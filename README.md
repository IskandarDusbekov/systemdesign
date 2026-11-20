# Vallum · Poligon (MVP)

Vallum — server infratuzilmasini qurishni o'rgatadigan o'yin: serverlar, IP lar, Load Balancer,
baza, kesh, sayt kodi, `.env` sirlari va Git tarixi. Faqat simulyatsiya — hech qanday real tarmoq
so'rovi yuborilmaydi.

> **1-senariy · Garaj → Birinchi toshqin.** Siz SmetaPro startupining muhandisisiz.
> 100 ta mijoz bilan boshlaysiz, ular ko'paygan sari tizim tor bo'g'izlarga duch keladi.
> Yoki **noldan** o'z xonangizni yaratib, tizimni o'zingiz quring.

## Ishga tushirish (Windows, PowerShell)

```powershell
python -m venv .venv
```
```powershell
.venv\Scripts\pip install -r requirements.txt
```
```powershell
.venv\Scripts\python manage.py migrate
```
```powershell
.venv\Scripts\python manage.py runserver
```

Brauzerda: http://127.0.0.1:8000

Testlar:

```powershell
.venv\Scripts\python manage.py test game
```

## Qanday o'ynaladi

**Xonalar** (yuqori panel) — har xona alohida tizim: o'z serverlari, kodi, `.env` va Git tarixi.
`＋ Xona` → "Noldan qurish" yoki "Senariy". `✎` — nomlash, `🗑` — o'chirish, ro'yxatdan — almashtirish.

**▦ Doska**
- Yuqoridagi katta asboblar panelidan blok qo'shing (bosing yoki sudrang). Bloklar qatlamlarga
  bo'lingan: Serverlar · Kirish · Ilova · Ma'lumot.
- **Server** — mashina: IP manzil (ochiq `203.0.113.x` yoki ichki `10.0.0.x`), CPU va RAM.
  Har bir xizmat (Nginx, Sayt, PostgreSQL...) bitta serverda ishlaydi — rangli yorliq qaysi serverda
  ekanini ko'rsatadi. Yangi blok avtomatik bo'sh joyi bor serverga tushadi; inspektordagi
  "▣ Server" maydonidan boshqa serverga ko'chirasiz. Server to'lsa — undagi hamma narsa sekinlashadi.
- **●** nuqtadan strelka torting (yoki inspektordagi "→ ulash"). Noto'g'ri ulanish rad etiladi va
  **sababi + real hayotda nima bo'lishi** ko'rsatiladi (masalan Foydalanuvchilar → Baza).
- Gorizontal kengayish: 2-server → unga 2-Sayt → Nginx → Load Balancer → ikkala Sayt.
- `▶ Boshlash` — har soniya 1 kun. Foydalanuvchilar javob vaqti (p95) va xatolarga qarab o'sadi
  yoki ketadi. Kassa 3 kun minusda bo'lsa — bankrot.

**🚀 Ishga tushirish** (doska tepasida) — real tartib: 1 Server → 2 Domen (DNS A yozuvi) →
3 GitHub (git push) → 4 Deploy (git pull + migrate) → 5 SSL (certbot, HTTPS). Har qadamni bosing:
nima ekanligi, nega kerakligi, real buyruqlar va qilinmasa nima bo'lishi. Domen va deploy bo'lmasa
sayt ishlamaydi; SSL bo'lmasa parollar ochiq ketadi va to'lov qabul qilinmaydi.

**Daromad** faqat **To'lov shlyuzi** (Sayt → To'lov) va HTTPS bilan keladi — usiz mijozlar bepul foydalanadi.
**Telegram bot**: Foydalanuvchilar → bot → Sayt (yoki PostgreSQL). Qo'shimcha o'sish beradi; webhook rejimi HTTPS talab qiladi.

**{ } Kod** — PyCharm/VS Code ga o'xshash: fayl daraxti (settings.py, views.py, urls.py, models.py,
nginx.conf, deploy.sh, .env, migratsiyalar ...), qator raqamlari va ranglar, loyiha bo'yicha qidiruv.
Kodni yozib bo'lmaydi — faqat yashil ramkadagi joylarni (DEBUG, SECRET_KEY manbai, SECURE_SSL_REDIRECT,
hisobot rejimi, .gitignore) o'zingiz topib o'zgartirasiz. `.env` da sirlar yashirin, 👁 va `↻ rotate`.
`models.py` ochilganda **Model quruvchi**: model va maydonlar (ForeignKey bilan) → `makemigrations`
yangi migratsiya fayli yozadi → 🚀 Deploy qilmaguncha serverda 500 xatolar bo'ladi.

**⎇ Git** — har bir o'zgarish diff bilan. Senariyda `.env` boshida "adashib" kommit qilingan:
fayl tarixda qoladi, shuning uchun kalitni almashtirish kerak.

**📖 Qo'llanma** — maslahatchi va inspektor havola beradigan boblar.

## Kodni o'qish tartibi

Fayllar ichida `N-QADAM` sarlavhalari bor, shu tartibda o'qing:

| # | Fayl | Nima qiladi |
|---|------|-------------|
| 1 | `game/catalog.py` | Bloklar, serverlar, narxlar, konfiguratsiya shablonlari. **Muvozanat shu yerda.** |
| 2 | `game/rules.py` | Qaysi blok qaysi blokka ulanadi, noto'g'ri ulanish sababi va oqibati |
| 3 | `game/engine.py` | Simulyatsiya: serverlar resursi, yuklama → ρ → javob vaqti, xatolar → kunlik iqtisod, maslahatchi |
| 4 | `game/models.py` | Room (xona), Block (server ham blok: IP + host), Connection, Commit |
| 5 | `game/services.py` | Xonalar, bloklar, serverga joylash, kod, rotate: tekshirish → saqlash → kommit |
| 6 | `game/views.py`, `urls.py` | JSON API |
| 7 | `game/launch.py` | 🚀 ishga tushirish qadamlari matni |
| 8 | `game/project.py` | Sayt loyihasi fayllari (shablon) va model/migratsiya generatori |
| — | `game/scenario.py`, `guide.py` | Senariy maqsadlari va qo'llanma matni |
| — | `game/static/game/js/` | `app.js` (markaz) → `board.js` (doska) → `panels.js` (toolbar, inspektor) → `launch.js` (🚀) → `code.js` (IDE) → `tpl.js` (shablon, ranglar) → `icons.js`, `api.js` |
| — | `game/tests.py` | Qoidalar aytilgandek ishlashini tekshiradi |

Asosiy formula (`engine.py`): har bir blok uchun `ρ = yuklama / sig'im`.
ρ > 0.7 — navbat cho'ziladi, ρ ≥ 1 — ortiqcha so'rovlar xato bo'ladi.

## Senariyni yechish g'oyalari (spoiler)

<details><summary>ochish</summary>

1. Kod → `DEBUG = False`, SECRET_KEY → `.env dan`, `.env` → `.gitignore`, keyin SECRET_KEY ni `↻ rotate`.
2. ~450 foydalanuvchida Sayt workerlari qiziydi: Fon ishchisi qo'ying, Sayt → Fon ishchisi ulang,
   Kod → hisobot = `fonda`.
3. 1500 uchun: 2-server, unga 2-Sayt, Load Balancer (Nginx → LB → ikkala Sayt), ikkala Sayt → PostgreSQL.
4. 3000 uchun: baza tor bo'g'iz bo'ladi — Redis kesh va/yoki Read replica.

</details>
