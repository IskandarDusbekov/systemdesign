"""
10-QADAM. BIZNES TURLARI VA MAHSULOTLAR (narx → talab → foyda).

O'yinchi xona ochganda biznes tanlaydi. Har birida pul boshqacha keladi:
    shop      — onlayn do'kon: har sotuvdan foyda = narx − tannarx
    news      — yangiliklar sayti: reklama (to'lovsiz ham) + Premium obuna
    saas      — onlayn xizmat (SmetaPro): oylik tariflar
    delivery  — ovqat yetkazib berish: ko'p kichik buyurtmalar, Telegram bot muhim

Talab modeli (har mahsulot uchun, bir kunda):
    sotuv = mijozlar × rate × exp(−k · (narx / ref − 1))
Narx oshsa — har sotuvdan ko'p foyda, lekin sotuv kamayadi. Eng yaxshi narx
taxminan  tannarx + ref / k  atrofida — o'yinchi buni o'zi topadi.
"""

import math

MAX_OFFERS = 6

BUSINESSES = {
    "shop": {
        "title": "Onlayn do'kon", "icon": "🛒", "site_name": "Do'kon",
        "pitch": "Kiyim va poyabzal sotasiz. Har sotuvdan foyda: narx − tannarx.",
        "learn": "To'lov va baza yozuvlari ko'p, bayram kunlari trafik sakraydi.",
        "hero": "Yangi kolleksiya · O'zbekiston bo'ylab 1 kunda yetkazamiz", "cta": "Sotib olish",
        "k": 1.5, "ads": 0.0, "traffic": 1.0, "growth": 0.0, "bot_growth": 0.0, "unit": "dona",
        "offers": [
            {"name": "Krossovka", "price": 45, "cost": 28, "ref": 45, "rate": 0.012, "emoji": "👟"},
            {"name": "Futbolka", "price": 15, "cost": 7, "ref": 15, "rate": 0.03, "emoji": "👕"},
            {"name": "Ryukzak", "price": 30, "cost": 16, "ref": 30, "rate": 0.01, "emoji": "🎒"},
        ],
    },
    "news": {
        "title": "Yangiliklar sayti", "icon": "📰", "site_name": "Yangiliklar",
        "pitch": "Har ko'rishdan reklama puli keladi (to'lov shlyuzisiz ham). Premium obuna — qo'shimcha.",
        "learn": "O'qish juda ko'p — Redis kesh va CDN katta farq qiladi. Mijozlar tez ko'payadi.",
        "hero": "Bugungi asosiy yangiliklar", "cta": "Obuna bo'lish",
        "k": 1.2, "ads": 0.32, "traffic": 1.5, "growth": 0.012, "bot_growth": 0.0, "unit": "oy",
        "offers": [
            {"name": "Premium obuna", "price": 5, "cost": 0, "ref": 5, "rate": 0.06, "emoji": "⭐"},
        ],
    },
    "saas": {
        "title": "Onlayn xizmat (SaaS)", "icon": "📋", "site_name": "Xizmat",
        "pitch": "Mijozlar oylik tarif to'laydi. Barqaror daromad, lekin sifat past bo'lsa — ketishadi.",
        "learn": "Fon ishchilari (PDF, eslatmalar), xavfsizlik va zaxira nusxa muhim.",
        "hero": "Smetani 5 daqiqada tuzing", "cta": "Tarifni tanlash",
        "k": 1.0, "ads": 0.0, "traffic": 1.0, "growth": 0.0, "bot_growth": 0.0, "unit": "oy",
        "offers": [
            {"name": "Pro tarif", "price": 25, "cost": 1, "ref": 25, "rate": 0.7, "emoji": "📄"},
            {"name": "Biznes tarif", "price": 60, "cost": 3, "ref": 60, "rate": 0.08, "emoji": "🏢"},
        ],
    },
    "delivery": {
        "title": "Ovqat yetkazib berish", "icon": "🍔", "site_name": "Yetkazib berish",
        "pitch": "Ko'p kichik buyurtmalar. Telegram bot orqali buyurtma — mijozlar 2 baravar tez ko'payadi.",
        "learn": "Tushlik paytida yuklama keskin oshadi, tezlik muhim: sekin sayt — buyurtma yo'q.",
        "hero": "Issiq ovqat 30 daqiqada eshigingizda", "cta": "Buyurtma",
        "k": 1.8, "ads": 0.0, "traffic": 1.2, "growth": 0.0, "bot_growth": 0.02, "unit": "dona",
        "offers": [
            {"name": "Lavash", "price": 4, "cost": 2.4, "ref": 4, "rate": 0.07, "emoji": "🌯"},
            {"name": "Pitsa", "price": 9, "cost": 5.5, "ref": 9, "rate": 0.04, "emoji": "🍕"},
            {"name": "Kofe", "price": 2, "cost": 0.8, "ref": 2, "rate": 0.06, "emoji": "☕"},
        ],
    },
}

EMOJIS = ["📦", "🎁", "💡", "🧴", "📱", "🎧", "🍰", "🥤", "📚", "🧢"]


def default_offers(key):
    return [dict(o) for o in BUSINESSES[key]["offers"]]


def clean_offers(key, offers):
    """Brauzerdan kelgan mahsulotlarni tekshiradi (nom, narx, tannarx)."""
    biz = BUSINESSES[key]
    if not isinstance(offers, list) or not offers:
        raise ValueError("Kamida bitta mahsulot bo'lishi kerak.")
    if len(offers) > MAX_OFFERS:
        raise ValueError(f"Ko'pi bilan {MAX_OFFERS} ta mahsulot.")
    base = biz["offers"]
    out = []
    for i, o in enumerate(offers):
        name = str(o.get("name", "")).strip()[:30]
        if not name:
            raise ValueError("Mahsulot nomi bo'sh.")
        try:
            price = round(float(o.get("price")), 2)
            cost = round(float(o.get("cost", 0)), 2)
        except (TypeError, ValueError):
            raise ValueError(f"{name}: narx raqam bo'lishi kerak.")
        if not (0.5 <= price <= 10000) or not (0 <= cost <= 10000):
            raise ValueError(f"{name}: narx $0.5 … $10 000 oralig'ida bo'lsin.")
        # yangi mahsulot uchun talab — o'xshash bazaviy mahsulotdan
        ref_src = base[i] if i < len(base) else base[-1]
        prev = o if "ref" in o and "rate" in o else ref_src
        ref = float(prev.get("ref", ref_src["ref"]))
        rate = float(prev.get("rate", ref_src["rate"]))
        if i >= len(base) and "ref" not in o:
            ref, rate = price, ref_src["rate"] * 0.8
        out.append({"name": name, "price": price, "cost": cost, "ref": round(ref, 2), "rate": round(rate, 4),
                    "emoji": str(o.get("emoji") or ref_src.get("emoji") or EMOJIS[i % len(EMOJIS)])[:4]})
    return out


def demand_factor(offer, k):
    return min(3.0, math.exp(-k * (offer["price"] / offer["ref"] - 1)))


def sales(key, offers, users, error_rate, payment_ok, live, demand=1.0):
    """
    Bir kunlik sotuv: har mahsulot bo'yicha soni, daromad, tannarx.
    Sayt ishlamasa — hech narsa; to'lov ishlamasa — sotuv 0 (reklama baribir keladi).
    """
    biz = BUSINESSES[key]
    ok = 1 - error_rate
    rows, revenue, cogs, orders = [], 0.0, 0.0, 0.0
    for o in offers:
        f = demand_factor(o, biz["k"])
        qty_raw = users * o["rate"] * f * demand * ok if live else 0.0
        per = 1 / 30 if biz["unit"] == "oy" else 1.0      # oylik tarif — kuniga 1/30
        paid = qty_raw if payment_ok else 0.0
        rev, cg = paid * o["price"] * per, paid * o["cost"] * per
        rows.append({"name": o["name"], "emoji": o.get("emoji", ""), "price": o["price"], "cost": o["cost"],
                     "qty": round(qty_raw, 1), "paid": round(paid, 1), "revenue": round(rev, 1),
                     "profit": round(rev - cg, 1), "demand": round(f, 2),
                     "best_price": round(o["cost"] + o["ref"] / biz["k"], 1)})
        revenue += rev
        cogs += cg
        orders += paid
    ads = round(users * biz["ads"] * ok, 1) if live else 0.0
    return {"rows": rows, "revenue": round(revenue, 1), "cogs": round(cogs, 1), "ads": ads,
            "orders": round(orders), "unit": biz["unit"], "lost": not payment_ok and live}


def public():
    return {k: {kk: vv for kk, vv in v.items()} for k, v in BUSINESSES.items()}
