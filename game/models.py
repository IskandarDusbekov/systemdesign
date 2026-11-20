"""
6-QADAM. MA'LUMOTLAR MODELI.

Room        — xona: bitta startup / tizim (bir nechta bo'lishi mumkin)
Block       — xonadagi blok. Server ham blok (u IP manzilga ega),
              boshqa xizmatlar esa qaysi serverda ishlashini `host` orqali biladi.
Connection  — strelka: qaysi blokdan qaysi blokka (graf tarmoqlanadi!)
Commit      — "GitHub bloki": har bir o'zgarish tarixi
Ledger      — g'azna: o'yinchilar domen/server uchun to'lagan pul (o'yin egasiga)
"""

from django.conf import settings
from django.db import models


class Room(models.Model):
    KIND_CHOICES = [("scenario", "Senariy"), ("sandbox", "Bo'sh xona")]

    # Har o'yinchining o'z startuplari. owner=None — akkauntlardan oldingi (yoki test) startuplar
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE,
                              related_name="rooms")
    name = models.CharField(max_length=80, default="SmetaPro")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="scenario")
    active = models.BooleanField(default=False)           # hozir ochiq xona
    day = models.PositiveIntegerField(default=1)
    users = models.PositiveIntegerField(default=100)
    coins = models.FloatField(default=300)
    neg_streak = models.PositiveIntegerField(default=0)   # necha kun ketma-ket minusda
    power_limit_w = models.PositiveIntegerField(default=600)
    seed = models.PositiveIntegerField(default=1)          # trafik tasodifiyligi uchun
    code = models.JSONField(default=dict)                  # sayt kodi sozlamalari (settings.py, views.py)
    env = models.JSONField(default=dict)                   # .env: SECRET_KEY, DB_PASSWORD ...
    history = models.JSONField(default=list)               # kunlik grafik
    flags = models.JSONField(default=dict)                 # senariy maqsadlari, versiya, 🚀 launch
    schema = models.JSONField(default=dict)                # Django modellari va migratsiyalar
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} (kun {self.day})"

    def save(self, *args, **kwargs):
        """Balans o'yinchining hamma startuplari uchun BITTA (umumiy hamyon): o'zgarsa — uning
        boshqa startuplariga ham yoziladi. Boshqa o'yinchilarning hamyoniga tegilmaydi."""
        super().save(*args, **kwargs)
        fields = kwargs.get("update_fields")
        if fields is None or "coins" in fields:
            Room.objects.filter(owner_id=self.owner_id).exclude(pk=self.pk).exclude(coins=self.coins) \
                .update(coins=self.coins)


class Block(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="blocks")
    kind = models.CharField(max_length=20)                 # catalog.BLOCKS kaliti
    name = models.CharField(max_length=40, blank=True)     # o'yinchi bergan nom (masalan "app-2")
    host = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="services")      # qaysi serverda ishlaydi
    ip = models.CharField(max_length=40, blank=True)       # faqat serverlar uchun
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)
    config = models.JSONField(default=dict)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.kind}#{self.pk}"


class Connection(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="connections")
    source = models.ForeignKey(Block, on_delete=models.CASCADE, related_name="outgoing")
    target = models.ForeignKey(Block, on_delete=models.CASCADE, related_name="incoming")

    class Meta:
        unique_together = [("source", "target")]


class Commit(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="commits")
    day = models.PositiveIntegerField()
    sha = models.CharField(max_length=7)
    message = models.CharField(max_length=200)
    file = models.CharField(max_length=120, blank=True)
    diff = models.JSONField(default=list)                  # ["- eski qator", "+ yangi qator"]
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]



class Ledger(models.Model):
    """G'azna: o'yinchi domen, server ijarasi uchun to'lagan pul shu yerga yoziladi."""
    KINDS = [("domain", "Domen"), ("server", "Server (ijara boshi)"), ("rent", "Server ijarasi (soatlik)")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="payments")
    room = models.ForeignKey(Room, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    kind = models.CharField(max_length=10, choices=KINDS)
    amount = models.FloatField(default=0)
    note = models.CharField(max_length=120, blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.kind} ${self.amount:.2f} — {self.note}"
