"""
9-QADAM. SAYTNI ISHGA TUSHIRISH (🚀 launch).

Real hayotdagi tartib:
    1. Server olish        — IP manzilli mashina (VPS)
    2. Domen               — myshop.uz → serverning IP si (DNS A yozuvi)
    3. GitHub              — kodni repoga yuklash (git push)
    4. Deploy              — serverda kodni tortib olish (git pull) va ishga tushirish
    5. SSL (HTTPS)         — Let's Encrypt sertifikati; usiz trafik ochiq matnda ketadi

Bu fayl faqat MATN: har qadam nima, nega kerak, qanday buyruqlar bilan qilinadi,
qilinmasa nima bo'ladi. Amallar services.launch_step() da.
"""

DOMAIN_COST = 15            # tanga, bir yilga
DOMAIN_ZONES = ["uz", "com", "dev", "io", "org"]

STEPS = [
    {
        "id": "server", "n": 1, "title": "Server", "icon": "▣",
        "what": "Server (VPS) — internetga ulangan kompyuter. Unga IP manzil beriladi, masalan 203.0.113.10. "
                "Saytingiz, bazangiz va boshqa xizmatlar shu mashinada ishlaydi.",
        "why": "Kodingiz sizning noutbukingizda emas, 24 soat yoqiq turadigan mashinada ishlashi kerak.",
        "terminal": [
            {"ask": "Serverga SSH orqali ulaning", "cmd": "ssh root@{ip}", "ps": "root@{host}:~#",
             "out": ["Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0 x86_64)", "Last login: dushanba 09:12 from 84.54.0.7"]},
            {"ask": "Paketlar ro'yxatini yangilang", "cmd": "apt update",
             "out": ["Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease", "Reading package lists... Done"]},
            {"ask": "Nginx, PostgreSQL, Python va Git ni o'rnating", "cmd": "apt install -y nginx postgresql python3-venv git",
             "alt": ["apt install nginx postgresql python3-venv git"],
             "out": ["Setting up nginx (1.24.0-2ubuntu7) ...", "Setting up postgresql-16 (16.4-1) ...", "Setting up git (1:2.43.0) ..."]},
        ],
        "commands": [
            "# hosting panelida: Ubuntu 24.04, 2 CPU, 4 GB RAM",
            "ssh root@203.0.113.10          # serverga ulanish",
            "apt update && apt install -y nginx postgresql python3-venv git",
        ],
        "skip": "Server bo'lmasa — saytni ishga tushiradigan joy yo'q.",
        "action": "Asboblar panelidan 'Server' blokini qo'shing.",
    },
    {
        "id": "domain", "n": 2, "title": "Domen", "icon": "🌐",
        "what": "Domen — IP manzilning odam eslay oladigan nomi (myshop.uz). DNS da 'A yozuvi' qo'yiladi: "
                "myshop.uz → 203.0.113.10. Brauzer avval DNS dan IP ni so'raydi, keyin shu serverga boradi.",
        "why": "Mijozlar IP raqamni eslab qolmaydi va unga ishonmaydi. SSL sertifikat ham faqat domenga beriladi.",
        "terminal": [
            {"ask": "Domen serveringiz IP siga qarayaptimi? Tekshiring", "cmd": "dig +short {domain}",
             "alt": ["nslookup {domain}", "host {domain}"], "out": ["{dns_ip}"]},
            {"ask": "Sayt javob beryaptimi? Sarlavhalarini so'rang", "cmd": "curl -I http://{domain}",
             "alt": ["curl -i http://{domain}", "curl -I {domain}"], "out": ["HTTP/1.1 200 OK", "Server: nginx/1.24.0"]},
        ],
        "commands": [
            "# registrator panelida (masalan, my.cctld.uz yoki boshqa):",
            "A     @      203.0.113.10     TTL 3600",
            "A     www    203.0.113.10",
            "dig +short myshop.uz           # tekshirish: IP qaytishi kerak",
        ],
        "skip": "Domen bo'lmasa — foydalanuvchilar saytni topa olmaydi: trafik umuman kelmaydi.",
        "warn": "Domen Nginx yoki Load Balancer turgan serverga qarashi kerak. Boshqa serverga qarasa — "
                "so'rovlar hech kim tinglamaydigan portga boradi.",
    },
    {
        "id": "github", "n": 3, "title": "GitHub", "icon": "⎇",
        "what": "GitHub — kodingiz saqlanadigan joy (repo). Har bir o'zgarish kommit bo'lib yoziladi; "
                "server kodni shu yerdan oladi.",
        "why": "Kodni qo'lda nusxalash xato va yo'qotishga olib keladi. Repo — yagona haqiqat manbai va tarix.",
        "terminal": [
            {"ask": "Loyiha papkasida git repo yarating", "cmd": "git init",
             "out": ["Initialized empty Git repository in /home/men/{project}/.git/"]},
            {"ask": "Hamma fayllarni kommitga qo'shing", "cmd": "git add .", "alt": ["git add -A", "git add --all"], "out": []},
            {"ask": "Kommit qiling (xabar o'zingizdan)", "cmd": "git commit -m \"birinchi versiya\"", "prefix": "git commit -m ",
             "out": ["[main (root-commit) 4f1c2ab] birinchi versiya", " 18 files changed, 412 insertions(+)"]},
            {"ask": "GitHub repo manzilini ulang", "cmd": "git remote add origin git@github.com:{repo}.git",
             "alt": ["git remote add origin https://github.com/{repo}.git"], "out": []},
            {"ask": "Kodni GitHubga yuklang", "cmd": "git push -u origin main", "alt": ["git push origin main"],
             "out": ["Enumerating objects: 24, done.", "To github.com:{repo}.git", " * [new branch]      main -> main"]},
        ],
        "commands": [
            "git init",
            "git add .",
            "git commit -m \"birinchi versiya\"",
            "git remote add origin git@github.com:men/myshop.git",
            "git push -u origin main",
        ],
        "skip": "Repo bo'lmasa — serverga kod yetkazib bo'lmaydi (deploy qilinmaydi).",
        "warn": "Repo ochiq (public) bo'lsa va .env .gitignore da bo'lmasa — sirlar butun dunyoga ko'rinadi.",
    },
    {
        "id": "deploy", "n": 4, "title": "Deploy", "icon": "⇩",
        "what": "Deploy — serverda kodni repodan tortib olish va ishga tushirish: git pull, kutubxonalar, "
                "migratsiyalar, gunicorn ni qayta yoqish.",
        "why": "Server bo'sh — unda kod yo'q. Sayt bloki faqat kod yuklangandan keyin javob bera oladi.",
        "terminal": [
            {"ask": "Serverga ulaning", "cmd": "ssh root@{ip}", "ps": "root@{host}:~#", "out": ["Welcome to Ubuntu 24.04 LTS"]},
            {"ask": "Kodni GitHubdan serverga tortib oling", "cmd": "git clone git@github.com:{repo}.git /srv/{project}",
             "alt": ["cd /srv/{project} && git pull origin main", "cd /srv/{project} && git pull", "git pull origin main", "git pull",
                     "git clone https://github.com/{repo}.git /srv/{project}"],
             "ps": "root@{host}:/srv/{project}#",
             "out": ["Cloning into '/srv/{project}'...", "Receiving objects: 100% (24/24), done."]},
            {"ask": "Python kutubxonalarini o'rnating", "cmd": "pip install -r requirements.txt",
             "alt": [".venv/bin/pip install -r requirements.txt", "pip3 install -r requirements.txt"],
             "out": ["Successfully installed Django-5.2 gunicorn-23.0 psycopg-3.2"]},
            {"ask": "Baza jadvallarini yarating (migratsiya)", "cmd": "python manage.py migrate",
             "alt": [".venv/bin/python manage.py migrate", "python3 manage.py migrate"],
             "out": ["Operations to perform: Apply all migrations", "  Applying smeta.0001_initial... OK"]},
            {"ask": "Saytni qayta ishga tushiring", "cmd": "systemctl restart gunicorn", "alt": ["service gunicorn restart"], "out": []},
        ],
        "commands": [
            "ssh root@203.0.113.10",
            "git clone git@github.com:men/myshop.git /srv/myshop   # birinchi marta",
            "cd /srv/myshop && git pull origin main                 # keyingi safar",
            ".venv/bin/pip install -r requirements.txt",
            ".venv/bin/python manage.py migrate",
            "systemctl restart gunicorn",
        ],
        "skip": "Deploy qilinmasa — Nginx so'rovni uzatadi, lekin javob beradigan kod yo'q: 502 Bad Gateway.",
        "warn": "Modellarni o'zgartirsangiz — qayta deploy qiling, aks holda migratsiya bazaga tushmaydi.",
    },
    {
        "id": "ssl", "n": 5, "title": "SSL · HTTPS", "icon": "🔒",
        "what": "SSL sertifikat brauzer va server orasidagi trafikni shifrlaydi (https://). "
                "Let's Encrypt bepul beradi, certbot uni Nginx'ga o'zi o'rnatadi va har 90 kunda yangilaydi.",
        "why": "HTTP da hamma narsa ochiq matn: bir Wi-Fi dagi har kim parol, cookie va karta ma'lumotini ko'radi "
               "va o'zgartira oladi (man-in-the-middle). To'lov tizimlari va Telegram webhook faqat HTTPS bilan ishlaydi.",
        "terminal": [
            {"ask": "Certbot ni o'rnating", "cmd": "apt install -y certbot python3-certbot-nginx",
             "alt": ["apt install certbot python3-certbot-nginx"], "out": ["Setting up certbot (2.9.0-1) ..."]},
            {"ask": "Domeningiz uchun sertifikat oling", "cmd": "certbot --nginx -d {domain} -d www.{domain}",
             "prefix": "certbot --nginx -d {domain}",
             "out": ["Successfully received certificate.", "Congratulations! You have successfully enabled HTTPS on https://{domain}"]},
        ],
        "commands": [
            "apt install -y certbot python3-certbot-nginx",
            "certbot --nginx -d myshop.uz -d www.myshop.uz",
            "systemctl list-timers | grep certbot     # avto-yangilanish",
        ],
        "skip": "SSL bo'lmasa — parollar ochiq ketadi, brauzer 'Xavfsiz emas' deb yozadi, to'lov qabul qilinmaydi.",
        "warn": "Sertifikat olingandan keyin HTTP ni HTTPS ga yo'naltiring: Kod → settings.py → SECURE_SSL_REDIRECT.",
    },
]

STEP_IDS = [s["id"] for s in STEPS]
