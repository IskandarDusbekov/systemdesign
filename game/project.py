"""
10-QADAM. SAYT LOYIHASINING FAYLLARI (Kod bo'limidagi fayl daraxti).

Har bir fayl — shablon. Belgilar:
    {maydon}        — o'yinchi o'zgartira oladigan joy (catalog.CODE_FIELDS)
    [[kalit]]       — xonadan olinadigan qiymat (domen, repo, IP ...), o'zgartirilmaydi
    [[ro'yxat]]     — qatorning o'zi faqat shu bo'lsa: bir nechta qatorga yoyiladi (modellar)
    ${KALIT}        — .env dagi sir
    "?shart "       — qator faqat shart rost bo'lsa ko'rinadi (?!shart — yolg'on bo'lsa)
    "?shart=qiymat "
Fayl "when" kaliti bo'lsa — faqat o'sha shart rost bo'lganda daraxtda ko'rinadi.

Shu yerda Django modellari (Model quruvchi) uchun kod va migratsiya generatori ham bor.
"""

import keyword
import re

FILES = [
    {"path": "README.md", "lang": "md", "lines": [
        "# [[project]]",
        "",
        "Repo:  github.com/[[repo]]",
        "Sayt:  [[scheme]]://[[domain]]",
        "",
        "## Ishga tushirish (lokal)",
        "    python -m venv .venv",
        "    .venv/bin/pip install -r requirements.txt",
        "    .venv/bin/python manage.py migrate",
        "    .venv/bin/python manage.py runserver",
    ]},
    {"path": "manage.py", "lang": "python", "lines": [
        "#!/usr/bin/env python",
        "import os",
        "import sys",
        "",
        "if __name__ == \"__main__\":",
        "    os.environ.setdefault(\"DJANGO_SETTINGS_MODULE\", \"config.settings\")",
        "    from django.core.management import execute_from_command_line",
        "    execute_from_command_line(sys.argv)",
    ]},
    {"path": "requirements.txt", "lang": "txt", "lines": [
        "Django==5.1.4",
        "gunicorn==23.0.0",
        "psycopg[binary]==3.2.3",
        "python-dotenv==1.0.1",
        "?has_worker celery==5.4.0",
        "?has_redis redis==5.2.1",
        "?has_bot aiogram==3.15.0",
        "?has_payment requests==2.32.3",
    ]},
    {"path": ".env", "lang": "env", "lines": [
        "# Sirlar. Bu fayl HECH QACHON Git'ga tushmasligi kerak (.gitignore).",
        "SECRET_KEY=${SECRET_KEY}",
        "DB_PASSWORD=${DB_PASSWORD}",
        "REDIS_PASSWORD=${REDIS_PASSWORD}",
        "WEBHOOK_SECRET=${WEBHOOK_SECRET}",
        "TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}",
    ]},
    {"path": ".gitignore", "lang": "txt", "lines": [
        "__pycache__/",
        "*.pyc",
        ".venv/",
        "media/",
        "staticfiles/",
        "# .env gitignore da: {env_gitignored}",
        "?env_gitignored .env",
        "?!env_gitignored # .env yo'q — u Git'ga tushib qolishi mumkin!",
        "",
        "# repo ochiq (public): {repo_public}",
    ]},
    {"path": "config/__init__.py", "lang": "python", "lines": []},
    {"path": "config/settings.py", "lang": "python", "lines": [
        "\"\"\"",
        "[[project]] sozlamalari. Bu fayl hamma Sayt serverlariga bir xil deploy qilinadi.",
        "\"\"\"",
        "import os",
        "from pathlib import Path",
        "",
        "from dotenv import load_dotenv",
        "",
        "BASE_DIR = Path(__file__).resolve().parent.parent",
        "load_dotenv(BASE_DIR / \".env\")",
        "",
        "# Xato sahifasi. Productionda doim False bo'lishi kerak",
        "DEBUG = {debug}",
        "",
        "# SECRET_KEY manbai: {secret_source}",
        "?secret_source=hardcoded SECRET_KEY = \"${SECRET_KEY}\"    # <- kod ichida! Git'ga tushadi",
        "?secret_source=env SECRET_KEY = os.environ[\"SECRET_KEY\"]",
        "",
        "ALLOWED_HOSTS = [\"[[domain]]\", \"www.[[domain]]\"]",
        "",
        "INSTALLED_APPS = [",
        "    \"django.contrib.admin\",",
        "    \"django.contrib.auth\",",
        "    \"django.contrib.contenttypes\",",
        "    \"django.contrib.sessions\",",
        "    \"django.contrib.messages\",",
        "    \"django.contrib.staticfiles\",",
        "    \"smeta\",",
        "]",
        "",
        "DATABASES = {",
        "    \"default\": {",
        "        \"ENGINE\": \"django.db.backends.postgresql\",",
        "        \"NAME\": \"[[project]]\",",
        "        \"USER\": \"[[project]]\",",
        "        \"PASSWORD\": os.environ[\"DB_PASSWORD\"],",
        "?has_pgbouncer         \"HOST\": \"127.0.0.1\", \"PORT\": 6432,    # PgBouncer orqali",
        "?!has_pgbouncer         \"HOST\": \"127.0.0.1\", \"PORT\": 5432,",
        "    }",
        "}",
        "?has_replica DATABASE_ROUTERS = [\"config.routers.ReplicaRouter\"]    # o'qishlar replica'ga",
        "",
        "?has_redis CACHES = {\"default\": {",
        "?has_redis     \"BACKEND\": \"django.core.cache.backends.redis.RedisCache\",",
        "?has_redis     \"LOCATION\": \"redis://:\" + os.environ[\"REDIS_PASSWORD\"] + \"@127.0.0.1:6379/0\",",
        "?has_redis }}",
        "?has_worker CELERY_BROKER_URL = \"redis://127.0.0.1:6379/1\"",
        "",
        "# HTTPS: HTTP so'rovlarni HTTPS ga yo'naltirish, cookie'larni faqat HTTPS da yuborish",
        "SECURE_SSL_REDIRECT = {ssl_redirect}",
        "SESSION_COOKIE_SECURE = {ssl_redirect}",
        "CSRF_COOKIE_SECURE = {ssl_redirect}",
        "SECURE_PROXY_SSL_HEADER = (\"HTTP_X_FORWARDED_PROTO\", \"https\")",
        "",
        "STATIC_URL = \"/static/\"",
        "STATIC_ROOT = BASE_DIR / \"staticfiles\"",
        "MEDIA_ROOT = BASE_DIR / \"media\"",
    ]},
    {"path": "config/urls.py", "lang": "python", "lines": [
        "from django.contrib import admin",
        "from django.urls import include, path",
        "",
        "urlpatterns = [",
        "    path(\"admin/\", admin.site.urls),",
        "    path(\"\", include(\"smeta.urls\")),",
        "]",
    ]},
    {"path": "config/wsgi.py", "lang": "python", "lines": [
        "# Gunicorn shu faylni ishga tushiradi:  gunicorn config.wsgi",
        "import os",
        "",
        "from django.core.wsgi import get_wsgi_application",
        "",
        "os.environ.setdefault(\"DJANGO_SETTINGS_MODULE\", \"config.settings\")",
        "application = get_wsgi_application()",
    ]},
    {"path": "smeta/__init__.py", "lang": "python", "lines": []},
    {"path": "smeta/models.py", "lang": "python", "lines": [
        "from django.conf import settings",
        "from django.db import models",
        "",
        "# Modellarni o'ngdagi 'Model quruvchi' bilan o'zgartiring.",
        "# Har o'zgarish: makemigrations -> yangi fayl smeta/migrations/ da -> deploy (migrate).",
        "",
        "",
        "[[models_code]]",
    ]},
    {"path": "smeta/admin.py", "lang": "python", "lines": [
        "from django.contrib import admin",
        "",
        "from . import models",
        "",
        "[[admin_code]]",
    ]},
    {"path": "smeta/views.py", "lang": "python", "lines": [
        "import os",
        "",
        "from django.contrib.auth.decorators import login_required",
        "from django.http import FileResponse, JsonResponse",
        "from django.shortcuts import render",
        "?has_payment import requests",
        "",
        "?report_mode=sync from .reports import build_excel_report",
        "?report_mode=background from .tasks import build_excel_report",
        "",
        "",
        "def home(request):",
        "    return render(request, \"home.html\")",
        "",
        "",
        "# hisobot rejimi: {report_mode}",
        "@login_required",
        "def report(request):",
        "?report_mode=sync     data = build_excel_report(request.user)    # ~2 s, worker shu vaqt band",
        "?report_mode=sync     return FileResponse(data, filename=\"hisobot.xlsx\")",
        "?report_mode=background     job = build_excel_report.delay(request.user.id)    # 50 ms, ish fonda",
        "?report_mode=background     return JsonResponse({\"job\": job.id}, status=202)",
        "?has_payment ",
        "?has_payment ",
        "?has_payment @login_required",
        "?has_payment def pay(request):",
        "?has_payment     # To'lov shlyuzi API: karta ma'lumoti shu so'rovda ketadi — faqat HTTPS!",
        "?has_payment     r = requests.post(\"https://pay.provider/api/charge\", json={\"amount\": 50000},",
        "?has_payment                       headers={\"Authorization\": os.environ[\"WEBHOOK_SECRET\"]}, timeout=10)",
        "?has_payment     return JsonResponse(r.json())",
    ]},
    {"path": "smeta/urls.py", "lang": "python", "lines": [
        "from django.urls import path",
        "",
        "from . import views",
        "",
        "urlpatterns = [",
        "    path(\"\", views.home),",
        "    path(\"api/report/\", views.report),",
        "?has_payment     path(\"pay/\", views.pay),",
        "]",
    ]},
    {"path": "smeta/tasks.py", "lang": "python", "when": "has_worker", "lines": [
        "from celery import shared_task",
        "",
        "from .reports import make_xlsx",
        "",
        "",
        "@shared_task",
        "def build_excel_report(user_id):",
        "    path = make_xlsx(user_id)     # ~1.5 s — lekin endi foydalanuvchi kutib turmaydi",
        "    return str(path)              # tayyor fayl media/ ga yoziladi",
    ]},
    {"path": "bot/main.py", "lang": "python", "when": "has_bot", "lines": [
        "\"\"\"",
        "Telegram bot (aiogram). Bot — alohida jarayon: serverda ishlaydi va Telegram API bilan gaplashadi.",
        "Foydalanuvchi botga yozadi -> Telegram -> bot -> Sayt API (yoki baza) -> javob.",
        "\"\"\"",
        "import asyncio",
        "import os",
        "",
        "import aiohttp",
        "from aiogram import Bot, Dispatcher, types",
        "from aiogram.filters import Command",
        "",
        "bot = Bot(token=os.environ[\"TELEGRAM_BOT_TOKEN\"])    # token @BotFather dan, faqat .env da",
        "dp = Dispatcher()",
        "",
        "",
        "@dp.message(Command(\"start\"))",
        "async def start(message: types.Message):",
        "    await message.answer(\"Salom! Smetalaringiz: /smetalar\")",
        "",
        "",
        "@dp.message(Command(\"smetalar\"))",
        "async def smetalar(message: types.Message):",
        "    async with aiohttp.ClientSession() as s:",
        "        async with s.get(\"[[scheme]]://[[domain]]/api/smeta/?tg=\" + str(message.from_user.id)) as r:",
        "            data = await r.json()",
        "    await message.answer(\"\\n\".join(x[\"title\"] for x in data) or \"Smeta yo'q\")",
        "",
        "",
        "# rejim: [[bot_mode]]",
        "?bot_webhook # webhook: Telegram xabarni o'zi https://[[domain]]/tg/ ga yuboradi — HTTPS SHART",
        "?bot_webhook # dp.run_webhook(bot, url=\"https://[[domain]]/tg/\")",
        "?!bot_webhook asyncio.run(dp.start_polling(bot))    # polling: bot o'zi Telegramdan so'rab turadi",
    ]},
    {"path": "deploy/nginx.conf", "lang": "nginx", "lines": [
        "# /etc/nginx/sites-enabled/[[project]]",
        "server {",
        "    listen 80;",
        "    server_name [[domain]] www.[[domain]];",
        "?ssl_redirect     return 301 https://$host$request_uri;    # HTTP -> HTTPS",
        "?!ssl_redirect     location / { proxy_pass http://127.0.0.1:8000; }    # HTTP ham qabul qilinadi — ochiq matn!",
        "}",
        "?ssl ",
        "?ssl server {",
        "?ssl     listen 443 ssl;",
        "?ssl     server_name [[domain]] www.[[domain]];",
        "?ssl     ssl_certificate     /etc/letsencrypt/live/[[domain]]/fullchain.pem;    # certbot qo'ydi",
        "?ssl     ssl_certificate_key /etc/letsencrypt/live/[[domain]]/privkey.pem;",
        "?ssl     location / { proxy_pass http://127.0.0.1:8000; }",
        "?ssl }",
        "?!ssl # 443 (HTTPS) yo'q: sertifikat olinmagan (🚀 5-qadam)",
    ]},
    {"path": "deploy/gunicorn.service", "lang": "ini", "lines": [
        "[Unit]",
        "Description=[[project]] gunicorn",
        "After=network.target",
        "",
        "[Service]",
        "WorkingDirectory=/srv/[[project]]",
        "EnvironmentFile=/srv/[[project]]/.env",
        "ExecStart=/srv/[[project]]/.venv/bin/gunicorn config.wsgi --bind 127.0.0.1:8000",
        "Restart=always",
        "",
        "[Install]",
        "WantedBy=multi-user.target",
    ]},
    {"path": "deploy/deploy.sh", "lang": "bash", "lines": [
        "#!/bin/bash",
        "# Serverga yangi kodni tortib olish (🚀 4-qadam)",
        "ssh root@[[server_ip]] << 'EOF'",
        "  cd /srv/[[project]]",
        "  git pull origin main",
        "  .venv/bin/pip install -r requirements.txt",
        "  .venv/bin/python manage.py migrate",
        "  .venv/bin/python manage.py collectstatic --noinput",
        "  systemctl restart gunicorn",
        "EOF",
    ]},
]

FILE_INDEX = {f["path"]: f for f in FILES}


# ---------------------------------------------------------------------------
# Shablonni matnga aylantirish (Git diff uchun). JS da xuddi shu qoida (static/game/js/tpl.js).
# ---------------------------------------------------------------------------
def _fmt(field, value):
    if field["type"] == "bool":
        fmt = field.get("fmt")
        if fmt == "pybool":
            return "True" if value else "False"
        if fmt == "yesno":
            return "ha" if value else "yo'q"
        return "on" if value else "off"
    return str(value)


def render(lines, fields, values, env=None):
    out = []
    for raw in lines:
        line = raw
        if raw.startswith("?"):
            cond, line = (raw[1:].split(" ", 1) + [""])[:2]
            negate = cond.startswith("!")
            cond = cond.lstrip("!")
            if "=" in cond:
                name, expected = cond.split("=", 1)
                ok = str(values.get(name)) == expected
            else:
                ok = bool(values.get(cond))
            if ok == negate:
                continue
        m = re.fullmatch(r"\s*\[\[(\w+)\]\]\s*", line)
        if m and isinstance(values.get(m.group(1)), list):
            out.extend(values[m.group(1)])
            continue
        for name, field in fields.items():
            line = line.replace("{" + name + "}", _fmt(field, values.get(name)))
        line = re.sub(r"\[\[(\w+)\]\]", lambda mm: str(values.get(mm.group(1), "")), line)
        for key, val in (env or {}).items():
            line = line.replace("${" + key + "}", val)
        out.append(line)
    return out


def visible_files(values, schema):
    """Daraxtda ko'rinadigan fayllar (+ migratsiyalar)."""
    files = [f for f in FILES if not f.get("when") or values.get(f["when"])]
    for mig in schema.get("migrations", []):
        files.append({"path": f"smeta/migrations/{mig['name']}.py", "lang": "python", "lines": mig["lines"],
                      "generated": True})
    return files


# ---------------------------------------------------------------------------
# Model quruvchi
# ---------------------------------------------------------------------------
FIELD_TYPES = {
    "CharField": "matn (qisqa)",
    "TextField": "matn (uzun)",
    "IntegerField": "butun son",
    "DecimalField": "pul / kasr",
    "BooleanField": "ha / yo'q",
    "DateTimeField": "sana-vaqt",
    "ForeignKey": "bog'lanish →",
}
MAX_MODELS = 8
MAX_FIELDS = 12


class SchemaError(Exception):
    pass


def default_schema(kind):
    if kind != "scenario":
        return {"models": [], "migrations": []}
    models = [
        {"name": "Smeta", "fields": [
            {"name": "owner", "type": "ForeignKey", "to": "User"},
            {"name": "title", "type": "CharField", "max_length": 200},
            {"name": "total", "type": "DecimalField"},
            {"name": "created", "type": "DateTimeField"},
        ]},
        {"name": "SmetaItem", "fields": [
            {"name": "smeta", "type": "ForeignKey", "to": "Smeta"},
            {"name": "name", "type": "CharField", "max_length": 200},
            {"name": "qty", "type": "IntegerField"},
            {"name": "price", "type": "DecimalField"},
        ]},
    ]
    schema = {"models": [], "migrations": []}
    return apply_models(schema, models)[0]


def clean_models(raw):
    if not isinstance(raw, list) or len(raw) > MAX_MODELS:
        raise SchemaError(f"Ko'pi bilan {MAX_MODELS} ta model.")
    names = [str(m.get("name", "")).strip() for m in raw if isinstance(m, dict)]
    result = []
    for m, name in zip(raw, names):
        if not re.fullmatch(r"[A-Z][A-Za-z0-9]{1,30}", name):
            raise SchemaError(f"Model nomi '{name}' noto'g'ri: katta harf bilan, faqat lotin harf va raqam (masalan Order).")
        if name == "User" or names.count(name) > 1:
            raise SchemaError(f"'{name}' nomi band.")
        fields, seen = [], set()
        raw_fields = m.get("fields") or []
        if len(raw_fields) > MAX_FIELDS:
            raise SchemaError(f"{name}: ko'pi bilan {MAX_FIELDS} ta maydon.")
        for f in raw_fields:
            fname = str(f.get("name", "")).strip()
            ftype = f.get("type")
            if not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", fname) or keyword.iskeyword(fname) or fname in ("id", "pk"):
                raise SchemaError(f"{name}: maydon nomi '{fname}' noto'g'ri (kichik harf, masalan price).")
            if fname in seen:
                raise SchemaError(f"{name}: '{fname}' ikki marta.")
            if ftype not in FIELD_TYPES:
                raise SchemaError(f"{name}.{fname}: noma'lum tur.")
            seen.add(fname)
            item = {"name": fname, "type": ftype}
            if ftype == "CharField":
                try:
                    item["max_length"] = max(1, min(500, int(f.get("max_length") or 200)))
                except (TypeError, ValueError):
                    item["max_length"] = 200
            if ftype == "ForeignKey":
                to = f.get("to")
                if to != "User" and to not in names:
                    raise SchemaError(f"{name}.{fname}: bog'lanadigan model topilmadi.")
                item["to"] = to
            fields.append(item)
        result.append({"name": name, "fields": fields})
    return result


def field_code(f):
    t = f["type"]
    if t == "CharField":
        return f"models.CharField(max_length={f.get('max_length', 200)})"
    if t == "DecimalField":
        return "models.DecimalField(max_digits=12, decimal_places=2, default=0)"
    if t == "IntegerField":
        return "models.IntegerField(default=0)"
    if t == "BooleanField":
        return "models.BooleanField(default=False)"
    if t == "DateTimeField":
        return "models.DateTimeField(auto_now_add=True)"
    if t == "ForeignKey":
        to = "settings.AUTH_USER_MODEL" if f["to"] == "User" else f"\"{f['to']}\""
        return f"models.ForeignKey({to}, on_delete=models.CASCADE)"
    return "models.TextField(blank=True)"


def models_code(models):
    if not models:
        return ["# Hali model yo'q. 'Model quruvchi' bilan birinchisini yarating."]
    out = []
    for i, m in enumerate(models):
        if i:
            out += ["", ""]
        out.append(f"class {m['name']}(models.Model):")
        for f in m["fields"]:
            out.append(f"    {f['name']} = {field_code(f)}")
        if not m["fields"]:
            out.append("    pass")
        label = next((f["name"] for f in m["fields"] if f["type"] == "CharField"), None)
        out += ["", "    def __str__(self):", f"        return str(self.{label or 'pk'})"]
    return out


def admin_code(models):
    return [f"admin.site.register(models.{m['name']})" for m in models] or ["# modellar yo'q"]


def _ops(old, new):
    """Ikki sxema orasidagi farq — Django migratsiya operatsiyalari."""
    ops, old_map, new_map = [], {m["name"]: m for m in old}, {m["name"]: m for m in new}
    for name, m in new_map.items():
        if name not in old_map:
            ops.append(f"        migrations.CreateModel(name=\"{name}\", fields=[")
            ops.append("            (\"id\", models.BigAutoField(primary_key=True)),")
            for f in m["fields"]:
                ops.append(f"            (\"{f['name']}\", {field_code(f)}),")
            ops.append("        ]),")
            continue
        of = {f["name"]: f for f in old_map[name]["fields"]}
        nf = {f["name"]: f for f in m["fields"]}
        for fname, f in nf.items():
            if fname not in of:
                ops.append(f"        migrations.AddField(model_name=\"{name.lower()}\", name=\"{fname}\", field={field_code(f)}),")
            elif of[fname] != f:
                ops.append(f"        migrations.AlterField(model_name=\"{name.lower()}\", name=\"{fname}\", field={field_code(f)}),")
        for fname in of:
            if fname not in nf:
                ops.append(f"        migrations.RemoveField(model_name=\"{name.lower()}\", name=\"{fname}\"),")
    for name in old_map:
        if name not in new_map:
            ops.append(f"        migrations.DeleteModel(name=\"{name}\"),")
    return ops


def apply_models(schema, models):
    """Yangi sxema + yangi migratsiya fayli. Qaytaradi: (schema, migratsiya nomi yoki None)."""
    ops = _ops(schema.get("models", []), models)
    if not ops:
        return schema, None
    migs = list(schema.get("migrations", []))
    n = len(migs) + 1
    first = ops[0].strip()
    m = re.search(r'name="(\w+)"', first)
    suffix = "initial" if n == 1 else (m.group(1).lower() if m else "auto")
    name = f"{n:04d}_{suffix}"
    deps = "[migrations.swappable_dependency(settings.AUTH_USER_MODEL)]" if n == 1 \
        else f"[(\"smeta\", \"{migs[-1]['name']}\")]"
    lines = ["# makemigrations avtomatik yaratdi. Qo'lda tahrirlamang.",
             "from django.conf import settings",
             "from django.db import migrations, models",
             "", "",
             "class Migration(migrations.Migration):",
             f"    dependencies = {deps}",
             "    operations = ["] + ops + ["    ]"]
    migs.append({"name": name, "lines": lines})
    return {"models": models, "migrations": migs, "applied": schema.get("applied")}, name
