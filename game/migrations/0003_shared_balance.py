from django.db import migrations


def merge(apps, schema_editor):
    """Har startupning alohida puli → bitta umumiy balans (yig'indi)."""
    Room = apps.get_model("game", "Room")
    total = round(sum(r.coins for r in Room.objects.all()), 2)
    Room.objects.update(coins=total)


class Migration(migrations.Migration):
    dependencies = [("game", "0002_room_schema")]
    operations = [migrations.RunPython(merge, migrations.RunPython.noop)]
