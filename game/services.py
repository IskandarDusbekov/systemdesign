"""
7-QADAM. XIZMATLAR QATLAMI (baza ↔ dvigatel).

views.py faqat shu funksiyalarni chaqiradi. Bu yerda:
  * xonalar: ro'yxat, yaratish (senariy / bo'sh), almashtirish, nomlash, o'chirish;
  * bloklar: qo'shish (avtomatik serverga joylash), ko'chirish, sozlash, o'chirish;
  * serverlar: IP berish, blokni boshqa serverga ko'chirish;
  * strelkalar: qoida tekshiruvi (sabab + oqibat bilan rad etish);
  * kod: settings.py / views.py / .env / .gitignore, SECRET_KEY almashtirish;
  * Git: har o'zgarish — kommit (diff bilan);
  * kunlar: o'sish simulyatsiyasi.
"""

import difflib
import hashlib
import random

from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

import re

from . import business, growth, catalog, engine, guide, launch, project, rules, scenario
from .models import Block, Commit, Connection, Room

LAYOUT_VERSION = 3          # eski xonalar yangilanadi (upgrade_room)


class GameError(Exception):
    """O'yinchiga ko'rsatiladigan xato. `effect` — real hayotda nima bo'lardi."""

    def __init__(self, message, effect=""):
        super().__init__(message)
        self.effect = effect


# ---------------------------------------------------------------------------
# Xonalar
# ---------------------------------------------------------------------------
def get_room():
    """Hozir ochiq xona. Hech narsa bo'lmasa — senariy xonasi yaratiladi."""
    for old in Room.objects.exclude(flags__version=LAYOUT_VERSION):
        upgrade_room(old)
    room = Room.objects.filter(active=True).first() or Room.objects.first()
    if room is None:
        room = create_room("scenario")
    if not room.active:
        Room.objects.update(active=False)
        room.active = True
        room.save(update_fields=["active"])
    return room


def upgrade_room(room):
    """v1 (juda eski) — o'chiriladi; v2 — yangi maydonlar qo'shiladi."""
    if (room.flags or {}).get("version") != 2:
        room.delete()
        return
    flags = dict(room.flags)
    flags["version"] = LAYOUT_VERSION
    if room.kind == "scenario":
        srv = room.blocks.filter(kind="server").first()
        flags["launch"] = {**scenario.SCENARIO_START["launch"], "dns": srv.id if srv else None}
    else:
        flags["launch"] = {}
    room.flags = flags
    room.env = {**catalog.new_env(), **room.env}
    room.code = catalog.clean_code({}, room.code)
    room.schema = project.default_schema(room.kind)
    room.schema["applied"] = room.schema["migrations"][-1]["name"] if room.schema["migrations"] else None
    room.save()
    ensure_scenario_payment(room)


def ensure_scenario_payment(room):
    """Senariy xonasida daromad To'lov shlyuzi orqali keladi — eski xonalarga qo'shib qo'yamiz."""
    if room.kind != "scenario" or room.blocks.filter(kind="payment").exists():
        return
    pay = Block.objects.create(room=room, kind="payment", name="payment", x=600, y=300,
                               config=catalog.default_config("payment"))
    app = room.blocks.filter(kind="app").first()
    if app:
        Connection.objects.create(room=room, source=app, target=pay)


@transaction.atomic
def create_room(kind, name=None, biz=None, invest=0, coins=None):
    """Yangi startup. Balans umumiy: yangi startup yangi pul bermaydi — hamma xarajat bitta hamyondan."""
    start = (scenario.SCENARIO_START if kind == "scenario" else
             scenario.STARTER_START if kind == "starter" else scenario.SANDBOX_START)
    other = Room.objects.order_by("id").first()
    if coins is None:
        coins = other.coins if other else start["coins"]
    Room.objects.update(active=False)
    room = Room.objects.create(
        name=(name or start["name"]).strip()[:80] or start["name"], kind=start["kind"], active=True,
        users=start["users"], coins=coins, power_limit_w=start["power_limit_w"],
        seed=random.randint(1, 10_000), code=catalog.default_code(), env=catalog.new_env(),
        flags={"version": LAYOUT_VERSION, "max_users": start["users"], "launch": {},
               "last_tick": timezone.now().isoformat(), "hour": 8,
               "business": "saas" if kind == "scenario" else (biz if biz in business.BUSINESSES else "shop")},
        schema=project.default_schema(start["kind"]),
    )
    refs = {}
    for s in start["servers"]:
        cfg = catalog.clean_config("server", {"tier": s["tier"]})
        srv = Block.objects.create(room=room, kind="server", name=_next_name(room, "server"),
                                   x=s["x"], y=s["y"], config=cfg)
        srv.ip = _ip_for(room, srv)
        srv.save(update_fields=["ip"])
        refs[s["ref"]] = srv
    by_kind = {}
    for kind_, host_ref, x, y, cfg in start["blocks"]:
        b = Block.objects.create(room=room, kind=kind_, name=_next_name(room, kind_),
                                 host=refs.get(host_ref), x=x, y=y,
                                 config=catalog.clean_config(kind_, cfg))
        by_kind[kind_] = b
    for src, dst in start["edges"]:
        Connection.objects.create(room=room, source=by_kind[src], target=by_kind[dst])

    la = dict(start["launch"])
    if "dns" in la:
        la["dns"] = refs[la["dns"]].id
    room.flags = {**room.flags, "launch": la}
    if la.get("deployed") and room.schema["migrations"]:
        room.schema["applied"] = room.schema["migrations"][-1]["name"]
    room.save(update_fields=["flags", "schema"])

    # Git tarixining boshi: loyiha yaratildi. Senariyda .env ham "adashib" kommit qilingan —
    # Git darsi uchun: keyin o'chirilsa ham tarixda qoladi.
    _commit(room, "loyiha yaratildi", "config/settings.py", [], file_lines(room, "config/settings.py"))
    if room.kind == "scenario":
        _commit(room, "env qo'shildi", ".env", [], file_lines(room, ".env"))
        for mig in room.schema["migrations"]:
            _commit(room, f"makemigrations: {mig['name']}", f"app/migrations/{mig['name']}.py", [], mig["lines"])
    return room


def list_rooms():
    return [{"id": r.id, "name": r.name, "kind": r.kind, "day": r.day, "users": r.users,
             "active": r.active} for r in Room.objects.all()]


def switch_room(room_id):
    room = Room.objects.filter(pk=room_id).first()
    if not room:
        raise GameError("Bunday xona yo'q.")
    Room.objects.update(active=False)
    room.active = True
    room.save(update_fields=["active"])
    sync(room)
    return room


def rename_room(room, name):
    name = (name or "").strip()[:80]
    if not name:
        raise GameError("Xona nomi bo'sh bo'lmasin.")
    room.name = name
    room.save(update_fields=["name"])
    return room


def delete_room(room):
    room.delete()
    return get_room()


def reset_room(room):
    kind, name, biz, coins = room.kind, room.name, business_of(room), room.coins
    room.delete()
    return create_room(kind, name, biz, coins=coins)      # balans umumiy — qayta boshlash pul bermaydi


# ---------------------------------------------------------------------------
# Yordamchilar: nom, IP, layout
# ---------------------------------------------------------------------------
def _next_name(room, kind):
    base = {"server": "srv", "app": "app", "postgres": "db", "replica": "replica",
            "worker": "worker", "nginx": "nginx", "lb": "lb", "redis": "redis"}.get(kind, kind)
    n = room.blocks.filter(kind=kind).count() + 1
    return f"{base}-{n}"


def _ip_for(room, server):
    """Server IP si: ochiq bo'lsa hujjat diapazoni 203.0.113.x, aks holda ichki 10.0.0.x."""
    taken = set(room.blocks.filter(kind="server").exclude(pk=server.pk).values_list("ip", flat=True))
    public = server.config.get("public", True)
    for n in range(10, 250):
        ip = f"203.0.113.{n}" if public else f"10.0.0.{n}"
        if ip not in taken:
            return ip
    return ""


def business_of(room):
    """Xona biznesi. Eski xonalar: senariy — SaaS (SmetaPro), qolganlari — do'kon."""
    key = (room.flags or {}).get("business")
    if key in business.BUSINESSES:
        return key
    return "saas" if room.kind == "scenario" else "shop"


def offers_of(room):
    return (room.flags or {}).get("offers") or business.default_offers(business_of(room))


@transaction.atomic
def save_offers(room, offers):
    try:
        clean = business.clean_offers(business_of(room), offers)
    except ValueError as e:
        raise GameError(str(e))
    old = {o["name"]: o for o in offers_of(room)}
    changes = [f"{o['name']}: ${old[o['name']]['price']} → ${o['price']}" for o in clean
               if o["name"] in old and old[o["name"]]["price"] != o["price"]]
    room.flags = {**room.flags, "offers": clean}
    room.save(update_fields=["flags"])
    return "Narxlar saqlandi" + (": " + ", ".join(changes) if changes else "")


def layout_of(room):
    blocks, hosts = {}, {}
    for b in room.blocks.all():
        blocks[b.id] = {"kind": b.kind, "host": b.host_id, "config": b.config, "name": b.name}
        if b.kind == "server":
            hosts[b.id] = {"tier": b.config.get("tier", "orta"), "config": b.config}
    edges = {(c.source_id, c.target_id) for c in room.connections.all()}
    la = dict((room.flags or {}).get("launch", {}))
    schema = room.schema or {}
    migs = schema.get("migrations", [])
    la["pending_migration"] = bool(la.get("deployed") and migs and schema.get("applied") != migs[-1]["name"])
    key = business_of(room)
    biz = business.BUSINESSES[key]
    mods = growth.modifiers(room.flags or {})
    la.update(business=key, offers=offers_of(room), traffic=biz["traffic"] * mods["traffic"],
              growth=biz["growth"] + mods["growth"], bot_growth=biz["bot_growth"], demand=mods["demand"],
              market=biz["market"], suspended=bool((room.flags or {}).get("suspended")),
              neglected=bool((room.flags or {}).get("neglected")),
              sms="sms" in (room.flags or {}).get("upgrades", []),
              db_load=project.db_load(schema.get("models", [])))
    return engine.Layout(power_limit_w=room.power_limit_w, blocks=blocks, edges=edges,
                         hosts=hosts, code=room.code, env=room.env, launch=la)


# ---------------------------------------------------------------------------
# Loyiha fayllari (Kod bo'limi) — kontekst va matn
# ---------------------------------------------------------------------------
def code_context(room):
    """Fayl shablonlaridagi [[kalit]] lar uchun qiymatlar."""
    kinds = set(room.blocks.values_list("kind", flat=True))
    la = (room.flags or {}).get("launch", {})
    dns = room.blocks.filter(pk=la.get("dns")).first() if la.get("dns") else None
    srv = dns or room.blocks.filter(kind="server").first()
    bot = room.blocks.filter(kind="tgbot").first()
    slug = re.sub(r"[^a-z0-9]+", "", room.name.lower()) or "sayt"
    models = (room.schema or {}).get("models", [])
    return {
        "project": slug,
        "domain": la.get("domain") or "localhost",
        "scheme": "https" if la.get("ssl") else "http",
        "ssl": bool(la.get("ssl")),
        "repo": la.get("repo") or f"men/{slug}",
        "server_ip": srv.ip if srv else "0.0.0.0",
        "has_worker": "worker" in kinds, "has_redis": "redis" in kinds, "has_bot": "tgbot" in kinds,
        "has_auth": "auth" in kinds,
        "auth_method": (room.blocks.filter(kind="auth").first().config.get("method", "email")
                        if "auth" in kinds else "email"),
        "auth_placeholder": ("+998 90 123 45 67" if "auth" in kinds and
                             room.blocks.filter(kind="auth").first().config.get("method") == "sms" else "email@misol.uz"),
        "has_payment": "payment" in kinds, "has_replica": "replica" in kinds, "has_pgbouncer": "pgbouncer" in kinds,
        "bot_mode": bot.config.get("mode", "polling") if bot else "polling",
        "bot_webhook": bool(bot and bot.config.get("mode") == "webhook"),
        "models_code": project.models_code(models),
        "admin_code": project.admin_code(models, (room.schema or {}).get("admin")),
    }


def _values(room, code=None):
    return {**(code if code is not None else room.code), **code_context(room)}


def file_lines(room, path, code=None, env=None):
    f = project.FILE_INDEX[path]
    return project.render(f["lines"], catalog.CODE_FIELDS, _values(room, code), env or room.env)


def _block(room, pk):
    b = room.blocks.filter(pk=pk).first()
    if not b:
        raise GameError("Blok topilmadi.")
    return b


def _commit(room, message, file, old_lines, new_lines):
    diff = [line for line in difflib.unified_diff(old_lines, new_lines, lineterm="", n=1)
            if not line.startswith(("---", "+++", "@@"))]
    if old_lines and not diff:
        return None
    if not old_lines:
        diff = ["+" + line for line in new_lines]
    sha = hashlib.sha1(f"{room.id}{room.day}{message}{random.random()}".encode()).hexdigest()[:7]
    return Commit.objects.create(room=room, day=room.day, sha=sha, message=message, file=file, diff=diff)


def _fits(room, kind, config, host, exclude_id=None):
    """Blok shu serverga sig'adimi (CPU/RAM) va elektr limiti yetadimi."""
    lay = layout_of(room)
    if exclude_id:
        lay.blocks.pop(exclude_id, None)
    tmp = -1
    lay.blocks[tmp] = {"kind": kind, "host": host.id if host else None, "config": config, "name": ""}
    if kind == "server":
        lay.hosts[tmp] = {"tier": config.get("tier"), "config": config}
    res = engine.resources(lay)
    if host:
        h = res["hosts"][host.id]
        if h["over_cpu"] or h["over_ram"]:
            return False, (f"{host.name} ({host.ip}) ga sig'maydi: CPU {h['cpu_used']}/{h['cpu_total']}, "
                           f"RAM {h['ram_used']}/{h['ram_total']} MB.")
    return True, ""


# ---------------------------------------------------------------------------
# Bloklar
# ---------------------------------------------------------------------------
@transaction.atomic
def add_block(room, kind, x, y, host_id=None):
    spec = catalog.BLOCKS.get(kind)
    if not spec or spec.get("fixed"):
        raise GameError("Bu blokni qo'shib bo'lmaydi.")
    if room.blocks.filter(kind=kind).count() >= spec["max_count"]:
        raise GameError(f"{spec['title']} — ko'pi bilan {spec['max_count']} ta.")
    cost = spec.get("cost", 0)
    if kind == "server":
        cost = catalog.SERVER_TIERS["orta"]["rent"]
    if room.coins < cost:
        raise GameError(f"Pul yetmaydi: ${cost} kerak, sizda {room.coins:.0f}.")
    config = catalog.default_config(kind)

    host = None
    if rules.needs_host(kind, spec):
        servers = list(room.blocks.filter(kind="server"))
        if host_id:
            servers = [s for s in servers if s.id == int(host_id)]
        if not servers:
            raise GameError("Avval Server qo'shing — xizmatlar serverda ishlaydi.")
        reasons = []
        for s in servers:
            ok, why = _fits(room, kind, config, s)
            if ok:
                host = s
                break
            reasons.append(why)
        if host is None:
            raise GameError(reasons[0] + " Kattaroq server tanlang yoki yangi server qo'shing.")
    else:
        ok, why = _fits(room, kind, config, None)
        if not ok:
            raise GameError(why)

    b = Block.objects.create(room=room, kind=kind, name=_next_name(room, kind), host=host,
                             x=int(x), y=int(y), config=config)
    if kind == "server":
        b.ip = _ip_for(room, b)
        b.save(update_fields=["ip"])
    room.coins -= cost
    room.save(update_fields=["coins"])
    where = f" → {host.name} ({host.ip})" if host else (f" · IP {b.ip}" if b.ip else "")
    _commit(room, f"{spec['title']} qo'shildi{where}", catalog.BLOCK_CODE.get(kind, {}).get("file", kind),
            [], catalog.render_code(kind, config))
    return b


def move_block(room, pk, x, y):
    b = _block(room, pk)
    b.x, b.y = int(x), int(y)
    b.save(update_fields=["x", "y"])


@transaction.atomic
def update_config(room, pk, data):
    b = _block(room, pk)
    new = catalog.clean_config(b.kind, {**b.config, **data})
    if new == b.config:
        return b
    if b.kind == "server" and new.get("tier") != b.config.get("tier"):
        old_t, new_t = catalog.SERVER_TIERS[b.config.get("tier", "orta")], catalog.SERVER_TIERS[new["tier"]]
        extra = max(0, new_t["rent"] - old_t["rent"])
        if room.coins < extra:
            raise GameError(f"Pul yetmaydi: ${extra} kerak.")
        lay = layout_of(room)
        lay.hosts[b.id] = {"tier": new["tier"], "config": new}
        h = engine.resources(lay)["hosts"][b.id]
        if h["over_cpu"] or h["over_ram"]:
            raise GameError(f"{new_t['title']} ga ichidagi xizmatlar sig'maydi "
                            f"(CPU {h['cpu_used']}/{h['cpu_total']}, RAM {h['ram_used']}/{h['ram_total']}).")
        room.coins -= extra
        room.save(update_fields=["coins"])
    elif b.kind != "server":
        ok, why = _fits(room, b.kind, new, b.host, exclude_id=b.id)
        if not ok:
            raise GameError(why)
    old_lines = catalog.render_code(b.kind, b.config)
    public_changed = b.kind == "server" and new.get("public") != b.config.get("public")
    b.config = new
    if public_changed:
        b.ip = _ip_for(room, b)
    b.save(update_fields=["config", "ip"])
    _commit(room, f"{b.name}: sozlama o'zgardi", catalog.BLOCK_CODE.get(b.kind, {}).get("file", b.kind),
            old_lines, catalog.render_code(b.kind, new))
    return b


@transaction.atomic
def set_host(room, pk, host_id):
    b = _block(room, pk)
    if not rules.needs_host(b.kind, catalog.BLOCKS[b.kind]):
        raise GameError("Bu blok serverga joylanmaydi.")
    host = room.blocks.filter(pk=host_id, kind="server").first() if host_id else None
    if host_id and not host:
        raise GameError("Bunday server yo'q.")
    if host:
        ok, why = _fits(room, b.kind, b.config, host, exclude_id=b.id)
        if not ok:
            raise GameError(why)
    b.host = host
    b.save(update_fields=["host"])
    if host:
        _commit(room, f"{b.name} → {host.name} ({host.ip}) ga ko'chirildi", "deploy.yml", [], [])
    return b


def rename_block(room, pk, name):
    b = _block(room, pk)
    name = (name or "").strip()[:40]
    if name:
        b.name = name
        b.save(update_fields=["name"])
    return b


@transaction.atomic
def delete_block(room, pk):
    b = _block(room, pk)
    if catalog.BLOCKS[b.kind].get("fixed"):
        raise GameError("Foydalanuvchilar blokini o'chirib bo'lmaydi.")
    if b.kind == "server" and b.services.exists():
        names = ", ".join(s.name for s in b.services.all()[:4])
        raise GameError(f"Serverda xizmatlar ishlayapti ({names}). Avval ularni boshqa serverga ko'chiring yoki o'chiring.",
                        "Server o'chsa — undagi hamma xizmat ham o'chadi va sayt qulaydi.")
    _commit(room, f"{b.name} o'chirildi", catalog.BLOCK_CODE.get(b.kind, {}).get("file", b.kind),
            catalog.render_code(b.kind, b.config), [])
    b.delete()


# ---------------------------------------------------------------------------
# Strelkalar
# ---------------------------------------------------------------------------
def connect(room, source_id, target_id):
    src, dst = _block(room, source_id), _block(room, target_id)
    if src.id == dst.id:
        raise GameError("Blok o'ziga ulanmaydi.")
    if Connection.objects.filter(source=src, target=dst).exists():
        raise GameError("Bu strelka allaqachon bor.")
    if Connection.objects.filter(source=dst, target=src).exists():
        raise GameError("Teskari strelka bor — trafik aylanib qoladi.", "So'rov cheksiz aylanib, server qotadi.")
    existing = set(Connection.objects.filter(source=src).values_list("target__kind", flat=True))
    ok, reason, effect = rules.can_connect(src.kind, dst.kind, existing)
    if not ok:
        raise GameError(reason, effect)
    c = Connection.objects.create(room=room, source=src, target=dst)
    _commit(room, f"{src.name} → {dst.name} ulandi", "upstream.conf", [], [f"{src.name} -> {dst.name}"])
    return c


def disconnect(room, pk):
    c = room.connections.filter(pk=pk).first()
    if not c:
        raise GameError("Strelka topilmadi.")
    _commit(room, f"{c.source.name} → {c.target.name} uzildi", "upstream.conf",
            [f"{c.source.name} -> {c.target.name}"], [])
    c.delete()


# ---------------------------------------------------------------------------
# Kod, .env, sirlar
# ---------------------------------------------------------------------------
@transaction.atomic
def update_code(room, data):
    new = catalog.clean_code(data, room.code or {})
    if new == room.code:
        return room
    old = room.code
    for f in project.FILES:
        if f["path"] == ".env" or "{" not in "".join(f["lines"]):
            continue
        _commit(room, f"{f['path']} tahrirlandi", f["path"],
                file_lines(room, f["path"], old), file_lines(room, f["path"], new))
    room.code = new
    flags = dict(room.flags)
    if not new.get("debug"):
        flags["debug_fixed"] = True
    if new.get("secret_source") == "env" and new.get("env_gitignored"):
        flags["secret_moved"] = True
    room.flags = flags
    room.save(update_fields=["code", "flags"])
    return room


@transaction.atomic
def rotate_env(room, key=None):
    """Sirni almashtirish: eski kalit endi hech narsani ochmaydi (Git tarixida qolgan bo'lsa ham)."""
    fresh = catalog.new_env()
    env = dict(room.env)
    keys = [key] if key in env else list(env)
    for k in keys:
        env[k] = fresh[k]
    old_lines = file_lines(room, ".env")
    room.env = env
    flags = dict(room.flags)
    if "SECRET_KEY" in keys:
        flags["rotated"] = True
    room.flags = flags
    room.save(update_fields=["env", "flags"])
    # Haqiqiy loyihada .env kommit qilinmaydi — bu yerda faqat qaysi qator o'zgargani yoziladi
    msg = f"kalit almashtirildi: {', '.join(keys)}"
    if room.code.get("env_gitignored"):
        _commit(room, msg + " (.env Git'da emas)", ".gitignore", [], [])
    else:
        _commit(room, msg, ".env", old_lines, file_lines(room, ".env", env=env))
    return room


# ---------------------------------------------------------------------------
# Elektr va kunlar
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Real vaqt: har so'rovda o'tgan vaqt hisoblanadi (o'yinchi yo'qligida ham)
# ---------------------------------------------------------------------------
HOUR_SECONDS = engine.GAME_DAY_SECONDS / engine.HOURS
STATUS_RANK = {"green": 0, "yellow": 1, "red": 2, "down": 3}


def sync(room, now=None):
    """Oxirgi hisobdan beri o'tgan o'yin soatlarini qo'llaydi. Uzoq yo'qlik — xulosa (room._away)."""
    now = now or timezone.now()
    flags = dict(room.flags or {})
    last = flags.get("last_tick")
    room._events, room._away = [], None
    if not last:
        flags["last_tick"] = now.isoformat()
        room.flags = flags
        room.save(update_fields=["flags"])
        return
    last_dt = datetime.fromisoformat(last)
    hours = int((now - last_dt).total_seconds() // HOUR_SECONDS)
    if hours <= 0:
        return
    cap = engine.MAX_CATCHUP_DAYS * engine.HOURS
    summary = advance_hours(room, min(hours, cap), neglect_after=engine.OWNER_AWAY_DAYS * engine.HOURS)
    flags = dict(room.flags)
    flags["last_tick"] = (now if hours > cap else last_dt + timedelta(seconds=hours * HOUR_SECONDS)).isoformat()
    room.flags = flags
    room.save(update_fields=["flags"])
    room._events = summary["events"]
    if hours >= 3:                         # 3 o'yin soatidan ko'p — "siz yo'qligingizda" oynasi
        summary["capped"] = hours > cap
        room._away = summary


def advance_hours(room, n, neglect_after=None):
    """n o'yin soati: soatma-soat pul va mijozlar, kun oxirida tarix, hodisalar."""
    flags = dict(room.flags or {})
    users_f = float(flags.get("users_f") or room.users)
    if abs(users_f - room.users) > 1:
        users_f = float(room.users)
    hour = int(flags.get("hour", 0))
    acc = dict(flags.get("acc") or {})
    start = {"users": room.users, "coins": room.coins, "day": room.day, "hour": hour}
    kassa = float(flags.get("kassa", 0))
    floor = min(room.users, 10)
    events, tot_rev, tot_cost, suspended_at = [], 0.0, 0.0, None
    lay = layout_of(room)
    m = None
    for i in range(n):
        if neglect_after is not None and i >= neglect_after and not room.flags.get("neglected") \
                and (room.flags.get("launch") or {}).get("deployed"):
            # egasi uzoq kirmadi: yangilanish, sertifikat, disk — hech kim qaramadi → sayt to'xtadi
            room.flags = {**room.flags, "neglected": True}
            events.append(f"⚠ Siz {engine.OWNER_AWAY_DAYS} kundan beri kirmadingiz (Kun {room.day}, {hour:02d}:00): "
                          "sayt to'xtab qoldi — hech kim tekshirmadi. Server ijarasi esa to'lanib turibdi. Qayta ishga tushiring.")
            lay = layout_of(room)
        suspended = bool(room.flags.get("suspended"))
        m = engine.evaluate(lay, round(users_f), traffic_factor=engine.traffic_factor_for(room.seed, room.day))
        h = engine.hour_step(lay, users_f, m, suspended)
        users_f = h["users"]
        # mijoz to'lovlari To'lov shlyuzi kassasida yig'iladi — egasi yechib olmaguncha balansga tushmaydi
        kassa += h["sales"]
        room.coins = round(room.coins + h["revenue"] - h["sales"] - h["cost"], 2)
        tot_rev += h["revenue"]
        tot_cost += h["cost"]
        for k in ("revenue", "cost", "orders", "cogs", "ads"):
            acc[k] = acc.get(k, 0) + h[k]
        acc["p95"] = max(acc.get("p95", 0), m["p95_ms"])
        acc["err"] = max(acc.get("err", 0), m["error_rate"])
        if STATUS_RANK[m["status"]] >= STATUS_RANK.get(acc.get("status", "green"), 0):
            acc["status"] = m["status"]
        if room.coins < 0 and not suspended:
            # bankrot o'rniga: hosting serverlarni to'xtatadi, qarz o'smaydi
            room.coins = 0.0
            suspended_at = f"Kun {room.day}, {hour:02d}:00"
            room.flags = {**room.flags, "suspended": True, "suspended_at": suspended_at}
            events.append(f"⛔ Balans tugadi ({suspended_at}): hosting serverlarni to'xtatdi. Sayt ishlamayapti, "
                          "lekin xarajat ham to'xtadi. Xarajatni kamaytiring va serverlarni qayta yoqing.")
            lay = layout_of(room)
        hour += 1
        if hour >= engine.HOURS:
            hour = 0
            entry = {"day": room.day, "users": round(users_f), "p95_ms": round(acc.get("p95", 0)),
                     "error_rate": round(acc.get("err", 0), 4), "status": acc.get("status", "green"),
                     "revenue": round(acc.get("revenue", 0), 1), "cost": round(acc.get("cost", 0), 1),
                     "coins": round(room.coins, 1), "bottleneck": m["bottleneck_kind"],
                     "orders": round(acc.get("orders", 0)), "cogs": round(acc.get("cogs", 0), 1),
                     "ads": round(acc.get("ads", 0), 1)}
            room.history = (room.history + [entry])[-60:]
            room.day += 1
            room.users = max(floor, round(users_f))
            fl = dict(room.flags)
            fl["max_users"] = max(fl.get("max_users", 0), room.users)
            if entry["revenue"] > 0:
                fl["paid_once"] = True
            fl["max_coins"] = max(fl.get("max_coins", 0), room.coins)
            fl["max_net"] = max(fl.get("max_net", 0), round(entry["revenue"] - entry["cost"], 1))
            room.flags = fl
            before = room.users
            events += _advance_effects(room, m)
            if room.users != before:          # hodisa mijozlarni kamaytirdi
                users_f = float(room.users)
            acc = {}
            lay = layout_of(room)
    room.users = max(floor, round(users_f))
    room.neg_streak = 0
    room.flags = {**room.flags, "users_f": users_f, "hour": hour, "acc": acc, "kassa": round(kassa, 2)}
    room.save()
    return {"hours": n, "from": start, "to": {"users": room.users, "coins": room.coins, "day": room.day, "hour": hour},
            "revenue": round(tot_rev, 1), "cost": round(tot_cost, 1), "net": round(tot_rev - tot_cost, 1),
            "events": events, "suspended_at": suspended_at,
            "kassa": round(kassa - float(flags.get("kassa", 0)), 1)}


@transaction.atomic
def withdraw(room):
    """To'lov shlyuzi kassasidagi pulni balansga yechib olish."""
    kassa = float((room.flags or {}).get("kassa", 0))
    if kassa < 0.01:
        raise GameError("Kassa bo'sh — hali to'lov tushmagan.",
                        "Mijozlar xarid qilganda pul avval To'lov shlyuzida (Payme/Click/Stripe) yig'iladi.")
    room.coins = round(room.coins + kassa, 2)
    room.flags = {**room.flags, "kassa": 0}
    room.save(update_fields=["coins", "flags"])
    return f"Kassadan ${kassa:.2f} balansga yechib olindi"


@transaction.atomic
def resume(room):
    """To'xtatilgan serverlarni qayta yoqish."""
    if not (room.flags or {}).get("suspended") and not (room.flags or {}).get("neglected"):
        raise GameError("Serverlar allaqachon ishlayapti.")
    room.flags = {**room.flags, "suspended": False, "neglected": False}
    room.save(update_fields=["flags"])
    lay = layout_of(room)
    m = engine.evaluate(lay, room.users, traffic_factor=engine.traffic_factor_for(room.seed, room.day))
    f = engine.finance(lay, room.users, m, room.coins)
    if f["net"] < 0:
        hours = int(room.coins / (-f["net"] / engine.HOURS)) if room.coins > 0 else 0
        return (f"Serverlar yoqildi, lekin zarar: {f['net']:+.1f}$/kun — balans taxminan {hours} o'yin soatida yana tugaydi. "
                "Server turini kichraytiring yoki keraksiz bloklarni o'chiring.")
    return f"Serverlar yoqildi ✓ Sof foyda: +${f['net']:.1f}/kun"


def _advance_effects(room, m):
    """Kun yakuni: kampaniya va hodisalar muddati, yangi tasodifiy hodisa."""
    flags = dict(room.flags)
    out = []
    bad = m["status"] in ("red", "down")
    camps = []
    for c in flags.get("campaigns", []):
        spec = growth.MARKETING[c["id"]]
        if bad and not c.get("wasted"):
            out.append(f"⚠ {spec['title']}: reklama puli havoga — mijozlar kelib, sekin/xato sayt ko'rdi.")
            c = {**c, "wasted": True}
        if c["days_left"] > 1:
            camps.append({**c, "days_left": c["days_left"] - 1})
    flags["campaigns"] = camps
    flags["effects"] = [{**e, "days_left": e["days_left"] - 1} for e in flags.get("effects", []) if e["days_left"] > 1]

    la = flags.get("launch", {})
    ev = growth.roll_event(room.seed, room.day, bool(la.get("domain") and la.get("deployed")))
    if ev:
        spec = growth.EVENTS[ev]
        ups = flags.get("upgrades", [])
        text = f"{spec['title']} {spec['text']}"
        if ev == "disk":
            if "backup" in ups:
                text = f"{spec['title']} 💾 Zaxira nusxadan tiklandi — deyarli hech narsa yo'qolmadi (−$30 ta'mir)."
                room.users, room.coins = round(room.users * 0.98), round(room.coins - 30, 1)
            else:
                text = f"{spec['title']} Zaxira yo'q edi: ma'lumotlar yo'qoldi, mijozlarning 25% ketdi, ta'mir −$100."
                room.users, room.coins = round(room.users * 0.75), round(room.coins - 100, 1)
        elif ev == "outage":
            if "monitoring" in ups:
                text = f"{spec['title']} 📟 Monitoring darhol xabar berdi — 10 daqiqada tiklandi (mijozlar −3%)."
                room.users = round(room.users * 0.97)
            else:
                text = f"{spec['title']} Hech kim sezmadi — sayt 6 soat ishlamadi (mijozlar −12%, −$50)."
                room.users, room.coins = round(room.users * 0.88), round(room.coins - 50, 1)
        else:
            flags["effects"] = flags["effects"] + [{"id": ev, "title": spec["title"], "days_left": spec["days"],
                                                    "traffic": spec["traffic"], "demand": spec["demand"], "growth": spec["growth"]}]
        flags["events_seen"] = flags.get("events_seen", 0) + 1
        flags["event_log"] = (flags.get("event_log", []) + [{"day": room.day, "text": text, "good": spec["good"]}])[-12:]
        out.append(text)
    room.flags = flags
    return out


@transaction.atomic
def buy_growth(room, kind, item):
    """Marketing kampaniyasi yoki yangi imkoniyat sotib olish."""
    flags = dict(room.flags)
    if kind == "campaign":
        spec = growth.MARKETING.get(item)
        if not spec:
            raise GameError("Bunday kampaniya yo'q.")
        if any(c["id"] == item for c in flags.get("campaigns", [])):
            raise GameError(f"{spec['title']} allaqachon ketyapti.")
        la = flags.get("launch", {})
        if not (la.get("domain") and la.get("deployed")):
            raise GameError("Sayt hali internetda emas — reklama qilinsa ham hech kim kira olmaydi. Avval 🚀 qadamlar.",
                            "Real hayotda: reklama puli ketadi, odamlar ishlamaydigan saytga tushadi.")
    elif kind == "upgrade":
        spec = growth.UPGRADES.get(item)
        if not spec:
            raise GameError("Bunday imkoniyat yo'q.")
        if item in flags.get("upgrades", []):
            raise GameError(f"{spec['title']} allaqachon bor.")
        if spec.get("needs") and not room.blocks.filter(kind=spec["needs"]).exists():
            need = catalog.BLOCKS[spec["needs"]]["title"]
            raise GameError(f"{spec['title']} uchun doskada '{need}' bloki kerak.",
                            "Bildirishnomalar fon ishchisi orqali yuboriladi — usiz sayt sekinlashadi.")
    else:
        raise GameError("Noma'lum amal.")
    if room.coins < spec["cost"]:
        raise GameError(f"Pul yetmaydi: ${spec['cost']} kerak, sizda ${room.coins:.0f}.")
    room.coins = round(room.coins - spec["cost"], 1)
    if kind == "campaign":
        flags["campaigns"] = flags.get("campaigns", []) + [{"id": item, "days_left": spec["days"]}]
        flags["campaigns_run"] = flags.get("campaigns_run", 0) + 1
        msg = f"{spec['icon']} {spec['title']} boshlandi: {spec['days']} kun, −${spec['cost']}"
    else:
        flags["upgrades"] = flags.get("upgrades", []) + [item]
        msg = f"{spec['icon']} {spec['title']} qo'shildi, −${spec['cost']}"
    room.flags = flags
    room.save(update_fields=["coins", "flags"])
    return msg


def growth_state(room):
    f = room.flags or {}
    rooms = list(Room.objects.order_by("id").values("id", "name", "coins", "users", "flags"))
    return {
        "campaigns": f.get("campaigns", []), "upgrades": f.get("upgrades", []), "effects": f.get("effects", []),
        "event_log": f.get("event_log", []), "mods": growth.modifiers(f),
        "achievements": growth.achievements(room, f),
        "portfolio": {"total": round(room.coins, 1),
                      "rooms": [{"id": r["id"], "name": r["name"], "kassa": round(float((r["flags"] or {}).get("kassa", 0)), 1),
                                 "users": r["users"],
                                 "business": (r["flags"] or {}).get("business") or "", "active": r["id"] == room.id}
                                for r in rooms]},
    }


def upgrade_power(room):
    if room.coins < catalog.POWER_UPGRADE_COST:
        raise GameError(f"Pul yetmaydi: ${catalog.POWER_UPGRADE_COST} kerak.")
    room.coins -= catalog.POWER_UPGRADE_COST
    room.power_limit_w += catalog.POWER_UPGRADE_STEP_W
    room.save(update_fields=["coins", "power_limit_w"])


@transaction.atomic
def tick(room, days=1):
    """Vaqtni qo'lda surish (faqat testlar uchun): n kun = n×24 o'yin soati."""
    days = max(1, min(30, int(days)))
    return advance_hours(room, days * engine.HOURS)["events"]


# ---------------------------------------------------------------------------
# 🚀 Ishga tushirish: domen, GitHub, deploy, SSL
# ---------------------------------------------------------------------------
def launch_state(room, lay=None):
    la = (room.flags or {}).get("launch", {})
    has_server = room.blocks.filter(kind="server").exists()
    dns = room.blocks.filter(pk=la.get("dns")).first() if la.get("dns") else None
    return {
        "done": {"server": has_server, "domain": bool(la.get("domain")), "github": bool(la.get("github")),
                 "deploy": bool(la.get("deployed")), "ssl": bool(la.get("ssl"))},
        "domain": la.get("domain"), "dns": la.get("dns"), "dns_ip": dns.ip if dns else None,
        "repo": la.get("repo"), "pending_migration": bool(lay and lay.launch.get("pending_migration")),
    }


def _entry_hosts(room):
    """Nginx yoki Load Balancer turgan serverlar (domen va SSL shu serverga qarashi kerak)."""
    return set(room.blocks.filter(kind__in=["nginx", "lb"]).exclude(host=None).values_list("host_id", flat=True))


@transaction.atomic
def launch_step(room, step, data):
    la = dict((room.flags or {}).get("launch", {}))
    if step == "domain":
        name = str(data.get("name") or la.get("domain") or "").strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,30}\.(%s)" % "|".join(launch.DOMAIN_ZONES), name):
            raise GameError("Domen nomi noto'g'ri. Masalan: mydokon.uz (lotin harflar, raqam, '-').")
        srv = room.blocks.filter(pk=data.get("server") or 0, kind="server").first()
        if not srv:
            raise GameError("Domen qaysi serverga qarashini tanlang (A yozuvi = server IP).")
        if name != la.get("domain"):
            if room.coins < launch.DOMAIN_COST:
                raise GameError(f"Pul yetmaydi: domen ${launch.DOMAIN_COST}.")
            room.coins -= launch.DOMAIN_COST
            la["ssl"] = False          # sertifikat eski domenga berilgan edi
        old_ip = la.get("dns_ip")
        la.update(domain=name, dns=srv.id, dns_ip=srv.ip)
        _commit(room, f"DNS: {name} → {srv.ip} ({srv.name})", "DNS",
                [f"A  @  {old_ip}"] if old_ip else [], [f"A  @  {srv.ip}", f"A  www  {srv.ip}"])
        msg = f"{name} → {srv.ip}"
        if not srv.config.get("public", True):
            msg += " · diqqat: server ichki IP da!"
    elif step == "github":
        repo = str(data.get("repo", "")).strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,30}/[A-Za-z0-9_.-]{1,40}", repo):
            raise GameError("Repo nomi: foydalanuvchi/loyiha, masalan men/mydokon.")
        public = bool(data.get("public"))
        la.update(github=True, repo=repo)
        room.code = {**room.code, "repo_public": public}
        _commit(room, f"git push origin main → github.com/{repo} ({'ochiq' if public else 'yopiq'} repo)", "", [], [])
        msg = "Kod GitHub'ga yuklandi"
        if public and not room.code.get("env_gitignored"):
            msg += " · diqqat: .env ham ochiq repoga tushdi!"
    elif step == "deploy":
        if not la.get("github"):
            raise GameError("Avval kodni GitHub'ga yuklang — server kodni repodan tortib oladi.",
                            "Kodni qo'lda nusxalasangiz — serverda qaysi versiya turgani noma'lum bo'lib qoladi.")
        apps = list(room.blocks.filter(kind="app"))
        if not apps or not all(a.host_id for a in apps):
            raise GameError("Deploy uchun kamida bitta Sayt bloki kerak va u serverga joylangan bo'lishi kerak.")
        schema = dict(room.schema or {})
        if schema.get("migrations"):
            schema["applied"] = schema["migrations"][-1]["name"]
        room.schema = schema
        first = not la.get("deployed")
        la["deployed"] = True
        if first and room.users < 50:
            room.users = 50
            room.flags = {**room.flags, "users_f": float(50)}
        hosts = sorted({a.host.ip for a in apps})
        _commit(room, f"deploy: git pull + migrate + restart gunicorn ({', '.join(hosts)})", "deploy/deploy.sh", [], [])
        msg = "Deploy qilindi: kod serverda, migratsiyalar qo'llandi" + (" · 🎉 birinchi 50 foydalanuvchi keldi!" if first else "")
    elif step == "ssl":
        if not la.get("domain"):
            raise GameError("SSL sertifikat domenga beriladi — avval domen oling.")
        if la.get("dns") not in _entry_hosts(room):
            raise GameError("certbot --nginx sertifikatni Nginx'ga o'rnatadi, lekin domen qaragan serverda Nginx/LB yo'q.",
                            "Let's Encrypt domenni tekshira olmaydi: http://domen/.well-known/ manziliga javob kelmaydi.")
        la["ssl"] = True
        _commit(room, f"certbot --nginx -d {la['domain']} (Let's Encrypt, 90 kun, avto-yangilanadi)",
                "deploy/nginx.conf", [], ["listen 443 ssl;",
                                          f"ssl_certificate /etc/letsencrypt/live/{la['domain']}/fullchain.pem;"])
        msg = "HTTPS yoqildi"
    else:
        raise GameError("Noma'lum qadam.")
    room.flags = {**room.flags, "launch": la}
    room.save()
    return msg


# ---------------------------------------------------------------------------
# Model quruvchi
# ---------------------------------------------------------------------------
@transaction.atomic
def save_models(room, models):
    try:
        clean = project.clean_models(models)
    except project.SchemaError as e:
        raise GameError(str(e))
    old_code = project.models_code((room.schema or {}).get("models", []))
    schema, mig = project.apply_models(room.schema or {"models": [], "migrations": []}, clean)
    if not mig:
        return None
    room.schema = schema
    room.save(update_fields=["schema"])
    _commit(room, "app/models.py tahrirlandi", "app/models.py", old_code, project.models_code(clean))
    _commit(room, f"makemigrations: {mig}", f"app/migrations/{mig}.py", [], schema["migrations"][-1]["lines"])
    return mig


@transaction.atomic
def save_admin(room, raw):
    """Django admin sozlamalari (list_display, search_fields, list_filter) → app/admin.py."""
    schema = dict(room.schema or {})
    models = schema.get("models", [])
    if not models:
        raise GameError("Avval model yarating (Kod → app/models.py) — adminda ko'rsatadigan jadval yo'q.")
    old = project.admin_code(models, schema.get("admin"))
    schema["admin"] = project.clean_admin(models, raw)
    new = project.admin_code(models, schema["admin"])
    if new == old:
        return "O'zgarish yo'q"
    room.schema = schema
    room.save(update_fields=["schema"])
    _commit(room, "app/admin.py: admin panel sozlandi", "app/admin.py", old, new)
    return "Admin panel sozlandi · app/admin.py yangilandi (deploydan keyin serverda ko'rinadi)"


# ---------------------------------------------------------------------------
# Brauzerga yuboriladigan holat
# ---------------------------------------------------------------------------
def _finance_if_running(room, lay, m):
    """Moliya. Hosting to'xtagan bo'lsa — qayta yoqilganda qanday bo'lishini ko'rsatamiz."""
    if not lay.launch.get("suspended") and not lay.launch.get("neglected"):
        return engine.finance(lay, room.users, m, room.coins)
    lay2 = engine.Layout(power_limit_w=lay.power_limit_w, blocks=lay.blocks, edges=lay.edges, hosts=lay.hosts,
                         code=lay.code, env=lay.env, launch={**lay.launch, "suspended": False, "neglected": False})
    m2 = engine.evaluate(lay2, room.users, traffic_factor=engine.traffic_factor_for(room.seed, room.day))
    return {**engine.finance(lay2, room.users, m2, room.coins), "projected": True}


def snapshot(room):
    lay = layout_of(room)
    m = engine.evaluate(lay, room.users, traffic_factor=engine.traffic_factor_for(room.seed, room.day))
    cost, rent, power_cost = engine.daily_cost(lay)
    names = {b.id: b for b in room.blocks.all()}
    if not lay.launch.get("deployed") and m["status"] in ("down", "red"):
        m["status"], m["status_title"] = "idle", "Hali ishga tushmagan"
    kassa = float((room.flags or {}).get("kassa", 0))
    pay = next((b for b in names.values() if b.kind == "payment"), None)
    if pay and kassa >= 1:
        m["labels"][pay.id] = f"💰 kassa ${kassa:,.0f}"
    blocks = []
    for b in names.values():
        host = names.get(b.host_id)
        blocks.append({
            "id": b.id, "kind": b.kind, "name": b.name, "x": b.x, "y": b.y, "config": b.config,
            "ip": b.ip, "host": b.host_id,
            "host_name": f"{host.name} · {host.ip}" if host else None,
            "code": catalog.render_code(b.kind, b.config),
            "services": [s.id for s in names.values() if s.host_id == b.id],
        })
    return {
        "room": {"id": room.id, "name": room.name, "kind": room.kind, "day": room.day,
                 "users": room.users, "coins": room.coins, "power_limit_w": room.power_limit_w,
                 "neg_streak": room.neg_streak},
        "rooms": list_rooms(),
        "blocks": blocks,
        "connections": [{"id": c.id, "source": c.source_id, "target": c.target_id}
                        for c in room.connections.all()],
        "metrics": m,
        "cost": {"total": cost, "rent": rent, "power": power_cost},
        "finance": _finance_if_running(room, lay, m),
        "clock": {"day": room.day, "hour": (room.flags or {}).get("hour", 0),
                  "game_day_seconds": engine.GAME_DAY_SECONDS, "hour_seconds": HOUR_SECONDS,
                  "last_tick": (room.flags or {}).get("last_tick")},
        "suspended": bool((room.flags or {}).get("suspended")),
        "neglected": bool((room.flags or {}).get("neglected")),
        "kassa": round(float((room.flags or {}).get("kassa", 0)), 2),
        "admin": project.clean_admin((room.schema or {}).get("models", []), (room.schema or {}).get("admin")),
        "suspended_at": (room.flags or {}).get("suspended_at"),
        "away": getattr(room, "_away", None),
        "sync_events": getattr(room, "_events", []),
        "model_limits": {"models": project.MAX_MODELS, "fields": project.MAX_FIELDS,
                         "total": project.MAX_TOTAL_FIELDS, "fk": project.MAX_FK,
                         "db_load": project.db_load((room.schema or {}).get("models", []))},
        "model_templates": project.TEMPLATES.get(business_of(room), []),
        "business": {"key": business_of(room), "offers": offers_of(room)},
        "growth": growth_state(room),
        "advice": engine.advise(lay, m, room.users),
        "history": room.history,
        "goals": scenario.goals(room, lay),
        "commits": [{"sha": c.sha, "day": c.day, "message": c.message, "file": c.file, "diff": c.diff}
                    for c in room.commits.all()[:80]],
        "code": room.code,
        "env": room.env,
        "ctx": code_context(room),
        "schema": room.schema,
        "files": [f["path"] for f in project.visible_files(_values(room), room.schema or {})],
        "migrations": {f"app/migrations/{m['name']}.py": m["lines"] for m in (room.schema or {}).get("migrations", [])},
        "launch": launch_state(room, lay),
    }


def static_payload():
    return {"catalog": catalog.public_catalog(), "guide": guide.CHAPTERS,
            "scenario": {"title": scenario.TITLE, "intro": scenario.INTRO}}
