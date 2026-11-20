"""
QO'LLANMA — noldan oxirigacha. Maslahatchi, inspektor va maqsadlar shu boblarga havola beradi
(kalitlar: "start", "local", "launch", "https" ... — o'zgartirmang, ular boshqa fayllarda ishlatiladi).

Har bob: {"part": bo'lim, "title": ..., "lead": qisqa mazmun, "body": [bo'laklar]}
Raqamlar sarlavhaga yozilmaydi — brauzer tartib bo'yicha o'zi qo'yadi.
Bo'lak turlari:
    {"h": "sarlavha"}      {"p": "paragraf"}
    {"steps": [...]}       — raqamlangan qadamlar
    {"list": [...]}        — nuqtali ro'yxat
    {"tip": "..."}         — foydali maslahat (yashil)
    {"warn": "..."}        — ogohlantirish (qizil)
    {"code": [...]}        — buyruq yoki kod
    {"cmds": [[buyruq, izoh], ...]}   — buyruq → nima qiladi (jadval)
    {"files": [[yo'l, izoh], ...]}    — fayl → vazifasi (jadval)
"""

CHAPTERS = {
    # ------------------------------------------------------------------ Boshlash
    "start": {
        "part": "Boshlash",
        "title": "Vallum nima?",
        "lead": "Siz startup ochasiz va uning backend tizimini o'zingiz qurasiz: kod yozasiz, server olasiz, saytni internetga "
                "chiqarasiz, mijozlar ko'paygan sari tizimni kengaytirasiz. Hammasi simulyatsiya — real pul va real server yo'q.",
        "body": [
            {"h": "Ekran qanday tuzilgan"},
            {"list": [
                "Yuqorida — startup tanlash, umumiy balans, kassa, o'yin soati va bo'limlar (Doska, Sayt, O'sish, Hisobot, Kod, Git, Qo'llanma).",
                "Holat qatori — sayt holati, foydalanuvchilar, yuklama (req/s), javob vaqti (p95), xatolar, daromad, xarajat, serverlar.",
                "Bloklar paneli — qatlamlar bo'yicha bloklar (Serverlar, Kirish, Ilova, Ma'lumot). Ustiga keling — tushuntirish; "
                "doskaga sudrang — qo'shiladi.",
                "Doska — tizim chizmasi: bloklar va strelkalar (so'rov qayerdan qayerga boradi). Strelka rangi — oqim turi (HTTP, SQL, kesh...).",
                "Ishga tushirish qatori — saytni internetga chiqarish qadamlari. Sariq tugma — hozir qilinadigan qadam.",
                "O'ng panel — maqsadlar, moliya, maslahatchi. Blokni bossangiz — uning sozlamalari va kodi.",
            ]},
            {"h": "O'yinning asosiy sikli"},
            {"steps": [
                "Startup oching: noldan, tayyor shablondan yoki tayyor biznesni sotib olib (keyingi bob).",
                "Tizimni quring va internetga chiqaring: server → domen → GitHub → deploy → SSL.",
                "Vaqt real yuradi — mijozlar keladi, xarid qiladi, pul To'lov shlyuzi kassasiga tushadi.",
                "Mijoz ko'paysa — yuklama oshadi va qaysidir blok qizaradi (tor bo'g'iz). Uni toping va yeching.",
                "Kassadagi pulni yechib oling va o'sishga sarflang: reklama, yangi imkoniyatlar, yangi serverlar.",
            ]},
            {"warn": "Vaqt real yuradi: 1 o'yin kuni = 20 daqiqa, siz yo'qligingizda ham (ko'pi bilan 7 kun hisoblanadi). "
                     "Ijara har soat balansdan ketadi. Balans 0 ga tushsa — hosting serverlarni to'xtatadi. "
                     "3 o'yin kunidan ortiq kirmasangiz — sayt to'xtaydi, ijara esa to'lanaveradi."},
        ],
    },
    "modes": {
        "part": "Boshlash",
        "title": "Uch xil boshlash: noldan, shablon, sotib olish",
        "lead": "Yangi g'oya ochganda qanday boshlashni tanlaysiz. Balans hamma startuplar uchun bitta — yangi startup pul bermaydi.",
        "body": [
            {"h": "1. Noldan — dasturchidek (eng ko'p o'rgatadi)"},
            {"p": "Hech narsa yo'q: na kod, na server. Siz terminal ochasiz va real dasturchi qiladigan buyruqlarni yozasiz: papka, "
                  "virtual muhit, Django, loyiha, ilova, static/media papkalar, migratsiya, sinov serveri. Har buyruqdan keyin "
                  "nima bo'lgani tushuntiriladi va Kod bo'limida yangi fayllar paydo bo'ladi. Keyin doskada tizimni chizasiz va "
                  "saytni internetga chiqarasiz. Bu bosqich bepul — server olguningizcha xarajat yo'q."},
            {"h": "2. Tayyor shablondan"},
            {"p": "Kod va tizim chizmasi tayyor: Foydalanuvchilar → Nginx → Sayt → PostgreSQL + To'lov shlyuzi. Siz faqat 5 qadamni "
                  "bajarib internetga chiqarasiz va keyin o'zingiz kengaytirasiz. Tez boshlash uchun."},
            {"h": "3. Tayyor biznesni sotib olish ($400)"},
            {"p": "Ishlab turgan sayt: domen, HTTPS, 300 ta mijoz va daromad bor. Qurish shart emas — boshqarasiz: narx qo'yasiz, "
                  "reklama qilasiz, yuklama oshganda tizimni kengaytirasiz. Real hayotda ham kichik onlayn biznesni sotib olish mumkin."},
            {"tip": "Birinchi marta o'ynasangiz — Noldan boshlang. Terminal qo'rqinchli emas: ▶ Yozib ko'rsat tugmasi buyruqni o'zi yozadi, "
                    "Tab tugmasi esa to'ldiradi."},
        ],
    },

    # ------------------------------------------------------------------ Kompyuterda
    "local": {
        "part": "Kompyuterda: loyiha yaratish",
        "title": "Noldan Django loyiha (terminalda)",
        "lead": "Chapdagi 'Dars' bo'limi (yoki 🚀 qatoridagi '0 · Lokal'). Windows'da terminal: Pusk → 'cmd' yoki PowerShell. "
                "Har buyruqni yozib Enter bosasiz.",
        "body": [
            {"h": "Tartib"},
            {"cmds": [
                ["mkdir mydokon", "loyiha uchun papka yaratish (make directory)"],
                ["cd mydokon", "papkaga kirish — keyingi buyruqlar shu yerda bajariladi"],
                ["py -m venv venv", "virtual muhit: shu loyihaning shaxsiy Pythoni va kutubxonalari"],
                ["venv\\Scripts\\activate", "muhitni yoqish — prompt boshida (venv) paydo bo'ladi"],
                ["pip install django", "Django ni internetdan (PyPI) yuklab, venv ga o'rnatish"],
                ["django-admin startproject config .", "loyiha skeleti: manage.py va config/ (nuqta — shu papkaga)"],
                ["python manage.py startapp app", "asosiy ilova: models, views, admin, migrations"],
                ["mkdir templates static media", "HTML shablonlar, dizayn fayllari va yuklamalar uchun papkalar"],
                ["pycharm .", "loyihani PyCharm da ochish (.env va .gitignore ham shu yerda)"],
                ["settings.py", "INSTALLED_APPS ga \"app\"; TEMPLATES DIRS, STATICFILES_DIRS, MEDIA_URL / MEDIA_ROOT"],
                ["app/views.py", "def home(request): return render(request, \"home.html\") — sahifa funksiyasi"],
                ["app/urls.py", "yangi fayl: path(\"\", views.home) — bosh manzil → home"],
                ["config/urls.py", "path(\"\", include(\"app.urls\")) — ilova manzillarini ulash"],
                ["templates/home.html", "brauzerda ko'rinadigan HTML sahifa"],
                ["app/models.py", "class Product(models.Model): name, price — kichik jadval"],
                ["python manage.py makemigrations", "models.py dan migratsiya faylini yozish (reja)"],
                ["python manage.py migrate", "jadvallarni bazada (db.sqlite3) haqiqatan yaratish"],
                ["app/admin.py", "admin.site.register(Product) — jadval /admin/ da ko'rinadi"],
                ["python manage.py createsuperuser", "/admin/ panelga kiradigan bosh foydalanuvchi"],
                ["python manage.py runserver", "sinov serveri: http://127.0.0.1:8000 — faqat sizning kompyuteringizda"],
                ["pip freeze > requirements.txt", "kutubxonalar ro'yxati — serverda xuddi shularni o'rnatish uchun"],
                ["git init · git add . · git commit -m \"...\"", "Git ombori, fayllarni tayyorlash, birinchi kommit"],
                ["git remote add origin URL · git push -u origin main", "GitHub'ga ulash va kodni yuklash"],
            ]},
            {"tip": "Terminalda: Tab — buyruqni to'ldiradi, ↑ — oldingi buyruq, help — hozirgi vazifa, cls — ekranni tozalash. "
                    "Bilmasangiz — ▶ Yozib ko'rsat yoki 'Buyruq' tugmasi."},
            {"h": "Nega venv kerak?"},
            {"p": "Bir kompyuterda bir nechta loyiha bo'ladi: birida Django 4, boshqasida Django 5. venv bo'lmasa — hammasi bitta joyga "
                  "o'rnatiladi va bir-biriga xalaqit beradi. venv har loyihaga alohida 'quti' beradi. venv papkasi Git'ga qo'shilmaydi "
                  "(.gitignore da) — uni requirements.txt dan har kim o'zi yaratadi."},
            {"h": "Nega runserver yetmaydi?"},
            {"p": "runserver — faqat sinov uchun: sizning kompyuteringizda, sekin va bitta jarayon. Internetdagi mijozlar uni ko'rmaydi. "
                  "Haqiqiy sayt uchun server (VPS), Nginx, gunicorn va domen kerak — bu keyingi boblarda."},
            {"warn": "Linux/Mac da faollashtirish boshqacha: source venv/bin/activate. Python o'rniga python3 yozish kerak bo'lishi mumkin."},
        ],
    },
    "structure": {
        "part": "Kompyuterda: loyiha yaratish",
        "title": "Loyiha tuzilmasi: har fayl nima qiladi",
        "lead": "Kod bo'limidagi har fayl va papka nimaga kerakligi. Faylni bosing — kodi ochiladi, yashil ramkadagi joylarni o'zgartirasiz.",
        "body": [
            {"h": "Ildiz (loyiha papkasi)"},
            {"files": [
                ["manage.py", "boshqaruv buyruqlari: runserver, migrate, startapp, createsuperuser ..."],
                ["requirements.txt", "kutubxonalar va versiyalari (Django, gunicorn, psycopg ...)"],
                [".env", "SIRLAR: SECRET_KEY, baza paroli, tokenlar. Hech qachon Git'ga tushmasin"],
                [".gitignore", "Git e'tiborga olmaydigan fayllar: venv/, .env, db.sqlite3, media/"],
                ["README.md", "loyiha haqida: qanday ishga tushiriladi, tuzilma"],
            ]},
            {"h": "config/ — loyiha sozlamalari"},
            {"files": [
                ["config/settings.py", "hamma sozlamalar: DEBUG, SECRET_KEY, INSTALLED_APPS, baza, static/media, xavfsizlik"],
                ["config/urls.py", "bosh manzillar xaritasi: /admin/ → admin, / → app.urls"],
                ["config/wsgi.py", "gunicorn shu fayl orqali Django'ni ishga tushiradi"],
            ]},
            {"h": "app/ — asosiy ilova"},
            {"files": [
                ["app/models.py", "jadvallar: har model — bazadagi jadval, har maydon — ustun"],
                ["app/views.py", "sahifalar: so'rov keladi → ma'lumot olinadi → javob qaytadi"],
                ["app/urls.py", "ilova manzillari: qaysi URL qaysi view ga boradi"],
                ["app/admin.py", "Django admin panelda nima ko'rinishi (list_display, search_fields)"],
                ["app/migrations/", "baza o'zgarishlari tarixi — makemigrations yaratadi, migrate qo'llaydi"],
            ]},
            {"h": "Boshqa papkalar"},
            {"files": [
                ["templates/", "HTML shablonlar: base.html (umumiy ramka), index.html (bosh sahifa)"],
                ["static/", "CSS, JS, rasmlar — dizayn, hamma uchun bir xil. Serverda Nginx beradi"],
                ["media/", "foydalanuvchi yuklagan fayllar (mahsulot rasmi, avatar). Zaxira nusxasini oling"],
                ["accounts/", "Avtorizatsiya bloki qo'shilsa: OTP kod bilan kirish"],
                ["deploy/", "serverga chiqarish: nginx.conf, gunicorn.service, deploy.sh"],
            ]},
            {"tip": "So'rovning yo'li: brauzer → Nginx → gunicorn (wsgi.py) → config/urls.py → app/urls.py → app/views.py → "
                    "models.py (baza) → templates/ (HTML) → javob."},
        ],
    },
    "terminal": {
        "part": "Kompyuterda: loyiha yaratish",
        "title": "Terminal buyruqlari lug'ati",
        "lead": "O'yinda (va real ishda) uchraydigan buyruqlar — qisqa izoh bilan.",
        "body": [
            {"h": "Fayl va papka"},
            {"cmds": [
                ["mkdir nom", "papka yaratish"], ["cd nom / cd ..", "papkaga kirish / orqaga chiqish"],
                ["dir (Windows) · ls (Linux)", "papkada nima borligini ko'rish"], ["cls · clear", "ekranni tozalash"],
            ]},
            {"h": "Python va Django"},
            {"cmds": [
                ["py -m venv venv", "virtual muhit yaratish"], ["venv\\Scripts\\activate", "uni yoqish (Windows)"],
                ["pip install nom", "kutubxona o'rnatish"], ["pip install -r requirements.txt", "ro'yxatdagi hammasini o'rnatish"],
                ["python manage.py makemigrations", "model o'zgarishidan migratsiya fayli yaratish"],
                ["python manage.py migrate", "migratsiyalarni bazaga qo'llash"],
                ["python manage.py collectstatic", "static fayllarni bitta papkaga yig'ish (serverda)"],
            ]},
            {"h": "Git"},
            {"cmds": [
                ["git init", "papkada repo yaratish"], ["git add .", "o'zgarishlarni kommitga tayyorlash"],
                ["git commit -m \"xabar\"", "tarixga yozish"], ["git remote add origin URL", "GitHub manzilini ulash"],
                ["git push", "GitHub'ga yuborish"], ["git pull · git clone URL", "GitHub'dan olish / to'liq ko'chirish"],
            ]},
            {"h": "Server (Linux)"},
            {"cmds": [
                ["ssh root@IP", "serverga ulanish"], ["apt update · apt install nom", "dasturlar ro'yxati / o'rnatish"],
                ["systemctl restart gunicorn", "xizmatni qayta ishga tushirish"], ["dig +short domen", "domen qaysi IP ga qarashini ko'rish"],
                ["curl -I http://domen", "sayt javob beryaptimi — sarlavhalar"], ["certbot --nginx -d domen", "bepul SSL sertifikat"],
            ]},
        ],
    },

    # ------------------------------------------------------------------ Internetga chiqarish
    "first-site": {
        "part": "Internetga chiqarish",
        "title": "Doskada tizimni qurish",
        "lead": "Kod tayyor — endi u qayerda va qanday ishlashini doskada chizasiz.",
        "body": [
            {"steps": [
                "Bloklar panelidan Server ni doskaga sudrang (ijara shu paytdan boshlanadi).",
                "Nginx, Sayt (Django) va PostgreSQL ni qo'shing — ular avtomatik shu serverga joylanadi "
                "(pastidagi rangli yorliq qaysi serverda ekanini ko'rsatadi).",
                "Strelkalar torting: Foydalanuvchilar → Nginx → Sayt → PostgreSQL. Blok o'ngidagi ● nuqtadan sudrang "
                "yoki blokni bosib, inspektordagi '＋ ulash' tugmasini bosing.",
                "To'lov shlyuzini qo'shing va Sayt → To'lov shlyuzi strelkasini torting — usiz pul tushmaydi.",
            ]},
            {"tip": "Strelka ulanmasa — tizim sababini aytadi va real hayotda nima bo'lishini tushuntiradi. "
                    "Masalan, Foydalanuvchilar to'g'ridan-to'g'ri bazaga ulanolmaydi."},
            {"p": "Keyin: Ishga tushirish qatoridagi qadamlar (keyingi bob)."},
        ],
    },
    "launch": {
        "part": "Internetga chiqarish",
        "title": "Server, domen, GitHub, deploy",
        "lead": "Real hayotdagi tartib: Server → Domen → GitHub → Deploy → SSL. Har qadamda terminal bor — buyruqlarni o'zingiz yozasiz.",
        "body": [
            {"h": "1. Server (VPS)"},
            {"p": "Internetga ulangan, 24 soat yoqiq kompyuter. Unga IP beriladi (203.0.113.10). SSH bilan ulanib, kerakli dasturlarni o'rnatasiz."},
            {"code": ["ssh root@203.0.113.10", "apt update && apt install -y nginx postgresql python3-venv git"]},
            {"h": "2. Domen va DNS"},
            {"p": "Domen — IP ning odam eslaydigan nomi. DNS da A yozuvi: dokon.uz → 203.0.113.10. Domen Nginx yoki Load Balancer "
                  "turgan, ochiq IP li serverga qarashi kerak. Narxi $15/yil."},
            {"h": "3. GitHub"},
            {"p": "Kod repoda saqlanadi; server kodni shu yerdan oladi. Har o'zgarish — kommit (Git bo'limida ko'rinadi)."},
            {"code": ["git init", "git add .", "git commit -m \"birinchi versiya\"", "git remote add origin git@github.com:men/dokon.git",
                      "git push -u origin main"]},
            {"h": "4. Deploy"},
            {"p": "Serverda: kodni tortib olish, kutubxonalar, migratsiyalar, gunicorn ni qayta yoqish. Birinchi deploydan keyin "
                  "birinchi 50 ta foydalanuvchi keladi."},
            {"code": ["git clone git@github.com:men/dokon.git /srv/dokon", "pip install -r requirements.txt",
                      "python manage.py migrate", "systemctl restart gunicorn"]},
            {"warn": "Deploy qilinmasa — Nginx so'rovni uzatadi, lekin javob beradigan kod yo'q: 502 Bad Gateway. "
                     "Modellarni o'zgartirsangiz — qayta deploy qiling, aks holda migratsiya bazaga tushmaydi."},
        ],
    },
    "https": {
        "part": "Internetga chiqarish",
        "title": "HTTPS va to'lov",
        "lead": "HTTP da hamma narsa ochiq matn. HTTPS (SSL) trafikni shifrlaydi — to'lov tizimlari faqat shu bilan ishlaydi.",
        "body": [
            {"list": [
                "HTTP: bir Wi-Fi dagi har kim parol, cookie va karta raqamini o'qiy oladi va o'zgartira oladi.",
                "Let's Encrypt sertifikati bepul; certbot uni Nginx'ga o'zi o'rnatadi va har 90 kunda yangilaydi.",
                "Sertifikatdan keyin HTTP so'rovlarni HTTPS ga yo'naltiring: Kod → config/settings.py → SECURE_SSL_REDIRECT = True.",
            ]},
            {"code": ["certbot --nginx -d dokon.uz -d www.dokon.uz"]},
            {"tip": "Ishga tushirish qatorining o'ng chetida saytingiz manzili: qulf belgisi bilan https — yaxshi, qizil http — xavfli."},
        ],
    },

    # ------------------------------------------------------------------ Pul va biznes
    "money": {
        "part": "Pul va biznes",
        "title": "Pul: daromad, xarajat, kassa",
        "lead": "Balans hamma startuplar uchun bitta. Daromad avval kassaga tushadi, xarajat esa balansdan ketadi.",
        "body": [
            {"h": "Daromad qayerdan keladi"},
            {"p": "Mijozlar saytingizda xarid qiladi (narx va talab — biznes turiga bog'liq, Sayt bo'limida o'zgartirasiz). "
                  "Pul faqat quyidagilar bo'lsa tushadi:"},
            {"list": [
                "To'lov shlyuzi qo'shilgan va Sayt → To'lov shlyuzi strelkasi bor;",
                "sayt HTTPS da ishlaydi (SSL qadami);",
                "sayt ishlayapti. Xatolar bo'lsa — shu ulushdagi xaridlar yo'qoladi (10% xato = 10% kam pul).",
            ]},
            {"h": "Kassa"},
            {"p": "Mijoz to'lovlari avval To'lov shlyuzi kassasida yig'iladi. Balansga o'tkazish uchun 'kassa · yechib olish' tugmasini "
                  "bosing (yuqorida yoki moliya kartasida). Kirib turmasangiz — pul kassada qoladi, ijara esa balansdan ketaveradi."},
            {"h": "Xarajatlar"},
            {"list": [
                "Dasturlar bepul (Nginx, Django, PostgreSQL, Redis ...) — ular kod.",
                "Server ijarasi: Kichik $20, O'rta $50, Katta $110, Kuchli $250 kuniga.",
                "Tashqi xizmatlar: CDN obunasi $15/kun, to'lov tizimi komissiyasi 2%, SMS kod $0.02 dona.",
                "Bir martalik: domen $15, reklama kampaniyalari, yangi imkoniyatlar (O'sish bo'limi).",
            ]},
            {"warn": "Ikkinchi serverni olishdan oldin o'ylang: u kuniga $50. Daromad kichik bo'lsa, har kuni minusda qolasiz. "
                     "Balans 0 ga tushsa — hosting serverlarni to'xtatadi va mijozlar har kuni 3% ga kamayadi. 'Qayta yoqish' tugmasi bor."},
        ],
    },
    "business": {
        "part": "Pul va biznes",
        "title": "Biznes, sayt va narxlar",
        "lead": "Har startup — biznes: do'kon, yangiliklar, SaaS yoki yetkazib berish. Pul qanday kelishi biznesga bog'liq.",
        "body": [
            {"h": "Sayt bo'limi"},
            {"p": "Chapda — mijoz ko'radigan sayt. U doskadagi tizimdan jonli yasaladi: domen yo'q bo'lsa — DNS xato, "
                  "deploy yo'q yoki tizim yiqilgan bo'lsa — 502, sekin bo'lsa — 'sahifa 2 s da ochildi', HTTPS yo'q bo'lsa — to'lov ishlamaydi. "
                  "O'ngda — narxlar va Django admin panel."},
            {"h": "Narx → talab → foyda"},
            {"steps": [
                "Narxlar jadvalida narx va tannarxni o'zgartiring.",
                "'Talab' ustuni: narx oshsa — xaridor kamayadi (100% — boshlang'ich).",
                "'Foyda/kun' = sotuvlar × (narx − tannarx). Eng katta foydani beradigan narxni toping.",
                "Saqlang va bir necha kun kuting, Hisobot bo'limida natijani ko'ring.",
            ]},
            {"tip": "Juda arzon — ko'p sotasiz, lekin foyda yo'q. Juda qimmat — har sotuvdan ko'p, lekin sotuv deyarli yo'q. Haqiqat o'rtada."},
            {"list": [
                "Do'kon — sotuvdan foyda, tannarx xarajat sifatida yoziladi.",
                "Yangiliklar — reklama puli to'lov shlyuzisiz ham keladi, lekin trafik 1.5× ko'p: Redis/CDN kerak.",
                "SaaS — oylik tarif; kunlik daromad = obunachilar × narx / 30.",
                "Yetkazib berish — Telegram bot ulansa mijozlar tezroq ko'payadi.",
            ]},
            {"warn": "Bozor cheksiz emas: mijozlar soni bozor hajmiga yaqinlashgan sari o'sish sekinlashadi."},
        ],
    },
    "growth": {
        "part": "Pul va biznes",
        "title": "O'sish: reklama, imkoniyatlar, hodisalar",
        "lead": "Foyda kelyapti — endi uni ishlating. O'sish bo'limida pulni mijozlarga aylantirasiz.",
        "body": [
            {"h": "Marketing — vaqtinchalik"},
            {"p": "Kampaniya bir necha kun mijozlarni tez ko'paytiradi, lekin trafikni ham oshiradi. Tizim chidamasa (qizil yoki yiqilgan) — "
                  "mijozlar xato sahifani ko'radi va reklama puli havoga ketadi."},
            {"steps": [
                "Avval doskada tizim yashil ekanini va zaxira quvvat borligini tekshiring.",
                "Arzon kampaniyadan boshlang (Telegram post, $40).",
                "Kampaniya paytida loglar va p95 ni kuzating. Sariq bo'lsa — worker yoki server qo'shing.",
                "Katta aksiya — faqat Load Balancer va 2 ta Sayt bo'lganda.",
            ]},
            {"h": "Yangi imkoniyatlar — doimiy"},
            {"p": "Qidiruv, sodiqlik bonuslari, push-bildirishnomalar, mobil ilova, monitoring, zaxira nusxa, SMS provayder — "
                  "sotuv yoki o'sishni doimiy oshiradi yoki xavfdan himoya qiladi. Ba'zilari blok talab qiladi (push uchun Fon ishchisi)."},
            {"h": "Hodisalar"},
            {"list": [
                "Viral / bayram — trafik keskin oshadi: tizim tayyor bo'lsa — katta foyda.",
                "Raqobatchi — sotuv 3 kun kamayadi: narxlarni qayta ko'ring.",
                "Disk buzildi — zaxira nusxa (backup) bo'lmasa mijozlarning bir qismi ketadi.",
                "Data-markazda elektr uzildi — monitoring bo'lsa tez tiklanadi.",
            ]},
            {"h": "Yangi startup"},
            {"p": "Pul ko'p bo'lsa — yangi g'oya oching. Balans umumiy: yangi startupning serverlari ham shu hamyondan to'lanadi, "
                  "shuning uchun avvalgisi foyda keltirayotganiga ishonch hosil qiling."},
        ],
    },

    # ------------------------------------------------------------------ Kengayish
    "servers": {
        "part": "Kengayish",
        "title": "Serverlar, IP va resurslar",
        "lead": "Server — mashina: CPU, RAM va IP manzil. Bloklar serverga joylanadi va uning resursini bo'lishadi.",
        "body": [
            {"list": [
                "CPU va RAM har server uchun alohida. Server to'lsa — undagi HAMMA bloklar sekinlashadi (doskada qizil).",
                "IP: ochiq server 203.0.113.x, ichki (internetga ko'rinmaydigan) 10.0.0.x.",
                "Ochiq serverda firewall (ufw) yoqing — faqat 22, 80, 443 portlar ochiq qoladi.",
            ]},
            {"h": "2-server qo'shdim — endi nima qilaman?"},
            {"p": "Bo'sh server foyda keltirmaydi, faqat pul yeydi. Uni ishlatishning uchta yo'li:"},
            {"steps": [
                "Bazani ajratish: PostgreSQL ni 2-serverga ko'chiring (blokni bosing → 'Server' ro'yxatidan tanlang). "
                "1-serverda Sayt uchun CPU bo'shaydi.",
                "Sayt qatlamini kengaytirish: 2-serverga yana bitta Sayt qo'ying, Load Balancer bilan yukni bo'ling.",
                "Fon ishchisi yoki Redis ni 2-serverga ko'chirish.",
            ]},
            {"tip": "Server blokini bossangiz — inspektor shu server uchun aniq tavsiyalar va bir bosishda bajariladigan tugmalar ko'rsatadi."},
        ],
    },
    "bottleneck": {
        "part": "Kengayish",
        "title": "Tor bo'g'iz va yuklama",
        "lead": "Tizim eng sekin bo'g'inidan tez ishlay olmaydi.",
        "body": [
            {"p": "Har blok uchun band bo'lish ρ = yuklama / sig'im. Blok ustidagi yorliqda foiz yozilgan."},
            {"list": [
                "ρ < 70% — yashil, bemalol.",
                "ρ 70–100% — sariq, navbat cho'ziladi, javob vaqti (p95) oshadi.",
                "ρ ≥ 100% — qizil, ortiqcha so'rovlar xato bilan qaytadi, mijozlar ketadi.",
            ]},
            {"tip": "Holat qatoridagi 'tor bo'g'iz: ...' qaysi blok ekanini aytadi. Avval sababni toping, keyin pul sarflang."},
        ],
    },
    "background": {
        "part": "Kengayish",
        "title": "Og'ir ishni fonga o'tkazish",
        "lead": "Gunicorn workeri bir vaqtda faqat BITTA so'rovga xizmat qiladi. 2 soniyalik hisobot workerni band qiladi.",
        "body": [
            {"h": "Muammo: sinxron hisobot"},
            {"p": "Mijoz 'Excel hisobot' tugmasini bosdi. Sinxron rejimda Sayt workeri hisobotni o'zi tuzadi — "
                  "2 soniya davomida boshqa hech kimga xizmat qilmaydi. So'rovlarning atigi 5% i hisobot bo'lsa ham, "
                  "workerlar vaqtining ~60% i shunga ketadi. Natija: Sayt qizil (100%+), qolgan mijozlar xato oladi."},
            {"h": "Yechim: navbat + Fon ishchisi"},
            {"steps": [
                "Fon ishchisi blokini qo'shing (iloji bo'lsa 2-serverga — 1-serverda CPU Saytga kerak).",
                "Sayt → Fon ishchisi va Fon ishchisi → PostgreSQL strelkalarini torting.",
                "Kod → hisobot rejimini 'fonda' qiling va saqlang.",
            ]},
            {"p": "Endi Sayt faqat vazifani navbatga qo'yadi (0,05 s) va darhol 'Hisobot tayyorlanmoqda' deb javob beradi. "
                  "Og'ir ishni Fon ishchisi bajaradi, tayyor faylni media/ ga qo'yadi."},
            {"h": "Nima qilsangiz — nima bo'ladi"},
            {"cmds": [
                ["hisobot: sinxron", "Sayt workerlari hisobotga band. Ko'p mijozda Sayt qizil, xatolar ko'payadi."],
                ["hisobot: fonda, Fon ishchisi yo'q", "Hisobotlar yo'qoladi — navbatni hech kim olmaydi (maslahatchi qizil ogohlantiradi)."],
                ["hisobot: fonda + Fon ishchisi", "Sayt yengillashadi (~60% kam yuk). Hisobot bir necha soniyada tayyor bo'ladi."],
                ["'navbat +X/s' yozuvi", "Ishchi ulgurmayapti: har soniyada navbatga X ta vazifa ortiqcha qo'shilyapti, hisobot kutish vaqti cho'ziladi."],
                ["concurrency oshirish", "Bitta ishchi bir vaqtda ko'proq vazifa bajaradi, lekin har jarayon o'z serverining CPU/RAM'ini yeydi."],
                ["2-serverga yana Fon ishchisi", "Ikkala ishchi BITTA navbatdan vazifa oladi — sig'im qo'shiladi, yuk serverlarga bo'linadi."],
                ["Fon ishchisi Saytga ulanmagan", "Blok kulrang 'ulanmagan' — u ishlamaydi, lekin serverda joy egallab turadi."],
            ]},
            {"tip": "Real hayotda bu Celery (yoki RQ) + Redis/RabbitMQ: Django vazifani navbatga qo'yadi, "
                    "'celery worker' jarayonlari uni oladi. Email yuborish, fayl/rasm ishlash, hisobot, to'lov tekshiruvi — hammasi shunday."},
            {"warn": "Ishchini Saytning o'sha serveriga qo'ysangiz, ular bir CPU'ni talashadi. CPU 100% ga yetsa — butun server sekinlashadi."},
        ],
    },
    "roles": {
        "part": "Kengayish",
        "title": "Bir nechta server: kim nima qiladi",
        "lead": "Server — bu shunchaki mashina. Foyda unga qaysi blok (dastur) qo'yganingizga bog'liq.",
        "body": [
            {"p": "Bitta serverdagi hamma dastur bitta CPU va RAM'ni bo'lishadi. Yuk oshganda dasturlarni "
                  "vazifasiga qarab serverlarga ajratasiz. Har blokning vazifasi:"},
            {"cmds": [
                ["Nginx", "Eshik: internetdan so'rovni qabul qiladi, statik fayllarni beradi, qolganini Saytga uzatadi."],
                ["Load Balancer", "Yo'naltiruvchi: so'rovlarni bir nechta Sayt o'rtasida bo'ladi. Biri yiqilsa — qolganiga yuboradi."],
                ["Sayt (Django)", "Asosiy ish: sahifa, ro'yxatdan o'tish, buyurtma. Workerlar soni = bir vaqtda nechta so'rov."],
                ["Fon ishchisi", "Kutib turmasa bo'ladigan og'ir ishlar: hisobot, email, rasm/fayl, ommaviy xabar."],
                ["PostgreSQL", "Asosiy baza: hamma yozuvlar shu yerda. Odatda alohida, kuchli serverda turadi."],
                ["Read replica", "Bazaning nusxasi faqat o'qish uchun. O'qishlarni olib, asosiy bazani yengillatadi."],
                ["PgBouncer", "Bazaga ulanishlar hovuzi: yuzlab worker ulanishini ~20 ta ulanishga yig'adi."],
                ["Redis", "Tez xotira: kesh (tez-tez so'raladigan ma'lumot), sessiya, OTP kodlar, navbat."],
                ["CDN", "Rasm/CSS/JS ni foydalanuvchiga yaqin serverlardan beradi — sizning serveringizga yuk kamayadi."],
            ]},
            {"h": "Odatiy bo'linish"},
            {"list": [
                "1 server: hammasi bitta joyda. Boshlash uchun yetarli (~1–2 ming mijoz).",
                "2 server: 1-server — Nginx + Sayt; 2-server — PostgreSQL + Fon ishchisi. Sayt CPU'si faqat so'rovlarga qoladi.",
                "3+ server: Load Balancer ortida 2–3 ta Sayt serveri, alohida baza serveri, alohida fon serveri, Redis.",
            ]},
            {"h": "Bir xil blokdan bir nechta bo'lsa"},
            {"list": [
                "Bir nechta Sayt — Load Balancer orqali ulansa, workerlari yig'iladi. LB'siz qo'yilgan 2-Sayt ishlamaydi.",
                "Bir nechta Fon ishchisi — hammasi Saytga ulansa, bitta navbatdan birga vazifa oladi (sig'im yig'iladi).",
                "Bir nechta Read replica — o'qish yuki ular o'rtasida bo'linadi.",
                "Ikkita Nginx yoki ortiqcha ulanmagan blok — foyda bermaydi, faqat CPU/RAM egallaydi. Keraksizini o'chiring.",
            ]},
            {"tip": "Qaysi serverga qo'yish kerakligini bilish uchun Server blokini bosing: CPU/RAM bandligi va tavsiyalar chiqadi. "
                    "Qoida: qizil (to'lgan) serverdan og'ir blokni bo'sh serverga ko'chiring."},
        ],
    },
    "lb": {
        "part": "Kengayish",
        "title": "Load Balancer: 2 server bilan kengayish",
        "lead": "Bitta Sayt serveri yetmay qolganda — ikkinchisini qo'shib, yukni bo'lasiz.",
        "body": [
            {"steps": [
                "2-server qo'shing (Serverlar qatlami).",
                "Sayt blokini qo'shing va inspektorda 'Server' = 2-server tanlang.",
                "Load Balancer qo'shing.",
                "Eski Nginx → Sayt strelkasini uzing; Nginx → Load Balancer torting.",
                "Load Balancer → 1-Sayt va Load Balancer → 2-Sayt torting.",
                "2-Sayt → PostgreSQL torting (ikkala Sayt bitta bazaga yozadi).",
            ]},
            {"p": "Quvvat = ikkala Saytdagi workerlar yig'indisi. Holat qatorida '2 ta Sayt' yozuvi chiqadi."},
            {"warn": "Sayt qatlamini kengaytirsangiz, tor bo'g'iz bazaga ko'chadi. Keyingi qadam — kesh va replica."},
        ],
    },
    "cache": {
        "part": "Kengayish",
        "title": "Kesh (Redis)",
        "lead": "Ko'p so'raladigan ma'lumot xotirada saqlanadi — baza bo'shaydi.",
        "body": [
            {"list": [
                "Redis qo'shing va Sayt → Redis torting: o'qishlarning ~70% i bazaga yetmaydi.",
                "Redis'ni internetga ochmang: bind 127.0.0.1 va parol (requirepass).",
            ]},
        ],
    },
    "replica": {
        "part": "Kengayish",
        "title": "Read replica va PgBouncer",
        "lead": "Baza qizarsa — o'qishlarni nusxaga bo'ling, ulanishlarni hovuzga yig'ing.",
        "body": [
            {"list": [
                "Read replica — bazaning o'qish nusxasi. Sayt → Read replica: o'qishlarning 80% ini oladi.",
                "Ko'p worker = ko'p ulanish. max_connections dan oshsa — xato. "
                "PgBouncer: Sayt → PgBouncer → PostgreSQL, ulanishlar 20 taga tushadi.",
            ]},
        ],
    },
    "cdn": {
        "part": "Kengayish",
        "title": "CDN",
        "lead": "Statik fayllarni (rasm, CSS, JS) dunyo bo'ylab chetdagi serverlar beradi.",
        "body": [
            {"p": "Foydalanuvchilar → CDN → Nginx. Serveringizga yuk ~30% kamayadi. Obuna $15/kun."},
        ],
    },
    "telegram": {
        "part": "Kengayish",
        "title": "Telegram bot ulash",
        "lead": "Bot — serverda ishlaydigan alohida dastur. Mijozlar saytga kirmasdan Telegramda ishlaydi va tezroq ko'payadi.",
        "body": [
            {"steps": [
                "Bloklar panelidan 'Telegram bot' ni qo'shing (u serverga joylanadi).",
                "Foydalanuvchilar → Telegram bot strelkasini torting (xabarlar Telegram orqali keladi).",
                "Telegram bot → Sayt strelkasini torting (bot Saytning API sidan ma'lumot oladi). "
                "Yoki to'g'ridan-to'g'ri Telegram bot → PostgreSQL.",
                "Botni bosing: inspektordagi ro'yxatda hamma qator ✓ bo'lishi kerak, yorliqda 'ishlayapti'.",
            ]},
            {"list": [
                "polling — bot o'zi Telegramdan so'rab turadi. Oddiy, HTTPS shart emas.",
                "webhook — Telegram xabarni botga o'zi yuboradi. Faqat HTTPS manzilga (SSL kerak).",
                "Token @BotFather dan olinadi va faqat .env da turadi (TELEGRAM_BOT_TOKEN). Kod: bot/main.py.",
            ]},
        ],
    },
    "auth": {
        "part": "Kengayish",
        "title": "Avtorizatsiya: SMS / email kod (OTP)",
        "lead": "Mijoz parol o'ylab topmaydi: telefon yoki email kiritadi, unga 6 xonali kod keladi, kodni yozadi — kirdi.",
        "body": [
            {"h": "Qanday ishlaydi"},
            {"steps": [
                "Mijoz kirish sahifasida telefon (+998...) yoki email yozadi.",
                "Sayt 6 xonali tasodifiy kod yaratadi va Redis'ga yozadi: otp:+99890... = 482913, 5 daqiqa (TTL).",
                "Kod SMS provayder (masalan Eskiz) yoki email (SMTP) orqali yuboriladi.",
                "Mijoz kodni yozadi → Sayt Redis'dagi kod bilan solishtiradi → to'g'ri bo'lsa sessiya ochiladi.",
                "Kod bir martalik: ishlatilgach o'chiriladi. 5 marta xato — bloklanadi.",
            ]},
            {"h": "O'yinda"},
            {"steps": [
                "Bloklar panelidan 'Avtorizatsiya' ni doskaga qo'ying (Ilova qatlami).",
                "Strelkalar: Sayt → Avtorizatsiya → Redis (yoki PostgreSQL).",
                "Inspektorda usulni tanlang: email (bepul) yoki SMS ($0.02 / kod). SMS uchun O'sish → 'SMS provayder' ($50) kerak.",
                "Kod → accounts/views.py va templates/auth/login.html paydo bo'ladi — o'qib chiqing.",
            ]},
            {"tip": "Akkaunt bo'lsa mijozlar qaytib keladi: sotuv +10%. Lekin SMS har kuni pul oladi: 1000 mijoz × 25% × $0.02 = $5/kun."},
            {"warn": "Kodni Redis'da TTL bilan saqlang va urinishlar sonini cheklang — aks holda 6 xonali kodni ketma-ket taxmin qilib kirish mumkin."},
        ],
    },

    # ------------------------------------------------------------------ Kod va xavfsizlik
    "code": {
        "part": "Kod va xavfsizlik",
        "title": "Kod bo'limi",
        "lead": "Loyihaning hamma fayllari — PyCharm'dagidek daraxt. Kodni o'qib o'rganasiz, yashil ramkadagi joylarni o'zgartirasiz.",
        "body": [
            {"list": [
                "Chapdagi qidiruvga 'DEBUG', 'SECRET', 'SSL' deb yozing — qaysi faylning qaysi qatorida ekanini ko'rasiz.",
                "Yashil nuqtali fayllarda o'zgartiriladigan joy bor.",
                "Ko'k fondagi qiymatlar startupdan olinadi (domen, IP), qizil fondagilar — .env sirlari.",
                "Saqlasangiz — o'zgarish Git bo'limiga kommit bo'lib yoziladi.",
                "'Noldan' startupda fayllar terminal buyruqlari bilan bittalab paydo bo'ladi.",
            ]},
        ],
    },
    "debug": {
        "part": "Kod va xavfsizlik",
        "title": "DEBUG=True nega xavfli?",
        "lead": "Xato sahifasi begona odamga saytning ichini ko'rsatadi.",
        "body": [
            {"p": "DEBUG=True bo'lsa, xato sahifasida barcha URL lar, fayl yo'llari va sozlamalar ko'rinadi. Kompyuteringizda — qulay, "
                  "internetda — xavfli."},
            {"tip": "Kod → config/settings.py → DEBUG = False."},
        ],
    },
    "secrets": {
        "part": "Kod va xavfsizlik",
        "title": "SECRET_KEY va .env",
        "lead": "SECRET_KEY sessiyalarni imzolaydi. Kim bilsa — istalgan foydalanuvchi nomidan kira oladi.",
        "body": [
            {"steps": [
                "Kod → settings.py → SECRET_KEY manbai = '.env dan'.",
                "Kod → .gitignore → .env = ha.",
                "Kalit avval Git'ga tushgan bo'lsa — .env faylida ↻ rotate.",
            ]},
            {"warn": "Sir oqib ketgan bo'lsa, faylni o'chirish YETMAYDI — Git tarixida qoladi. Faqat almashtirish (rotate)."},
        ],
    },
    "git": {
        "part": "Kod va xavfsizlik",
        "title": "Git va GitHub",
        "lead": "Git — o'zgarishlar tarixi. GitHub — shu tarix saqlanadigan sayt. Git bo'limi GitHub'ga o'xshaydi.",
        "body": [
            {"list": [
                "Code — fayllar ro'yxati, har birining yonida uni oxirgi o'zgartirgan kommit, pastda README.",
                "Commits — kunlar bo'yicha kommitlar. Bosing — nima qo'shilgan (yashil +) va o'chirilgan (qizil −) ko'rinadi.",
                "Security — tarixda sir (SECRET_KEY) qolgan bo'lsa ogohlantiradi.",
                "Public / Private — repo hammaga ochiqmi yoki faqat sizgami.",
            ]},
            {"p": "Kommitni keyingi kommitda 'o'chirish' uni tarixdan yo'qotmaydi. Senariyda .env boshida adashib kommit qilingan — "
                  "kalit hamon tarixda ko'rinadi."},
            {"tip": "Ochiq repoda bir marta paydo bo'lgan sir — oshkor bo'lgan sir. Yagona to'g'ri javob: rotate."},
        ],
    },
    "models": {
        "part": "Kod va xavfsizlik",
        "title": "Modellar va migratsiyalar",
        "lead": "Model — bazadagi jadval, maydon — ustun.",
        "body": [
            {"steps": [
                "Kod → app/models.py ni oching. O'ngda Model quruvchi chiqadi.",
                "Model nomi (masalan Order) → ＋ Model. Maydonlar qo'shing: nom, tur (ForeignKey — boshqa jadvalga bog'lanish).",
                "Saqlash · makemigrations — app/migrations/ da yangi fayl paydo bo'ladi.",
                "Deploy — migrate serverda bajariladi.",
            ]},
            {"list": ["Limitlar: 6 model, model boshiga 10 maydon, jami 36 maydon, 8 ta ForeignKey.",
                      "Ko'p jadval va bog'lanish — bazaga ko'proq yuk."]},
            {"warn": "Deploy qilmasangiz, kod bazada yo'q ustunni so'raydi — 20% so'rov 500 xato bilan qaytadi."},
        ],
    },

    # ------------------------------------------------------------------ Yordam
    "faq": {
        "part": "Yordam",
        "title": "Muammolar va yechimlar",
        "lead": "Eng ko'p uchraydigan holatlar.",
        "body": [
            {"h": "Holat 'Hali ishga tushmagan'"},
            {"p": "Sayt hali deploy qilinmagan. Ishga tushirish qatoridagi sariq qadamni bosing va oxirigacha boring."},
            {"h": "Holat 'Qulagan', xatolar 100%"},
            {"p": "O'ngdagi maslahatchi sababni yozadi: domen yo'q, strelka yetishmaydi, blok serverga joylanmagan yoki hosting to'xtagan."},
            {"h": "Blok kulrang va 'ulanmagan'"},
            {"p": "Blokni bosing — inspektordagi ✗ qatorlar qaysi strelka yetishmasligini ko'rsatadi, '＋ ulash' tugmasi bilan ulang."},
            {"h": "Pul tushmayapti"},
            {"p": "To'lov shlyuzi ulanganmi va HTTPS bormi? Pul kassada turgan bo'lishi mumkin — 'yechib olish' tugmasini bosing."},
            {"h": "Pul tugayapti"},
            {"p": "Moliya kartasini oching: xarajat katta bo'lsa — keraksiz server yoki CDN ni o'chiring, narxlarni ko'ring."},
            {"h": "GitHub / Deploy qadami yopiq"},
            {"p": "'Noldan' startupda avval 0-qadam: kompyuteringizda loyiha yarating — yuklaydigan kod bo'lishi kerak."},
            {"h": "'navbat +X/s' (Fon ishchisi)"},
            {"p": "Fon ishchisi ulgurmayapti. Jarayonlar sonini (concurrency) oshiring yoki boshqa serverga yana bitta Fon ishchisi qo'yib Saytga ulang."},
            {"h": "Ko'p mijoz qo'shildi — holat 'Yomon'"},
            {"p": "Holat qatoridagi tor bo'g'izga qarang. Sayt bo'lsa — hisobotni fonga o'tkazing, keyin Load Balancer + 2-Sayt. "
                  "Baza bo'lsa — Redis, Read replica, PgBouncer. Server CPU'si to'lgan bo'lsa — bloklarni 2-serverga ko'chiring."},
            {"h": "Blok qo'shilmayapti"},
            {"p": "Serverda CPU yoki RAM yetmayapti. Serverni kattalashtiring (Server → tur) yoki yangi server oling."},
        ],
    },
}
