"""
SENARIY: "Garaj → Birinchi toshqin".
Bo'sh xona (sandbox) uchun esa SANDBOX_START ishlatiladi — faqat server va foydalanuvchilar.
"""

TITLE = "1-senariy · Garaj → Birinchi toshqin"
STARTUP = "SmetaPro"
INTRO = [
    "Siz SmetaPro startupining muhandisisiz. Hozir 100 ta mijoz, bitta VPS va $300 bor.",
    "Mijozlar ko'paygan sari yuklama oshadi. Tizim chidamasa — sayt qotadi, mijozlar ketadi, pul to'xtaydi.",
    "Yangi serverlar qo'shing, ularga xizmatlarni joylang, Load Balancer bilan yukni bo'ling.",
    "'Kod' bo'limida sirlarni tartibga keltiring: DEBUG, SECRET_KEY, .env va Git tarixi.",
]

# Boshlang'ich holat. Bloklar "server" ichida ishlaydi (host nomi bilan bog'lanadi).
SCENARIO_START = {
    "name": STARTUP, "kind": "scenario",
    "users": 100, "coins": 300, "power_limit_w": 600,
    "servers": [
        # nom, tier, x, y
        {"ref": "vps1", "tier": "orta", "x": 330, "y": 360},
    ],
    "blocks": [
        # kind, host_ref, x, y, config
        ("users", None, 20, 210, {}),
        ("nginx", "vps1", 190, 210, {}),
        ("app", "vps1", 380, 210, {}),
        ("postgres", "vps1", 600, 120, {}),
        ("payment", None, 600, 300, {}),
    ],
    "edges": [("users", "nginx"), ("nginx", "app"), ("app", "postgres"), ("app", "payment")],
    # SmetaPro allaqachon ishlayapti: domen, GitHub, deploy va SSL qilingan
    "launch": {"domain": "smetapro.uz", "dns": "vps1", "github": True, "repo": "smetapro/smetapro",
               "deployed": True, "ssl": True},
}

SANDBOX_START = {
    "name": "Yangi startup", "kind": "sandbox",
    "users": 0, "coins": 500, "power_limit_w": 600,
    "servers": [{"ref": "vps1", "tier": "orta", "x": 330, "y": 360}],
    "blocks": [("users", None, 20, 210, {})],
    "edges": [],
    "launch": {},     # hammasini o'yinchi o'zi qiladi: 🚀 domen → GitHub → deploy → SSL
}


# Birinchi kirishda: tayyor kichik loyiha — bitta server, Nginx → Sayt → PostgreSQL ulangan.
# O'yinchi faqat 🚀 qadamlarni bajaradi va keyin o'zi kengaytiradi.
STARTER_START = {
    "name": "Mening birinchi startupim", "kind": "sandbox",
    "users": 0, "coins": 600, "power_limit_w": 600,
    "servers": [{"ref": "vps1", "tier": "orta", "x": 330, "y": 330}],
    "blocks": [
        ("users", None, 20, 210, {}),
        ("nginx", "vps1", 190, 210, {}),
        ("app", "vps1", 360, 210, {}),
        ("postgres", "vps1", 540, 210, {}),
        ("payment", None, 540, 60, {}),
    ],
    "edges": [("users", "nginx"), ("nginx", "app"), ("app", "postgres"), ("app", "payment")],
    "launch": {},
}


def goals(room, layout):
    f = room.flags or {}
    if room.kind == "sandbox":
        la = f.get("launch", {})
        return [
            {"id": "server", "text": "1. Server oling (asboblar paneli)", "done": layout.has("server") and bool(layout.hosts), "hint": "launch"},
            {"id": "chain", "text": "Zanjir: Foydalanuvchilar → Nginx → Sayt → PostgreSQL", "done": layout.has("app") and layout.has("postgres"), "hint": "bottleneck"},
            {"id": "domain", "text": "2. Domen oling va serverga yo'naltiring", "done": bool(la.get("domain")), "hint": "launch"},
            {"id": "github", "text": "3. Kodni GitHub'ga yuklang", "done": bool(la.get("github")), "hint": "git"},
            {"id": "deploy", "text": "4. Serverga deploy qiling", "done": bool(la.get("deployed")), "hint": "launch"},
            {"id": "ssl", "text": "5. SSL sertifikat oling (HTTPS)", "done": bool(la.get("ssl")), "hint": "https"},
            {"id": "pay", "text": "To'lov shlyuzini ulang — daromad boshlanadi", "done": bool(f.get("paid_once")), "hint": "https"},
        ]
    max_users = max(f.get("max_users", 0), room.users)
    return [
        {"id": "debug", "text": "DEBUG=False qiling ('Kod' bo'limi)", "done": f.get("debug_fixed", False), "hint": "debug"},
        {"id": "u500", "text": "500 foydalanuvchiga yeting (hisobot workerlarni qotiradi!)",
         "done": max_users >= 500, "hint": "background"},
        {"id": "u1500", "text": "1 500 foydalanuvchiga yeting (2-server + Load Balancer)",
         "done": max_users >= 1500, "hint": "lb"},
        {"id": "secret", "text": "SECRET_KEY ni .env ga ko'chiring va .env ni .gitignore ga qo'shing",
         "done": f.get("secret_moved", False), "hint": "secrets"},
        {"id": "rotate", "text": "Git tarixida qolgan SECRET_KEY ni almashtiring (rotate)",
         "done": f.get("rotated", False), "hint": "git"},
        {"id": "https", "text": "HTTP so'rovlarni HTTPS ga yo'naltiring (SECURE_SSL_REDIRECT)",
         "done": bool((room.code or {}).get("ssl_redirect")), "hint": "https"},
        {"id": "u3000", "text": "3 000 foydalanuvchi (kesh yoki replica kerak bo'ladi)",
         "done": max_users >= 3000, "hint": "cache"},
    ]
