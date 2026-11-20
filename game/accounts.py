"""
AKKAUNTLAR: email + parol bilan ro'yxatdan o'tish, kirish, chiqish.

Xavfsizlik:
  * parol bazada ochiq saqlanmaydi — Django uni PBKDF2 bilan xeshlaydi (make_password);
  * parol qoidalari: settings.AUTH_PASSWORD_VALIDATORS (uzunlik, oddiy parollar, faqat raqam, emailga o'xshash);
  * har formada CSRF tokeni;
  * kirishda ketma-ket xato urinishlar cheklanadi (5 ta xato → 5 daqiqa kutish);
  * kirgandan keyin sessiya kaliti yangilanadi (django.contrib.auth.login shuni qiladi).

Birinchi ro'yxatdan o'tgan odam — o'yin egasi (staff): Boshqaruv paneli unga ochiladi va
akkauntlardan oldin yaratilgan startuplar unga o'tadi.
"""

from django import forms
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_http_methods

from .models import Room

User = get_user_model()
MAX_FAILS = 5            # ketma-ket xato urinishlar
LOCK_SECONDS = 5 * 60    # bloklanish vaqti
UZ_PASSWORD = {
    "password_too_short": "Parol juda qisqa — kamida 8 belgi bo'lsin.",
    "password_too_common": "Bu parol juda oddiy (ko'p ishlatiladi) — buzish oson.",
    "password_entirely_numeric": "Parol faqat raqamdan iborat bo'lmasin.",
    "password_too_similar": "Parol emailingizga juda o'xshash.",
}


class RegisterForm(forms.Form):
    email = forms.EmailField(label="Email", max_length=150)
    password1 = forms.CharField(label="Parol", widget=forms.PasswordInput, strip=False)
    password2 = forms.CharField(label="Parolni takrorlang", widget=forms.PasswordInput, strip=False)

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(username__iexact=email).exists():
            raise ValidationError("Bu email bilan akkaunt allaqachon bor. Kirish sahifasidan kiring.")
        return email

    def clean(self):
        d = super().clean()
        p1, p2 = d.get("password1"), d.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Parollar bir xil emas.")
        if p1 and d.get("email"):
            try:
                validate_password(p1, User(username=d["email"], email=d["email"]))
            except ValidationError as e:
                for err in e.error_list:
                    self.add_error("password1", UZ_PASSWORD.get(err.code, err.messages[0]))
        return d


class LoginForm(forms.Form):
    # email (oddiy o'yinchi) yoki username (createsuperuser bilan yaratilgan admin)
    email = forms.CharField(label="Email yoki username", max_length=150)
    password = forms.CharField(label="Parol", widget=forms.PasswordInput, strip=False)


def _client_ip(request):
    return request.META.get("REMOTE_ADDR", "")


def _lock_key(request, email):
    return f"login-fails:{_client_ip(request)}:{email}"


def _next(request):
    nxt = request.POST.get("next") or request.GET.get("next") or "/"
    return nxt if url_has_allowed_host_and_scheme(nxt, {request.get_host()}) else "/"


@transaction.atomic
def _create_user(email, password):
    first = not User.objects.filter(is_staff=True).exists()
    user = User.objects.create_user(username=email, email=email, password=password)
    if first:
        # birinchi o'yinchi — o'yin egasi: akkauntsiz startuplar unga o'tadi
        user.is_staff = user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
        Room.objects.filter(owner__isnull=True).update(owner=user)
    return user


@require_http_methods(["GET", "POST"])
def register_view(request):
    if request.user.is_authenticated:
        return redirect("/")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = _create_user(form.cleaned_data["email"], form.cleaned_data["password1"])
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return redirect("/")
    return render(request, "game/auth.html", {"form": form, "mode": "register"})


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect(_next(request))
    form = LoginForm(request.POST or None)
    error = ""
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"].strip()
        if "@" in email:
            email = email.lower()
        key = _lock_key(request, email)
        fails = cache.get(key, 0)
        if fails >= MAX_FAILS:
            error = "Juda ko'p xato urinish. 5 daqiqadan keyin qayta urinib ko'ring."
        else:
            user = authenticate(request, username=email, password=form.cleaned_data["password"])
            if user is None:
                cache.set(key, fails + 1, LOCK_SECONDS)
                # qaysi biri xato ekanini aytmaymiz — begona odam emaillarni tekshira olmasin
                error = "Email yoki parol noto'g'ri."
            else:
                cache.delete(key)
                login(request, user)
                if user.is_staff:          # createsuperuser bilan yaratilgan egasi: egasiz startuplar unga
                    Room.objects.filter(owner__isnull=True).update(owner=user)
                return redirect(_next(request))
    return render(request, "game/auth.html", {"form": form, "mode": "login", "error": error,
                                              "next": request.GET.get("next", "")})


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return redirect("/kirish/")
