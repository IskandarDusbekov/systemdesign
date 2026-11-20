"""
8-QADAM. HTTP QATLAMI (views).

Bitta HTML sahifa + kichik JSON API. Har bir API javobi ochiq xonaning to'liq
holatini (snapshot) qaytaradi — brauzer shunchaki qayta chizadi.

    GET    /                          o'yin sahifasi
    GET    /api/state                 to'liq holat
    POST   /api/rooms                 {kind, name}          yangi startup: scratch | starter | bought | scenario
    POST   /api/dev                   {task}                💻 lokal terminal vazifasi (noldan boshlash)
    PATCH  /api/rooms/<id>            {name} | {active}     nomlash / ochish
    DELETE /api/rooms/<id>                                  xonani o'chirish
    POST   /api/blocks                {kind, x, y, host?}   blok qo'shish
    PATCH  /api/blocks/<id>           {x,y} {config} {host} {name}
    DELETE /api/blocks/<id>
    POST   /api/connections           {source, target}      strelka
    DELETE /api/connections/<id>
    POST   /api/code                  {debug, ...}          sayt kodi sozlamalari
    POST   /api/rotate                {key?}                .env sirini almashtirish
    POST   /api/launch/<step>         {...}                 🚀 domen / github / deploy / ssl
    POST   /api/admin                 {admin: {...}}        Django admin sozlamalari
    POST   /api/models                {models: [...]}       Django modellari (makemigrations)
    POST   /api/withdraw                                    kassadan pulni balansga yechish
    POST   /api/resume                                      to'xtatilgan serverlarni qayta yoqish
    POST   /api/offers                {offers: [...]}       mahsulotlar va narxlar
    POST   /api/growth                {kind, id}            reklama kampaniyasi / yangi imkoniyat
    POST   /api/power                                       elektr limitini oshirish
    POST   /api/reset                                       xonani boshidan
    GET    /api/owner                                       🛠 Boshqaruv (faqat o'yin egasi / staff)
    POST   /api/owner                 {action, ...}         vaqt, balans, domen, server

Hamma API faqat kirgan o'yinchiga: har kim faqat O'Z startuplarini ko'radi va o'zgartiradi.
"""

import json
from pathlib import Path

from django.conf import settings

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from . import owner as owner_panel
from . import services
from .models import Block, Connection
from .services import GameError


@login_required
@ensure_csrf_cookie
def index(request):
    return render(request, "game/index.html", {"static_payload": services.static_payload(),
                                               "importmap": _importmap(), "app_v": _js_versions().get("app.js", "")})


def _js_versions():
    """Har JS fayl uchun versiya (o'zgargan vaqti) — brauzer eski keshdagi modulni ishlatmasin."""
    folder = Path(__file__).parent / "static" / "game" / "js"
    return {p.name: str(int(p.stat().st_mtime)) for p in folder.glob("*.js")}


def _importmap():
    base = settings.STATIC_URL.rstrip("/") + "/game/js/"
    if not base.startswith("/"):
        base = "/" + base
    return {"imports": {base + n: f"{base}{n}?v={v}" for n, v in _js_versions().items()}}


def _body(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def _ok(room, **extra):
    return JsonResponse({"ok": True, "state": services.snapshot(room), **extra})


def _fail(message, status=400, effect=""):
    return JsonResponse({"ok": False, "error": message, "effect": effect}, status=status)


def api(view):
    """Har bir API funksiyasini o'raydi: xonani topadi, o'yin xatolarini chiroyli qaytaradi."""
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _fail("Avval akkauntga kiring.", 401)
        room = services.get_room(request.user)
        room = services.sync_owner(room)  # o'tgan real vaqt — o'yinchining HAMMA startuplari uchun
        try:
            return view(request, room, *args, **kwargs)
        except GameError as e:
            return _fail(str(e), effect=e.effect)
        except (Block.DoesNotExist, Connection.DoesNotExist, services.Room.DoesNotExist, ValueError, TypeError):
            return _fail("Noto'g'ri so'rov.", 400)
    wrapper.__name__ = view.__name__
    return wrapper


@require_http_methods(["GET"])
@api
def state(request, room):
    return _ok(room)


@require_http_methods(["POST"])
def rooms(request):
    if not request.user.is_authenticated:
        return _fail("Avval akkauntga kiring.", 401)
    d = _body(request)
    kind = d.get("kind") if d.get("kind") in ("scenario", "starter", "scratch", "bought") else "sandbox"
    try:
        room = services.create_room(kind, d.get("name"), d.get("business"), int(d.get("invest") or 0),
                                    owner=request.user)
    except GameError as e:
        return _fail(str(e), effect=e.effect)
    return _ok(room)


@require_http_methods(["PATCH", "DELETE"])
@api
def room_detail(request, room, pk):
    me = request.user
    target = services.switch_room(pk, me) if request.method == "PATCH" and _body(request).get("active") else None
    if request.method == "DELETE":
        room = services.delete_room(services.switch_room(pk, me))
    elif target:
        room = target
    else:
        services.rename_room(services.mine(me).get(pk=pk), _body(request).get("name"))
        room = services.get_room(me)
    return _ok(room)


@require_http_methods(["POST"])
@api
def blocks(request, room):
    d = _body(request)
    block = services.add_block(room, d.get("kind"), d.get("x", 100), d.get("y", 100), d.get("host"))
    room.refresh_from_db()
    return _ok(room, created=block.pk)


@require_http_methods(["PATCH", "DELETE"])
@api
def block_detail(request, room, pk):
    if request.method == "DELETE":
        services.delete_block(room, pk)
    else:
        d = _body(request)
        if "config" in d:
            services.update_config(room, pk, d["config"])
        if "host" in d:
            services.set_host(room, pk, d["host"])
        if "name" in d:
            services.rename_block(room, pk, d["name"])
        if "x" in d and "y" in d:
            services.move_block(room, pk, d["x"], d["y"])
    room.refresh_from_db()
    return _ok(room)


@require_http_methods(["POST"])
@api
def connections(request, room):
    d = _body(request)
    services.connect(room, d.get("source"), d.get("target"))
    return _ok(room)


@require_http_methods(["DELETE"])
@api
def connection_detail(request, room, pk):
    services.disconnect(room, pk)
    return _ok(room)


@require_http_methods(["POST"])
@api
def code(request, room):
    services.update_code(room, _body(request))
    return _ok(room)


@require_http_methods(["POST"])
@api
def rotate(request, room):
    services.rotate_env(room, _body(request).get("key"))
    return _ok(room)


@require_http_methods(["POST"])
@api
def launch_step(request, room, step):
    msg = services.launch_step(room, step, _body(request))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def dev_view(request, room):
    msg = services.dev_step(room, _body(request).get("task"))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def profile_view(request, room):
    msg = services.set_profile(room, _body(request).get("gh_user"))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def web_view(request, room):
    """🌐 Brauzerdagi saytlar: Domenchi.uz (domen, DNS) va Bulutxon.uz (server ijarasi)."""
    body = _body(request)
    act = body.get("action")
    if act == "buy_domain":
        msg = services.buy_domain(room, body.get("name"))
    elif act == "dns":
        msg = services.set_dns(room, body.get("ip"))
    elif act == "rent":
        _b, msg = services.rent_server(room, body.get("tier"))
    elif act == "cancel_server":
        msg = services.cancel_server(room, int(body.get("id")))
    elif act == "drop_domain":
        msg = services.drop_domain(room)
    else:
        raise services.GameError("Noma'lum amal.")
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def models_view(request, room):
    mig = services.save_models(room, _body(request).get("models"))
    return _ok(room, message=f"makemigrations: {mig}" if mig else "O'zgarish yo'q")


@require_http_methods(["POST"])
@api
def admin_view(request, room):
    msg = services.save_admin(room, _body(request).get("admin"))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def djadmin_view(request, room):
    """O'yinchi saytidagi Django admin: superuser, kirish/chiqish, panel nomi."""
    msg = services.dj_admin(room, _body(request))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def growth_view(request, room):
    d = _body(request)
    msg = services.buy_growth(room, d.get("kind"), d.get("id"))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def offers(request, room):
    msg = services.save_offers(room, _body(request).get("offers"))
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def withdraw(request, room):
    msg = services.withdraw(room)
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def resume(request, room):
    msg = services.resume(room)
    return _ok(room, message=msg)


@require_http_methods(["POST"])
@api
def power(request, room):
    services.upgrade_power(room)
    room.refresh_from_db()
    return _ok(room)


@require_http_methods(["POST"])
@api
def reset(request, room):
    return _ok(services.reset_room(room))


@require_http_methods(["GET", "POST"])
def owner_view(request):
    """🛠 Boshqaruv: o'yinchilar, startuplar, domenlar, serverlar, vaqt va g'azna. Faqat staff."""
    if not request.user.is_authenticated:
        return _fail("Avval akkauntga kiring.", 401)
    if not request.user.is_staff:
        return _fail("Bu bo'lim faqat o'yin egasi uchun.", 403)
    try:
        msg = owner_panel.act(_body(request)) if request.method == "POST" else ""
    except GameError as e:
        return _fail(str(e), effect=e.effect)
    except (ValueError, TypeError, services.Room.DoesNotExist, Block.DoesNotExist):
        return _fail("Noto'g'ri so'rov.", 400)
    return JsonResponse({"ok": True, "message": msg, "owner": owner_panel.overview()})
