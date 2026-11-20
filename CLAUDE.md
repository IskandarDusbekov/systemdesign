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
.venv\Scripts\python manage.py test game      # 60 ta test, hammasi o'tishi kerak
```
JS sintaksisini tekshirish: `node --check game/static/game/js/<fayl>.js`.
Ishlaydigan muhit — `.venv` (bo'sh `venv/` papkasi ham bor, unda Django yo'q). Brauzer static fayllarni keshlaydi — CSS/JS o'zgarsa Ctrl+F5.

## 4. Arxitektura

### Backend (`game/`)
| Fayl | Vazifasi |
|---|---|
| `models.py` | `Room` (startup, `owner` → User), `Block`, `Connection`, `Commit`, `Ledger` (g'azna). **`Room.save()` balansni shu egasining hamma startuplariga ko'chiradi — hamyon har o'yinchiga bitta.** |
| `accounts.py` | Akkauntlar: `/royxat/`, `/kirish/` (email yoki username), `/chiqish/` (POST). Parol validatorlari (o'zbekcha `UZ_PASSWORD`), 5 xato → 5 daqiqa blok (cache). Birinchi ro'yxatdan o'tgan (staff yo'q bo'lsa) — o'yin egasi; staff kirganda egasiz startuplar unga o'tadi. Shablon: `templates/game/auth.html`. |
| `owner.py` | 🛠 Boshqaruv (faqat staff, `GET/POST /api/owner`): o'yinchilar/balans, startuplar (+1 soat/+1 kun/+7 kun), domenlar (bo'shatish), serverlar (o'chirish), g'azna (`Ledger`: domain, server, rent). |
| `catalog.py` | Bloklar katalogi (`BLOCKS`): narx, CPU/RAM, maydonlar, shakl, ikon. Dasturlar **bepul** (`cost: 0`); pul faqat server ijarasi, domen, tashqi xizmatlarga. `ELECTRICITY_PRICE = 0`. `BLOCK_CODE` — har blokning config fayli. |
| `rules.py` | Qaysi blok qaysi blokka ulanishi mumkin (`TRAFFIC`), talablar, `WHY_NOT` tushuntirishlar. |
| `engine.py` | Sof hisob-kitob: `evaluate()` (rps, p95, xato, tor bo'g'iz, holat), `finance()`, `hour_step()`, `daily_growth()`, `service_costs()` (to'lov 2%, SMS $0.02), `advise()`. Konstantalar faylning boshida. |
| `services.py` | O'yin mantiqi va DB: `create_room`, `add_block`, `connect`, `launch_step` (🚀 server→domen→github→deploy→ssl), `sync`/`advance_hours` (real vaqt), `withdraw` (kassa), `resume`, `save_models`, `save_admin`, `buy_growth`, `snapshot()` (brauzerga yuboriladigan to'liq holat). |
| `business.py` | Biznes turlari (do'kon, yangiliklar, SaaS, ovqat yetkazish): talab formulasi, narx/tannarx, bozor hajmi. |
| `growth.py` | Marketing kampaniyalari, `UPGRADES` (shu jumladan `sms` — SMS provayder $50), tasodifiy hodisalar, yutuqlar. |
| `project.py` | O'yinchi loyihasining **Django kodi** (Kod bo'limi): `app/`, `accounts/` (OTP), `templates/`, `media/`, `config/`. Model quruvchi (`clean_models`, limitlar), migratsiyalar, `admin_code()` + `clean_admin()` (Django admin: list_display/search_fields/list_filter). |
| `launch.py` | 🚀 5 qadam matnlari va **terminal vazifalari** (o'yinchi buyruq yozadi; har birida `explain` — "nima bo'ldi"). |
| `scenario.py` | Boshlang'ich holatlar: `SCENARIO_START` (SmetaPro), `SANDBOX_START` (eski bo'sh), `STARTER_START` (tayyor shablon), `SCRATCH_START` (noldan), `BOUGHT_START` (sotib olish, `BUY_PRICE`=$400), `MODES` (3 xil boshlash matni), maqsadlar. |
| `devsetup.py` | **Dars: 0 dan Django loyiha** — `TASKS` (29 ta): `kind: cmd` (terminal: mkdir → venv → pip → startproject → runserver → startapp → dirs → `code .`) va `kind: edit` (muharrir: settings.py INSTALLED_APPS/DIRS/STATIC/MEDIA → views.py → app/urls.py → config/urls.py → home.html → models.py), makemigrations → migrate → admin.py → createsuperuser → runserver → freeze → git init/add/commit/remote/push. Har birida `explain`, `why`, `reveals`, `tree`, `browser`. Holat: `flags.dev` + `flags.dev_v=2`; eski 13 vazifalik progress `_legacy()` bilan o'tkaziladi. `makemigrations` → `LESSON_MODEL` (Product) sxemaga; `gitcommit` → birinchi kommit; `push` → 🚀 GitHub bajarildi. |
| `guide.py` | Qo'llanma boblari (sodda tilda). |
| `views.py` / `urls.py` | JSON API. `api` dekoratori: kirmagan bo'lsa 401, `services.get_room(request.user)`, `services.sync(room)`. `index` — `@login_required` + versiyali **import map** (`?v=<mtime>`, brauzer eski JS keshini ishlatmasin). `/api/djadmin` — o'yinchi saytidagi Django admin. |
| `migrations/0003_shared_balance.py` | Eski alohida balanslarni bitta umumiy balansga jamlagan. |

### Frontend (`game/static/game/js/`, ES modullar, framework yo'q)
| Fayl | Vazifasi |
|---|---|
| `app.js` | Asosiy: holat, `actions`, `run()`, render, har 5 s poll, soat, onboarding (5 qadam), `boardTour()`, `launchHint()`, kassa tugmasi. |
| `board.js` | Doska: bloklar, strelkalar, **oqim turlari `FLOWS`/`flowOf()`** (HTTP, proxy, SQL, kesh, to'lov, OTP, vazifa, bot, fayl — har biri o'z rangi + strelka ustida yozuv), sudrash, `boardPoint()`. |
| `panels.js` | Holat qatori, bloklar paneli (toolbar), o'ng panel, moliya kartasi, grafik (`renderChart` — 2 ta mini grafik), Git, Qo'llanma. |
| `launch.js` | 🚀 qatori ("noldan"da `0 · Lokal` qadami bilan) va qadam oynalari. |
| `term.js` | Umumiy o'quv terminali: **sekin** — har buyruqdan keyin "Nima bo'ldi / O'zgardi" va **"Tushundim"** bosilmaguncha keyingisi ochilmaydi (`gate`); `edit` vazifalar uchun `complete(task)`; ↑/↓ tarix, Tab to'ldirish, help, cls/clear, `▶ Yozib ko'rsat`, `Buyruq`, har buyruqdan keyin "Nima bo'ldi" izohi; Windows (cmd) yoki Linux ko'rinishi. |
| `web.js` | **🌐 Brauzer** (`#page-web`): o'yin ichidagi internet — `qidirbek.uz` (yangi tab/qidiruv), `bulutxon.uz` (VPS ijarasi → doskada Server, "Serverlarim" — IP nusxalash), `domenchi.uz` (domen qidirish/sotib olish, "Mening domenlarim" → DNS A yozuvi), o'z domeni (site.js `browserBody`), 127.0.0.1/begona domenlar — Chrome xato sahifalari. O'ngda "Saytni internetga ulash" vazifa ro'yxati. **Bir nechta tab** (`tabs`, `nav` — faol tab, `shared` — bufer; "+", ×, Ctrl+bosish — yangi tabda). Qidiruv tizimi — **Qidirbek** (`qidirbek.uz`). API: `POST /api/web {action: rent|buy_domain|dns|cancel_server|drop_domain}` (Serverlarim/Mening domenlarim — o'chirish tugmasi; server ichidagi dasturlar ham o'chadi). |
| `local.js` | **🎓 Dars sahifasi** (`renderLesson`, `#page-lesson`): chapda bosqichlar, o'rtada VS Code (muharrir: yashil qatorni yozish, `Yozib ber`, `Ctrl+S`) + terminal, o'ngda EXPLORER va mini brauzer (127.0.0.1:8000: xato → raketa → home → admin). Boshida GitHub username so'raladi (`POST /api/profile`, `services.set_profile` — hamma startuplarga, `gh_user()`), PyCharm ko'rinishi (`pycharm .`), bajarilgan qadamni bosib **qayta ko'rish** (buyruq, natija, izoh, o'sha paytdagi papka/brauzer). ID'lar `les*` (launch.js `ls*` bilan to'qnashmasin!). **Tez takrorlash** (`vallum.lesson.replay`, `vallum.lesson.replayname`): boshidan, papka nomi erkin (term.js `freeName`), `gate:false`, startupga ta'sirsiz; o'ngda rangli **Jarayon** logi (term.js `onLog`: ok/err/info). Noldan startupda `POST /api/dev`, boshqasida mashq (`localStorage vallum.lesson`, papka nomi erkin — `vallum.lesson.replayname`). **Faylda yozish** rejimi (standart, `vallum.edmode` = file/step): butun fayl `textarea`da ochiladi, o'yinchi joyni o'zi topadi, Ctrl+S → `checkFile` xatolarni ko'rsatadi; Project'da faylni bosish — faqat ko'rish. Poll qayta chizmasin — `mounted` kaliti. |
| `djfiles.js` | Dars fayllarining to'liq asl matni (`startproject`/`startapp` chiqargan settings.py, urls.py, views.py ...), `applyTask` (vazifani faylga qo'llash — "Yozib ber" va oldingi qadamlarni tiklash), `checkFile` (har "+" qator bormi va joyi to'g'rimi), `REPLACES` (eski qatorni almashtiruvchi vazifalar). |
| `owner.js` | 🛠 Boshqaruv sahifasi (`#page-owner`, yon panelda faqat staff'ga — `.staff-only`). |
| `git.js` | Git sahifasi — GitHub uslubida: Code (fayllar + oxirgi kommit, README, Languages, Clone), Commits (kunlar bo'yicha, diff +/−), Security (sirlar). |
| `ui-icons.js` | Interfeys SVG ikonlari: `ico(name, size)`, HTML'da `<i data-ico="...">` + `hydrateIcons()`, `fileIco(path)`. Emoji o'rniga shular ishlatilsin. |
| `demo.js` | **"Noldan qurib ko'rsat"** animatsiyasi: kursor bloklarni sudraydi, strelka chizadi, model shablonini qo'yadi. |
| `tour.js` | Spotlight yo'riqnoma: ekran xiralashadi (SVG evenodd parda), kerakli joy yoritiladi. |
| `site.js` | 🌐 Sayt: mijoz ko'radigan jonli sayt + o'ngda "Do'kon: narxlar" va **"Django admin"**: `createsuperuser` (parol xeshlanadi, `flags.dj_super`) → `/admin/login/` → panel; panel nomi `admin.site.site_header` (`schema.admin_site`) → `app/admin.py` + kommit. |
| `code.js` | Kod bo'limi (IDE) + Model quruvchi. |
| `growth.js`, `report.js`, `logs.js`, `icons.js`, `tpl.js`, `api.js` | O'sish sahifasi, hisobot, jonli loglar, blok shakllari (SVG), shablon, API chaqiruvlari. |

CSS: `game/static/game/css/vallum.css` — bo'limlar `v3`…`v14` izohlari bilan oxiriga qo'shib borilgan (oxirgilari ustun). v13: Inter shrifti (kod uchun JetBrains Mono), ikonlar, 3 xil boshlash, terminal, Lokal, GitHub (`.gh-*`), qo'llanma. Mobil uchun `@media (max-width: 760px)` bloklari bor. v14: **chap yon panel** (`.sidenav#tabs`, guruhlar Qurish/Biznes/Yordam, `nav-mini` ixcham rejim, ≤1100px faqat ikon, ≤760px pastki panel), Dars (`.les-*`, `.ed-*`, `.lw-*`), Sayt (`.rq-flow` so'rov yo'li, Chrome/nginx sahifalari `.cr-err`/`.ng-page`, `.br-why`).

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

- **Akkauntlar:** har o'yinchining o'z startuplari va hamyoni (`services.mine(owner)`). `get_room/create_room/list_rooms/switch_room` egasi bilan chaqiriladi; `owner=None` — testlar/eski startuplar.
- **G'azna:** `services.pay()` — domen ($15) va soatlik server ijarasi (`advance_hours`, kun bo'yicha bitta qatorga jamlanadi). Server **oldindan to'lovsiz** — faqat soatbay (kamida 1 kunlik pul bo'lishi shart).
- **Hamyon:** `api` dekoratori `services.sync_owner(room)` chaqiradi — o'yinchining HAMMA startuplari har so'rovda hisoblanadi (aks holda boshqa startupga o'tganda ijara birdan yechilardi). `snapshot.wallet` — balans yonidagi "kuniga −$X" ro'yxati (panels.js `walletHtml`).
- **Server paroli:** `services.root_password(room, srv)` (bazada saqlanmaydi, hosildan), snapshot blokida `login`/`password`; Bulutxon → Serverlarim'da ko'rinadi; term.js `ssh root@IP` dan keyin parol so'raydi (`opts.sshPassword`, 3 xato → rad). `cancel_server` app'lar o'chsa `deployed=False`.
- **Uch xil boshlash** (Yangi g'oya oynasi va onboarding): `scratch` — noldan (kod ham, server ham yo'q; GitHub/deploy `_need_code` bilan yopiq lokal qadamlar tugamaguncha), `starter` — tayyor shablon, `bought` — $400 ga ishlab turgan biznes (domen, HTTPS, 300 mijoz). Rejim `room.flags["mode"]` da; `reset_room` rejimni saqlaydi va qayta to'lov olmaydi.
- **Domen va DNS alohida:** `buy_domain` (domen, A yozuvisiz), `set_dns(ip)` (IP o'yinchining serveriga tegishli bo'lishi shart), `rent_server(tier)`. `launch.done.domain` = domen **va** A yozuvi. `siteState`: `nodns` (A yo'q), `refused` (serverda Nginx yo'q). Band domenlar — `services.TAKEN_DOMAINS`.
- **Avval server:** `add_block` server bo'lmasa boshqa blokni rad etadi (doska = serverlar). Toolbar'da bloklar qulf, doskada `.board-empty` izohi.
- **Sayt sahifasi:** tepada so'rov yo'li (Brauzer → DNS → Server → Nginx → Django → Baza → Javob), birinchi uzilgan joy qizil; haqiqiy xato sahifalari + "Nima bo'ldi" izohi.
- **Qo'llanma** (`guide.py`): boblar `part` bo'yicha guruhlangan, raqamlarni JS qo'yadi; `cmds`/`files` jadval bloklari bor.

## 6. Bajarilgan ishlar (xronologik)

1. 1–3 bosqichlar (commit `7cbed9c`): $ balans, loglar, hisobot, terminal, biznes turlari, jonli sayt, narxlar, marketing, yangilanishlar, hodisalar, portfel.
2. Real vaqt + offlayn hisob; bankrot o'rniga hosting to'xtashi; bozor to'yinishi; "qo'shsangiz nima bo'ladi" ko'rsatkichi; model quruvchi limitlari.
3. Elektr olib tashlandi, dasturlar bepul; 2 qatorli sarlavha; "xona" → "startup / yangi g'oya"; egasi kirmasa sayt to'xtashi; `smeta` → `app` + `templates/`, `media/`, `accounts/`; Avtorizatsiya (OTP) bloki; onboarding + tayyor loyiha.
4. Spotlight yo'riqnoma; 0 → 50 foydalanuvchi; SMS pullik xizmat; kassa va yechib olish; yangi grafik; katta tablar.
5. "Noldan qurib ko'rsat" animatsiyasi; terminalda avto-yozish; "ishga tushmagan" holati; Django admin (kod + sozlash UI); mobil moslashuv.
6. Umumiy balans (+ migratsiya); oqim turlari bo'yicha rangli strelkalar va legenda; terminal matni tashqariga chiqmasligi.
7. 3 xil boshlash (noldan / shablon / sotib olish); noldan — Windows terminalida real buyruqlar bilan Django loyiha; umumiy o'quv terminali; SVG ikonlar; GitHub uslubidagi Git; qo'llanma qayta yozildi (yangi boblar: noldan, fayl tuzilmasi, buyruqlar lug'ati); Inter shrifti.
8. Chap yon panel; alohida **Dars** bo'limi (29 qadam, muharrir + terminal, settings → urls → model → git push); sekin terminal ("Tushundim"); avval server qoidasi; Sayt sahifasi real ko'rinishda (so'rov yo'li, Chrome/nginx sahifalari).
10. Akkauntlar (email+parol, xavfsiz), har kimning o'z startup/hamyoni, 🛠 Boshqaruv + g'azna, o'yin ichidagi Django admin (superuser, login, panel nomi), Darsni tez takrorlash + Jarayon logi, brauzer tablari + Qidirbek, Kod maydonlari kontrasti (`.ln2.edl`), import map (kesh).
11. Hamyon bir tekis (sync_owner) + xarajatlar ro'yxati; ijara faqat soatbay; server root paroli + ssh parol; serverlar/domenlarni o'chirish; tez rejimda erkin papka nomi; "Kunlik natijalar" grafigi yig'ilgan (`vallum.chart`).
12. Darsda mashq rejimida ham erkin papka nomi; **faylda to'g'ridan-to'g'ri tahrirlash** (butun fayl, joyni o'zi topadi, Ctrl+S tekshiruvi, `djfiles.js`); Project'da fayllarni ochib ko'rish.
13. Boshqaruvda mijozlar sonini qo'lda o'zgartirish; engine: Saytga ulangan HAMMA Fon ishchilari bitta navbatni birga bajaradi (`worker_ids`); qo'llanma: "Og'ir ishni fonga" kengaytirildi, yangi bob `roles` (Bir nechta server: kim nima qiladi).
9. O'yin ichidagi Brauzer (Bulutxon.uz, Domenchi.uz, Qidirgich → Qidirbek); domen + A yozuvi alohida; GitHub username; PyCharm; darsni qayta ko'rish; aniqroq "Tushundim" (vazifa qatorida ham); lesson/launch terminal ID to'qnashuvi tuzatildi.

## 7. Keyingi g'oyalar (foydalanuvchi bilan kelishilgan yo'nalish)

- **Tayyor komponentlar ("no-code" qurilish):** katalog, savat, buyurtmalar, bildirishnomalar (email/Telegram), qidiruv, fayl yuklash (`media`) — har biri doskaga qo'yiladi va kodga (`INSTALLED_APPS`, `urls`, `models`, `templates`) avtomatik ulanadi, tizim nima o'zgarganini tushuntiradi. Avtorizatsiya bloki — shunday qilingan birinchi namuna.
- Ko'rsatma (`demo.js`) ni boshqa mavzularga kengaytirish: Redis kesh, Load Balancer, ikkinchi server.
- Mobil versiyani yanada sayqallash (doska sensorli ekranda sudrash).

## 8. E'tibor beriladigan joylar

- `snapshot()` dagi `metrics` bir necha joyda o'zgartiriladi (idle holat, kassa yorlig'i) — engine natijasi emas, ko'rinish uchun.
- `hour_step()` `sales` (kassaga) va `revenue` (sales + reklama) ni alohida qaytaradi; `advance_hours` reklamani to'g'ridan-to'g'ri balansga, sotuvni kassaga yozadi.
- Testlar (`game/tests.py`) — har yangi qoida uchun test qo'shilgan; o'zgarishdan keyin hammasi o'tishi shart.
- `localStorage` kalitlari: `vallum.onboarded`, `vallum.toured`, `vallum.ttydemo`, `vallum.localdemo`, `vallum.lesson` (mashq progressi), `vallum.lesson.replayname`, `vallum.edmode`, `vallum.chart`, `vallum.navmini`.
- Brauzerda sinov: vaqtinchalik **staff test akkaunt**ni shell orqali yarating va keyin o'chiring (startuplari CASCADE bilan o'chadi; `Ledger` qatorlarini ham). Foydalanuvchi akkauntlari: `admin` (egasi, superuser), `a@gmail.com`.
- Bash heredoc ichida `\\n` bitta `\n` ga aylanib qolishi mumkin — teskari chiziqli patchlarni Write bilan faylga yozing.
- Brauzerda sinovda pul sarflanadi (hamyon!) va username hamma startuplarga yoziladi — sinovdan keyin `gh_user` ni olib tashlang. Faol startupni foydalanuvchi o'z tabida almashtirishi mumkin — mutatsiya qilishdan oldin faol startupni tekshiring.
- `.claude/launch.json` — Claude preview uchun runserver konfiguratsiyasi (git'da emas).
