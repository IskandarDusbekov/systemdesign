"""
Testlar:  python manage.py test game

Ular o'yin qoidalari aytilgandek ishlashini kafolatlaydi:
noto'g'ri ulanish sabab bilan rad etiladi, bloklar serverga joylanadi,
2 ta Sayt + Load Balancer quvvatni oshiradi, kod o'zgarishi Git'ga yoziladi va h.k.
"""

from django.test import TestCase

from . import catalog, engine, project, rules, services


def make_layout(apps=1, workers=2, lb=False):
    """Qo'lda yig'ilgan layout: users → nginx (→ lb) → app×N → postgres."""
    blocks = {1: {"kind": "server", "host": None, "config": catalog.clean_config("server", {"tier": "katta"}), "name": "s1"},
              2: {"kind": "server", "host": None, "config": catalog.clean_config("server", {"tier": "katta"}), "name": "s2"},
              10: {"kind": "users", "host": None, "config": {}, "name": "u"},
              11: {"kind": "nginx", "host": 1, "config": catalog.default_config("nginx"), "name": "n"},
              12: {"kind": "postgres", "host": 1, "config": catalog.default_config("postgres"), "name": "db"}}
    edges = {(10, 11)}
    if lb:
        blocks[13] = {"kind": "lb", "host": 1, "config": catalog.default_config("lb"), "name": "lb"}
        edges.add((11, 13))
    for i in range(apps):
        bid = 20 + i
        blocks[bid] = {"kind": "app", "host": 1 + i % 2, "config": {"workers": workers}, "name": f"a{i}"}
        edges.add((13 if lb else 11, bid))
        edges.add((bid, 12))
    hosts = {h: {"tier": "katta", "config": blocks[h]["config"]} for h in (1, 2)}
    return engine.Layout(power_limit_w=5000, blocks=blocks, edges=edges, hosts=hosts,
                         code=catalog.default_code())


class RulesTests(TestCase):
    def test_users_cannot_reach_db_and_effect_is_explained(self):
        ok, reason, effect = rules.can_connect("users", "postgres", set())
        self.assertFalse(ok)
        self.assertIn("internet", effect)

    def test_server_is_not_connected_by_arrow(self):
        ok, reason, _ = rules.can_connect("app", "server", set())
        self.assertFalse(ok)
        self.assertIn("Server", reason)

    def test_valid_chain(self):
        for a, b in [("users", "nginx"), ("nginx", "lb"), ("lb", "app"), ("app", "postgres")]:
            self.assertTrue(rules.can_connect(a, b, set())[0])


class EngineTests(TestCase):
    def test_working_path(self):
        m = engine.evaluate(make_layout(), 100)
        self.assertTrue(m["path_ok"], m["path_problems"])
        self.assertIn(m["status"], ("green", "yellow"))

    def test_two_apps_behind_lb_double_capacity(self):
        one = engine.evaluate(make_layout(apps=1), 2000)
        two = engine.evaluate(make_layout(apps=2, lb=True), 2000)
        self.assertAlmostEqual(two["total_workers"], one["total_workers"] * 2, places=1)
        self.assertLess(two["util"][20], one["util"][20])

    def test_overloaded_host_slows_down(self):
        lay = make_layout()
        lay.hosts[1]["config"] = catalog.clean_config("server", {"tier": "kichik"})
        lay.blocks[20]["config"] = {"workers": 16}
        self.assertLess(engine.host_speed(lay, 1), 1.0)
        self.assertTrue(engine.resources(lay)["hosts"][1]["over_cpu"])


class ServiceTests(TestCase):
    def setUp(self):
        self.room = services.get_room()

    def test_scenario_seeded_with_server_ip(self):
        srv = self.room.blocks.get(kind="server")
        self.assertTrue(srv.ip.startswith("203.0.113."))
        self.assertEqual(self.room.blocks.get(kind="app").host_id, srv.id)
        self.assertTrue(services.snapshot(self.room)["metrics"]["path_ok"])

    def test_new_block_goes_to_a_server(self):
        b = services.add_block(self.room, "redis", 10, 10)
        self.assertIsNotNone(b.host_id)

    def test_second_server_gets_new_ip(self):
        self.room.coins = 1000
        self.room.save()
        s2 = services.add_block(self.room, "server", 10, 10)
        ips = set(self.room.blocks.filter(kind="server").values_list("ip", flat=True))
        self.assertEqual(len(ips), 2)
        app2 = services.add_block(self.room, "app", 10, 10, host_id=s2.id)
        self.assertEqual(app2.host_id, s2.id)

    def test_invalid_connection_has_reason_and_effect(self):
        users = self.room.blocks.get(kind="users")
        db = self.room.blocks.get(kind="postgres")
        with self.assertRaises(services.GameError) as ctx:
            services.connect(self.room, users.id, db.id)
        self.assertTrue(ctx.exception.effect)

    def test_server_with_services_cannot_be_deleted(self):
        srv = self.room.blocks.get(kind="server")
        with self.assertRaises(services.GameError):
            services.delete_block(self.room, srv.id)

    def test_code_change_makes_commit_and_flag(self):
        before = self.room.commits.count()
        services.update_code(self.room, {"debug": False})
        self.assertGreater(self.room.commits.count(), before)
        self.assertTrue(self.room.flags["debug_fixed"])

    def test_rotate_changes_secret(self):
        old = self.room.env["SECRET_KEY"]
        services.rotate_env(self.room, "SECRET_KEY")
        self.assertNotEqual(old, self.room.env["SECRET_KEY"])
        self.assertTrue(self.room.flags["rotated"])

    def test_sandbox_room_and_switch(self):
        sb = services.create_room("sandbox", "Mening tizimim")
        self.assertEqual(services.get_room().id, sb.id)
        self.assertEqual(sb.blocks.count(), 2)   # server + foydalanuvchilar
        services.switch_room(self.room.id)
        self.assertEqual(services.get_room().id, self.room.id)

    def test_tick_advances_day(self):
        services.tick(self.room, 3)
        self.assertEqual(self.room.day, 4)
        self.assertEqual(len(self.room.history), 3)


class ApiTests(TestCase):
    def test_state_and_invalid_connection_effect(self):
        r = self.client.get("/api/state").json()
        self.assertTrue(r["ok"])
        ids = {b["kind"]: b["id"] for b in r["state"]["blocks"]}
        r = self.client.post("/api/connections", {"source": ids["users"], "target": ids["postgres"]},
                             content_type="application/json").json()
        self.assertFalse(r["ok"])
        self.assertTrue(r["effect"])


class LaunchTests(TestCase):
    """🚀 Noldan: server → zanjir → domen → GitHub → deploy → SSL → to'lov."""

    def setUp(self):
        self.room = services.create_room("sandbox", "Do'kon")
        self.room.coins = 2000
        self.room.save()
        users = self.room.blocks.get(kind="users")
        self.srv = self.room.blocks.get(kind="server")
        ng = services.add_block(self.room, "nginx", 0, 0)
        self.app = services.add_block(self.room, "app", 0, 0)
        db = services.add_block(self.room, "postgres", 0, 0)
        for a, b in [(users, ng), (ng, self.app), (self.app, db)]:
            services.connect(self.room, a.id, b.id)

    def metrics(self):
        self.room.refresh_from_db()
        return services.snapshot(self.room)["metrics"]

    def test_full_launch(self):
        m = self.metrics()
        self.assertFalse(m["path_ok"])
        self.assertTrue(any("Domen" in p for p in m["path_problems"]))
        with self.assertRaises(services.GameError):
            services.launch_step(self.room, "deploy", {})          # GitHub siz deploy yo'q
        services.launch_step(self.room, "domain", {"name": "dokon.uz", "server": self.srv.id})
        services.launch_step(self.room, "github", {"repo": "men/dokon", "public": False})
        services.launch_step(self.room, "deploy", {})
        m = self.metrics()
        self.assertTrue(m["path_ok"], m["path_problems"])
        self.assertFalse(m["payment_ok"])
        pay = services.add_block(self.room, "payment", 0, 0)
        services.connect(self.room, self.app.id, pay.id)
        self.assertFalse(self.metrics()["payment_ok"])            # HTTPS siz to'lov yo'q
        services.launch_step(self.room, "ssl", {})
        self.assertTrue(self.metrics()["payment_ok"])
        services.tick(self.room, 1)
        self.assertGreater(self.room.history[-1]["revenue"], 0)

    def test_no_payment_no_revenue(self):
        services.launch_step(self.room, "domain", {"name": "dokon.uz", "server": self.srv.id})
        services.launch_step(self.room, "github", {"repo": "men/dokon"})
        services.launch_step(self.room, "deploy", {})
        services.tick(self.room, 1)
        self.assertEqual(self.room.history[-1]["revenue"], 0)

    def test_bad_domain_rejected(self):
        with self.assertRaises(services.GameError):
            services.launch_step(self.room, "domain", {"name": "yomon domen", "server": self.srv.id})


class ModelBuilderTests(TestCase):
    def test_models_make_migration_and_code(self):
        room = services.create_room("sandbox", "X")
        mig = services.save_models(room, [{"name": "Order", "fields": [
            {"name": "user", "type": "ForeignKey", "to": "User"},
            {"name": "total", "type": "DecimalField"}]}])
        self.assertEqual(mig, "0001_initial")
        code = "\n".join(services.file_lines(room, "app/models.py"))
        self.assertIn("class Order(models.Model):", code)
        mig2 = services.save_models(room, [{"name": "Order", "fields": [
            {"name": "user", "type": "ForeignKey", "to": "User"},
            {"name": "total", "type": "DecimalField"},
            {"name": "paid", "type": "BooleanField"}]}])
        self.assertTrue(mig2.startswith("0002_"))
        self.assertIn("AddField", "\n".join(room.schema["migrations"][-1]["lines"]))

    def test_bad_model_name(self):
        room = services.create_room("sandbox", "X")
        with self.assertRaises(services.GameError):
            services.save_models(room, [{"name": "order", "fields": []}])

    def test_scenario_has_models_and_bot_works(self):
        room = services.get_room()
        self.assertEqual(len(room.schema["models"]), 2)
        bot = services.add_block(room, "tgbot", 0, 0)
        users = room.blocks.get(kind="users")
        app = room.blocks.get(kind="app")
        services.connect(room, users.id, bot.id)
        services.connect(room, bot.id, app.id)
        self.assertTrue(services.snapshot(room)["metrics"]["bot_ok"])
        self.assertIn("bot/main.py", services.snapshot(room)["files"])


class BusinessTests(TestCase):
    """Biznes turi, narx → talab → foyda."""

    def test_room_gets_business_and_offers(self):
        room = services.create_room("sandbox", "Do'kon", "delivery")
        self.assertEqual(services.business_of(room), "delivery")
        st = services.snapshot(room)
        self.assertEqual(st["business"]["key"], "delivery")
        self.assertEqual(st["business"]["offers"][0]["name"], "Lavash")

    def test_higher_price_fewer_sales_more_margin(self):
        from . import business
        base = business.default_offers("shop")
        cheap = [dict(base[0], price=30)]
        dear = [dict(base[0], price=90)]
        a = business.sales("shop", cheap, 1000, 0, True, True)["rows"][0]
        b = business.sales("shop", dear, 1000, 0, True, True)["rows"][0]
        self.assertGreater(a["qty"], b["qty"])
        self.assertGreater(b["price"] - b["cost"], a["price"] - a["cost"])

    def test_no_payment_no_sales_but_ads(self):
        from . import business
        s = business.sales("news", business.default_offers("news"), 1000, 0, False, True)
        self.assertEqual(s["revenue"], 0)
        self.assertGreater(s["ads"], 0)

    def test_save_offers_validates(self):
        room = services.create_room("sandbox", "X", "shop")
        offers = services.offers_of(room)
        offers[0]["price"] = 55
        msg = services.save_offers(room, offers)
        self.assertIn("$45", msg)
        self.assertEqual(services.offers_of(room)[0]["price"], 55)
        offers[0]["price"] = "abc"
        with self.assertRaises(services.GameError):
            services.save_offers(room, offers)
        with self.assertRaises(services.GameError):
            services.save_offers(room, [])

    def test_scenario_revenue_still_flows(self):
        room = services.create_room("scenario")
        f = services.snapshot(room)["finance"]
        self.assertGreater(f["revenue"], 0)


class GrowthTests(TestCase):
    """Marketing, imkoniyatlar, hodisalar, sarmoya."""

    def _live(self):
        room = services.create_room("scenario")       # senariyda sayt allaqachon ishlayapti
        room.coins = 2000
        room.save()
        return room

    def test_campaign_costs_money_and_boosts(self):
        room = self._live()
        before = services.snapshot(room)["finance"]["sales"]
        services.buy_growth(room, "campaign", "sale")
        room.refresh_from_db()
        self.assertEqual(room.coins, 1850)
        after = services.snapshot(room)["finance"]["sales"]
        self.assertGreater(after["revenue"], before["revenue"])
        with self.assertRaises(services.GameError):
            services.buy_growth(room, "campaign", "sale")     # ikki marta bir vaqtda — yo'q

    def test_campaign_expires(self):
        room = self._live()
        services.buy_growth(room, "campaign", "telegram")
        services.tick(room, 3)
        room.refresh_from_db()
        self.assertEqual(room.flags.get("campaigns"), [])

    def test_campaign_needs_live_site(self):
        room = services.create_room("sandbox", "x", "shop")
        with self.assertRaises(services.GameError):
            services.buy_growth(room, "campaign", "telegram")

    def test_upgrade_needs_block(self):
        room = self._live()
        if room.blocks.filter(kind="worker").exists():
            room.blocks.filter(kind="worker").delete()
        with self.assertRaises(services.GameError):
            services.buy_growth(room, "upgrade", "push")
        services.buy_growth(room, "upgrade", "backup")
        self.assertIn("backup", services.growth_state(room)["upgrades"])

    def test_events_happen_over_time(self):
        room = self._live()
        for _ in range(6):
            services.tick(room, 30)
            room.refresh_from_db()
            if room.neg_streak >= 3:
                break
        self.assertGreaterEqual(room.flags.get("events_seen", 0), 1)

    def test_balance_is_shared_between_startups(self):
        room = self._live()
        new = services.create_room("sandbox", "ikkinchi", "news")
        self.assertEqual(new.coins, room.coins)          # yangi startup yangi pul bermaydi
        new.coins = 700
        new.save(update_fields=["coins"])
        room.refresh_from_db()
        self.assertEqual(room.coins, 700)                # bitta umumiy hamyon
        again = services.reset_room(new)
        self.assertEqual(again.coins, 700)


class RealTimeTests(TestCase):
    """Real vaqt, offlayn hisob, hosting to'xtashi, cheklovlar."""

    def test_sync_applies_elapsed_hours(self):
        from datetime import timedelta
        from django.utils import timezone
        room = services.create_room("scenario")
        coins0, day0 = room.coins, room.day
        later = timezone.now() + timedelta(seconds=services.HOUR_SECONDS * 30)   # 30 o'yin soati
        services.sync(room, now=later)
        self.assertEqual(room.day, day0 + 1)
        self.assertNotEqual(room.coins, coins0)
        self.assertIsNotNone(room._away)
        self.assertEqual(room._away["hours"], 30)

    def test_offline_capped(self):
        from datetime import timedelta
        from django.utils import timezone
        room = services.create_room("scenario")
        services.sync(room, now=timezone.now() + timedelta(days=30))
        self.assertLessEqual(room.day, 1 + engine.MAX_CATCHUP_DAYS)
        self.assertTrue(room._away["capped"])

    def test_no_bankruptcy_hosting_suspends(self):
        room = services.create_room("sandbox", "zarar", "shop")   # daromad yo'q, faqat xarajat
        room.coins = 20
        room.save()
        events = services.tick(room, 5)
        room.refresh_from_db()
        self.assertEqual(room.coins, 0)
        self.assertTrue(room.flags["suspended"])
        self.assertTrue(any("Balans tugadi" in e for e in events))
        coins = room.coins
        services.tick(room, 2)                     # to'xtagan paytda pul ketmaydi
        room.refresh_from_db()
        self.assertEqual(room.coins, coins)
        services.resume(room)
        self.assertFalse(room.flags["suspended"])

    def test_market_saturation_slows_growth(self):
        room = services.create_room("scenario")
        lay = services.layout_of(room)
        m = engine.evaluate(lay, 100)
        small = engine.daily_growth(lay, 100, m)
        big = engine.daily_growth(lay, 14_000, m)
        self.assertGreater(small, big)

    def test_model_limits(self):
        from . import project
        many = [{"name": f"M{i}x", "fields": [{"name": "a", "type": "IntegerField"}]} for i in range(7)]
        with self.assertRaises(project.SchemaError):
            project.clean_models(many)
        with self.assertRaises(project.SchemaError):
            project.clean_models([{"name": "Empty", "fields": []}])
        ok = project.clean_models(project.TEMPLATES["shop"])
        self.assertGreater(project.db_load(ok), 1.0)

    def test_starter_users_come_after_deploy_and_money_goes_to_kassa(self):
        room = services.create_room("starter", "kassa", "shop")
        self.assertEqual(room.users, 0)
        srv = room.blocks.get(kind="server")
        services.launch_step(room, "domain", {"name": "kassa.uz", "server": srv.id})
        services.launch_step(room, "github", {"repo": "men/kassa", "public": False})
        services.launch_step(room, "deploy", {})
        room.refresh_from_db()
        self.assertEqual(room.users, 50)
        services.launch_step(room, "ssl", {})
        room.refresh_from_db()
        services.tick(room, 1)
        room.refresh_from_db()
        self.assertGreater(room.flags.get("kassa", 0), 0)       # sotuv kassaga tushdi
        coins, kassa = room.coins, room.flags["kassa"]
        services.withdraw(room)
        self.assertAlmostEqual(room.coins, coins + kassa, places=1)
        self.assertEqual(room.flags["kassa"], 0)
        with self.assertRaises(services.GameError):
            services.withdraw(room)

    def test_sms_otp_needs_purchased_service(self):
        lay = engine.Layout(power_limit_w=999, blocks={
            1: {"kind": "server", "host": None, "config": {}, "name": "s"},
            2: {"kind": "users", "host": None, "config": {}, "name": "u"},
            3: {"kind": "app", "host": 1, "config": {}, "name": "a"},
            4: {"kind": "auth", "host": 1, "config": {"method": "sms"}, "name": "otp"},
            5: {"kind": "redis", "host": 1, "config": {}, "name": "r"},
        }, edges={(2, 3), (3, 4), (4, 5)}, hosts={1: {"tier": "orta", "config": {}}},
            code={}, env={}, launch={"sms": False})
        self.assertFalse(engine.evaluate(lay, 50)["auth_ok"])
        lay.launch["sms"] = True
        self.assertTrue(engine.evaluate(lay, 50)["auth_ok"])

    def test_django_admin_config_and_idle_status(self):
        room = services.create_room("starter", "adm", "shop")
        snap = services.snapshot(room)
        self.assertEqual(snap["metrics"]["status"], "idle")          # ochilmagan sayt — "qulagan" emas
        services.save_models(room, project.TEMPLATES["shop"])
        name = project.TEMPLATES["shop"][0]["name"]
        fields = [f["name"] for f in project.TEMPLATES["shop"][0]["fields"]]
        msg = services.save_admin(room, {name: {"list": fields[:2], "search": ["yo'q_maydon"], "filter": []}})
        self.assertIn("admin.py", msg)
        code = project.admin_code(room.schema["models"], room.schema["admin"])
        self.assertIn(f"class {name}Admin(admin.ModelAdmin):", code)
        self.assertTrue(any("list_display" in l for l in code))
        self.assertFalse(any("yo'q_maydon" in l for l in code))
