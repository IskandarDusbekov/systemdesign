"""
11-QADAM. RIVOJLANTIRISH: marketing, yangi imkoniyatlar, tasodifiy hodisalar, yutuqlar.

Foydani nimaga sarflash mumkin:
    MARKETING — vaqtinchalik kampaniya: mijozlar tez o'sadi, lekin trafik ham oshadi.
                Tizim chidamasa (qizil/yiqilgan) — reklama puli havoga ketadi.
    UPGRADES  — bir martalik xarid, doimiy foyda: talab, o'sish yoki himoya.
Tasodifiy hodisalar (sayt ishga tushgandan keyin) — yaxshi va yomon:
    viral, bayram, raqobatchi, disk buzilishi, data-markazda elektr uzilishi.
Har bir ta'sir uchta ko'paytiruvchi orqali ishlaydi:
    traffic (so'rovlar), demand (sotib olish ehtimoli), growth (+mijoz / kun).
"""

import random

MARKETING = {
    "telegram": {"title": "Telegram kanalda post", "icon": "✈", "cost": 40, "days": 2,
                 "growth": 0.05, "traffic": 1.1, "demand": 1.0,
                 "about": "Arzon va tez: 2 kun davomida mijozlar +5%/kun."},
    "instagram": {"title": "Instagram reklama", "icon": "📸", "cost": 90, "days": 5,
                  "growth": 0.04, "traffic": 1.15, "demand": 1.05,
                  "about": "5 kun: +4%/kun mijoz, sotuvlar biroz oshadi."},
    "blogger": {"title": "Bloger bilan hamkorlik", "icon": "🎥", "cost": 250, "days": 3,
                "growth": 0.10, "traffic": 1.4, "demand": 1.1,
                "about": "3 kun: +10%/kun mijoz, trafik 1.4×. Server chidashi kerak!"},
    "sale": {"title": "Katta chegirma aksiyasi", "icon": "🏷", "cost": 150, "days": 2,
             "growth": 0.06, "traffic": 2.0, "demand": 1.8,
             "about": "2 kun: sotuvlar 1.8×, trafik 2×. Tizim tayyor bo'lmasa — 502 va pul havoga."},
}

UPGRADES = {
    "search": {"title": "Saytda qidiruv", "icon": "🔍", "cost": 200, "demand": 1.08, "traffic": 1.05, "growth": 0.0,
               "about": "Mijoz kerakli narsani tez topadi: sotuvlar +8%. Bazaga biroz ko'proq so'rov."},
    "loyalty": {"title": "Sodiqlik bonuslari", "icon": "💎", "cost": 300, "demand": 1.12, "traffic": 1.0, "growth": 0.0,
                "about": "Qaytib keladigan mijozlar ko'payadi: sotuvlar +12%."},
    "push": {"title": "Push-bildirishnomalar", "icon": "🔔", "cost": 250, "demand": 1.05, "traffic": 1.05, "growth": 0.005,
             "needs": "worker", "about": "Eslatmalar yuboriladi: +0.5%/kun mijoz, sotuv +5%. Fon ishchisi (worker) kerak."},
    "mobile": {"title": "Mobil ilova", "icon": "📱", "cost": 700, "demand": 1.1, "traffic": 1.25, "growth": 0.01,
               "about": "App Store / Play Market: +1%/kun mijoz, sotuv +10%, lekin trafik 1.25×."},
    "monitoring": {"title": "Monitoring (Grafana + alert)", "icon": "📟", "cost": 150, "demand": 1.0, "traffic": 1.0, "growth": 0.0,
                   "about": "Muammo bo'lsa darhol xabar keladi: elektr uzilishi va buzilishlarda mijoz kam yo'qotiladi."},
    "backup": {"title": "Kunlik zaxira nusxa (backup)", "icon": "💾", "cost": 120, "demand": 1.0, "traffic": 1.0, "growth": 0.0,
               "about": "Disk buzilsa — ma'lumotlar zaxiradan tiklanadi. Usiz: mijozlarning chorak qismi ketadi."},
}

EVENT_CHANCE = 0.08     # sayt ishga tushgandan keyin har kuni
EVENTS = {
    "viral": {"title": "🎉 Saytingiz TikTokda mashhur bo'ldi!", "good": True, "days": 2,
              "traffic": 2.5, "demand": 1.2, "growth": 0.15,
              "text": "2 kun davomida trafik 2.5×. Tizim chidasa — mijozlar keskin ko'payadi."},
    "holiday": {"title": "🎉 Bayram — xaridlar mavsumi", "good": True, "days": 2,
                "traffic": 1.6, "demand": 1.5, "growth": 0.02,
                "text": "2 kun: sotuvlar 1.5×, trafik 1.6×."},
    "competitor": {"title": "⚠ Raqobatchi narxlarni tushirdi", "good": False, "days": 3,
                   "traffic": 1.0, "demand": 0.75, "growth": -0.01,
                   "text": "3 kun sotuvlar 25% kam. Narxlarni qayta ko'rib chiqing (🌐 Sayt → Admin)."},
    "disk": {"title": "⚠ Server diski buzildi", "good": False, "days": 0,
             "text": "Zaxira nusxa bo'lmasa — ma'lumotlar yo'qoladi va mijozlarning bir qismi ketadi."},
    "outage": {"title": "⚠ Data-markazda elektr uzildi", "good": False, "days": 0,
               "text": "Bir necha soat sayt ishlamadi. Monitoring bo'lsa — tez tiklanadi."},
}

ACHIEVEMENTS = [
    ("first_sale", "Birinchi sotuv", lambda r, f: f.get("paid_once")),
    ("u500", "500 mijoz", lambda r, f: f.get("max_users", 0) >= 500),
    ("u2000", "2 000 mijoz", lambda r, f: f.get("max_users", 0) >= 2000),
    ("u10000", "10 000 mijoz", lambda r, f: f.get("max_users", 0) >= 10000),
    ("cash1k", "Hisobda $1 000", lambda r, f: f.get("max_coins", 0) >= 1000),
    ("cash10k", "Hisobda $10 000", lambda r, f: f.get("max_coins", 0) >= 10000),
    ("profit100", "Kuniga $100 sof foyda", lambda r, f: f.get("max_net", 0) >= 100),
    ("marketer", "Birinchi reklama kampaniyasi", lambda r, f: f.get("campaigns_run", 0) >= 1),
    ("builder", "3 ta imkoniyat qo'shildi", lambda r, f: len(f.get("upgrades", [])) >= 3),
    ("survivor", "Hodisadan omon chiqdi", lambda r, f: f.get("events_seen", 0) >= 1),
]


def modifiers(flags):
    """Hozir amaldagi barcha ta'sirlar yig'indisi."""
    t, d, g = 1.0, 1.0, 0.0
    for c in flags.get("campaigns", []):
        spec = MARKETING.get(c["id"])
        if spec:
            t, d, g = t * spec["traffic"], d * spec["demand"], g + spec["growth"]
    for uid in flags.get("upgrades", []):
        spec = UPGRADES.get(uid)
        if spec:
            t, d, g = t * spec["traffic"], d * spec["demand"], g + spec["growth"]
    for e in flags.get("effects", []):
        t, d, g = t * e["traffic"], d * e["demand"], g + e["growth"]
    return {"traffic": round(t, 3), "demand": round(d, 3), "growth": round(g, 3)}


def roll_event(seed, day, launched):
    if not launched or day < 5:
        return None
    rnd = random.Random(seed * 7_919 + day * 31)
    if rnd.random() >= EVENT_CHANCE:
        return None
    return rnd.choice(list(EVENTS))


def achievements(room, flags):
    return [{"id": k, "title": t, "done": bool(fn(room, flags))} for k, t, fn in ACHIEVEMENTS]


def public():
    return {"marketing": MARKETING, "upgrades": UPGRADES, "events": EVENTS}
