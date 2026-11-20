# CLAUDE.md — Vallum loyihasi bo'yicha topshirish hujjati

> Bu fayl yangi Claude sessiyasi (yoki boshqa dasturchi) loyihani tez tushunib, ishni
> davom ettira olishi uchun yozilgan. Claude Code uni avtomatik o'qiydi.

## 1. Loyiha nima

**Vallum** — Django + vanilla JS da yozilgan **o'quv o'yini**: o'yinchi startup ochadi va uning
backend infratuzilmasini doskada bloklardan quradi (Server, Nginx, Sayt/Django, PostgreSQL, Redis,
To'lov shlyuzi, Avtorizatsiya/OTP, Telegram bot, CDN, media ...). Tizim real vaqtda ishlaydi:
mijozlar keladi, pul tushadi, xarajat ketadi, tor bo'g'izlar paydo bo'ladi. Maqsad — dasturlashni
bilmagan odam ham backend qanday ishlashini o'ynab o'rgansin; tizim har qadamda yetaklaydi.

Hammasi **simulyatsiya** — hech qanday real tarmoq so'rovi yo'q.

## 2. Foydalanuvchi bilan ishlash qoidalari (muhim!)

- Foydalanuvchiga javoblar **o'zbek tilida**, qisqa, oraliq holat xabarlari bilan.
- Koddagi izohlar ham **o'zbekcha**.
- **Hujum simulyatori / xakerlik mazmuni qo'shilmasin** (avval xavfsizlik filtri bloklagan). Loyiha faqat qurish va himoya haqida.
- Foydalanuvchi o'zi `runserver` ni `127.0.0.1:8000` da ishlatib turadi (autoreload). Python o'zgarishlari darhol qo'llanadi; **migratsiya qo'shilsa `migrate` ni o'zingiz ishga tushiring**.
- Foydalanuvchi commitni so'raganda **main** ga commit qilinadi (push qilinmaydi, so'ralmasa).
- Brauzerda tekshirganda vaqtinchalik startup yarating va keyin o'chiring; foydalanuvchining startuplariga (SmetaPro, "Mening birinchi startupim") tegmang. Diqqat: "faol startup" global — foydalanuvchining ochiq tabi ham shu bazani ishlatadi.
- Katta o'zgarishlar ilgari scratchpad'dagi Python "patch" skriptlari bilan qilingan (katta heredoc'lar Bash'da buziladi). Oddiy tahrirlar uchun Edit vositasi yetarli.

## 3. Ishga tushirish

```powershell
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py runserver
.venv\Scripts\python manage.py test game      # 41 ta test, hammasi o'tishi kerak
```
JS sintaksisini tekshirish: `node --check game/static/game/js/<fayl>.js`.

## 4. Arxitektura

### Backend (`game/`)
| Fayl | Vazifasi |
|---|---|
| `models.py` | `Room` (startup), `Block`, `Connection`, `Commit`. **`Room.save()` balansni hamma startuplarga ko'chiradi — balans umumiy (bitta hamyon).** |
| `catalog.py` | Bloklar katalogi (`BLOCKS`): narx, CPU/RAM, maydonlar, shakl, ikon. Dasturlar **bepul** (`cost: 0`); pul faqat server ijarasi, domen, tashqi xizmatlarga. `ELECTRICITY_PRICE = 0`. `BLOCK_CODE` — har blokning config fayli. |
| `rules.py` | Qaysi blok qaysi blokka ulanishi mumkin (`TRAFFIC`), talablar, `WHY_NOT` tushuntirishlar. |
| `engine.py` | Sof hisob-kitob: `evaluate()` (rps, p95, xato, tor bo'g'iz, holat), `finance()`, `hour_step()`, `daily_growth()`, `service_costs()` (to'lov 2%, SMS $0.02), `advise()`. Konstantalar faylning boshida. |
| `services.py` | O'yin mantiqi va DB: `create_room`, `add_block`, `connect`, `launch_step` (🚀 server→domen→github→deploy→ssl), `sync`/`advance_hours` (real vaqt), `withdraw` (kassa), `resume`, `save_models`, `save_admin`, `buy_growth`, `snapshot()` (brauzerga yuboriladigan to'liq holat). |
| `business.py` | Biznes turlari (do'kon, yangiliklar, SaaS, ovqat yetkazish): talab formulasi, narx/tannarx, bozor hajmi. |
| `growth.py` | Marketing kampaniyalari, `UPGRADES` (shu jumladan `sms` — SMS provayder $50), tasodifiy hodisalar, yutuqlar. |
| `project.py` | O'yinchi loyihasining **Django kodi** (Kod bo'limi): `app/`, `accounts/` (OTP), `templates/`, `media/`, `config/`. Model quruvchi (`clean_models`, limitlar), migratsiyalar, `admin_code()` + `clean_admin()` (Django admin: list_display/search_fields/list_filter). |
| `launch.py` | 🚀 5 qadam matnlari va **terminal vazifalari** (o'yinchi buyruq yozadi). |
| `scenario.py` | Boshlang'ich holatlar: `SCENARIO_START` (SmetaPro), `SANDBOX_START` (bo'sh), `STARTER_START` (tayyor kichik loyiha), maqsadlar. |
| `guide.py` | Qo'llanma boblari (sodda tilda). |
| `views.py` / `urls.py` | JSON API. `api` dekoratori har so'rovda `services.sync(room)` chaqiradi (o'tgan vaqt hisoblanadi). |
| `migrations/0003_shared_balance.py` | Eski alohida balanslarni bitta umumiy balansga jamlagan. |

### Frontend (`game/static/game/js/`, ES modullar, framework yo'q)
| Fayl | Vazifasi |
|---|---|
| `app.js` | Asosiy: holat, `actions`, `run()`, render, har 5 s poll, soat, onboarding (5 qadam), `boardTour()`, `launchHint()`, kassa tugmasi. |
| `board.js` | Doska: bloklar, strelkalar, **oqim turlari `FLOWS`/`flowOf()`** (HTTP, proxy, SQL, kesh, to'lov, OTP, vazifa, bot, fayl — har biri o'z rangi + strelka ustida yozuv), sudrash, `boardPoint()`. |
| `panels.js` | Holat qatori, bloklar paneli (toolbar), o'ng panel, moliya kartasi, grafik (`renderChart` — 2 ta mini grafik), Git, Qo'llanma. |
| `launch.js` | 🚀 qadam oynasi + terminal (`▶ Yozib ko'rsat` — harfma-harf avto yozish; birinchi marta avtomatik). |
| `demo.js` | **"Noldan qurib ko'rsat"** animatsiyasi: kursor bloklarni sudraydi, strelka chizadi, model shablonini qo'yadi. |
| `tour.js` | Spotlight yo'riqnoma: ekran xiralashadi (SVG evenodd parda), kerakli joy yoritiladi. |
| `site.js` | 🌐 Sayt: mijoz ko'radigan jonli sayt + o'ngda "Do'kon: narxlar" va **"Django admin"** (soxta /admin/ + sozlash → `app/admin.py`). |
| `code.js` | Kod bo'limi (IDE) + Model quruvchi. |
| `growth.js`, `report.js`, `logs.js`, `icons.js`, `tpl.js`, `api.js` | O'sish sahifasi, hisobot, jonli loglar, blok shakllari (SVG), shablon, API chaqiruvlari. |

CSS: `game/static/game/css/vallum.css` — bo'limlar `v3`…`v12` izohlari bilan oxiriga qo'shib borilgan (oxirgilari ustun). Mobil uchun `@media (max-width: 760px)` bloklari bor.

## 5. Asosiy o'yin qoidalari (hozirgi holat)

- **Real vaqt:** 1 o'yin kuni = 20 daqiqa (`GAME_DAY_SECONDS`), 1 soat ≈ 50 s. O'yinchi yo'qligida ham hisoblanadi (ko'pi bilan 7 kun, `MAX_CATCHUP_DAYS`). Qaytganda "Siz yo'qligingizda" oynasi chiqadi.
- **Umumiy balans:** hamma startuplar uchun bitta hamyon. Yangi startup pul bermaydi, reset ham balansni o'zgartirmaydi.
- **Kassa:** mijoz to'lovlari avval startupning **To'lov shlyuzi kassasida** (`flags.kassa`) yig'iladi; o'yinchi "💰 yechib olish" bosmaguncha balansga tushmaydi. Xarajat esa balansdan ketadi → o'yinchi qaytib kirishga majbur.
- **Bankrot yo'q:** balans 0 ga tushsa hosting to'xtaydi (`flags.suspended`), xarajat ham to'xtaydi, mijozlar kuniga −3%. "Qayta yoqish" tugmasi.
- **Egasi kirmasa:** 3 o'yin kunidan ortiq kirilmasa sayt to'xtaydi (`flags.neglected`), ijara esa to'lanaveradi.
- **Foydalanuvchilar:** yangi startupda 0; birinchi **deploy** da 50 ta keladi. Bozor to'yingani sari o'sish sekinlashadi.
- **Holat:** hali deploy qilinmagan sayt "Qulagan" emas — **"Hali ishga tushmagan"** (`status: "idle"`, faqat snapshot'da almashtiriladi).
- **Avtorizatsiya:** email OTP bepul; SMS uchun `growth.UPGRADES["sms"]` sotib olinishi kerak, aks holda `auth_ok = False`.
- **Pul:** dasturlar bepul; server ijarasi ($20/$50/$110 kuniga), domen $15, CDN obunasi, to'lov komissiyasi 2%, SMS $0.02.
- **Model quruvchi limitlari:** 6 model, model boshiga 10 maydon, jami 36, 8 ta ForeignKey.

## 6. Bajarilgan ishlar (xronologik)

1. 1–3 bosqichlar (commit `7cbed9c`): $ balans, loglar, hisobot, terminal, biznes turlari, jonli sayt, narxlar, marketing, yangilanishlar, hodisalar, portfel.
2. Real vaqt + offlayn hisob; bankrot o'rniga hosting to'xtashi; bozor to'yinishi; "qo'shsangiz nima bo'ladi" ko'rsatkichi; model quruvchi limitlari.
3. Elektr olib tashlandi, dasturlar bepul; 2 qatorli sarlavha; "xona" → "startup / yangi g'oya"; egasi kirmasa sayt to'xtashi; `smeta` → `app` + `templates/`, `media/`, `accounts/`; Avtorizatsiya (OTP) bloki; onboarding + tayyor loyiha.
4. Spotlight yo'riqnoma; 0 → 50 foydalanuvchi; SMS pullik xizmat; kassa va yechib olish; yangi grafik; katta tablar.
5. "Noldan qurib ko'rsat" animatsiyasi; terminalda avto-yozish; "ishga tushmagan" holati; Django admin (kod + sozlash UI); mobil moslashuv.
6. Umumiy balans (+ migratsiya); oqim turlari bo'yicha rangli strelkalar va legenda; terminal matni tashqariga chiqmasligi.

## 7. Keyingi g'oyalar (foydalanuvchi bilan kelishilgan yo'nalish)

- **Tayyor komponentlar ("no-code" qurilish):** katalog, savat, buyurtmalar, bildirishnomalar (email/Telegram), qidiruv, fayl yuklash (`media`) — har biri doskaga qo'yiladi va kodga (`INSTALLED_APPS`, `urls`, `models`, `templates`) avtomatik ulanadi, tizim nima o'zgarganini tushuntiradi. Avtorizatsiya bloki — shunday qilingan birinchi namuna.
- Ko'rsatma (`demo.js`) ni boshqa mavzularga kengaytirish: Redis kesh, Load Balancer, ikkinchi server.
- Mobil versiyani yanada sayqallash (doska sensorli ekranda sudrash).

## 8. E'tibor beriladigan joylar

- `snapshot()` dagi `metrics` bir necha joyda o'zgartiriladi (idle holat, kassa yorlig'i) — engine natijasi emas, ko'rinish uchun.
- `hour_step()` `sales` (kassaga) va `revenue` (sales + reklama) ni alohida qaytaradi; `advance_hours` reklamani to'g'ridan-to'g'ri balansga, sotuvni kassaga yozadi.
- Testlar (`game/tests.py`) — har yangi qoida uchun test qo'shilgan; o'zgarishdan keyin hammasi o'tishi shart.
- `localStorage` kalitlari: `vallum.onboarded`, `vallum.toured`, `vallum.ttydemo`.
- `.claude/launch.json` — Claude preview uchun runserver konfiguratsiyasi (git'da emas).
