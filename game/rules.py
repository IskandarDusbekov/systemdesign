"""
2-QADAM. ULANISH VA JOYLASH QOIDALARI.

  * qaysi blok qaysi blokka strelka bilan ulanishi mumkin;
  * noto'g'ri ulanishda — nima uchun mumkin emas va real hayotda NIMA BO'LARDI;
  * qaysi blok serverga joylanishi shart;
  * sayt ishlashi uchun zanjir: Foydalanuvchilar → ... → Sayt → PostgreSQL.
"""

# Trafik o'tkazuvchi strelkalar: manba turi -> ruxsat etilgan nishon turlari
TRAFFIC = {
    "users": {"cdn", "nginx", "lb", "tgbot"},
    "tgbot": {"app", "postgres", "pgbouncer", "redis"},
    "cdn": {"nginx", "lb"},
    "nginx": {"lb", "app"},
    "lb": {"app"},
    "app": {"postgres", "pgbouncer", "replica", "redis", "worker", "media", "payment", "auth"},
    "auth": {"redis", "postgres", "pgbouncer"},
    "worker": {"postgres", "pgbouncer", "media"},
    "pgbouncer": {"postgres"},
    "postgres": {"replica"},     # replikatsiya
}

SIDE_TARGETS = {}   # (hozircha kuzatuvchi bloklar yo'q)

TITLES = {
    "users": "Foydalanuvchilar", "server": "Server", "cdn": "CDN", "nginx": "Nginx",
    "lb": "Load Balancer", "app": "Sayt", "worker": "Fon ishchisi", "payment": "To'lov shlyuzi",
    "postgres": "PostgreSQL", "replica": "Read replica", "pgbouncer": "PgBouncer", "redis": "Redis",
    "media": "media/", "tgbot": "Telegram bot", "auth": "Avtorizatsiya",
}

# Noto'g'ri ulanish: (sabab, real hayotda nima bo'lardi)
WHY_NOT = {
    ("nginx", "auth"): ("Avtorizatsiya alohida sayt emas — u Saytning bir qismi. Sayt → Avtorizatsiya torting.", ""),
    ("users", "auth"): ("Mijoz kirish sahifasini Sayt orqali ochadi: Foydalanuvchilar → Nginx → Sayt → Avtorizatsiya.", ""),
    ("users", "postgres"): ("Foydalanuvchi bazaga to'g'ridan-to'g'ri ulanmaydi.",
                            "Baza internetga ochiladi: istalgan odam parolni terib ko'rishi, ma'lumotlarni o'g'irlashi mumkin."),
    ("users", "redis"): ("Kesh internetga ochilmaydi.",
                         "Parolsiz Redis'ga har kim ulanib, keshni o'qishi yoki serverga buyruq yozishi mumkin."),
    ("users", "app"): ("Sayt internetga to'g'ridan-to'g'ri ochilmaydi — oldida Nginx yoki Load Balancer turishi kerak.",
                       "Gunicorn sekin mijozlarga chidamaydi: bir nechta sekin ulanish hamma workerni band qiladi."),
    ("users", "worker"): ("Fon ishchisi internetdan so'rov qabul qilmaydi.",
                          "Navbatga har kim vazifa tashlab, serverni to'ldirib yuboradi."),
    ("nginx", "postgres"): ("Nginx bazani tanimaydi — u faqat HTTP so'rovni Saytga uzatadi.",
                            "So'rovlar hech qayerga yetmaydi: 502 Bad Gateway."),
    ("lb", "postgres"): ("Load Balancer HTTP so'rovlarni Saytlar orasida bo'ladi, bazani emas.",
                         "Baza HTTP tushunmaydi — hamma so'rov xato bilan qaytadi."),
    ("app", "users"): ("Sayt foydalanuvchiga strelka bilan ulanmaydi — javob o'sha yo'l bilan qaytadi.", ""),
    ("redis", "postgres"): ("Redis bazaga o'zi murojaat qilmaydi — keshni Sayt kodi to'ldiradi.", ""),
    ("postgres", "app"): ("Baza Saytga so'rov yubormaydi — Sayt bazaga murojaat qiladi. Strelka yo'nalishini almashtiring.", ""),
    ("worker", "app"): ("Fon ishchisi Saytga emas, baza va media/ ga yozadi.", ""),
    ("nginx", "tgbot"): ("Bot sayt emas — u Telegram orqali xabar oladi. Foydalanuvchilar → Telegram bot strelkasini torting.", ""),
    ("app", "tgbot"): ("Sayt botga so'rov yubormaydi — bot Saytning API siga murojaat qiladi. Strelkani teskari torting.", ""),
    ("tgbot", "users"): ("Javob o'sha yo'l bilan qaytadi — strelka kerak emas.", ""),
    ("users", "payment"): ("Foydalanuvchi to'lov tizimiga sayt orqali boradi: Sayt → To'lov shlyuzi.",
                           "To'lov qaysi buyurtmaga tegishli ekanini hech kim bilmaydi — pul tushadi, buyurtma yo'q."),
}


# Blok ishlashi uchun kerakli strelkalar (inspektordagi "✓/✗" ro'yxat va "ulash" tugmalari).
#   dir: "in" — shu turdagi blokdan bu blokka; "out" — bu blokdan shu turdagi blokka
REQUIREMENTS = {
    "nginx": [{"dir": "in", "kinds": ["users", "cdn"], "text": "Foydalanuvchilar → Nginx (so'rovlar kiradi)"},
              {"dir": "out", "kinds": ["app", "lb"], "text": "Nginx → Sayt yoki Load Balancer"}],
    "lb": [{"dir": "in", "kinds": ["nginx", "users", "cdn"], "text": "Nginx → Load Balancer"},
           {"dir": "out", "kinds": ["app"], "text": "Load Balancer → Sayt (2 ta Sayt bo'lsa — ikkalasiga)", "many": True}],
    "app": [{"dir": "in", "kinds": ["nginx", "lb"], "text": "Nginx yoki Load Balancer → Sayt"},
            {"dir": "out", "kinds": ["postgres", "pgbouncer"], "text": "Sayt → PostgreSQL (ma'lumotlar)"}],
    "postgres": [{"dir": "in", "kinds": ["app", "pgbouncer", "worker"], "text": "Sayt → PostgreSQL"}],
    "worker": [{"dir": "in", "kinds": ["app"], "text": "Sayt → Fon ishchisi (vazifalar navbati)"},
               {"dir": "out", "kinds": ["postgres", "pgbouncer"], "text": "Fon ishchisi → PostgreSQL"}],
    "redis": [{"dir": "in", "kinds": ["app"], "text": "Sayt → Redis (kesh)"}],
    "replica": [{"dir": "in", "kinds": ["app"], "text": "Sayt → Read replica (o'qishlar)"}],
    "pgbouncer": [{"dir": "in", "kinds": ["app"], "text": "Sayt → PgBouncer"},
                  {"dir": "out", "kinds": ["postgres"], "text": "PgBouncer → PostgreSQL"}],
    "payment": [{"dir": "in", "kinds": ["app"], "text": "Sayt → To'lov shlyuzi (API so'rov)"}],
    "media": [{"dir": "in", "kinds": ["app", "worker"], "text": "Sayt → media/ (fayllar)"}],
    "cdn": [{"dir": "in", "kinds": ["users"], "text": "Foydalanuvchilar → CDN"},
            {"dir": "out", "kinds": ["nginx", "lb"], "text": "CDN → Nginx"}],
    "auth": [{"dir": "in", "kinds": ["app"], "text": "Sayt → Avtorizatsiya (kirish sahifasi Saytning bir qismi)"},
             {"dir": "out", "kinds": ["redis", "postgres", "pgbouncer"], "text": "Avtorizatsiya → Redis (kodlar TTL bilan) yoki PostgreSQL"}],
    "tgbot": [{"dir": "in", "kinds": ["users"], "text": "Foydalanuvchilar → Telegram bot (xabarlar Telegram orqali keladi)"},
              {"dir": "out", "kinds": ["app", "postgres", "pgbouncer"], "text": "Telegram bot → Sayt (API) yoki PostgreSQL"}],
}


def can_connect(src_kind, dst_kind, existing_kinds_from_src):
    """
    Ulanish mumkinmi?
    Qaytaradi: (ok, sabab, oqibat)
    existing_kinds_from_src — shu manbadan allaqachon chiqqan strelkalar nishon turlari.
    """
    t = TITLES
    if src_kind == "server" or dst_kind == "server":
        return False, ("Server — bu mashina, unga strelka tortilmaydi. Blokni tanlab, inspektorda "
                       "'Server' maydonidan qaysi serverda ishlashini tanlang."), ""
    if dst_kind == "users":
        return False, "Foydalanuvchilarga strelka kirmaydi — ular trafik manbai.", ""

    allowed = TRAFFIC.get(src_kind, set())
    if dst_kind not in allowed:
        reason, effect = WHY_NOT.get((src_kind, dst_kind), (None, ""))
        if not reason:
            names = ", ".join(t[k] for k in sorted(allowed)) or "hech qaysi blokka"
            reason = f"{t[src_kind]} faqat quyidagilarga ulanadi: {names}."
        return False, reason, effect
    return True, "", ""


def needs_host(kind, spec):
    """Bu blok serverga joylanishi shartmi?"""
    return not spec.get("external") and not spec.get("is_server")
