"""
🛠 BOSHQARUV — o'yin egasi (staff) uchun kichik panel.

Bu yerda: o'yinchilar va ularning hamyoni, startuplar, domenlar va serverlar,
vaqtni oldinga surish, va G'AZNA — o'yinchilar domen/server uchun to'lagan pul.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Sum

from . import catalog, engine, services
from .models import Block, Ledger, Room
from .services import GameError

User = get_user_model()
MAX_HOURS = 7 * engine.HOURS


def overview():
    users = []
    for u in User.objects.annotate(n=Count("rooms")).order_by("id"):
        first = u.rooms.order_by("id").first()
        users.append({"id": u.id, "email": u.email or u.username, "staff": u.is_staff, "rooms": u.n,
                      "balance": round(first.coins, 1) if first else 0,
                      "joined": u.date_joined.strftime("%Y-%m-%d"),
                      "last": u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else "—"})
    rooms, domains, servers = [], [], []
    for r in Room.objects.select_related("owner").order_by("id"):
        la = (r.flags or {}).get("launch", {})
        who = (r.owner.email or r.owner.username) if r.owner_id else "— (egasiz)"
        rooms.append({"id": r.id, "name": r.name, "owner": who, "day": r.day, "hour": (r.flags or {}).get("hour", 0),
                      "users": r.users, "kassa": round(float((r.flags or {}).get("kassa", 0)), 1),
                      "suspended": bool((r.flags or {}).get("suspended")), "active": r.active})
        if la.get("domain"):
            domains.append({"room": r.id, "room_name": r.name, "owner": who, "domain": la["domain"],
                            "ip": la.get("dns_ip") or "", "ssl": bool(la.get("ssl"))})
        for b in r.blocks.filter(kind="server"):
            tier = catalog.SERVER_TIERS.get(b.config.get("tier", "orta"), {})
            servers.append({"id": b.id, "room": r.id, "room_name": r.name, "owner": who, "name": b.name,
                            "ip": b.ip, "tier": tier.get("title", ""), "rent": tier.get("rent", 0),
                            "apps": b.services.count()})
    by_kind = {k: round(v or 0, 2) for k, v in Ledger.objects.values_list("kind").annotate(t=Sum("amount"))}
    recent = [{"id": e.id, "kind": e.kind, "amount": round(e.amount, 2), "note": e.note,
               "who": (e.user.email or e.user.username) if e.user_id else "—",
               "room": e.room.name if e.room_id else "—", "at": e.created.strftime("%m-%d %H:%M")}
              for e in Ledger.objects.select_related("user", "room")[:40]]
    return {"users": users, "rooms": rooms, "domains": domains, "servers": servers,
            "treasury": {"total": round(sum(by_kind.values()), 2), "by_kind": by_kind, "recent": recent}}


@transaction.atomic
def act(d):
    action = d.get("action")
    if action == "time":
        room = Room.objects.get(pk=int(d.get("room")))
        hours = int(d.get("hours") or 0)
        if not 1 <= hours <= MAX_HOURS:
            raise GameError(f"Soat 1 dan {MAX_HOURS} gacha bo'lsin.")
        res = services.advance_hours(room, hours)
        return f"{room.name}: +{hours} soat → Kun {res['to']['day']}, {res['to']['hour']:02d}:00"
    if action == "balance":
        user = User.objects.get(pk=int(d.get("user")))
        amount = round(float(d.get("amount")), 2)
        if not 0 <= amount <= 1_000_000:
            raise GameError("Balans 0 dan 1 000 000 gacha.")
        rooms = Room.objects.filter(owner=user)
        if not rooms.exists():
            raise GameError("Bu o'yinchida hali startup yo'q.")
        rooms.update(coins=amount)            # hamyon umumiy — hamma startupiga bir xil
        return f"{user.email or user.username}: balans ${amount:,.2f}"
    if action == "release_domain":
        room = Room.objects.get(pk=int(d.get("room")))
        flags = dict(room.flags or {})
        la = dict(flags.get("launch", {}))
        name = la.get("domain")
        if not name:
            raise GameError("Bu startupda domen yo'q.")
        la.update(domain=None, dns=None, dns_ip=None, ssl=False)
        flags["launch"] = la
        room.flags = flags
        room.save(update_fields=["flags"])
        return f"{name} bo'shatildi"
    if action == "delete_server":
        b = Block.objects.select_related("room").get(pk=int(d.get("block")), kind="server")
        services.delete_block(b.room, b.id)
        return f"{b.name} ({b.ip}) o'chirildi"
    raise GameError("Noma'lum amal.")
