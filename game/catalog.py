"""
1-QADAM. BLOKLAR KATALOGI (statik ma'lumot).

Bu yerda bazaga yozilmaydigan, o'yin qoidalarini belgilaydigan raqamlar turadi:
  * SERVER_TIERS — server (VPS) turlari: CPU, RAM, elektr, ijara;
  * BLOCKS       — asboblar paneli: har bir blok narxi, resursi, sozlamalari;
  * BLOCK_CODE   — har bir blokning "real ko'rinishli" konfiguratsiya fayli;
  * CODE_FIELDS  — sayt kodidagi o'zgartiriladigan joylar (fayllar project.py da);
  * ENDPOINTS    — saytning API manzillari va ular qaysi kod sozlamasiga bog'liq.

Muvozanatni o'zgartirmoqchi bo'lsangiz — shu faylni tahrirlang.
"""

import secrets

from . import business, growth, launch, project, rules

# ---------------------------------------------------------------------------
# Serverlar. Server ham doskadagi blok: unga IP beriladi, boshqa xizmatlar
# shu server ichida CPU va RAM sarflaydi.
# ---------------------------------------------------------------------------
SERVER_TIERS = {
    "kichik": {"title": "VPS Kichik", "cpu": 1, "ram_mb": 1024, "power_w": 60, "rent": 20},
    "orta": {"title": "VPS O'rta", "cpu": 2, "ram_mb": 4096, "power_w": 120, "rent": 50},
    "katta": {"title": "VPS Katta", "cpu": 4, "ram_mb": 8192, "power_w": 220, "rent": 110},
    "kuchli": {"title": "VPS Kuchli", "cpu": 8, "ram_mb": 16384, "power_w": 400, "rent": 250},
}

POWER_UPGRADE_STEP_W = 300
POWER_UPGRADE_COST = 150
ELECTRICITY_PRICE = 0     # elektr server ijarasi ichida — alohida to'lanmaydi

# ---------------------------------------------------------------------------
# Bloklar (asboblar paneli).
#   external   — serverga joylanmaydi (internetdagi xizmat: CDN, to'lov tizimi)
#   is_server  — bu blokning o'zi server (IP oladi, boshqalarni "sig'diradi")
#   side       — trafik o'tkazmaydi, faqat boshqa blokni kuzatadi/himoya qiladi
#   per_unit   — bitta "birlik" (worker, jarayon) uchun qo'shimcha resurs
#   fields     — oq ro'yxatdagi sozlamalar (faqat shular tahrirlanadi)
# ---------------------------------------------------------------------------
BLOCKS = {
    # --- Infratuzilma -----------------------------------------------------
    "users": {
        "title": "Foydalanuvchilar", "subtitle": "internet", "layer": "kirish",
        "color": "#f9f2e8", "icon": "users", "fixed": True, "external": True,
        "cost": 0, "cpu": 0, "ram_mb": 0, "power_w": 0, "max_count": 1,
        "shape": "platform",
        "about": "Sizning mijozlaringiz. Har bir faol foydalanuvchi ~0.02 so'rov/s yuboradi.",
        "fields": {},
    },
    "server": {
        "title": "Server", "subtitle": "VPS", "layer": "server",
        "color": "#e6ddd0", "icon": "rack", "is_server": True, "shape": "tower",
        "cost": 0, "cpu": 0, "ram_mb": 0, "power_w": 0, "max_count": 6,
        "about": "Jismoniy mashina (VPS). IP manzili bor. Boshqa bloklarni shu serverga 'joylaysiz' — "
                 "ular uning CPU va RAM ini bo'lishib ishlatadi.",
        "guide": "servers",
        "fields": {
            "tier": {"type": "choice", "default": "orta", "label": "tur",
                     "choices": [[k, v["title"]] for k, v in SERVER_TIERS.items()]},
            "public": {"type": "bool", "default": True, "label": "internetga ochiq IP", "fmt": "yesno"},
            "firewall": {"type": "bool", "default": False, "label": "ufw firewall", "fmt": "onoff"},
        },
    },

    # --- Kirish qatlami ---------------------------------------------------
    "cdn": {
        "title": "CDN", "subtitle": "statik kesh", "layer": "kirish",
        "color": "#d6e5f6", "icon": "globe", "external": True, "shape": "cloud",
        "cost": 0, "rent": 15, "cpu": 0, "ram_mb": 0, "power_w": 0, "max_count": 1,
        "about": "Rasm, CSS, JS kabi statik fayllarni dunyo bo'ylab o'zi beradi — serverga yetib bormaydi.",
        "guide": "cdn",
        "fields": {},
    },
    "nginx": {
        "title": "Nginx", "subtitle": "darvoza", "layer": "kirish",
        "color": "#fcdcbd", "icon": "shield", "shape": "gate",
        "cost": 0, "cpu": 0.1, "ram_mb": 30, "power_w": 10, "max_count": 2,
        "capacity_rps": 2000, "max_conns": 1024,
        "about": "Hamma so'rovlar shu darvozadan o'tadi: statik fayllarni o'zi beradi, qolganini Saytga uzatadi.",
        "guide": "bottleneck",
        "fields": {
            "server_tokens": {"type": "bool", "default": True, "label": "versiyani ko'rsatish", "fmt": "onoff"},
        },
    },
    "lb": {
        "title": "Load Balancer", "subtitle": "bo'luvchi", "layer": "kirish",
        "color": "#dff0de", "icon": "split", "shape": "slab",
        "cost": 0, "cpu": 0.2, "ram_mb": 50, "power_w": 10, "max_count": 1,
        "capacity_rps": 5000,
        "about": "So'rovlarni bir nechta Sayt (app) serverlari orasida bo'lib beradi. Bitta server yetmay qolganda kerak.",
        "guide": "lb",
        "fields": {
            "algorithm": {"type": "choice", "default": "round_robin", "label": "algoritm",
                          "choices": [["round_robin", "navbatma-navbat"], ["least_conn", "eng bo'shiga"]]},
            "health_check": {"type": "bool", "default": True, "label": "health check", "fmt": "onoff"},
        },
    },

    # --- Ilova qatlami ----------------------------------------------------
    "app": {
        "title": "Sayt", "subtitle": "gunicorn + django", "layer": "ilova",
        "color": "#d6e5f6", "icon": "server", "shape": "stack",
        "cost": 0, "cpu": 0.05, "ram_mb": 60, "power_w": 2, "max_count": 6,
        "per_unit": {"field": "workers", "cpu": 0.2, "ram_mb": 150, "power_w": 5},
        "about": "Django kodi Gunicorn workerlarida ishlaydi. 1 worker bir vaqtda 1 ta so'rovga xizmat qiladi. "
                 "Bir nechta Sayt blokini turli serverlarga qo'yib, Load Balancer bilan bo'lish mumkin.",
        "guide": "bottleneck",
        "fields": {
            "workers": {"type": "int", "default": 2, "min": 1, "max": 16, "label": "workerlar"},
        },
    },
    "worker": {
        "title": "Fon ishchisi", "subtitle": "celery", "layer": "ilova",
        "color": "#cfe3b2", "icon": "gear", "shape": "hex",
        "cost": 0, "cpu": 0.1, "ram_mb": 100, "power_w": 20, "max_count": 3,
        "per_unit": {"field": "concurrency", "cpu": 0.2, "ram_mb": 100, "power_w": 5},
        "job_seconds": 1.5,
        "about": "Og'ir ishlarni (Excel hisobot) saytdan olib, navbat orqali bajaradi.",
        "guide": "background",
        "fields": {
            "concurrency": {"type": "int", "default": 2, "min": 1, "max": 8, "label": "jarayonlar"},
            "max_queue": {"type": "int", "default": 0, "min": 0, "max": 10000, "label": "navbat limiti"},
        },
    },
    "tgbot": {
        "title": "Telegram bot", "subtitle": "aiogram", "layer": "ilova",
        "color": "#d3e9f7", "icon": "plane", "shape": "disc",
        "cost": 0, "cpu": 0.1, "ram_mb": 80, "power_w": 5, "max_count": 1,
        "about": "Mijozlar saytga kirmasdan Telegramda ishlaydi: yangi mijozlar oqimi (+2% o'sish/kun). "
                 "Ulash: Foydalanuvchilar → Telegram bot → Sayt (API) yoki PostgreSQL. Token .env da.",
        "guide": "telegram",
        "fields": {
            "mode": {"type": "choice", "default": "polling", "label": "rejim",
                     "choices": [["polling", "polling (bot o'zi so'raydi)"], ["webhook", "webhook (HTTPS kerak)"]]},
        },
    },
    "auth": {
        "title": "Avtorizatsiya", "subtitle": "OTP: SMS / email", "layer": "ilova",
        "color": "#e3f0d4", "icon": "shield", "shape": "lock",
        "cost": 0, "cpu": 0.05, "ram_mb": 40, "power_w": 0, "max_count": 1,
        "about": "Kirish: mijoz telefon yoki email kiritadi → unga 6 xonali bir martalik kod (OTP) yuboriladi → "
                 "kodni yozsa — kirdi. Ulash: Sayt → Avtorizatsiya → Redis (kod 5 daqiqa saqlanadi). "
                 "Akkaunt bo'lsa mijozlar qaytib keladi: sotuv +10%. SMS pullik ($0.02), email bepul.",
        "guide": "auth",
        "fields": {
            "method": {"type": "choice", "default": "email", "label": "kod qayerga",
                       "choices": [["email", "email (bepul)"], ["sms", "SMS telefon ($0.02 / kod)"]]},
            "ttl": {"type": "int", "default": 300, "min": 60, "max": 900, "label": "kod amal qiladi (s)"},
            "attempts": {"type": "int", "default": 5, "min": 3, "max": 10, "label": "urinishlar"},
        },
    },
    "payment": {
        "title": "To'lov shlyuzi", "subtitle": "tashqi API", "layer": "ilova",
        "color": "#fde3a7", "icon": "card", "external": True, "shape": "card",
        "cost": 0, "cpu": 0, "ram_mb": 0, "power_w": 0, "max_count": 1,
        "about": "Mijozlardan pul yig'ish. Usiz daromad 0! Saytga ulang. Karta ma'lumoti ketgani uchun faqat HTTPS (SSL) bilan ishlaydi.",
        "guide": "https",
        "fields": {},
    },

    # --- Ma'lumot qatlami -------------------------------------------------
    "postgres": {
        "title": "PostgreSQL", "subtitle": "baza", "layer": "malumot",
        "color": "#e7ddf5", "icon": "db", "shape": "cyl",
        "cost": 0, "cpu": 0.5, "ram_mb": 256, "power_w": 40, "max_count": 1,
        "capacity_qps": 300,
        "about": "Asosiy baza. ~300 so'rov/s ko'taradi. Yozishlar faqat shu yerga boradi.",
        "guide": "cache",
        "fields": {
            "max_connections": {"type": "int", "default": 100, "min": 10, "max": 500, "label": "max ulanish"},
            "listen": {"type": "choice", "default": "localhost", "label": "listen",
                       "choices": [["localhost", "localhost"], ["*", "* (hamma)"]]},
        },
    },
    "replica": {
        "title": "Read replica", "subtitle": "o'qish nusxasi", "layer": "malumot",
        "color": "#ebe3f1", "icon": "db", "shape": "cyl2",
        "cost": 0, "cpu": 0.5, "ram_mb": 256, "power_w": 40, "max_count": 3,
        "capacity_qps": 300,
        "about": "Bazaning faqat o'qish uchun nusxasi. Sayt unga ulansa, o'qishlarning 80% i shu yerga ketadi.",
        "guide": "replica",
        "fields": {},
    },
    "pgbouncer": {
        "title": "PgBouncer", "subtitle": "ulanish hovuzi", "layer": "malumot",
        "color": "#e8efd9", "icon": "pool", "shape": "ring",
        "cost": 0, "cpu": 0.1, "ram_mb": 20, "power_w": 5, "max_count": 1,
        "about": "Bazaga ulanishlarni qayta ishlatadi: 100 ta worker bazada atigi 20 ta ulanish ochadi.",
        "guide": "replica",
        "fields": {},
    },
    "redis": {
        "title": "Redis", "subtitle": "kesh", "layer": "malumot",
        "color": "#f6cfc7", "icon": "db", "shape": "puck",
        "cost": 0, "cpu": 0.1, "ram_mb": 64, "power_w": 10, "max_count": 1,
        "about": "Kesh. Saytga ulansa, bazaga o'qish so'rovlarining ~70% ini o'zi oladi.",
        "guide": "cache",
        "fields": {
            "bind": {"type": "choice", "default": "127.0.0.1", "label": "bind",
                     "choices": [["127.0.0.1", "127.0.0.1"], ["0.0.0.0", "0.0.0.0"]]},
            "password": {"type": "bool", "default": False, "label": "parol (requirepass)", "fmt": "yesno"},
        },
    },
    "media": {
        "title": "media/", "subtitle": "fayllar", "layer": "malumot",
        "color": "#fbe5bd", "icon": "folder", "shape": "folder",
        "cost": 0, "cpu": 0, "ram_mb": 0, "power_w": 5, "max_count": 1,
        "about": "Yuklangan va fonda yaratilgan Excel fayllar shu yerda saqlanadi.",
        "fields": {
            "disk_gb": {"type": "int", "default": 20, "min": 5, "max": 500, "label": "disk GB"},
        },
    },
}

LAYERS = [
    ["server", "Serverlar"],
    ["kirish", "Kirish qatlami"],
    ["ilova", "Ilova qatlami"],
    ["malumot", "Ma'lumot qatlami"],
]

# ---------------------------------------------------------------------------
# Blok konfiguratsiya fayllari.
#   {maydon}          — tahrirlanadigan qiymat (inspektorda input bo'lib chiqadi)
#   "?maydon "        — qator faqat maydon yoqilgan bo'lsa ko'rinadi
#   "?!maydon "       — qator faqat maydon o'chirilgan bo'lsa ko'rinadi
#   "?maydon=qiymat " — qator faqat maydon shu qiymatda bo'lsa ko'rinadi
# ---------------------------------------------------------------------------
BLOCK_CODE = {
    "server": {"file": "/etc/hostname  +  ufw status", "lines": [
        "# tur: {tier}",
        "# internetga ochiq IP: {public}",
        "# ufw (firewall): {firewall}",
        "?firewall ufw default deny incoming",
        "?firewall ufw allow 22,80,443/tcp",
        "?!firewall # firewall o'chiq: serverdagi HAMMA portlar tashqaridan ko'rinadi",
    ]},
    "nginx": {"file": "/etc/nginx/sites-enabled/site", "lines": [
        "server {",
        "    listen 80;",
        "    server_tokens {server_tokens};",
        "",
        "    location / {",
        "        proxy_pass http://upstream;",
        "    }",
        "}",
        "# to'liq konfiguratsiya (SSL bilan): Kod → deploy/nginx.conf",
    ]},
    "lb": {"file": "/etc/haproxy/haproxy.cfg", "lines": [
        "backend sayt",
        "    balance {algorithm}",
        "    # health check: {health_check}",
        "?health_check     option httpchk GET /health/",
        "    # serverlar strelkalar orqali qo'shiladi",
    ]},
    "app": {"file": "/etc/systemd/system/gunicorn.service", "lines": [
        "[Service]",
        "ExecStart=/srv/site/.venv/bin/gunicorn config.wsgi \\",
        "    --workers {workers} \\",
        "    --bind 0.0.0.0:8000",
        "# har bir worker ~0.2 CPU va ~150 MB RAM yeydi",
        "# Kod (settings.py, views.py) 'Kod' bo'limida",
    ]},
    "worker": {"file": "/etc/systemd/system/celery.service", "lines": [
        "ExecStart=/srv/site/.venv/bin/celery -A config worker \\",
        "    --concurrency={concurrency}",
        "# navbat limiti: {max_queue}   (0 = cheksiz)",
    ]},
    "postgres": {"file": "/etc/postgresql/16/main/postgresql.conf", "lines": [
        "listen_addresses = '{listen}'",
        "max_connections = {max_connections}",
        "shared_buffers = 256MB",
    ]},
    "replica": {"file": "postgresql.conf (replica)", "lines": [
        "hot_standby = on",
        "primary_conninfo = 'host=primary user=replicator'",
    ]},
    "pgbouncer": {"file": "/etc/pgbouncer/pgbouncer.ini", "lines": [
        "pool_mode = transaction",
        "default_pool_size = 20",
    ]},
    "redis": {"file": "/etc/redis/redis.conf", "lines": [
        "bind {bind}",
        "port 6379",
        "# parol: {password}",
        "?password requirepass ${REDIS_PASSWORD}",
        "?!password # requirepass yo'q",
    ]},
    "media": {"file": "/srv/site/media/", "lines": ["# disk hajmi: {disk_gb} GB"]},
    "cdn": {"file": "cdn.provider/dashboard", "lines": ["# /static/ va /media/ rasmlari chetdagi serverlardan beriladi"]},
    "tgbot": {"file": "/etc/systemd/system/tgbot.service", "lines": [
        "ExecStart=/srv/site/.venv/bin/python bot/main.py",
        "# rejim: {mode}",
        "?mode=webhook # webhook: Telegram https://domen/tg/ ga yuboradi — SSL bo'lmasa ishlamaydi",
        "?mode=polling # polling: bot har soniya Telegramdan yangi xabar so'raydi",
        "# kod: Kod → bot/main.py · token: .env → TELEGRAM_BOT_TOKEN",
    ]},
    "auth": {"file": "accounts/otp.py", "lines": [
        "# OTP: bir martalik kod. Yuborish usuli: {method}",
        "CODE_TTL = {ttl}          # soniya — keyin kod yaroqsiz",
        "MAX_ATTEMPTS = {attempts}     # ko'p noto'g'ri urinish — bloklanadi (taxmin qilib bo'lmasin)",
        "?method=sms # SMS: provayder API (masalan Eskiz) → kalit .env: SMS_API_KEY",
        "?method=email # Email: SMTP → parol .env: EMAIL_HOST_PASSWORD",
        "# kod Redis'da saqlanadi:  otp:<telefon> = 482913  (TTL bilan o'zi o'chadi)",
    ]},
    "payment": {"file": "payment.provider/dashboard", "lines": [
        "api_key = ${WEBHOOK_SECRET}",
        "# Sayt to'lov so'rovini API orqali yuboradi, javobni bazaga yozadi",
    ]},
    "users": {"file": "internet", "lines": ["# Foydalanuvchilar sayt sifatiga qarab keladi yoki ketadi."]},
}

# ---------------------------------------------------------------------------
# Xonaning SAYT KODI. Bu bloklarga emas, butun xonaga tegishli:
# bitta kod hamma Sayt serverlariga bir xil "deploy" qilinadi.
# ---------------------------------------------------------------------------
CODE_FIELDS = {
    "debug": {"type": "bool", "default": True, "label": "DEBUG", "fmt": "pybool"},
    "secret_source": {"type": "choice", "default": "hardcoded", "label": "SECRET_KEY manbai",
                      "choices": [["hardcoded", "kod ichida"], ["env", ".env dan"]]},
    "env_gitignored": {"type": "bool", "default": False, "label": ".env gitignore da", "fmt": "yesno"},
    "repo_public": {"type": "bool", "default": True, "label": "repo ochiq", "fmt": "yesno"},
    "report_mode": {"type": "choice", "default": "sync", "label": "hisobot",
                    "choices": [["sync", "sinxron"], ["background", "fonda"]]},
    "ssl_redirect": {"type": "bool", "default": False, "label": "SECURE_SSL_REDIRECT", "fmt": "pybool"},
}

# Saytning API manzillari: qaysi kod sozlamasi va qaysi bloklar ishtirok etadi
ENDPOINTS = [
    {"path": "/", "method": "GET", "what": "Bosh sahifa", "flow": "Nginx → Sayt → Baza (3 so'rov, Redis bo'lsa 1)", "field": None},
    {"path": "/api/report/", "method": "GET", "what": "Excel hisobot", "flow": "sinxron: Sayt 2 s · fonda: navbat → Fon ishchisi → media/", "field": "report_mode"},
    {"path": "/smeta/<id>/", "method": "GET", "what": "Bitta smeta", "flow": "Sayt → Baza (o'qish: replica bo'lsa o'sha yerdan)", "field": None},
    {"path": "/upload/", "method": "POST", "what": "Excel yuklash", "flow": "Nginx → Sayt → media/", "field": None},
    {"path": "/pay/", "method": "POST", "what": "To'lov", "flow": "Sayt → To'lov shlyuzi API → Baza (faqat HTTPS)", "field": None},
    {"path": "/tg/", "method": "POST", "what": "Telegram webhook", "flow": "Telegram → Nginx → bot (HTTPS shart)", "field": None},
    {"path": "/auth/otp/", "method": "POST", "what": "Kod yuborish (OTP)", "flow": "Sayt → Avtorizatsiya → Redis + SMS/email", "field": None},
    {"path": "/auth/verify/", "method": "POST", "what": "Kodni tekshirish", "flow": "Avtorizatsiya → Redis → sessiya", "field": None},
    {"path": "/login/", "method": "POST", "what": "Kirish", "flow": "Sayt → Baza (sessiya SECRET_KEY bilan imzolanadi)", "field": "secret_source"},
]


# ---------------------------------------------------------------------------
# Yordamchi funksiyalar
# ---------------------------------------------------------------------------
def default_config(kind):
    return {name: f["default"] for name, f in BLOCKS[kind]["fields"].items()}


def default_code():
    return {name: f["default"] for name, f in CODE_FIELDS.items()}


def new_env():
    """Yangi tasodifiy sirlar (.env). Kalitni 'almashtirish' = shu funksiyani qayta chaqirish."""
    return {
        "SECRET_KEY": "django-insecure-" + secrets.token_urlsafe(18),
        "DB_PASSWORD": secrets.token_urlsafe(9),
        "REDIS_PASSWORD": secrets.token_urlsafe(9),
        "WEBHOOK_SECRET": "whsec_" + secrets.token_hex(8),
        "SMS_API_KEY": "sms_" + secrets.token_hex(10),
        "EMAIL_HOST_PASSWORD": secrets.token_urlsafe(12),
        "TELEGRAM_BOT_TOKEN": f"{secrets.randbelow(9_000_000_000) + 1_000_000_000}:AA" + secrets.token_urlsafe(24),
    }


def _clean(fields, data, base):
    result = dict(base)
    for name, field in fields.items():
        if name not in data:
            continue
        value = data[name]
        if field["type"] == "bool":
            result[name] = value in (True, "true", "True", "1", 1, "on")
        elif field["type"] == "int":
            try:
                value = int(value)
            except (TypeError, ValueError):
                continue
            result[name] = max(field["min"], min(field["max"], value))
        elif field["type"] == "choice":
            if value in [c[0] for c in field["choices"]]:
                result[name] = value
    return result


def clean_config(kind, data):
    """Blok sozlamalarini oq ro'yxat bo'yicha tekshiradi."""
    return _clean(BLOCKS[kind]["fields"], data, default_config(kind))


def clean_code(data, current):
    """Sayt kodi sozlamalarini oq ro'yxat bo'yicha tekshiradi."""
    return _clean(CODE_FIELDS, data, {**default_code(), **current})


def block_resources(kind, config):
    """Blok qancha CPU, RAM va elektr yeyishini qaytaradi (server blokining o'zi bundan mustasno)."""
    spec = BLOCKS[kind]
    cpu, ram, power = spec["cpu"], spec["ram_mb"], spec["power_w"]
    unit = spec.get("per_unit")
    if unit:
        n = config.get(unit["field"], 1)
        cpu += unit["cpu"] * n
        ram += unit["ram_mb"] * n
        power += unit["power_w"] * n
    return round(cpu, 2), ram, power


def _format_value(field, value):
    if field["type"] == "bool":
        fmt = field.get("fmt")
        if fmt == "pybool":
            return "True" if value else "False"
        if fmt == "yesno":
            return "ha" if value else "yo'q"
        return "on" if value else "off"
    return str(value)


def render_lines(lines, fields, values, env=None):
    """Shablonni oddiy matnga aylantiradi (Git diff va hujumchi ko'radigan fayllar uchun)."""
    out = []
    for raw in lines:
        line = raw
        if raw.startswith("?"):
            cond, line = raw[1:].split(" ", 1)
            negate = cond.startswith("!")
            cond = cond.lstrip("!")
            if "=" in cond:
                name, expected = cond.split("=", 1)
                ok = str(values.get(name)) == expected
            else:
                ok = bool(values.get(cond))
            if ok == negate:
                continue
        for name, field in fields.items():
            line = line.replace("{" + name + "}", _format_value(field, values.get(name)))
        for key, val in (env or {}).items():
            line = line.replace("${" + key + "}", val)
        out.append(line)
    return out


def render_code(kind, config):
    spec = BLOCKS[kind]
    return render_lines(BLOCK_CODE.get(kind, {}).get("lines", []), spec["fields"], config)


def public_catalog():
    """Brauzerga yuboriladigan katalog (JS shu bilan asboblar panelini chizadi)."""
    return {
        "blocks": BLOCKS,
        "layers": LAYERS,
        "servers": SERVER_TIERS,
        "block_code": BLOCK_CODE,
        "code_fields": CODE_FIELDS,
        "project_files": project.FILES,
        "field_types": project.FIELD_TYPES,
        "launch": launch.STEPS,
        "requirements": rules.REQUIREMENTS,
        "businesses": business.public(),
        "growth": growth.public(),
        "electricity_price": ELECTRICITY_PRICE,
        "domain_cost": launch.DOMAIN_COST,
        "domain_zones": launch.DOMAIN_ZONES,
        "endpoints": ENDPOINTS,
        "power_upgrade": {"step_w": POWER_UPGRADE_STEP_W, "cost": POWER_UPGRADE_COST},
    }
