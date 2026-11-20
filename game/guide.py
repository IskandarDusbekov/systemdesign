"""
QO'LLANMA — noldan oxirigacha. Maslahatchi, inspektor va maqsadlar shu boblarga havola beradi.

Har bob: {"title": ..., "lead": qisqa mazmun, "body": [bo'laklar]}
Bo'lak turlari:
    {"h": "sarlavha"}      {"p": "paragraf"}
    {"steps": [...]}       — raqamlangan qadamlar
    {"list": [...]}        — nuqtali ro'yxat
    {"tip": "..."}         — foydali maslahat (yashil)
    {"warn": "..."}        — ogohlantirish (qizil)
    {"code": [...]}        — buyruq yoki kod
"""

CHAPTERS = {
    "start": {
        "title": "0. Vallum nima?",
        "lead": "Bu o'yinda siz startupning muhandisisiz: server olasiz, sayt qurasiz, uni internetga chiqarasiz va "
                "foydalanuvchilar ko'paygan sari tizimni kengaytirasiz.",
        "body": [
            {"h": "Ekran qanday tuzilgan"},
            {"list": [
                "Yuqorida — holat qatori: sayt holati, foydalanuvchilar, javob vaqti, xatolar, kassa, elektr, serverlar.",
                "Undan pastda — asboblar paneli: bloklar qatlamlarga bo'lingan (Serverlar, Kirish, Ilova, Ma'lumot). "
                "Blok ustiga sichqonchani olib boring — nima ekanligi chiqadi. Bosing — ma'lumot va '＋ Qo'shish' tugmasi.",
                "O'rtada — doska: bloklar va ular orasidagi strelkalar (so'rovlar qayerdan qayerga boradi).",
                "🚀 qatori — saytni internetga chiqarish qadamlari.",
                "O'ngda — maqsadlar, 💰 moliya, maslahatchi. Blokni bossangiz — uning sozlamalari (inspektor).",
            ]},
            {"h": "O'yinning asosiy sikli"},
            {"steps": [
                "Tizimni quring va ishga tushiring (keyingi bob).",
                "▶ Boshlash yoki +1 kun — vaqt o'tadi. Sayt tez va xatosiz bo'lsa — foydalanuvchilar ko'payadi.",
                "Foydalanuvchi ko'paysa — yuklama oshadi va qaysidir blok qizaradi (tor bo'g'iz).",
                "Tor bo'g'izni toping va yeching: worker qo'shing, server kattalashtiring, kesh, Load Balancer...",
                "Pulni kuzating: daromad xarajatdan katta bo'lishi kerak.",
            ]},
            {"warn": "Kassa 3 kun ketma-ket minusda bo'lsa — bankrot. Daromad yo'q paytda kunlarni ketma-ket bosmang: "
                     "avval To'lov shlyuzini ulang (2-bob)."},
        ],
    },
    "first-site": {
        "title": "1. Noldan birinchi sayt",
        "lead": "Bo'sh xonada ishlaydigan saytni qadam-baqadam qurish. Har qadamdan keyin doskaga qarang.",
        "body": [
            {"h": "A. Zanjirni qurish"},
            {"steps": [
                "＋ Xona → 'Noldan qurish'. Doskada Foydalanuvchilar va 1 ta Server bor.",
                "Asboblar panelidan Nginx, Sayt va PostgreSQL qo'shing. Ular avtomatik shu serverga joylanadi "
                "(pastidagi rangli yorliq qaysi serverda ekanini ko'rsatadi).",
                "Strelkalar torting: Foydalanuvchilar → Nginx → Sayt → PostgreSQL. Blok o'ngidagi ● nuqtadan "
                "sudrang yoki blokni bosib, inspektordagi '＋ ulash' tugmasini bosing.",
                "To'lov shlyuzini qo'shing va Sayt → To'lov shlyuzi strelkasini torting. Usiz daromad bo'lmaydi.",
            ]},
            {"h": "B. Internetga chiqarish (🚀 qatori)"},
            {"steps": [
                "2 Domen — nom kiriting (masalan dokon.uz), Nginx turgan serverni tanlang. $15.",
                "3 GitHub — repo nomi. Ochiq repo bo'lsa, avval .env ni .gitignore ga qo'shing (Kod bo'limi).",
                "4 Deploy — server kodni repodan tortib oladi. Shundan keyin sayt ishlay boshlaydi.",
                "5 SSL — HTTPS. Endi to'lov qabul qilinadi va daromad keladi.",
            ]},
            {"tip": "Holat qatorida 'Yaxshi' va 💰 moliyada daromad > 0 bo'lsa — hammasi to'g'ri. Endi ▶ Boshlash."},
            {"h": "C. Keyin nima?"},
            {"list": [
                "Kod bo'limida: DEBUG = False, SECRET_KEY ni .env ga, SECURE_SSL_REDIRECT = True.",
                "~450 foydalanuvchida Sayt band bo'ladi — 7-bob (fon ishchisi).",
                "~1500 da bitta server yetmaydi — 8-bob (2-server + Load Balancer).",
            ]},
        ],
    },
    "money": {
        "title": "2. Pul: daromad va xarajat",
        "lead": "Kassa = kecha qolgan pul + bugungi daromad − bugungi xarajat. O'ngdagi 💰 Moliya kartasida hammasi qatorma-qator.",
        "body": [
            {"h": "Daromad qayerdan keladi"},
            {"p": "Har bir foydalanuvchi kuniga $0.75 to'laydi — lekin FAQAT agar:"},
            {"list": [
                "To'lov shlyuzi qo'shilgan va Sayt → To'lov shlyuzi strelkasi bor;",
                "sayt HTTPS da ishlaydi (🚀 5-qadam SSL);",
                "sayt ishlayapti. Xatolar bo'lsa — shu ulushdagi to'lovlar yo'qoladi (10% xato = 10% kam pul).",
            ]},
            {"h": "Xarajatlar"},
            {"list": [
                "Har bir server ijarasi: Kichik $20, O'rta $50, Katta $110, Kuchli $250 kuniga.",
                "Obunalar: CDN $15/kun.",
                "Elektr: ishlatilgan har W uchun $0.05/kun (holat qatoridagi 'Elektr').",
                "Bir martalik: yangi blok narxi (asboblar panelida yozilgan), domen $15.",
            ]},
            {"tip": "Moliya kartasida 'kassa N kunga yetadi' yozuvi chiqsa — daromad yo'q yoki xarajat ko'p. "
                    "Ortiqcha serverni o'chiring yoki To'lov ulang."},
            {"warn": "Ikkinchi serverni olishdan oldin o'ylang: u kuniga $50. Foydalanuvchi 100 bo'lsa, daromad 75 — "
                     "2 server bilan har kuni minusda qolasiz."},
        ],
    },
    "servers": {
        "title": "3. Serverlar, IP va resurslar",
        "lead": "Server — mashina: CPU, RAM va IP manzil. Bloklar serverga 'joylanadi' va uning resursini bo'lishadi.",
        "body": [
            {"list": [
                "CPU va RAM har server uchun alohida. Server to'lsa — undagi HAMMA bloklar sekinlashadi (doskada qizil).",
                "Elektr (W) butun xona uchun umumiy limit. Oshirish: asboblar panelidagi ⚡.",
                "IP: ochiq server 203.0.113.x, ichki (internetga ko'rinmaydigan) 10.0.0.x.",
                "Ochiq serverda firewall (ufw) yoqing — faqat 22, 80, 443 portlar ochiq qoladi.",
            ]},
            {"h": "2-server qo'shdim — endi nima qilaman?"},
            {"p": "Bo'sh server foyda keltirmaydi, faqat pul yeydi. Uni ishlatishning uchta yo'li:"},
            {"steps": [
                "Bazani ajratish: PostgreSQL ni 2-serverga ko'chiring (blokni bosing → '▣ Server' ro'yxatidan tanlang). "
                "1-serverda Sayt uchun CPU bo'shaydi.",
                "Sayt qatlamini kengaytirish: 2-serverga yana bitta Sayt qo'ying, Load Balancer qo'shing va "
                "Nginx → LB → ikkala Sayt ulang (8-bob).",
                "Fon ishchisi yoki Redis ni 2-serverga ko'chirish.",
            ]},
            {"tip": "Server blokini bossangiz — inspektor shu server uchun aniq tavsiyalar va bir bosishda bajariladigan tugmalar ko'rsatadi."},
        ],
    },
    "launch": {
        "title": "4. Ishga tushirish: domen, GitHub, deploy",
        "lead": "Real hayotdagi tartib: Server → Domen → GitHub → Deploy → SSL. Doska tepasidagi 🚀 qatoridagi har qadamni bosing.",
        "body": [
            {"h": "Domen va DNS"},
            {"p": "Domen — IP ning odam eslaydigan nomi. DNS da A yozuvi qo'yiladi: dokon.uz → 203.0.113.10. "
                  "Domen Nginx yoki Load Balancer turgan, ochiq IP li serverga qarashi kerak."},
            {"code": ["A   @     203.0.113.10", "A   www   203.0.113.10"]},
            {"h": "GitHub"},
            {"p": "Kod repoda saqlanadi; server kodni shu yerdan oladi. Har o'zgarish — kommit (⎇ Git bo'limi)."},
            {"code": ["git add .", "git commit -m \"birinchi versiya\"", "git push origin main"]},
            {"h": "Deploy"},
            {"p": "Serverda: kodni tortib olish, kutubxonalar, migratsiyalar, gunicorn ni qayta yoqish."},
            {"code": ["cd /srv/dokon && git pull origin main", ".venv/bin/python manage.py migrate", "systemctl restart gunicorn"]},
            {"warn": "Deploy qilinmasa — Nginx so'rovni uzatadi, lekin javob beradigan kod yo'q: 502 Bad Gateway."},
        ],
    },
    "https": {
        "title": "5. HTTPS va to'lov",
        "lead": "HTTP da hamma narsa ochiq matn. HTTPS (SSL) trafikni shifrlaydi — to'lov faqat shu bilan ishlaydi.",
        "body": [
            {"list": [
                "HTTP: bir Wi-Fi dagi har kim parol, cookie va karta raqamini o'qiy oladi va o'zgartira oladi.",
                "Let's Encrypt sertifikati bepul; certbot uni Nginx'ga o'zi o'rnatadi va 90 kunda yangilaydi.",
                "Sertifikatdan keyin HTTP so'rovlarni HTTPS ga yo'naltiring: Kod → settings.py → SECURE_SSL_REDIRECT = True.",
            ]},
            {"code": ["certbot --nginx -d dokon.uz -d www.dokon.uz"]},
            {"tip": "🚀 qatorining o'ng chetida saytingiz manzili: 🔒 https — yaxshi, qizil ⚠ http — xavfli."},
        ],
    },
    "bottleneck": {
        "title": "6. Tor bo'g'iz va yuklama",
        "lead": "Tizim eng sekin bo'g'inidan tez ishlay olmaydi.",
        "body": [
            {"p": "Har blok uchun band bo'lish ρ = yuklama / sig'im. Blok ustidagi yorliqda foiz yozilgan."},
            {"list": [
                "ρ < 70% — yashil, bemalol.",
                "ρ 70–100% — sariq, navbat cho'ziladi, javob vaqti (p95) oshadi.",
                "ρ ≥ 100% — qizil, ortiqcha so'rovlar xato bilan qaytadi, foydalanuvchilar ketadi.",
            ]},
            {"tip": "Holat qatoridagi 'tor bo'g'iz: ...' qaysi blok ekanini aytadi. Avval sababni toping, keyin pul sarflang."},
        ],
    },
    "background": {
        "title": "7. Og'ir ishni fonga o'tkazish",
        "lead": "Gunicorn workeri bir vaqtda faqat BITTA so'rovga xizmat qiladi. 2 soniyalik hisobot workerni band qiladi.",
        "body": [
            {"steps": [
                "Fon ishchisi blokini qo'shing.",
                "Sayt → Fon ishchisi va Fon ishchisi → PostgreSQL strelkalarini torting.",
                "Kod → smeta/views.py → hisobot rejimini 'fonda' qiling va saqlang.",
            ]},
            {"p": "Endi so'rov faqat vazifani navbatga qo'yadi (50 ms), og'ir ishni Fon ishchisi bajaradi."},
            {"tip": "Navbat limitini (max_queue) qo'ying — aks holda navbat cheksiz o'sishi mumkin."},
        ],
    },
    "lb": {
        "title": "8. Load Balancer: 2 server bilan kengayish",
        "lead": "Bitta Sayt serveri yetmay qolganda — ikkinchisini qo'shib, yukni bo'lasiz.",
        "body": [
            {"steps": [
                "2-server qo'shing (Serverlar qatlami).",
                "Sayt blokini qo'shing va inspektorda '▣ Server' = 2-server tanlang.",
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
        "title": "9. Kesh (Redis)",
        "lead": "Ko'p so'raladigan ma'lumot xotirada saqlanadi — baza bo'shaydi.",
        "body": [
            {"list": [
                "Redis qo'shing va Sayt → Redis torting: o'qishlarning ~70% i bazaga yetmaydi.",
                "Redis'ni internetga ochmang: bind 127.0.0.1 va parol (requirepass).",
            ]},
        ],
    },
    "replica": {
        "title": "10. Read replica va PgBouncer",
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
        "title": "11. CDN",
        "lead": "Statik fayllarni (rasm, CSS, JS) dunyo bo'ylab chetdagi serverlar beradi.",
        "body": [
            {"p": "Foydalanuvchilar → CDN → Nginx. Serveringizga yuk ~30% kamayadi. Obuna $15/kun."},
        ],
    },
    "telegram": {
        "title": "12. Telegram bot ulash",
        "lead": "Bot — serverda ishlaydigan alohida dastur. Mijozlar saytga kirmasdan Telegramda ishlaydi: +2% o'sish/kun.",
        "body": [
            {"steps": [
                "Asboblar panelidan 'Telegram bot' ni qo'shing (u serverga joylanadi).",
                "Foydalanuvchilar → Telegram bot strelkasini torting (xabarlar Telegram orqali keladi).",
                "Telegram bot → Sayt strelkasini torting (bot Saytning API sidan ma'lumot oladi). "
                "Yoki to'g'ridan-to'g'ri Telegram bot → PostgreSQL.",
                "Botni bosing: inspektordagi ro'yxatda hamma qator ✓ bo'lishi kerak, yorliqda 'ishlayapti'.",
            ]},
            {"list": [
                "polling — bot o'zi Telegramdan so'rab turadi. Oddiy, HTTPS shart emas.",
                "webhook — Telegram xabarni botga o'zi yuboradi. Faqat HTTPS manzilga (🚀 SSL kerak).",
                "Token @BotFather dan olinadi va faqat .env da turadi (TELEGRAM_BOT_TOKEN). Kod: bot/main.py.",
            ]},
        ],
    },
    "code": {
        "title": "13. Kod bo'limi",
        "lead": "Loyihaning hamma fayllari — PyCharm'dagidek daraxt. Kodni o'qib o'rganasiz, yashil ramkadagi joylarni o'zgartirasiz.",
        "body": [
            {"list": [
                "Chapdagi qidiruvga 'DEBUG', 'SECRET', 'SSL' deb yozing — qaysi faylning qaysi qatorida ekanini ko'rasiz.",
                "🟢 nuqtali fayllarda o'zgartiriladigan joy bor.",
                "Ko'k fondagi qiymatlar xonadan olinadi (domen, IP), qizil fondagilar — .env sirlari.",
                "Saqlasangiz — o'zgarish ⎇ Git ga kommit bo'lib yoziladi.",
            ]},
        ],
    },
    "debug": {
        "title": "14. DEBUG=True nega xavfli?",
        "lead": "Xato sahifasi begona odamga saytning ichini ko'rsatadi.",
        "body": [
            {"p": "DEBUG=True bo'lsa, xato sahifasida barcha URL lar, fayl yo'llari va sozlamalar ko'rinadi."},
            {"tip": "Kod → config/settings.py → DEBUG = False."},
        ],
    },
    "secrets": {
        "title": "15. SECRET_KEY va .env",
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
        "title": "16. Git tarixi abadiy",
        "lead": "Kommitni keyingi kommitda 'o'chirish' uni tarixdan yo'qotmaydi.",
        "body": [
            {"p": "⎇ Git bo'limida har bir o'zgarish diff bilan. Senariyda .env boshida adashib kommit qilingan — "
                  "kalit hamon tarixda ko'rinadi."},
            {"tip": "Ochiq repoda bir marta paydo bo'lgan sir — oshkor bo'lgan sir. Yagona to'g'ri javob: rotate."},
        ],
    },
    "models": {
        "title": "17. Modellar va migratsiyalar",
        "lead": "Model — bazadagi jadval, maydon — ustun.",
        "body": [
            {"steps": [
                "Kod → smeta/models.py ni oching. O'ngda Model quruvchi chiqadi.",
                "Model nomi (masalan Order) → ＋ Model. Maydonlar qo'shing: nom, tur (ForeignKey — boshqa jadvalga bog'lanish).",
                "Saqlash · makemigrations — smeta/migrations/ da yangi fayl paydo bo'ladi.",
                "🚀 Deploy — migrate serverda bajariladi.",
            ]},
            {"warn": "Deploy qilmasangiz, kod bazada yo'q ustunni so'raydi — 20% so'rov 500 xato bilan qaytadi."},
        ],
    },
    "business": {
        "title": "Biznes, sayt va narxlar",
        "lead": "Har startup — biznes: do'kon, yangiliklar, SaaS yoki yetkazib berish. Pul qanday kelishi biznesga bog'liq.",
        "body": [
            {"h": "🌐 Sayt tabi"},
            {"p": "Chapda — mijoz ko'radigan sayt. U doskadagi tizimdan jonli yasaladi: domen yo'q bo'lsa — DNS xato, "
                  "deploy yo'q yoki tizim yiqilgan bo'lsa — 502, sekin bo'lsa — 'sahifa 2 s da ochildi', HTTPS yo'q bo'lsa — to'lov ishlamaydi."},
            {"h": "Narx → talab → foyda"},
            {"steps": [
                "O'ngdagi Admin jadvalida narx va tannarxni o'zgartiring.",
                "'Talab' ustuni: narx oshsa — xaridor kamayadi (100% — boshlang'ich).",
                "'Foyda/kun' = sotuvlar × (narx − tannarx). Eng katta foydani beradigan narxni toping.",
                "Saqlang va bir necha kun o'tkazib, 📊 Hisobotda natijani ko'ring.",
            ]},
            {"tip": "Juda arzon — ko'p sotasiz, lekin foyda yo'q. Juda qimmat — har sotuvdan ko'p, lekin sotuv deyarli yo'q. Haqiqat o'rtada."},
            {"list": [
                "🛒 Do'kon — sotuvdan foyda, tannarx xarajat sifatida yoziladi.",
                "📰 Yangiliklar — reklama puli to'lov shlyuzisiz ham keladi, lekin trafik 1.5× ko'p: Redis/CDN kerak.",
                "📋 SaaS — oylik tarif; kunlik daromad = obunachilar × narx / 30.",
                "🍔 Yetkazib berish — Telegram bot ulansa mijozlar 2 baravar tez ko'payadi.",
            ]},
        ],
    },
    "growth": {
        "title": "O'sish: reklama, imkoniyatlar, hodisalar",
        "lead": "Foyda kelyapti — endi uni ishlating. 📈 O'sish tabida pulni o'sishga aylantirasiz.",
        "body": [
            {"h": "📣 Marketing — vaqtinchalik"},
            {"p": "Kampaniya bir necha kun mijozlarni tez ko'paytiradi, lekin trafikni ham oshiradi. "
                  "Agar tizim chidamasa (qizil yoki yiqilgan) — mijozlar xato sahifani ko'radi va reklama puli havoga ketadi."},
            {"steps": [
                "Avval doskada tizim yashil ekanini va zaxira quvvat borligini tekshiring.",
                "Arzon kampaniyadan boshlang (Telegram post).",
                "Kampaniya paytida loglar va p95 ni kuzating. Sariq bo'lsa — server qo'shing.",
                "Katta aksiya (2× trafik) — faqat Load Balancer va 2 ta Sayt bo'lganda.",
            ]},
            {"h": "🧩 Yangi imkoniyatlar — doimiy"},
            {"p": "Qidiruv, sodiqlik bonuslari, push-bildirishnomalar, mobil ilova — sotuv yoki o'sishni doimiy oshiradi. "
                  "Ba'zilari yangi blok talab qiladi (push uchun Fon ishchisi)."},
            {"h": "⚡ Hodisalar"},
            {"list": [
                "🎉 Viral / bayram — trafik keskin oshadi: tizim tayyor bo'lsa — katta foyda.",
                "⚠ Raqobatchi — sotuv 3 kun kamayadi: narxlarni qayta ko'ring.",
                "⚠ Disk buzildi — zaxira nusxa (backup) bo'lmasa mijozlarning 25% ketadi.",
                "⚠ Elektr uzildi — monitoring bo'lsa tez tiklanadi.",
            ]},
            {"h": "🏢 Yangi startup"},
            {"p": "Hisobda pul ko'p bo'lsa — yangi startup oching va hozirgisidan sarmoya kiriting. "
                  "Portfelda hamma startuplar va umumiy boylik ko'rinadi."},
            {"warn": "Sarmoya hozirgi startup hisobidan olinadi — unda server va xarajatlar uchun pul qolganiga ishonch hosil qiling."},
        ],
    },
    "faq": {
        "title": "18. Muammolar va yechimlar",
        "lead": "Eng ko'p uchraydigan holatlar.",
        "body": [
            {"h": "Holat 'Qulagan', xatolar 100%"},
            {"p": "O'ngdagi maslahatchi sababni yozadi: domen yo'q, deploy qilinmagan, strelka yetishmaydi, blok serverga joylanmagan."},
            {"h": "Blok kulrang va 'ulanmagan'"},
            {"p": "Blokni bosing — inspektordagi ✗ qatorlar qaysi strelka yetishmasligini ko'rsatadi, '＋ ulash' tugmasi bilan ulang."},
            {"h": "Pul tugayapti"},
            {"p": "💰 Moliya kartasini oching: daromad 0 bo'lsa — To'lov va HTTPS. Xarajat katta bo'lsa — keraksiz server yoki CDN ni o'chiring."},
            {"h": "Blok qo'shilmayapti"},
            {"p": "Serverda CPU/RAM yoki xonada elektr yetmayapti. Serverni kattalashtiring (Server → tur), yangi server oling yoki ⚡ elektrni oshiring."},
        ],
    },
}

DEFENDER = CHAPTERS
