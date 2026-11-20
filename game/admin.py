from django.contrib import admin

from .models import Block, Commit, Connection, Room

admin.site.register([Room, Block, Connection, Commit])
