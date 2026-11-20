"""
Vallum — Django sozlamalari.

Bu fayl faqat MAHALLIY sinov uchun sozlangan.
Diqqat: o'yinning o'zi "DEBUG=True productionda xavfli" deb o'rgatadi.
Shuning uchun DEBUG va SECRET_KEY muhit o'zgaruvchilaridan o'qiladi:
    VALLUM_DEBUG=0  VALLUM_SECRET_KEY=...  python manage.py runserver
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Mahalliy sinov uchun standart qiymatlar. Real serverda albatta almashtiring.
SECRET_KEY = os.environ.get("VALLUM_SECRET_KEY", "dev-only-vallum-key-change-me")
DEBUG = os.environ.get("VALLUM_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("VALLUM_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "game",  # o'yinning hamma mantiqi shu ilovada
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
