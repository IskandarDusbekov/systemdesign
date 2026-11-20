"""
3-QADAM. SIMULYATSIYA DVIGATELI.

"Toza" funksiyalar: baza bilan ishlamaydi, faqat hisoblaydi (tests.py ni qarang).

Model — bloklar grafi. Trafik Foydalanuvchilardan boshlanadi va bloklar bo'ylab oqadi.
Har bir blok "quvur", sig'imi bor:
    yuklama / sig'im = band bo'lish (rho, ρ)
    ρ<0.7 yashil · ρ~0.9 navbat cho'ziladi · ρ≥1 ortiqcha so'rovlar xato bo'ladi

Yangi imkoniyatlar:
  * bir nechta Server (host), har birida CPU/RAM; blok qaysi serverda ishlashi — host;
  * bir nechta Sayt (app) blok + Load Balancer: quvvat ularning yig'indisi;
  * ikki darajali resurs: CPU/RAM serverda, elektr (W) butun xonada.
"""

import random
from dataclasses import dataclass, field

from . import business, catalog, rules

# --- Trafik modeli ---------------------------------------------------------
REQ_PER_USER = 0.02
REPORT_SHARE = 0.05
LIGHT_COST_S = 0.06
REPORT_SYNC_S = 2.0
REPORT_ENQUEUE_S = 0.05
BLOCKED_IN_APP_S = 0.005
LIGHT_QUERIES = 3
REPORT_QUERIES = 10
REDIS_HIT = 0.7
REPLICA_READ_SHARE = 0.8
DB_QUERY_MS = 2
LOGIN_COST_S = 0.15        # parol xeshini tekshirish

# --- Iqtisod ---------------------------------------------------------------
REVENUE_PER_USER = 0.75     # faqat To'lov shlyuzi + HTTPS bo'lsa
AUTH_DEMAND = 1.10          # akkaunt bo'lsa mijozlar qaytib keladi: sotuv +10%
BOT_GROWTH = 0.02           # Telegram bot ishlasa — qo'shimcha o'sish / kun
BOT_REQ_PER_USER = 0.004
PENDING_MIGRATION_ERR = 0.2
GROWTH = {"green": 0.06, "yellow": 0.005, "red": -0.06, "down": -0.20}
STATUS_TITLE = {"green": "Yaxshi", "yellow": "O'rtacha", "red": "Yomon", "down": "Qulagan"}
BANKRUPT_DAYS = 3            # eski: endi bankrot yo'q, balans tugasa hosting to'xtaydi

# --- Vaqt: o'yin real vaqtda yuradi (o'yinchi yo'qligida ham)
GAME_DAY_SECONDS = 20 * 60   # 1 o'yin kuni = 20 real daqiqa (1 soat ≈ 50 soniya)
HOURS = 24
MAX_CATCHUP_DAYS = 7         # uzoq yo'qlikda ko'pi bilan 7 kun hisoblanadi
OWNER_AWAY_DAYS = 3          # egasi 3 o'yin kunidan ko'p kirmasa — sayt to'xtaydi (xarajat davom etadi)
SUSPENDED_GROWTH = -0.03     # hosting to'xtagan paytda mijozlar kuniga −3%
DEFAULT_MARKET = 20_000      # bozor hajmi: mijozlar shunga yaqinlashgani sari o'sish sekinlashadi


# ---------------------------------------------------------------------------
# Layout — xonaning "surati"
# ---------------------------------------------------------------------------
@dataclass
class Layout:
    power_limit_w: int
    blocks: dict                       # id -> {"kind","host","config","name"}
    edges: set                         # {(src_id, dst_id)}
    hosts: dict = field(default_factory=dict)   # id -> {"tier","config"}
    code: dict = field(default_factory=dict)
    env: dict = field(default_factory=dict)
    launch: dict = None        # 🚀 domen, dns, github, deploy, ssl (None = tekshirilmaydi, testlar uchun)

    def kind(self, bid):
        return self.blocks[bid]["kind"]

    def cfg(self, bid):
        return self.blocks[bid]["config"]

    def ids(self, kind):
        return [bid for bid, b in self.blocks.items() if b["kind"] == kind]

    def first(self, kind):
        ids = self.ids(kind)
        return ids[0] if ids else None

    def has(self, kind):
        return bool(self.ids(kind))

    def out(self, bid):
        return [d for s, d in self.edges if s == bid]

    def inc(self, bid):
        return [s for s, d in self.edges if d == bid]




# ---------------------------------------------------------------------------
# Resurslar: elektr xona bo'yicha, CPU/RAM esa server bo'yicha
# ---------------------------------------------------------------------------
def host_load(layout, host_id):
    """Shu serverdagi xizmatlar qancha CPU/RAM yeydi."""
    cpu = ram = 0.0
    for bid, b in layout.blocks.items():
        if b["host"] == host_id and not catalog.BLOCKS[b["kind"]].get("is_server"):
            c, r, _ = catalog.block_resources(b["kind"], b["config"])
            cpu += c
            ram += r
    return round(cpu, 2), ram


def host_speed(layout, host_id):
    """Server to'lib ketgan bo'lsa, undagi bloklar sekinlashadi (CPU) yoki swap (RAM)."""
    if host_id not in layout.hosts:
        return 1.0
    tier = catalog.SERVER_TIERS[layout.hosts[host_id]["config"].get("tier", "orta")]
    cpu, ram = host_load(layout, host_id)
    cpu_f = min(1.0, tier["cpu"] / cpu) if cpu else 1.0
    ram_f = 1.0 if ram <= tier["ram_mb"] else 0.6
    return round(cpu_f * ram_f, 3)


def resources(layout):
    power = 0
    hosts = {}
    for hid, h in layout.hosts.items():
        tier = catalog.SERVER_TIERS[h["config"].get("tier", "orta")]
        cpu, ram = host_load(layout, hid)
        power += tier["power_w"]
        hosts[hid] = {"cpu_used": cpu, "cpu_total": tier["cpu"],
                      "ram_used": ram, "ram_total": tier["ram_mb"],
                      "over_cpu": cpu > tier["cpu"], "over_ram": ram > tier["ram_mb"]}
    for bid, b in layout.blocks.items():
        spec = catalog.BLOCKS[b["kind"]]
        if not spec.get("is_server") and not spec.get("external"):
            _, _, p = catalog.block_resources(b["kind"], b["config"])
            power += p
    return {"power_used": round(power), "power_limit": layout.power_limit_w, "hosts": hosts}


def _wait(base, rho):
    return base / (1 - min(rho, 0.95))


def _err(rho):
    return max(0.0, 1 - 1 / rho) if rho > 1 else 0.0


def reachable_from_users(layout):
    """Foydalanuvchilardan trafik strelkalari bo'ylab yetib boriladigan bloklar."""
    u = layout.first("users")
    seen, stack = set(), ([u] if u else [])
    while stack:
        n = stack.pop()
        if n in seen:
            continue
        seen.add(n)
        for d in layout.out(n):
            stack.append(d)
    return seen


def _down_db(layout, app_id):
    """App blokidan to'g'ridan-to'g'ri yoki pgbouncer orqali yetiladigan bloklar."""
    out = set(layout.out(app_id))
    for t in list(out):
        if layout.kind(t) == "pgbouncer":
            out |= set(layout.out(t))
    return out


# ---------------------------------------------------------------------------
# Asosiy hisob
# ---------------------------------------------------------------------------
def evaluate(layout, users, traffic_factor=1.0):
    res = resources(layout)
    reach = reachable_from_users(layout)

    apps = [b for b in layout.ids("app") if b in reach]
    nginxes = [b for b in layout.ids("nginx") if b in reach]
    lbs = [b for b in layout.ids("lb") if b in reach]
    entry = nginxes + lbs
    pg = layout.first("postgres")
    db_reachable = bool(pg) and any(pg in _down_db(layout, a) for a in apps)

    problems = []
    if not layout.first("users"):
        problems.append("Foydalanuvchilar bloki yo'q")
    if not entry:
        problems.append("Nginx yoki Load Balancer Foydalanuvchilarga ulanmagan")
    if not apps:
        problems.append("Sayt (app) bloki yo'q yoki trafik unga yetib bormayapti")
    if not pg:
        problems.append("PostgreSQL yo'q")
    elif not db_reachable:
        problems.append("Sayt → PostgreSQL ulanmagan")
    unhosted = [b for b in layout.blocks
                if rules.needs_host(layout.kind(b), catalog.BLOCKS[layout.kind(b)])
                and not layout.blocks[b]["host"]]
    if unhosted:
        problems.append(f"{len(unhosted)} ta blok serverga joylanmagan")
    # --- 🚀 Ishga tushirish: domen, DNS, deploy
    launch = layout.launch
    ssl = True if launch is None else bool(launch.get("ssl"))
    if launch is not None:
        dns = launch.get("dns")
        if not launch.get("domain"):
            problems.append("Domen yo'q — foydalanuvchilar saytni topa olmaydi (🚀 2-qadam)")
        elif dns not in layout.hosts:
            problems.append("Domen hech qaysi serverga qaramayapti (DNS A yozuvi)")
        else:
            if not layout.hosts[dns]["config"].get("public", True):
                problems.append("Domen ichki IP li serverga qaraydi — internetdan ko'rinmaydi")
            if not any(layout.blocks[b]["host"] == dns for b in entry):
                problems.append("Domen qaragan serverda Nginx yoki Load Balancer yo'q — so'rovni hech kim qabul qilmaydi")
        if not launch.get("deployed"):
            problems.append("Kod serverga yuklanmagan — 502 Bad Gateway (🚀 4-qadam: deploy)")
    if launch and launch.get("neglected") and not launch.get("suspended"):
        problems.insert(0, "⚠ Egasi kirmadi: sayt to'xtab qoldi (yangilanish va tekshiruv qilinmadi) — qayta ishga tushiring")
    if launch and launch.get("suspended"):
        problems.insert(0, "⛔ Hosting to'xtatildi: balans tugagan — serverlar o'chiq")
    over = [hid for hid, h in res["hosts"].items() if h["over_cpu"] or h["over_ram"]]
    path_ok = not problems and not over

    # --- Telegram bot va To'lov: ishlaydimi?
    bot_id = next((b for b in layout.ids("tgbot") if b in reach), None)
    bot_ok = bool(bot_id) and bool(layout.blocks[bot_id]["host"]) and         any(layout.kind(t) in ("app", "postgres", "pgbouncer") for t in layout.out(bot_id)) and         (layout.cfg(bot_id).get("mode") != "webhook" or ssl)
    auth_id = next((t for a in apps for t in layout.out(a) if layout.kind(t) == "auth"), None)
    auth_ok = bool(auth_id) and bool(layout.blocks[auth_id]["host"]) and \
        any(layout.kind(t) in ("redis", "postgres", "pgbouncer") for t in layout.out(auth_id))
    auth_method = layout.cfg(auth_id).get("method", "email") if auth_id else None
    sms_missing = auth_method == "sms" and not (layout.launch or {}).get("sms", True)
    if sms_missing:
        auth_ok = False          # SMS provayder ulanmagan — kod yuborilmaydi
    pay_id = next((t for a in apps for t in layout.out(a) if layout.kind(t) == "payment"), None)
    payment_ok = bool(pay_id) and ssl

    code = layout.code or catalog.default_code()
    sync = code.get("report_mode", "sync") == "sync"

    # --- Trafik
    tf = traffic_factor
    cdn = any(layout.kind(b) == "cdn" for b in reach)
    biz_traffic = (layout.launch or {}).get("traffic", 1.0)
    legit = users * REQ_PER_USER * tf * biz_traffic * (0.7 if cdn else 1.0) + (users * BOT_REQ_PER_USER if bot_ok else 0)
    legit_report = legit * REPORT_SHARE
    legit_light = legit - legit_report

    # --- Nginx: kirish darvozasi
    ng_id = nginxes[0] if nginxes else None
    nginx_rps = legit
    ng_cap = catalog.BLOCKS["nginx"]["capacity_rps"]

    # --- App tier: workerlar yig'indisi (serverlar bo'yicha)
    total_workers = 0.0
    app_caps = {}
    for a in apps:
        sp = host_speed(layout, layout.blocks[a]["host"])
        cap = layout.cfg(a).get("workers", 1) * sp
        app_caps[a] = cap
        total_workers += cap
    total_workers = max(total_workers, 0.01)

    report_cost = REPORT_SYNC_S if sync else REPORT_ENQUEUE_S
    g_demand = legit_light * LIGHT_COST_S + legit_report * report_cost
    rho_g = g_demand / total_workers
    g_through = min(1.0, 1 / rho_g) if rho_g > 0 else 1.0

    # --- Baza, Redis, Replica
    redis_on = any(layout.kind(t) == "redis" for a in apps for t in layout.out(a))
    replica = any(layout.kind(t) == "replica" for a in apps for t in layout.out(a))
    light_q = LIGHT_QUERIES * ((1 - REDIS_HIT) if redis_on else 1)
    q_web = legit_light * light_q + (legit_report * REPORT_QUERIES if sync else 0)
    q_web *= g_through
    reads = q_web * 0.8
    if replica:
        q_primary = q_web - reads * REPLICA_READ_SHARE
        rho_replica = (reads * REPLICA_READ_SHARE) / catalog.BLOCKS["replica"]["capacity_qps"]
    else:
        q_primary = q_web
        rho_replica = 0

    # --- Fon ishchisi
    rho_w = queue_growth = jobs = worker_cap = 0.0
    report_fail = 0.0
    worker_id = None
    worker_ids = []
    if not sync:
        # Saytga ulangan HAMMA Fon ishchilari bitta navbatdan vazifa oladi (Celery kabi) —
        # sig'im yig'iladi. Har ishchi o'z serverining CPU'sida ishlaydi.
        for a in apps:
            for t in layout.out(a):
                if layout.kind(t) == "worker" and t not in worker_ids:
                    worker_ids.append(t)
        worker_id = worker_ids[0] if worker_ids else None
        if worker_id:
            jobs = legit_report * g_through
            for w in worker_ids:
                sp = host_speed(layout, layout.blocks[w]["host"])
                worker_cap += layout.cfg(w).get("concurrency", 1) / catalog.BLOCKS["worker"]["job_seconds"] * sp
            rho_w = jobs / max(worker_cap, 0.01)
            queue_growth = max(0.0, jobs - worker_cap)
        else:
            report_fail = REPORT_SHARE

    q_worker = min(jobs, worker_cap) * REPORT_QUERIES
    # har bir model (jadval) va bog'lanish bazaga biroz qo'shimcha yuk beradi
    db_qps = (q_primary + q_worker) * (layout.launch or {}).get("db_load", 1.0)
    rho_db = db_qps / catalog.BLOCKS["postgres"]["capacity_qps"] if pg else 0

    pgbouncer = any(layout.kind(t) == "pgbouncer" for a in apps for t in layout.out(a))
    raw_conns = sum(layout.cfg(a).get("workers", 0) for a in apps) + \
        sum(layout.cfg(w).get("concurrency", 0) for w in worker_ids)
    conns = 20 if pgbouncer else raw_conns
    conn_err = 0.3 if pg and conns > layout.cfg(pg).get("max_connections", 100) else 0

    # --- Javob vaqti
    light_ms = 2 + _wait(LIGHT_COST_S * 1000, rho_g) + _wait(light_q * DB_QUERY_MS, rho_db)
    p95_ms = light_ms * 1.8
    if sync:
        report_ms = _wait(REPORT_SYNC_S * 1000, rho_g) + _wait(REPORT_QUERIES * DB_QUERY_MS, rho_db)
    elif worker_id:
        report_ms = _wait(catalog.BLOCKS["worker"]["job_seconds"] * 1000, rho_w)
    else:
        report_ms = 0

    # --- Xatolar
    ok = 1.0
    for e in (_err(nginx_rps / ng_cap if ng_id else 0), _err(rho_g), _err(rho_db),
              _err(rho_replica), report_fail, conn_err,
              PENDING_MIGRATION_ERR if launch and launch.get("pending_migration") else 0):
        ok *= (1 - e)
    error_rate = 1 - ok
    if not path_ok:
        error_rate = 1.0
    status = status_of(p95_ms, error_rate)

    # --- Har bir blokning band bo'lishi va yorlig'i
    ns = {"users": users, "nginx_rps": nginx_rps, "total_workers": total_workers, "rho_g": rho_g,
          "db_qps": db_qps, "rho_db": rho_db, "rho_replica": rho_replica, "replica": replica,
          "redis_on": redis_on, "rho_w": rho_w, "queue_growth": queue_growth, "worker_id": worker_id, "worker_ids": worker_ids}
    util, node_status, labels = {}, {}, {}
    for bid, b in layout.blocks.items():
        k = b["kind"]
        rho = None
        if k == "nginx":
            rho = nginx_rps / ng_cap
        elif k == "lb":
            rho = nginx_rps / catalog.BLOCKS["lb"]["capacity_rps"]
        elif k == "app":
            rho = rho_g
        elif k == "postgres":
            rho = rho_db
        elif k == "replica":
            rho = rho_replica
        elif k == "worker" and bid in worker_ids:
            rho = rho_w
        if rho is not None:
            util[bid] = round(rho, 3)
            node_status[bid] = "red" if rho >= 1 else "yellow" if rho >= 0.7 else "green"
        labels[bid] = _label(layout, bid, ns)
        if k == "tgbot":
            labels[bid] = "ishlayapti" if bot_ok else ("webhook: HTTPS kerak" if b["host"] and not ssl
                                                       and b["config"].get("mode") == "webhook" else "ulanmagan")
            node_status[bid] = "green" if bot_ok else "off"
        if k == "auth":
            labels[bid] = (f"OTP: {'SMS' if auth_method == 'sms' else 'email (bepul)'}" if auth_ok
                           else "SMS xizmati sotib olinmagan" if auth_id == bid and sms_missing
                           else "Redis yoki PostgreSQL ga ulang" if auth_id == bid else "Sayt → Avtorizatsiya ulang")
            node_status[bid] = "green" if auth_ok else "off"
        if k == "payment":
            labels[bid] = "pul tushyapti" if payment_ok and bid == pay_id else ("HTTPS kerak" if pay_id == bid else "ulanmagan")
            node_status[bid] = "green" if payment_ok and bid == pay_id else "off"
        if b["host"] is None and rules.needs_host(k, catalog.BLOCKS[k]):
            node_status[bid] = "off"
        elif bid not in reach and not catalog.BLOCKS[k].get("external") and k not in rules.SIDE_TARGETS \
                and k in ("nginx", "lb", "app", "postgres", "redis", "worker", "replica"):
            node_status.setdefault(bid, "off")

    for hid in over:
        for bid, b in layout.blocks.items():
            if b["host"] == hid:
                node_status[bid] = "red"

    bottleneck = max(util, key=util.get) if util else None
    if bottleneck and util[bottleneck] < 0.7:
        bottleneck = None

    return {
        "power_used": res["power_used"], "power_limit": res["power_limit"], "hosts": res["hosts"],
        "path_ok": path_ok, "path_problems": problems,
        "legit_rps": round(legit, 2), "rps": round(nginx_rps, 2),
        "p95_ms": round(p95_ms), "report_ms": round(report_ms),
        "error_rate": round(error_rate, 4), "status": status, "status_title": STATUS_TITLE[status],
        "util": util, "node_status": node_status, "labels": labels,
        "bottleneck": bottleneck, "bottleneck_kind": layout.kind(bottleneck) if bottleneck else None,
        "queue_growth": round(queue_growth, 2),
        "db_qps": round(db_qps, 1), "conn_err": conn_err > 0,
        "apps": len(apps), "total_workers": round(total_workers, 1),
        "bot_ok": bot_ok, "payment_ok": payment_ok, "ssl": ssl, "auth_ok": auth_ok, "auth_method": auth_method,
    }


def _label(layout, bid, ns):
    k = layout.kind(bid)
    cfg = layout.cfg(bid)
    if k == "users":
        return f"{ns['users']:,} foyd.".replace(",", " ")
    if k == "server":
        tier = catalog.SERVER_TIERS[cfg.get("tier", "orta")]
        return tier["title"].replace("VPS ", "") + (" 🔒" if cfg.get("firewall") else "")
    if k == "nginx":
        return f"{ns['nginx_rps']:.0f} req/s"
    if k == "lb":
        return f"{ns['nginx_rps']:.0f} req/s → {ns['total_workers']:.0f}w"
    if k == "app":
        return f"{cfg.get('workers')}w · {ns['rho_g']:.0%}"
    if k == "postgres":
        return f"{ns['db_qps']:.0f} q/s · {ns['rho_db']:.0%}"
    if k == "replica":
        return f"{ns['rho_replica']:.0%} band" if ns["replica"] else "ulanmagan"
    if k == "redis":
        return "kesh 70%" if ns["redis_on"] else "ulanmagan"
    if k == "worker":
        if bid in ns["worker_ids"]:
            return f"navbat +{ns['queue_growth']:.1f}/s" if ns["queue_growth"] > 0 else f"{ns['rho_w']:.0%}"
        return "ulanmagan"
    return catalog.BLOCKS[k]["subtitle"]


def status_of(p95_ms, error_rate):
    if error_rate > 0.5:
        return "down"
    if p95_ms > 1000 or error_rate > 0.02:
        return "red"
    if p95_ms > 300 or error_rate > 0.005:
        return "yellow"
    return "green"


# ---------------------------------------------------------------------------
# Bir o'yin kuni
# ---------------------------------------------------------------------------
def traffic_factor_for(seed, day):
    rnd = random.Random(seed * 100_003 + day)
    return 0.85 + rnd.random() * 0.45


def daily_cost(layout):
    rent = sum(catalog.SERVER_TIERS[h["config"].get("tier", "orta")]["rent"] for h in layout.hosts.values())
    rent += sum(catalog.BLOCKS[b["kind"]].get("rent", 0) for b in layout.blocks.values())
    power = resources(layout)["power_used"] * catalog.ELECTRICITY_PRICE
    return round(rent + power, 1), rent, round(power, 1)


PAYMENT_FEE = 0.02          # to'lov tizimi har to'lovdan 2% oladi (Payme/Click kabi)
SMS_PRICE = 0.02            # bitta SMS (OTP kod)
LOGINS_PER_USER = 0.25      # mijozlarning ~25% i har kuni kod bilan kiradi


def service_costs(layout, users, m, s):
    """Tashqi xizmatlar haqi: to'lov komissiyasi va SMS. Dasturlar (Nginx, Django...) bepul."""
    items = []
    if s["revenue"] > 0:
        items.append({"label": f"To'lov tizimi komissiyasi ({PAYMENT_FEE:.0%})", "amount": round(s["revenue"] * PAYMENT_FEE, 1)})
    if m.get("auth_ok") and m.get("auth_method") == "sms":
        sms = round(users * LOGINS_PER_USER * SMS_PRICE, 1)
        if sms:
            items.append({"label": f"SMS kodlar: {round(users * LOGINS_PER_USER)} ta × ${SMS_PRICE}", "amount": sms})
    return items


def day_sales(layout, users, m):
    """Bir kunlik sotuv. Biznes tanlanmagan (testlar) — eski oddiy model: mijoz × $0.75."""
    la = layout.launch or {}
    key = la.get("business")
    if not key:
        rev = round(users * REVENUE_PER_USER * (1 - m["error_rate"]), 1) if m["payment_ok"] else 0.0
        return {"rows": [], "revenue": rev, "cogs": 0.0, "ads": 0.0, "orders": 0, "unit": "dona",
                "lost": not m["payment_ok"]}
    live = m["path_ok"] and m["status"] != "down"
    demand = la.get("demand", 1.0) * (AUTH_DEMAND if m.get("auth_ok") else 1.0)
    return business.sales(key, la.get("offers") or business.default_offers(key), users,
                          m["error_rate"], m["payment_ok"], live, demand)


def finance(layout, users, m, coins):
    """
    Bugungi pul oqimi — o'yinchi tushunishi uchun qator-qator:
      daromad: qancha va NEGA (yoki nega 0);
      xarajatlar: har server ijarasi, xizmatlar ijarasi, elektr, mahsulot tannarxi;
      sof natija va kassa necha kunga yetishi.
    """
    s = day_sales(layout, users, m)
    revenue = round(s["revenue"] + s["ads"], 1)
    parts = []
    if s["revenue"]:
        parts.append(f"{s['orders']} ta sotuv · ${s['revenue']}" if s["orders"] else f"{users} mijoz × ${REVENUE_PER_USER}")
    if s["ads"]:
        parts.append(f"reklama ${s['ads']}")
    if s["revenue"] and m["error_rate"] > 0.001:
        parts.append(f"xatolar −{m['error_rate']:.0%}")
    if not m["payment_ok"]:
        if not any(b["kind"] == "payment" for b in layout.blocks.values()):
            parts.append("To'lov shlyuzi yo'q — sotib olib bo'lmaydi")
        elif not m["ssl"]:
            parts.append("To'lov shlyuzi bor, lekin HTTPS yo'q — to'lov qabul qilinmaydi")
        else:
            parts.append("To'lov shlyuzi Saytga ulanmagan yoki Sayt ishlamayapti")
    why = " · ".join(parts) or "Sayt ishlamayapti — mijozlar kira olmaydi"
    items = []
    for hid, h in layout.hosts.items():
        tier = catalog.SERVER_TIERS[h["config"].get("tier", "orta")]
        items.append({"label": f"{layout.blocks[hid]['name']} ijarasi ({tier['title']})", "amount": tier["rent"]})
    for b in layout.blocks.values():
        rent = catalog.BLOCKS[b["kind"]].get("rent", 0)
        if rent:
            items.append({"label": f"{catalog.BLOCKS[b['kind']]['title']} obunasi", "amount": rent})
    for it in service_costs(layout, users, m, s):
        items.append(it)
    if s["cogs"]:
        items.insert(0, {"label": "Mahsulot tannarxi (sotilganlar)", "amount": s["cogs"]})
    fixed = round(sum(i["amount"] for i in items) - s["cogs"], 1)
    cost = round(sum(i["amount"] for i in items), 1)
    net = round(revenue - cost, 1)
    runway = None
    if net < 0:
        runway = max(0, int(coins // -net)) if coins > 0 else 0
    # 1 mijozdan sof (tannarxsiz) daromad — zararsizlik nuqtasi uchun
    per_user = round((revenue - s["cogs"]) / users, 3) if users and revenue else 0.0
    return {"revenue": revenue, "revenue_why": why, "items": items, "cost": cost, "net": net,
            "runway": runway, "per_user": per_user, "fixed": fixed, "bankrupt_days": BANKRUPT_DAYS,
            "sales": s}


def daily_growth(layout, users, m):
    """Kunlik o'sish: tizim holati + bot + biznes/kampaniya; bozor to'yingani sari sekinlashadi."""
    la = layout.launch or {}
    if layout.launch is not None and not la.get("deployed") and not la.get("suspended"):
        return 0.0          # sayt hali ochilmagan — mijozlar kutib turibdi, kamaymaydi ham
    good = m["status"] in ("green", "yellow")
    g = (GROWTH[m["status"]] + (BOT_GROWTH + la.get("bot_growth", 0) if m["bot_ok"] and good else 0)
         + (la.get("growth", 0) if good else 0))
    if g > 0:
        g *= max(0.0, 1 - users / la.get("market", DEFAULT_MARKET))
    return g


def hour_step(layout, users, m, suspended=False):
    """Bir o'yin soati: kunlik daromad/xarajatning 1/24 qismi, mijozlar silliq o'zgaradi."""
    if suspended:
        return {"users": max(min(users, 10.0), users * (1 + SUSPENDED_GROWTH) ** (1 / HOURS)),
                "revenue": 0.0, "sales": 0.0, "cost": 0.0, "orders": 0.0, "cogs": 0.0, "ads": 0.0}
    s = day_sales(layout, round(users), m)
    cost, _, _ = daily_cost(layout)
    cost += sum(i["amount"] for i in service_costs(layout, round(users), m, s))
    g = daily_growth(layout, users, m)
    return {"users": max(min(users, 10.0), users * (1 + g) ** (1 / HOURS)),
            "revenue": (s["revenue"] + s["ads"]) / HOURS, "sales": s["revenue"] / HOURS, "cost": (cost + s["cogs"]) / HOURS,
            "orders": s["orders"] / HOURS, "cogs": s["cogs"] / HOURS, "ads": s["ads"] / HOURS}


def advance_day(layout, users, coins, neg_streak, seed, day):
    tf = traffic_factor_for(seed, day)
    m = evaluate(layout, users, traffic_factor=tf)
    growth = daily_growth(layout, users, m)
    new_users = max(10, round(users * (1 + growth)))
    s = day_sales(layout, users, m)
    revenue = round(s["revenue"] + s["ads"], 1)
    cost, _, _ = daily_cost(layout)
    cost = round(cost + s["cogs"] + sum(i["amount"] for i in service_costs(layout, users, m, s)), 1)
    new_coins = round(coins + revenue - cost, 1)
    neg_streak = neg_streak + 1 if new_coins < 0 else 0
    entry = {"day": day, "users": users, "p95_ms": m["p95_ms"], "error_rate": m["error_rate"],
             "status": m["status"], "revenue": revenue, "cost": cost, "coins": new_coins,
             "bottleneck": m["bottleneck_kind"], "orders": s["orders"], "cogs": s["cogs"], "ads": s["ads"]}
    return {"users": new_users, "coins": new_coins, "neg_streak": neg_streak,
            "bankrupt": neg_streak >= BANKRUPT_DAYS, "metrics": m, "entry": entry}


# ---------------------------------------------------------------------------
# Maslahatchi
# ---------------------------------------------------------------------------
def advise(layout, m, users):
    tips = []

    def tip(level, text, guide=None, kind=None):
        bid = layout.first(kind) if kind else None
        tips.append({"level": level, "text": text, "guide": guide, "block": bid, "kind": kind})

    if not m["path_ok"]:
        for p in m["path_problems"]:
            tip("bad", "Sayt ishlamayapti: " + p + ".", "bottleneck")
    for hid, h in m["hosts"].items():
        if h["over_cpu"]:
            tip("bad", f"Bir serverda CPU yetmayapti ({h['cpu_used']}/{h['cpu_total']} yadro). "
                       f"Serverni kattalashtiring yoki blokni boshqa serverga ko'chiring.", "servers")
        if h["over_ram"]:
            tip("bad", "Bir serverda RAM tugadi (swap) — undagi bloklar 40% sekin.", "servers")

    code = layout.code or {}
    launch = layout.launch
    if launch is not None:
        if launch.get("domain") and not launch.get("ssl"):
            tip("bad", "HTTPS yo'q: parollar va cookie'lar ochiq matnda ketadi, to'lov qabul qilinmaydi (🚀 5-qadam: SSL).", "https")
        if launch.get("ssl") and not code.get("ssl_redirect"):
            tip("warn", "HTTP so'rovlar HTTPS ga yo'naltirilmayapti — kimdir http:// bilan kirsa, trafigi ochiq. "
                        "Kod → settings.py → SECURE_SSL_REDIRECT.", "https")
        if launch.get("pending_migration"):
            tip("bad", "Yangi migratsiya serverda qo'llanmagan: kod bazada yo'q ustunni so'rayapti (500 xato). Qayta deploy qiling.",
                "models")
    if not any(b["kind"] == "payment" for b in layout.blocks.values()):
        tip("info", "To'lov shlyuzi yo'q — mijozlar bepul foydalanmoqda, daromad 0. Uni qo'shib Saytga ulang.", "https")
    elif not m["payment_ok"]:
        tip("warn", "To'lov shlyuzi ishlamayapti: Sayt → To'lov ulanmagan yoki HTTPS yo'q.", "https", "payment")
    if m["path_ok"] and not layout.first("auth") and users >= 300:
        tip("info", "Mijozlar ko'paydi: Avtorizatsiya (OTP) qo'shing — akkaunt bo'lsa qaytib kelishadi (sotuv +10%).", "auth")
    bt = layout.first("tgbot")
    if bt and not m["bot_ok"]:
        tip("warn", "Telegram bot ishlamayapti: serverga joylang, Foydalanuvchilar → bot → Sayt ulang. "
                    "Webhook rejimi uchun HTTPS kerak.", "telegram", "tgbot")
    if code.get("debug"):
        tip("warn", "Sayt kodida DEBUG=True. Xato sahifasi begona odamga ichki yo'llarni ko'rsatadi.", "debug")
    if code.get("secret_source") == "hardcoded":
        tip("warn", "SECRET_KEY kod ichida yozilgan. Uni .env ga ko'chiring ('Kod' bo'limi).", "secrets")
    if not code.get("env_gitignored") and code.get("repo_public"):
        tip("warn", ".env .gitignore da emas va repo ochiq — sirlar Git tarixiga tushishi mumkin.", "git")
    if code.get("report_mode") == "background" and not layout.first("worker"):
        tip("bad", "Hisobot 'fonda', lekin Fon ishchisi yo'q — hisobotlar yo'qolyapti.", "background", "app")

    bgk = m["bottleneck_kind"]
    if bgk == "app" and m["util"].get(m["bottleneck"], 0) > 0.7:
        if code.get("report_mode", "sync") == "sync":
            tip("warn", "Sayt workerlari band — har hisobot 2 soniya ushlaydi. Hisobotni fonga o'tkazing.",
                "background", "app")
        else:
            tip("warn", "Sayt workerlari band. Worker qo'shing yoki 2-server + Load Balancer bilan bo'ling.", "lb", "app")
    if bgk == "postgres":
        if not any(b["kind"] == "redis" for b in layout.blocks.values()):
            tip("warn", "Baza band. Redis kesh o'qishlarning 70% ini oladi.", "cache", "postgres")
        else:
            tip("warn", "Baza band. Read replica o'qish yukini bo'lishadi.", "replica", "postgres")
    if m["conn_err"]:
        tip("bad", "Bazaga ulanishlar max_connections dan oshdi. PgBouncer ulanishlarni qayta ishlatadi.",
            "replica", "postgres")
    if m["queue_growth"] > 0:
        tip("warn", f"Fon navbati o'smoqda (+{m['queue_growth']}/s). Jarayonlar sonini (concurrency) oshiring "
                    "yoki boshqa serverga yana bitta Fon ishchisi qo'yib, Saytga ulang — ular navbatni birga bajaradi.",
            "background", "worker")
    rd = layout.first("redis")
    if rd and layout.cfg(rd).get("bind") == "0.0.0.0" and not layout.cfg(rd).get("password"):
        tip("warn", "Redis 0.0.0.0 da va parolsiz — internetga ochiq.", "cache", "redis")
    for h in layout.hosts.values():
        if h["config"].get("public") and not h["config"].get("firewall"):
            tip("info", "Bir serverda firewall o'chiq — hamma port tashqaridan ko'rinadi.", "servers", "server")
            break
    if not tips:
        tip("info", "Hammasi joyida. Kunlarni o'tkazing va o'sishni kuzating.")
    return tips
