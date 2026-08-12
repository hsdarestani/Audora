import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import Booking, Listing, ProviderProfile, SessionProject

User = get_user_model()


class ProductLogicAuditTests(TestCase):
    def setUp(self):
        self.artist = User.objects.create_user(username='logic-artist', email='logic-artist@example.com', password='StrongPass123!')
        self.provider = User.objects.create_user(username='logic-provider', email='logic-provider@example.com', password='StrongPass123!')
        ProviderProfile.objects.create(user=self.provider, display_name='Logic Provider', active=True)
        self.studio_berlin = self.make_listing('logic-studio-berlin', 'studio', 'Berlin Studio', 100, 'Berlin', provider=self.provider)
        self.studio_hamburg = self.make_listing('logic-studio-hamburg', 'studio', 'Hamburg Studio', 80, 'Hamburg')
        self.producer = self.make_listing('logic-producer', 'producer', 'Logic Producer', 140, 'Berlin')
        self.engineer = self.make_listing('logic-engineer', 'engineer', 'Logic Engineer', 110, 'Berlin')
        self.songwriter = self.make_listing('logic-writer', 'songwriter', 'Logic Writer', 120, 'Berlin')
        self.client.force_login(self.artist)

    def make_listing(self, slug, category, name, price, city, provider=None):
        return Listing.objects.create(
            slug=slug, category=category, name=name, price=Decimal(str(price)), city=city,
            provider=provider, active=True, instant=True, rating=Decimal('4.80'), genres=['Hip-Hop', 'Pop'],
            image_url='https://example.com/test.jpg', meta_de=name, meta_en=name,
            about_de='Test', about_en='Test', tags_de=[], tags_en=[]
        )

    def post_json(self, path, payload, client=None):
        return (client or self.client).post(path, data=json.dumps(payload), content_type='application/json')

    def patch_json(self, path, payload, client=None):
        return (client or self.client).patch(path, data=json.dumps(payload), content_type='application/json')

    def future(self, days=20, hour=20):
        value = timezone.now() + timedelta(days=days)
        return value.replace(hour=hour, minute=0, second=0, microsecond=0)

    def body(self, response):
        return json.loads(response.content.decode('utf-8'))

    def test_builder_candidates_are_availability_aware(self):
        start = self.future()
        Booking.objects.create(user=self.artist, listing=self.studio_berlin, start_at=start, duration_hours=3, total=300, status='confirmed')
        response = self.post_json('/api/builder/candidates/', {
            'goal': 'record', 'city': 'Berlin', 'genres': ['Hip-Hop'],
            'start_at': start.isoformat(), 'duration_hours': 3,
        })
        self.assertEqual(response.status_code, 200)
        data = self.body(response)
        self.assertNotIn(self.studio_berlin.slug, [row['id'] for row in data['studios']])
        self.assertEqual(data['rules']['studio_required'], True)
        self.assertIn('producer', data['roles'])
        self.assertIn('engineer', data['roles'])

    def test_goal_rules_change_the_actual_session_shape(self):
        start = self.future(22)
        studio_only = self.post_json('/api/sessions/selected/', {
            'goal': 'studio', 'city': 'Berlin', 'studio_id': self.studio_berlin.slug,
            'team_ids': [], 'start_at': start.isoformat(), 'duration_hours': 2, 'status': 'confirmed',
        })
        self.assertEqual(studio_only.status_code, 201)
        studio_session = SessionProject.objects.get(pk=self.body(studio_only)['id'])
        self.assertEqual(studio_session.team.count(), 0)
        self.assertEqual(studio_session.bookings.count(), 1)

        mix = self.post_json('/api/sessions/selected/', {
            'goal': 'mix', 'city': 'Remote', 'studio_id': '', 'team_ids': [self.engineer.slug],
            'start_at': self.future(23).isoformat(), 'duration_hours': 3, 'status': 'confirmed',
        })
        self.assertEqual(mix.status_code, 201)
        mix_session = SessionProject.objects.get(pk=self.body(mix)['id'])
        self.assertIsNone(mix_session.studio)
        self.assertEqual(list(mix_session.team.values_list('category', flat=True)), ['engineer'])

        missing_engineer = self.post_json('/api/sessions/selected/', {
            'goal': 'mix', 'city': 'Remote', 'studio_id': '', 'team_ids': [],
            'start_at': self.future(24).isoformat(), 'status': 'confirmed',
        })
        self.assertEqual(missing_engineer.status_code, 409)
        self.assertEqual(self.body(missing_engineer)['error'], 'required_team_role_missing')

    def test_out_of_city_studio_persists_the_real_location(self):
        response = self.post_json('/api/sessions/selected/', {
            'goal': 'studio', 'city': 'Frankfurt', 'studio_id': self.studio_hamburg.slug,
            'team_ids': [], 'start_at': self.future(25).isoformat(), 'status': 'confirmed',
        })
        self.assertEqual(response.status_code, 201)
        session = SessionProject.objects.get(pk=self.body(response)['id'])
        self.assertEqual(session.city, 'Hamburg')
        self.assertEqual(session.studio_id, self.studio_hamburg.id)

    def test_customer_cannot_mark_booking_completed_but_provider_can(self):
        booking = Booking.objects.create(
            user=self.artist, listing=self.studio_berlin, start_at=self.future(26), duration_hours=1,
            total=100, status='confirmed'
        )
        denied = self.patch_json(f'/api/bookings/{booking.id}/', {'status': 'completed'})
        self.assertEqual(denied.status_code, 403)
        booking.refresh_from_db(); self.assertEqual(booking.status, 'confirmed')

        provider_client = Client(); provider_client.force_login(self.provider)
        completed = self.patch_json(f'/api/bookings/{booking.id}/', {'status': 'completed'}, client=provider_client)
        self.assertEqual(completed.status_code, 200)
        booking.refresh_from_db(); self.assertEqual(booking.status, 'completed')

        terminal = self.patch_json(f'/api/bookings/{booking.id}/', {'status': 'confirmed'}, client=provider_client)
        self.assertEqual(terminal.status_code, 409)

    def test_session_owner_cannot_fake_completion(self):
        session = SessionProject.objects.create(
            user=self.artist, title='Logic Session', goal='record', city='Berlin',
            studio=self.studio_berlin, start_at=self.future(27), duration_hours=1, status='confirmed'
        )
        booking = Booking.objects.create(
            user=self.artist, listing=self.studio_berlin, session=session, start_at=session.start_at,
            duration_hours=1, total=100, status='confirmed'
        )
        fake = self.patch_json(f'/api/sessions/{session.id}/', {'status': 'completed'})
        self.assertEqual(fake.status_code, 409)
        session.refresh_from_db(); booking.refresh_from_db()
        self.assertEqual(session.status, 'confirmed')
        self.assertEqual(booking.status, 'confirmed')

        cancelled = self.patch_json(f'/api/sessions/{session.id}/', {'status': 'cancelled'})
        self.assertEqual(cancelled.status_code, 200)
        booking.refresh_from_db(); self.assertEqual(booking.status, 'cancelled')

    def test_reviews_prevent_self_review_and_expose_verification(self):
        provider_client = Client(); provider_client.force_login(self.provider)
        own = self.post_json(f'/api/listings/{self.studio_berlin.slug}/reviews/', {'rating': 5, 'comment': 'Own review'}, client=provider_client)
        self.assertEqual(own.status_code, 403)

        unverified = self.post_json(f'/api/listings/{self.studio_berlin.slug}/reviews/', {'rating': 4, 'comment': 'Before completed booking'})
        self.assertEqual(unverified.status_code, 201)
        self.assertFalse(self.body(unverified)['verified_booking'])

        Booking.objects.create(user=self.artist, listing=self.studio_berlin, start_at=self.future(1), duration_hours=1, total=100, status='completed')
        verified = self.post_json(f'/api/listings/{self.studio_berlin.slug}/reviews/', {'rating': 5, 'comment': 'Verified experience'})
        self.assertEqual(verified.status_code, 200)
        self.assertTrue(self.body(verified)['verified_booking'])
        listing = self.body(self.client.get(f'/api/listings/{self.studio_berlin.slug}/reviews/'))
        self.assertTrue(listing['verified_booking'])
        self.assertTrue(listing['results'][0]['verified_booking'])
