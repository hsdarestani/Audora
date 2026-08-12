import json
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import (
    AvailabilitySlot,
    Booking,
    Conversation,
    Favorite,
    Listing,
    Message,
    Notification,
    ProviderProfile,
    Review,
    SessionFile,
    SessionProject,
    SessionTask,
)

User = get_user_model()


class AudoraTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_root = tempfile.mkdtemp(prefix="audora-tests-")
        cls._override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user(
            username="artist",
            email="artist@example.com",
            password="StrongPass123!",
            first_name="Artist",
        )
        self.other = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="StrongPass123!",
            first_name="Other",
        )
        self.provider = User.objects.create_user(
            username="provider",
            email="provider@example.com",
            password="StrongPass123!",
            first_name="Provider",
        )
        ProviderProfile.objects.create(user=self.provider, display_name="Provider", active=True)

        self.studio = self.make_listing(
            "studio-main", "studio", "Main Studio", Decimal("100"), provider=self.provider,
            genres=["Hip-Hop", "Pop"], top=True, rating=Decimal("4.80"), instant=True,
        )
        self.cheap_studio = self.make_listing(
            "studio-cheap", "studio", "Budget Studio", Decimal("50"),
            genres=["Hip-Hop"], rating=Decimal("4.20"),
        )
        self.producer = self.make_listing(
            "producer-main", "producer", "Producer One", Decimal("150"), provider=self.provider,
            genres=["Hip-Hop"], rating=Decimal("4.90"),
        )
        self.engineer = self.make_listing(
            "engineer-main", "engineer", "Engineer One", Decimal("120"),
            genres=["Hip-Hop"], rating=Decimal("4.70"),
        )
        self.songwriter = self.make_listing(
            "songwriter-main", "songwriter", "Writer One", Decimal("90"),
            genres=["Pop"], rating=Decimal("4.60"),
        )
        self.inactive = self.make_listing(
            "inactive", "studio", "Inactive", Decimal("10"), active=False,
        )

        self.client.force_login(self.user)

    def make_listing(self, slug, category, name, price, **kwargs):
        defaults = dict(
            city="Berlin",
            image_url="https://example.com/image.jpg",
            meta_de=f"{name} Berlin",
            meta_en=f"{name} Berlin",
            about_de="Beschreibung",
            about_en="Description",
            genres=[],
            tags_de=[],
            tags_en=[],
            rating=Decimal("0"),
            reviews=0,
            instant=False,
            top=False,
            active=True,
        )
        defaults.update(kwargs)
        return Listing.objects.create(
            slug=slug, category=category, name=name, price=price, **defaults
        )

    def api(self, method, path, data=None, client=None, content_type="application/json"):
        client = client or self.client
        fn = getattr(client, method.lower())
        if data is None:
            return fn(path)
        if content_type == "application/json":
            return fn(path, data=json.dumps(data), content_type=content_type)
        return fn(path, data=data)

    @staticmethod
    def body(response):
        return json.loads(response.content.decode("utf-8"))

    def future(self, days=10, hour=18):
        dt = timezone.now() + timedelta(days=days)
        return dt.replace(hour=hour, minute=0, second=0, microsecond=0)


class HealthAuthAndDemoTests(AudoraTestCase):
    def test_health_and_method_guards(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.body(response)["ok"])
        self.assertEqual(self.client.post("/api/listings/").status_code, 405)
        self.assertEqual(self.client.get("/api/auth/login/").status_code, 405)

    def test_anonymous_demo_sessions_are_isolated(self):
        a = Client()
        b = Client()
        first = self.body(a.get("/api/bootstrap/"))["user"]
        second = self.body(b.get("/api/bootstrap/"))["user"]
        self.assertTrue(first.get("is_demo"))
        self.assertTrue(second.get("is_demo"))
        self.assertNotEqual(first["id"], second["id"])

        self.api("post", f"/api/favorites/{self.studio.slug}/", {"toggle": False}, client=a)
        fav_a = self.body(a.get("/api/bootstrap/"))["favorites"]
        fav_b = self.body(b.get("/api/bootstrap/"))["favorites"]
        self.assertIn(self.studio.slug, fav_a)
        self.assertNotIn(self.studio.slug, fav_b)

    def test_register_validates_email_password_and_duplicate(self):
        c = Client()
        bad_email = self.api("post", "/api/auth/register/", {"email": "not-an-email", "password": "12345678"}, client=c)
        self.assertEqual(bad_email.status_code, 400)
        short = self.api("post", "/api/auth/register/", {"email": "new@example.com", "password": "short"}, client=c)
        self.assertEqual(short.status_code, 400)
        ok = self.api("post", "/api/auth/register/", {"email": "NEW@example.com", "password": "StrongPass123!", "name": "New"}, client=c)
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(User.objects.get(email="new@example.com").first_name, "New")
        dup = self.api("post", "/api/auth/register/", {"email": "new@example.com", "password": "StrongPass123!"}, client=Client())
        self.assertEqual(dup.status_code, 409)

    def test_login_by_email_or_username_and_logout(self):
        c = Client()
        by_email = self.api("post", "/api/auth/login/", {"email": "ARTIST@example.com", "password": "StrongPass123!"}, client=c)
        self.assertEqual(by_email.status_code, 200)
        self.assertEqual(self.body(c.get("/api/bootstrap/"))["user"]["id"], self.user.id)
        self.assertEqual(self.api("post", "/api/auth/logout/", {}, client=c).status_code, 200)
        after = self.body(c.get("/api/bootstrap/"))["user"]
        self.assertTrue(after["is_demo"])

        c2 = Client()
        by_username = self.api("post", "/api/auth/login/", {"username": "artist", "password": "StrongPass123!"}, client=c2)
        self.assertEqual(by_username.status_code, 200)
        wrong = self.api("post", "/api/auth/login/", {"username": "artist", "password": "wrong"}, client=Client())
        self.assertEqual(wrong.status_code, 401)


class ListingFavoriteAndMatchTests(AudoraTestCase):
    def test_listing_filters_search_and_detail(self):
        response = self.client.get("/api/listings/?category=studio&city=ber&instant=true&max_price=120&q=Main")
        data = self.body(response)["results"]
        self.assertEqual([x["id"] for x in data], [self.studio.slug])
        self.assertEqual(self.client.get(f"/api/listings/{self.studio.slug}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/listings/{self.inactive.slug}/").status_code, 404)
        self.assertNotIn(self.inactive.slug, [x["id"] for x in self.body(self.client.get("/api/listings/"))["results"]])

    def test_favorite_add_idempotent_toggle_and_delete(self):
        path = f"/api/favorites/{self.studio.slug}/"
        first = self.api("post", path, {"toggle": False})
        second = self.api("post", path, {"toggle": False})
        self.assertTrue(self.body(first)["active"])
        self.assertTrue(self.body(second)["active"])
        self.assertEqual(Favorite.objects.filter(user=self.user, listing=self.studio).count(), 1)
        toggled = self.api("post", path, {})
        self.assertFalse(self.body(toggled)["active"])
        self.api("post", path, {"toggle": False})
        deleted = self.api("delete", path)
        self.assertFalse(self.body(deleted)["active"])
        self.assertEqual(self.client.post("/api/favorites/nope/").status_code, 404)

    def test_smart_match_all_goals_and_invalid_budget(self):
        record = self.api("post", "/api/match/", {"goal": "record", "city": "Berlin", "genres": ["Hip-Hop"], "budget": 500})
        data = self.body(record)
        self.assertEqual(record.status_code, 200)
        self.assertIsNotNone(data["studio"])
        self.assertGreaterEqual(len(data["team"]), 2)
        self.assertLessEqual(data["score"], 99)

        mix = self.body(self.api("post", "/api/match/", {"goal": "mix", "city": "Berlin", "budget": 500}))
        self.assertEqual([x["category"] for x in mix["team"]], ["engineer"])
        write = self.body(self.api("post", "/api/match/", {"goal": "write", "city": "Berlin", "budget": 500}))
        self.assertEqual([x["category"] for x in write["team"]], ["songwriter"])
        invalid = self.api("post", "/api/match/", {"budget": "not-a-number"})
        self.assertEqual(invalid.status_code, 200)


class ProviderListingAndAvailabilityTests(AudoraTestCase):
    def test_provider_dashboard_profile_metrics_and_limits(self):
        self.client.force_login(self.provider)
        Booking.objects.create(user=self.user, listing=self.studio, start_at=self.future(), total=Decimal("200"), status="confirmed")
        Booking.objects.create(user=self.other, listing=self.studio, start_at=self.future(11), total=Decimal("300"), status="completed")
        Booking.objects.create(user=self.other, listing=self.studio, start_at=self.future(12), total=Decimal("400"), status="cancelled")
        response = self.api("patch", "/api/provider/dashboard/", {
            "active": True,
            "display_name": "X" * 300,
            "bio": "B" * 20000,
        })
        self.assertEqual(response.status_code, 200)
        data = self.body(response)
        self.assertEqual(data["metrics"]["revenue"], 500.0)
        # Cancelled work is not part of the provider's active/completed workload.
        self.assertEqual(data["metrics"]["bookings"], 2)
        profile = ProviderProfile.objects.get(user=self.provider)
        self.assertLessEqual(len(profile.display_name), 140)
        self.assertLessEqual(len(profile.bio), 10000)

    def test_provider_listing_crud_unique_slug_and_permissions(self):
        payload = {
            "name": "My New Studio", "category": "studio", "city": "Hamburg", "price": 88,
            "instant": True, "genres": ["Rock"], "about_de": "DE", "about_en": "EN",
        }
        created = self.api("post", "/api/provider/listings/", payload)
        self.assertEqual(created.status_code, 201)
        slug = self.body(created)["id"]
        self.assertEqual(Listing.objects.get(slug=slug).provider, self.user)
        second = self.api("post", "/api/provider/listings/", payload)
        self.assertNotEqual(self.body(second)["id"], slug)
        invalid = self.api("post", "/api/provider/listings/", {"name": "", "category": "bad", "price": 5})
        self.assertEqual(invalid.status_code, 400)

        patched = self.api("patch", f"/api/provider/listings/{slug}/", {"price": -10, "instant": False, "genres": ["Jazz"]})
        self.assertEqual(patched.status_code, 200)
        obj = Listing.objects.get(slug=slug)
        self.assertEqual(obj.price, Decimal("0"))
        self.assertFalse(obj.instant)
        self.assertEqual(obj.genres, ["Jazz"])

        other_client = Client()
        other_client.force_login(self.other)
        self.assertEqual(self.api("patch", f"/api/provider/listings/{slug}/", {"name": "Hack"}, client=other_client).status_code, 404)
        deleted = self.api("delete", f"/api/provider/listings/{slug}/")
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(Listing.objects.get(slug=slug).active)

    def test_availability_crud_validation_permissions_and_range_cap(self):
        self.client.force_login(self.provider)
        start = self.future(20)
        end = start + timedelta(hours=8)
        created = self.api("post", f"/api/listings/{self.studio.slug}/availability/", {
            "start": start.isoformat(), "end": end.isoformat(), "available": True, "note": "Open",
        })
        self.assertEqual(created.status_code, 201)
        slot_id = self.body(created)["id"]
        listed = self.body(self.client.get(f"/api/listings/{self.studio.slug}/availability/"))
        self.assertTrue(any(x["id"] == slot_id for x in listed["slots"]))

        invalid = self.api("post", f"/api/listings/{self.studio.slug}/availability/", {"start": end.isoformat(), "end": start.isoformat()})
        self.assertEqual(invalid.status_code, 400)
        too_long = self.api("post", f"/api/listings/{self.studio.slug}/availability/", {"start": start.isoformat(), "end": (start + timedelta(days=32)).isoformat()})
        self.assertEqual(too_long.status_code, 400)
        invalid_get = self.client.get(f"/api/listings/{self.studio.slug}/availability/?start={end.isoformat()}&end={start.isoformat()}")
        self.assertEqual(invalid_get.status_code, 400)

        other_client = Client(); other_client.force_login(self.other)
        forbidden = self.api("post", f"/api/listings/{self.studio.slug}/availability/", {"start": start.isoformat(), "end": end.isoformat()}, client=other_client)
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(self.api("delete", f"/api/availability/{slot_id}/", client=other_client).status_code, 403)
        self.assertEqual(self.api("delete", f"/api/availability/{slot_id}/").status_code, 200)
        self.assertFalse(AvailabilitySlot.objects.filter(pk=slot_id).exists())

    def test_availability_string_boolean_is_not_misread(self):
        self.client.force_login(self.provider)
        start = self.future(25)
        created = self.api("post", f"/api/listings/{self.studio.slug}/availability/", {
            "start": start.isoformat(), "end": (start + timedelta(hours=1)).isoformat(), "available": "false"
        })
        self.assertEqual(created.status_code, 201)
        self.assertFalse(AvailabilitySlot.objects.get(pk=self.body(created)["id"]).is_available)


class ReviewTests(AudoraTestCase):
    def test_review_create_update_average_and_invalid(self):
        first = self.api("post", f"/api/listings/{self.studio.slug}/reviews/", {"rating": 5, "comment": "Great"})
        self.assertEqual(first.status_code, 201)
        updated = self.api("post", f"/api/listings/{self.studio.slug}/reviews/", {"rating": 4, "comment": "Updated"})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(Review.objects.filter(user=self.user, listing=self.studio).count(), 1)

        c = Client(); c.force_login(self.other)
        self.api("post", f"/api/listings/{self.studio.slug}/reviews/", {"rating": 2, "comment": "Okay"}, client=c)
        self.studio.refresh_from_db()
        self.assertEqual(self.studio.reviews, 2)
        self.assertEqual(self.studio.rating, Decimal("3.00"))
        rows = self.body(self.client.get(f"/api/listings/{self.studio.slug}/reviews/"))["results"]
        self.assertEqual(len(rows), 2)
        for bad in [0, 6, "bad", None]:
            response = self.api("post", f"/api/listings/{self.studio.slug}/reviews/", {"rating": bad})
            self.assertEqual(response.status_code, 400)


class BookingTests(AudoraTestCase):
    def test_direct_booking_totals_duration_clamps_and_notification(self):
        start = self.future(30)
        studio = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": start.isoformat(), "duration_hours": 2})
        self.assertEqual(studio.status_code, 201)
        self.assertEqual(self.body(studio)["total"], 200.0)
        self.assertTrue(Notification.objects.filter(user=self.user, title_en="Booking confirmed").exists())

        start2 = self.future(31)
        low = self.api("post", "/api/bookings/", {"listing_id": self.engineer.slug, "start_at": start2.isoformat(), "duration_hours": 0.1})
        self.assertEqual(self.body(low)["duration_hours"], 0.5)
        self.assertEqual(self.body(low)["total"], 120.0)
        high = self.api("post", "/api/bookings/", {"listing_id": self.songwriter.slug, "start_at": self.future(32).isoformat(), "duration_hours": 999})
        self.assertEqual(self.body(high)["duration_hours"], 24.0)

    def test_booking_conflicts_positive_slots_blocked_slots_and_adjacency(self):
        start = self.future(35)
        AvailabilitySlot.objects.create(listing=self.studio, start_at=start, end_at=start + timedelta(hours=4), is_available=True)
        outside = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": (start + timedelta(hours=5)).isoformat(), "duration_hours": 1})
        self.assertEqual(outside.status_code, 409)
        first = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": start.isoformat(), "duration_hours": 2})
        self.assertEqual(first.status_code, 201)
        overlap = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": (start + timedelta(hours=1)).isoformat(), "duration_hours": 1})
        self.assertEqual(overlap.status_code, 409)
        adjacent = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": (start + timedelta(hours=2)).isoformat(), "duration_hours": 1})
        self.assertEqual(adjacent.status_code, 201)

        blocked_start = self.future(36)
        AvailabilitySlot.objects.create(listing=self.engineer, start_at=blocked_start, end_at=blocked_start + timedelta(hours=2), is_available=False)
        blocked = self.api("post", "/api/bookings/", {"listing_id": self.engineer.slug, "start_at": blocked_start.isoformat(), "duration_hours": 1})
        self.assertEqual(blocked.status_code, 409)

    def test_past_or_invalid_booking_is_rejected(self):
        past = timezone.now() - timedelta(hours=2)
        response = self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": past.isoformat(), "duration_hours": 1})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.api("post", "/api/bookings/", {"listing_id": "missing", "start_at": self.future().isoformat()}).status_code, 400)
        self.assertEqual(self.api("post", "/api/bookings/", {"listing_id": self.studio.slug, "start_at": "bad"}).status_code, 400)

    def test_booking_detail_permissions_and_status_transitions(self):
        booking = Booking.objects.create(user=self.user, listing=self.studio, start_at=self.future(40), duration_hours=1, total=100, status="confirmed")
        own = self.client.get(f"/api/bookings/{booking.id}/")
        self.assertEqual(own.status_code, 200)
        self.assertIn(self.api("patch", f"/api/bookings/{booking.id}/", {"status": "pending"}).status_code, {400, 403})
        self.assertEqual(self.api("patch", f"/api/bookings/{booking.id}/", {"status": "cancelled"}).status_code, 200)

        booking.status = "confirmed"; booking.save(update_fields=["status"])
        provider_client = Client(); provider_client.force_login(self.provider)
        backwards = self.api("patch", f"/api/bookings/{booking.id}/", {"status": "pending"}, client=provider_client)
        # A confirmed booking cannot move backwards into pending.
        self.assertEqual(backwards.status_code, 409)

        stranger = Client(); stranger.force_login(self.other)
        self.assertEqual(stranger.get(f"/api/bookings/{booking.id}/").status_code, 403)


class SessionTests(AudoraTestCase):
    def test_confirmed_session_creates_team_tasks_bookings_and_notification(self):
        start = self.future(50)
        response = self.api("post", "/api/sessions/", {
            "title": "Album Session", "goal": "record", "city": "Berlin", "genres": ["Hip-Hop"],
            "budget": 1000, "duration_hours": 3, "start_at": start.isoformat(), "status": "confirmed",
        })
        self.assertEqual(response.status_code, 201)
        data = self.body(response)
        session = SessionProject.objects.get(pk=data["id"])
        self.assertEqual(session.tasks.count(), 3)
        self.assertEqual(session.bookings.count(), 3)
        self.assertEqual(session.team.count(), 2)
        self.assertTrue(Notification.objects.filter(user=self.user, title_en="Session confirmed").exists())
        self.assertEqual(data["state"], "upcoming")

    def test_draft_session_has_tasks_but_no_bookings(self):
        response = self.api("post", "/api/sessions/", {"title": "Draft", "goal": "record", "city": "Berlin", "budget": 1000, "status": "draft"})
        self.assertEqual(response.status_code, 201)
        session = SessionProject.objects.get(pk=self.body(response)["id"])
        self.assertEqual(session.status, "draft")
        self.assertEqual(session.bookings.count(), 0)
        self.assertEqual(session.tasks.count(), 3)

    def test_session_rejects_unavailable_team_or_studio(self):
        start = self.future(55)
        for listing in [self.studio, self.cheap_studio]:
            Booking.objects.create(user=self.other, listing=listing, start_at=start, duration_hours=4, total=100, status="confirmed")
        no_studio = self.api("post", "/api/sessions/", {"goal": "record", "city": "Berlin", "start_at": start.isoformat(), "duration_hours": 2})
        self.assertEqual(no_studio.status_code, 409)
        self.assertEqual(self.body(no_studio)["error"], "no_available_studio")

        future = self.future(56)
        Booking.objects.create(user=self.other, listing=self.engineer, start_at=future, duration_hours=4, total=100, status="confirmed")
        no_team = self.api("post", "/api/sessions/", {"goal": "mix", "city": "Berlin", "start_at": future.isoformat(), "duration_hours": 2})
        self.assertEqual(no_team.status_code, 409)
        self.assertEqual(self.body(no_team)["error"], "no_available_team")

    def test_session_duration_is_clamped_and_past_start_rejected(self):
        start = self.future(60)
        response = self.api("post", "/api/sessions/", {"goal": "mix", "city": "Berlin", "start_at": start.isoformat(), "duration_hours": -5})
        self.assertEqual(response.status_code, 201)
        session = SessionProject.objects.get(pk=self.body(response)["id"])
        self.assertEqual(session.duration_hours, Decimal("0.5"))
        past = self.api("post", "/api/sessions/", {"goal": "mix", "city": "Berlin", "start_at": (timezone.now() - timedelta(hours=1)).isoformat()})
        self.assertEqual(past.status_code, 400)

    def test_session_detail_isolation_patch_limits_and_cancel_sync(self):
        session = SessionProject.objects.create(user=self.user, title="Own", city="Berlin", status="confirmed", studio=self.studio, start_at=self.future(65), duration_hours=1)
        booking = Booking.objects.create(user=self.user, listing=self.studio, session=session, start_at=session.start_at, duration_hours=1, total=100, status="confirmed")
        response = self.api("patch", f"/api/sessions/{session.id}/", {"title": "T" * 500, "city": "C" * 500, "notes": "N" * 20000, "status": "cancelled"})
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db(); booking.refresh_from_db()
        self.assertLessEqual(len(session.title), 180)
        self.assertLessEqual(len(session.city), 100)
        self.assertEqual(session.status, "cancelled")
        self.assertEqual(booking.status, "cancelled")
        self.assertEqual(self.body(response)["state"], "past")

        c = Client(); c.force_login(self.other)
        self.assertEqual(c.get(f"/api/sessions/{session.id}/").status_code, 404)

    def test_cancel_endpoint_releases_slots_and_completed_is_protected(self):
        session = SessionProject.objects.create(user=self.user, title="Cancelable", city="Berlin", status="confirmed", studio=self.studio, start_at=self.future(70), duration_hours=1)
        booking = Booking.objects.create(user=self.user, listing=self.studio, session=session, start_at=session.start_at, duration_hours=1, total=100, status="confirmed")
        cancelled = self.api("post", f"/api/sessions/{session.id}/cancel/", {})
        self.assertEqual(cancelled.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "cancelled")
        self.assertEqual(self.body(cancelled)["state"], "past")

        completed = SessionProject.objects.create(user=self.user, title="Done", status="completed")
        self.assertEqual(self.api("post", f"/api/sessions/{completed.id}/cancel/", {}).status_code, 409)


class TaskFileInboxNotificationTests(AudoraTestCase):
    def setUp(self):
        super().setUp()
        self.session = SessionProject.objects.create(user=self.user, title="Project", city="Berlin", status="confirmed")
        self.task = SessionTask.objects.create(session=self.session, title="Do it")

    def test_task_owner_boolean_validation_and_isolation(self):
        done = self.api("patch", f"/api/tasks/{self.task.id}/", {"done": True})
        self.assertEqual(done.status_code, 200)
        self.assertTrue(self.body(done)["done"])
        bad = self.api("patch", f"/api/tasks/{self.task.id}/", {"done": "false"})
        self.assertEqual(bad.status_code, 400)
        c = Client(); c.force_login(self.other)
        self.assertEqual(self.api("patch", f"/api/tasks/{self.task.id}/", {"done": False}, client=c).status_code, 404)

    def test_file_upload_required_owner_and_size_limit(self):
        self.assertEqual(self.client.post(f"/api/sessions/{self.session.id}/files/").status_code, 400)
        small = SimpleUploadedFile("reference.txt", b"hello", content_type="text/plain")
        uploaded = self.client.post(f"/api/sessions/{self.session.id}/files/", {"file": small})
        self.assertEqual(uploaded.status_code, 201)
        self.assertEqual(SessionFile.objects.filter(session=self.session).count(), 1)

        c = Client(); c.force_login(self.other)
        foreign = SimpleUploadedFile("foreign.txt", b"hello")
        self.assertEqual(c.post(f"/api/sessions/{self.session.id}/files/", {"file": foreign}).status_code, 404)

        too_big = SimpleUploadedFile("huge.bin", b"x" * (51 * 1024 * 1024), content_type="application/octet-stream")
        rejected = self.client.post(f"/api/sessions/{self.session.id}/files/", {"file": too_big})
        self.assertEqual(rejected.status_code, 413)

    def test_conversation_create_reuse_participants_send_and_permissions(self):
        first = self.api("post", f"/api/conversations/listing/{self.studio.slug}/", {})
        second = self.api("post", f"/api/conversations/listing/{self.studio.slug}/", {})
        self.assertEqual(self.body(first)["id"], self.body(second)["id"])
        convo = Conversation.objects.get(pk=self.body(first)["id"])
        self.assertEqual(set(convo.participants.values_list("id", flat=True)), {self.user.id, self.provider.id})
        self.assertEqual(self.api("post", f"/api/conversations/{convo.id}/", {"text": "   "}).status_code, 400)
        sent = self.api("post", f"/api/conversations/{convo.id}/", {"text": "Hello"})
        self.assertEqual(sent.status_code, 201)
        self.assertTrue(Message.objects.filter(conversation=convo, sender=self.user, text="Hello").exists())

        c = Client(); c.force_login(self.other)
        self.assertEqual(c.get(f"/api/conversations/{convo.id}/").status_code, 404)
        self.assertEqual(self.api("post", f"/api/conversations/{convo.id}/", {"text": "Hack"}, client=c).status_code, 404)

    def test_notifications_read_single_and_all(self):
        n1 = Notification.objects.create(user=self.user, title_de="A", title_en="A")
        n2 = Notification.objects.create(user=self.user, title_de="B", title_en="B")
        Notification.objects.create(user=self.other, title_de="Other", title_en="Other")
        listed = self.body(self.client.get("/api/notifications/"))["results"]
        self.assertEqual(len(listed), 2)
        self.api("patch", "/api/notifications/", {"id": n1.id})
        n1.refresh_from_db(); n2.refresh_from_db()
        self.assertTrue(n1.read); self.assertFalse(n2.read)
        self.api("patch", "/api/notifications/", {"all": True})
        self.assertFalse(Notification.objects.filter(user=self.user, read=False).exists())

    def test_bootstrap_returns_only_current_users_data(self):
        Favorite.objects.create(user=self.user, listing=self.studio)
        SessionProject.objects.create(user=self.other, title="Secret")
        Notification.objects.create(user=self.other, title_de="Secret", title_en="Secret")
        data = self.body(self.client.get("/api/bootstrap/"))
        self.assertIn(self.studio.slug, data["favorites"])
        self.assertNotIn("Secret", json.dumps(data))
