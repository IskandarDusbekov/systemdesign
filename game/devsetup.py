"""
DARS: NOLDAN DJANGO LOYIHA — dasturchidek, o'z kompyuteringizda (Windows).

O'yinchi haqiqiy dasturchi qiladigan ishni qadamma-qadam bajaradi:
  1. papka + venv + Django o'rnatish (terminal)
  2. startproject → runserver (raketa sahifasi) → startapp → papkalar → PyCharm
  3. settings.py ni sozlash → views.py → app/urls.py → config/urls.py → home.html → runserver
  4. kichik model → makemigrations → migrate → admin.py → createsuperuser
  5. requirements.txt → git init → add → commit → remote → push (GitHub)

Ikki xil vazifa bor:
  kind "cmd"  — terminalda buyruq yoziladi;
  kind "edit" — muharrirda (PyCharm) faylga qator yoziladi. `code` — fayl ko'rinishi,
               "+" bilan boshlangan qatorlarni o'yinchi o'zi yozadi.

Holat: room.flags["dev"] — nechta vazifa bajarilgan; room.flags["dev_v"] = 2 (yangi ro'yxat).
Har buyruqdan keyin "Nima bo'ldi" izohi chiqadi va o'yinchi "Tushundim" bosmaguncha
keyingisiga o'tilmaydi — shoshilmasdan tushunib borsin.
"""

DEV_VERSION = 2

# Maydonlar:
#   id, group, kind ("cmd" | "edit"), ask — vazifa
#   cmd / alt — to'g'ri buyruq(lar) (cmd uchun);  file / code (edit uchun)
#   ps      — buyruqdan keyingi prompt (o'zgarsa)
#   out     — terminal javobi
#   explain — "nima bo'ldi" (sodda tilda);  why — "nega kerak" (ixtiyoriy)
#   reveals — Kod bo'limida ochiladigan fayllar (yo'l boshlanishi)
#   tree    — papkada paydo bo'ladigan narsalar (o'ngdagi EXPLORER)
#   browser — shu qadamdan keyin brauzerda nima ko'rinadi (rocket | home | admin)
G1, G2, G3, G4, G5 = ("1 · Papka va muhit", "2 · Django loyiha", "3 · Sozlash: settings → urls → sahifa",
                      "4 · Model va baza", "5 · GitHub'ga yuklash")

TASKS = [
    # ----------------------------------------------------------------- 1
    {"id": "mkdir", "group": G1, "kind": "cmd",
     "ask": "Loyiha uchun yangi papka yarating",
     "cmd": "mkdir {project}", "alt": ["md {project}"], "out": [],
     "explain": "mkdir (make directory) — yangi papka yaratdi. Har loyiha o'z papkasida turadi, fayllar aralashib ketmaydi.",
     "why": "Keyingi hamma fayllar (kod, venv, baza) shu papka ichida bo'ladi.",
     "reveals": [], "tree": ["{project}/"]},
    {"id": "cd", "group": G1, "kind": "cmd",
     "ask": "Shu papkaga kiring",
     "cmd": "cd {project}", "ps": "C:\\Users\\{user}\\{project}>", "out": [],
     "explain": "cd (change directory) — papkaga kirdingiz. Prompt o'zgardi: endi buyruqlar shu papka ichida bajariladi.",
     "why": "Orqaga chiqish: cd ..   Hozir qayerdaligingizni prompt ko'rsatadi.",
     "reveals": [], "tree": []},
    {"id": "venv", "group": G1, "kind": "cmd",
     "ask": "Virtual muhit (venv) yarating",
     "cmd": "py -m venv venv", "alt": ["python -m venv venv", "python3 -m venv venv"], "out": [],
     "explain": "venv papkasi yaratildi — bu loyihaning shaxsiy Python muhiti. 'py -m venv venv' = venv modulini ishga tushir, "
                "natijani 'venv' papkasiga yoz.",
     "why": "Har loyihaning kutubxonalari alohida turadi: bir loyihada Django 4, boshqasida Django 5 bo'lsa ham xalaqit bermaydi.",
     "reveals": [], "tree": ["venv/"]},
    {"id": "activate", "group": G1, "kind": "cmd",
     "ask": "Virtual muhitni yoqing (activate)",
     "cmd": "venv\\Scripts\\activate",
     "alt": ["venv\\Scripts\\activate.bat", ".\\venv\\Scripts\\activate", "venv/Scripts/activate",
             ".\\venv\\Scripts\\Activate.ps1", "venv\\Scripts\\Activate.ps1", "source venv/bin/activate"],
     "ps": "(venv) C:\\Users\\{user}\\{project}>", "out": [],
     "explain": "Prompt boshida (venv) paydo bo'ldi: terminal endi loyihaning o'z Pythonini ishlatadi. "
                "pip bilan o'rnatgan narsangiz faqat shu loyihaga tushadi.",
     "why": "Har safar terminalni yangidan ochganda activate qilish kerak. Linux/Mac: source venv/bin/activate.",
     "reveals": [], "tree": []},
    {"id": "django", "group": G1, "kind": "cmd",
     "ask": "Django ni o'rnating",
     "cmd": "pip install django", "alt": ["pip install Django", "py -m pip install django", "python -m pip install django"],
     "out": ["Collecting django", "  Downloading Django-5.2-py3-none-any.whl (8.3 MB)",
             "     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 8.3/8.3 MB 4.1 MB/s",
             "Installing collected packages: tzdata, sqlparse, asgiref, django",
             "Successfully installed asgiref-3.8 django-5.2 sqlparse-0.5 tzdata-2025.2"],
     "explain": "pip (Python paket o'rnatuvchi) Django ni internetdan (PyPI) yuklab, venv ichiga o'rnatdi. "
                "Yonida yordamchi kutubxonalar ham keldi (asgiref, sqlparse).",
     "why": "Endi terminalda 'django-admin' buyrug'i paydo bo'ldi — u bilan loyiha yaratamiz.",
     "reveals": [], "tree": []},
    # ----------------------------------------------------------------- 2
    {"id": "startproject", "group": G2, "kind": "cmd",
     "ask": "Django loyihasini yarating (sozlamalar papkasi: config)",
     "cmd": "django-admin startproject config .", "out": [],
     "explain": "Loyiha skeleti yaratildi: manage.py — boshqaruv buyruqlari; config/ — settings.py (sozlamalar), "
                "urls.py (manzillar), wsgi.py (server shu orqali ishga tushiradi).",
     "why": "Oxiridagi nuqta (.) — 'shu papkaning o'ziga yoz'. Nuqtasiz config/config/ bo'lib, ichma-ich papka chiqadi.",
     "reveals": ["manage.py", "config/"], "tree": ["manage.py", "config/", "config/settings.py", "config/urls.py", "config/wsgi.py"]},
    {"id": "rocket", "group": G2, "kind": "cmd",
     "ask": "Loyihani birinchi marta ishga tushirib ko'ring",
     "cmd": "python manage.py runserver", "alt": ["py manage.py runserver"],
     "out": ["Watching for file changes with StatReloader", "System check identified no issues (0 silenced).",
             "You have 18 unapplied migration(s). Run 'python manage.py migrate' to apply them.",
             "Starting development server at http://127.0.0.1:8000/", "Quit the server with CTRL-BREAK.",
             "[20/Nov 10:02:11] \"GET / HTTP/1.1\" 200 10629", "^C   # Ctrl+C — serverni to'xtatdik, davom etamiz"],
     "explain": "Sinov serveri ishga tushdi va brauzerda http://127.0.0.1:8000 ochildi — Django'ning raketa sahifasi. "
                "Bu 'loyiha to'g'ri o'rnatildi' degani. Pastdagi \"GET / 200\" — brauzer so'rov yubordi, server javob berdi.",
     "why": "\"18 unapplied migrations\" ogohlantirishi — baza hali yaratilmagan. Keyinroq migrate qilamiz.",
     "reveals": [], "tree": [], "browser": "rocket"},
    {"id": "startapp", "group": G2, "kind": "cmd",
     "ask": "Saytning asosiy ilovasini (app) yarating",
     "cmd": "python manage.py startapp app", "alt": ["py manage.py startapp app"], "out": [],
     "explain": "app/ papkasi yaratildi: models.py — jadvallar, views.py — sahifalar, admin.py — admin panel, "
                "migrations/ — baza o'zgarishlari tarixi.",
     "why": "Loyiha = bir nechta ilova (do'kon, akkauntlar, blog...). Har ilova o'z vazifasini bajaradi.",
     "reveals": ["app/", "accounts/", "bot/"],
     "tree": ["app/", "app/models.py", "app/views.py", "app/admin.py", "app/migrations/"]},
    {"id": "dirs", "group": G2, "kind": "cmd",
     "ask": "HTML shablonlar, statik fayllar va yuklamalar uchun papkalar yarating",
     "cmd": "mkdir templates static media", "alt": ["md templates static media"], "out": [],
     "explain": "Uchta papka: templates/ — HTML sahifalar; static/ — CSS, JS, logo (hamma uchun bir xil); "
                "media/ — foydalanuvchi yuklagan fayllar (mahsulot rasmi, avatar).",
     "why": "Django bu papkalarni o'zi bilmaydi — keyingi bosqichda settings.py ga yozib qo'yamiz.",
     "reveals": ["templates/", "static/", "media/"], "tree": ["templates/", "static/", "media/"]},
    {"id": "editor", "group": G2, "kind": "cmd",
     "ask": "Loyihani PyCharm da oching",
     "cmd": "pycharm .", "alt": ["charm .", "pycharm64 .", "pycharm64.exe .", "code ."],
     "out": ["# PyCharm ochildi: chapda Project (fayllar), o'rtada muharrir, pastda — shu terminal.",
             "# Interpreter: venv\Scripts\python.exe (PyCharm venv ni o'zi topdi)",
             "# Yangi fayllar: .env (sirlar), .gitignore, README.md"],
     "explain": "'pycharm .' — joriy papkani PyCharm da ochdi (nuqta — shu papka). PyCharm — Python uchun eng qulay muharrir: "
                "xatolarni yozayotganda ko'rsatadi, Django ni taniydi. Sirlar (SECRET_KEY, parollar) .env faylida turadi, "
                ".env esa .gitignore ga yozilgan — GitHub'ga tushmaydi.",
     "why": "Keyingi qadamlarda kodni o'zingiz yozasiz: muharrirda yashil qator — siz yozadigan joy. "
            "(VS Code ishlatsangiz — 'code .' ham bo'ladi.)",
     "reveals": [".env", ".gitignore", "README.md", "deploy/"], "tree": [".env", ".gitignore", "README.md"]},
    # ----------------------------------------------------------------- 3
    {"id": "set_apps", "group": G3, "kind": "edit", "file": "config/settings.py",
     "ask": "settings.py: yangi ilovani INSTALLED_APPS ga qo'shing",
     "code": ["INSTALLED_APPS = [",
              "    \"django.contrib.admin\",",
              "    \"django.contrib.auth\",",
              "    \"django.contrib.contenttypes\",",
              "    \"django.contrib.sessions\",",
              "    \"django.contrib.messages\",",
              "    \"django.contrib.staticfiles\",",
              "+    \"app\",",
              "]"],
     "explain": "INSTALLED_APPS — loyihada yoqilgan ilovalar ro'yxati. \"app\" ni yozdingiz: endi Django uning modellarini, "
                "admin.py va shablonlarini ko'radi.",
     "why": "Ilova shu ro'yxatda bo'lmasa, makemigrations uning jadvallarini topmaydi — eng ko'p uchraydigan boshlang'ich xato.",
     "reveals": [], "tree": []},
    {"id": "set_paths", "group": G3, "kind": "edit", "file": "config/settings.py",
     "ask": "settings.py: templates, static va media papkalarini ko'rsating",
     "code": ["TEMPLATES = [{",
              "    \"BACKEND\": \"django.template.backends.django.DjangoTemplates\",",
              "+    \"DIRS\": [BASE_DIR / \"templates\"],",
              "    \"APP_DIRS\": True,",
              "    ...",
              "}]",
              "",
              "STATIC_URL = \"static/\"",
              "+STATICFILES_DIRS = [BASE_DIR / \"static\"]",
              "+MEDIA_URL = \"media/\"",
              "+MEDIA_ROOT = BASE_DIR / \"media\""],
     "explain": "DIRS — Django HTML shablonlarni templates/ papkadan qidiradi. STATICFILES_DIRS — CSS/JS shu yerda. "
                "MEDIA_URL / MEDIA_ROOT — yuklangan fayllar /media/... manzilida ochiladi va media/ papkaga yoziladi.",
     "why": "BASE_DIR — loyiha papkasi (manage.py turgan joy). '/' bilan yo'l qo'shiladi: BASE_DIR / \"templates\".",
     "reveals": [], "tree": []},
    {"id": "view", "group": G3, "kind": "edit", "file": "app/views.py",
     "ask": "app/views.py: bosh sahifa funksiyasini (view) yozing",
     "code": ["from django.shortcuts import render",
              "",
              "",
              "+def home(request):",
              "+    return render(request, \"home.html\")"],
     "explain": "View — so'rov kelganda ishlaydigan funksiya. home() brauzerdan kelgan so'rovni (request) oladi va "
                "home.html shablonini to'ldirib, javob qaytaradi.",
     "why": "Hozircha bu funksiyani hech kim chaqirmaydi — unga manzil (URL) bog'lash kerak. Keyingi qadam.",
     "reveals": [], "tree": []},
    {"id": "app_urls", "group": G3, "kind": "edit", "file": "app/urls.py", "new": True,
     "ask": "app/urls.py yarating: bosh manzilni home view ga bog'lang",
     "code": ["+from django.urls import path",
              "",
              "+from . import views",
              "",
              "+urlpatterns = [",
              "+    path(\"\", views.home, name=\"home\"),",
              "+]"],
     "explain": "Yangi fayl app/urls.py: ilovaning o'z manzillari. path(\"\", views.home) — bo'sh manzil (bosh sahifa) "
                "kelsa, home funksiyasini chaqir. name=\"home\" — shablonlarda havola berish uchun nom.",
     "why": "startapp urls.py ni yaratmaydi — uni har doim qo'lda qo'shasiz.",
     "reveals": [], "tree": ["app/urls.py"]},
    {"id": "conf_urls", "group": G3, "kind": "edit", "file": "config/urls.py",
     "ask": "config/urls.py: ilova manzillarini asosiy manzillarga ulang (include)",
     "code": ["from django.contrib import admin",
              "+from django.urls import include, path",
              "",
              "urlpatterns = [",
              "    path(\"admin/\", admin.site.urls),",
              "+    path(\"\", include(\"app.urls\")),",
              "]"],
     "explain": "config/urls.py — butun saytning manzillar xaritasi. include(\"app.urls\") — \"qolgan manzillarni app/urls.py "
                "hal qilsin\" degani. Endi zanjir tayyor: brauzer → config/urls.py → app/urls.py → views.home.",
     "why": "Katta loyihada har ilova o'z urls.py iga ega, asosiy fayl ularni include bilan ulaydi.",
     "reveals": [], "tree": []},
    {"id": "template", "group": G3, "kind": "edit", "file": "templates/home.html", "new": True,
     "ask": "templates/home.html yarating: bosh sahifa matni",
     "code": ["+<h1>Salom, {project}!</h1>",
              "+<p>Saytimiz tez orada ochiladi.</p>"],
     "explain": "HTML shablon — brauzerda ko'rinadigan sahifa. render(request, \"home.html\") aynan shu faylni topadi "
                "(settings.py dagi DIRS tufayli).",
     "why": "Keyinroq bu yerga mahsulotlar ro'yxati, {{ }} bilan bazadagi ma'lumotlar qo'yiladi.",
     "reveals": [], "tree": ["templates/home.html"]},
    {"id": "runserver", "group": G3, "kind": "cmd",
     "ask": "Saytni ishga tushiring va natijani ko'ring",
     "cmd": "python manage.py runserver", "alt": ["py manage.py runserver"],
     "out": ["Watching for file changes with StatReloader", "System check identified no issues (0 silenced).",
             "Starting development server at http://127.0.0.1:8000/",
             "[20/Nov 10:14:52] \"GET / HTTP/1.1\" 200 82", "^C"],
     "explain": "Brauzerda raketa o'rniga sizning sahifangiz: \"Salom, {project}!\". So'rov yo'li: "
                "127.0.0.1:8000/ → config/urls.py → include(app.urls) → views.home → home.html → javob 200.",
     "why": "Bu sayt hozircha FAQAT sizning kompyuteringizda. Mijozlar ko'rishi uchun server, domen va deploy kerak.",
     "reveals": [], "tree": [], "browser": "home"},
    # ----------------------------------------------------------------- 4
    {"id": "model", "group": G4, "kind": "edit", "file": "app/models.py",
     "ask": "app/models.py: kichik model (jadval) yozing — Mahsulot",
     "code": ["from django.db import models",
              "",
              "",
              "+class Product(models.Model):",
              "+    name = models.CharField(max_length=100)",
              "+    price = models.DecimalField(max_digits=10, decimal_places=2)",
              "",
              "+    def __str__(self):",
              "+        return self.name"],
     "explain": "Model = bazadagi jadval. Product jadvali, ikki ustun: name (matn, 100 belgigacha) va price (pul: 10 xona, "
                "2 tasi tiyin). __str__ — admin panelda mahsulot nomi ko'rinsin.",
     "why": "Kod yozildi, lekin baza hali bilmaydi. Endi Django'ga 'jadval o'zgardi' deymiz: makemigrations.",
     "reveals": [], "tree": []},
    {"id": "makemigrations", "group": G4, "kind": "cmd",
     "ask": "Model uchun migratsiya faylini yarating",
     "cmd": "python manage.py makemigrations", "alt": ["py manage.py makemigrations", "python manage.py makemigrations app"],
     "out": ["Migrations for 'app':", "  app\\migrations\\0001_initial.py", "    + Create model Product"],
     "explain": "makemigrations models.py ni o'qib, app/migrations/0001_initial.py faylini yozdi — \"Product jadvalini yarat\" "
                "degan ko'rsatma. Baza hali o'zgarmadi!",
     "why": "Migratsiya fayllari Git'ga tushadi: serverda ham xuddi shu o'zgarishlar shu tartibda qo'llanadi.",
     "reveals": [], "tree": ["app/migrations/0001_initial.py"]},
    {"id": "migrate", "group": G4, "kind": "cmd",
     "ask": "Migratsiyalarni bazaga qo'llang",
     "cmd": "python manage.py migrate", "alt": ["py manage.py migrate"],
     "out": ["Operations to perform:", "  Apply all migrations: admin, app, auth, contenttypes, sessions",
             "Running migrations:", "  Applying contenttypes.0001_initial... OK", "  Applying auth.0001_initial... OK",
             "  Applying admin.0001_initial... OK", "  Applying app.0001_initial... OK",
             "  Applying sessions.0001_initial... OK"],
     "explain": "migrate jadvallarni haqiqatan yaratdi: Django'ning o'zinikilari (foydalanuvchilar, sessiyalar) va sizning "
                "app_product jadvalingiz. Kompyuterda baza — db.sqlite3 fayli.",
     "why": "Ikki qadam: makemigrations — rejani yozadi, migrate — bajaradi. Serverda esa PostgreSQL ishlatiladi.",
     "reveals": [], "tree": ["db.sqlite3"]},
    {"id": "admin", "group": G4, "kind": "edit", "file": "app/admin.py",
     "ask": "app/admin.py: Product ni admin panelga qo'shing",
     "code": ["from django.contrib import admin",
              "",
              "+from .models import Product",
              "",
              "+admin.site.register(Product)"],
     "explain": "admin.site.register(Product) — Product jadvali /admin/ panelda paydo bo'ladi: mahsulot qo'shish, "
                "narxini o'zgartirish, o'chirish — kod yozmasdan.",
     "why": "Admin panel — do'kon egasi va xodimlar uchun tayyor boshqaruv sahifasi.",
     "reveals": [], "tree": []},
    {"id": "superuser", "group": G4, "kind": "cmd",
     "ask": "Admin panelga kirish uchun superuser yarating",
     "cmd": "python manage.py createsuperuser", "alt": ["py manage.py createsuperuser"],
     "out": ["Username: admin", "Email address: admin@{project}.uz", "Password: ********",
             "Password (again): ********", "Superuser created successfully."],
     "explain": "Bosh foydalanuvchi yaratildi: auth_user jadvaliga yozildi, parol shifrlangan (hash) holda saqlanadi.",
     "why": "Parolni hech kimga bermang va oddiy so'z qo'ymang — admin panel butun bazani boshqaradi.",
     "reveals": [], "tree": []},
    {"id": "runadmin", "group": G4, "kind": "cmd",
     "ask": "Serverni ishga tushirib, /admin/ ga kiring",
     "cmd": "python manage.py runserver", "alt": ["py manage.py runserver"],
     "out": ["Starting development server at http://127.0.0.1:8000/",
             "[20/Nov 10:21:07] \"GET /admin/ HTTP/1.1\" 302 0",
             "[20/Nov 10:21:07] \"GET /admin/login/?next=/admin/ HTTP/1.1\" 200 4158",
             "[20/Nov 10:21:15] \"POST /admin/login/?next=/admin/ HTTP/1.1\" 302 0",
             "[20/Nov 10:21:15] \"GET /admin/ HTTP/1.1\" 200 6342", "^C"],
     "explain": "127.0.0.1:8000/admin/ ochildi: 302 — kirish sahifasiga yo'naltirdi, login qildingiz (POST), keyin panel (200). "
                "Ichida APP → Products — sizning jadvalingiz.",
     "why": "Loglardagi raqamlar — HTTP status: 200 yaxshi, 302 yo'naltirish, 404 topilmadi, 500 server xatosi.",
     "reveals": [], "tree": [], "browser": "admin"},
    # ----------------------------------------------------------------- 5
    {"id": "freeze", "group": G5, "kind": "cmd",
     "ask": "Kutubxonalar ro'yxatini requirements.txt ga yozing",
     "cmd": "pip freeze > requirements.txt", "alt": ["py -m pip freeze > requirements.txt"], "out": [],
     "explain": "requirements.txt yaratildi: Django==5.2, asgiref==3.8 ... Serverda 'pip install -r requirements.txt' "
                "xuddi shu versiyalarni o'rnatadi.",
     "why": "\"Menda ishlagandi\" muammosi bo'lmasin: hamma joyda bir xil versiya.",
     "reveals": ["requirements.txt"], "tree": ["requirements.txt"]},
    {"id": "gitinit", "group": G5, "kind": "cmd",
     "ask": "Papkada Git omborini (repository) yarating",
     "cmd": "git init", "out": ["Initialized empty Git repository in C:/Users/{user}/{project}/.git/"],
     "explain": "Yashirin .git papkasi yaratildi — bu yerda loyihaning butun tarixi saqlanadi: kim, qachon, nimani o'zgartirdi.",
     "why": "Git — vaqt mashinasi: xato qilsangiz, istalgan oldingi holatga qaytasiz.",
     "reveals": [], "tree": [".git/"]},
    {"id": "gitadd", "group": G5, "kind": "cmd",
     "ask": "Hamma fayllarni kommitga tayyorlang",
     "cmd": "git add .", "alt": ["git add -A", "git add --all"], "out": [],
     "explain": "git add . — o'zgargan fayllarni 'tayyorlov hududi'ga (staging) qo'ydi. .gitignore dagilar (venv/, .env, "
                "db.sqlite3) qo'shilmadi — ular sir yoki katta fayl.",
     "why": "Tekshirish: git status — qaysi fayl tayyor, qaysi biri yo'qligini ko'rsatadi.",
     "reveals": [], "tree": []},
    {"id": "gitcommit", "group": G5, "kind": "cmd",
     "ask": "Birinchi kommitni yozing (xabar: birinchi versiya)",
     "cmd": "git commit -m \"birinchi versiya\"", "prefix": "git commit -m ",
     "out": ["[main (root-commit) 3f9a1c2] birinchi versiya",
             " 21 files changed, 412 insertions(+)", " create mode 100644 manage.py",
             " create mode 100644 config/settings.py", " create mode 100644 app/models.py", " ..."],
     "explain": "Kommit — loyihaning 'surati': hamma tayyorlangan fayllar bitta nuqta sifatida tarixga yozildi. "
                "3f9a1c2 — kommitning qisqa ID si.",
     "why": "Xabar qisqa va tushunarli bo'lsin: nima o'zgardi. Kommit hali faqat kompyuteringizda.",
     "reveals": [], "tree": []},
    {"id": "remote", "group": G5, "kind": "cmd",
     "ask": "GitHub'dagi bo'sh repo manzilini ulang (origin)",
     "cmd": "git remote add origin https://github.com/{user}/{project}.git", "out": [],
     "explain": "origin — GitHub'dagi repoga qisqa nom. Repo avval github.com da 'New repository' bilan yaratiladi "
                "(Private — yopiq tanlash xavfsizroq).",
     "why": "Tekshirish: git remote -v — qaysi manzilga ulanganini ko'rsatadi.",
     "reveals": [], "tree": []},
    {"id": "push", "group": G5, "kind": "cmd",
     "ask": "Kodni GitHub'ga yuklang (push)",
     "cmd": "git push -u origin main", "alt": ["git push origin main"],
     "out": ["Enumerating objects: 27, done.", "Writing objects: 100% (27/27), 6.10 KiB | 1.5 MiB/s, done.",
             "To https://github.com/{user}/{project}.git", " * [new branch]      main -> main",
             "branch 'main' set up to track 'origin/main'."],
     "explain": "Kommitlar GitHub'ga yuklandi. Endi kod internetda xavfsiz saqlanadi va server uni 'git pull' bilan "
                "tortib oladi (🚀 Deploy qadami). Git bo'limida repongizni ko'ring.",
     "why": "Keyingi o'zgarishlar: add → commit → push. -u keyingi safar shunchaki 'git push' yetishi uchun.",
     "reveals": [], "tree": []},
]

TASK_IDS = [t["id"] for t in TASKS]
START_PS = "C:\\Users\\{user}>"
# Eski (1-versiya, 13 vazifa) tartibi — eski "noldan" startuplarni yangi ro'yxatga o'tkazish uchun
_OLD_IDS = ["mkdir", "cd", "venv", "activate", "django", "startproject", "startapp", "dirs", "editor",
            "migrate", "superuser", "runserver", "freeze"]

# Lesson bosqichlari uchun indekslar
IDX = {tid: k for k, tid in enumerate(TASK_IDS)}


def _legacy(n):
    """Eski progress (13 vazifalik) → yangi ro'yxatda nechta bajarilgan."""
    if n >= len(_OLD_IDS):
        return len(TASKS)              # eski darsni tugatganlar — kodi tayyor deb olinadi
    done = set(_OLD_IDS[:n])
    if "startproject" in done:
        done.add("rocket")
    k = 0
    while k < len(TASKS) and TASK_IDS[k] in done:
        k += 1
    return k


def progress(flags):
    """Nechta dars vazifasi bajarilgan. Tayyor / sotib olingan startuplarda kod bor — hammasi bajarilgan."""
    flags = flags or {}
    if flags.get("mode") != "scratch":
        return len(TASKS)
    n = max(0, int(flags.get("dev", 0)))
    if flags.get("dev_v") != DEV_VERSION:
        n = _legacy(n)
    return min(len(TASKS), n)


def is_done(flags):
    return progress(flags) >= len(TASKS)


def revealed(n):
    """n ta vazifadan keyin Kod bo'limida ko'rinadigan yo'l boshlanishlari."""
    out = []
    for t in TASKS[:n]:
        out.extend(t["reveals"])
    return out


def path_visible(path, prefixes):
    return any(path == p or (p.endswith("/") and path.startswith(p)) for p in prefixes)


def prompt_after(n):
    """n ta vazifadan keyingi prompt (cd va activate uni o'zgartiradi)."""
    ps = START_PS
    for t in TASKS[:n]:
        ps = t.get("ps", ps)
    return ps


# Dars modeli: "makemigrations" bajarilganda o'yinchining sxemasiga shu model yoziladi
LESSON_MODEL = {"name": "Product", "fields": [
    {"name": "name", "type": "CharField", "max_length": 100},
    {"name": "price", "type": "DecimalField"},
]}
