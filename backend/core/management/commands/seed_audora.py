from datetime import datetime, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Conversation, Favorite, Listing, Message, Notification, ProviderProfile, SessionProject, SessionTask

User = get_user_model()

LISTINGS = [
    dict(slug="neon-room", category="studio", name="Neon Room Berlin", city="Berlin", image_url="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=88", rating="4.96", reviews=128, distance_km="1.8", price="89", instant=True, top=True, genres=["Hip-Hop","R&B","Pop"], meta_de="Kreuzberg · Vocal Booth · 42 m²", meta_en="Kreuzberg · Vocal booth · 42 m²", tags_de=["Neumann U87","SSL","Vocal Booth"], tags_en=["Neumann U87","SSL","Vocal booth"], about_de="Modernes Recording-Studio in Kreuzberg mit warmer Akustik, separater Vocal Booth und schnellem Workflow für Artists und Producer.", about_en="Modern recording studio in Kreuzberg with warm acoustics, a separate vocal booth and a fast workflow for artists and producers."),
    dict(slug="atlas-sound", category="studio", name="Atlas Sound Loft", city="Berlin", image_url="https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1200&q=88", rating="4.91", reviews=84, distance_km="3.2", price="65", instant=True, top=False, genres=["Indie","Rock","Pop"], meta_de="Friedrichshain · Live Room · 68 m²", meta_en="Friedrichshain · Live room · 68 m²", tags_de=["Live Room","Drums","Analog"], tags_en=["Live room","Drums","Analog"], about_de="Helles Loft-Studio für Bands, Live-Instrumente, Proben und kreative Production Sessions.", about_en="Bright loft studio for bands, live instruments, rehearsals and creative production sessions."),
    dict(slug="noir-suite", category="studio", name="NOIR Recording Suite", city="Berlin", image_url="https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=88", rating="4.99", reviews=201, distance_km="4.6", price="110", instant=False, top=True, genres=["R&B","Hip-Hop","Soul"], meta_de="Charlottenburg · Premium · 55 m²", meta_en="Charlottenburg · Premium · 55 m²", tags_de=["Genelec","U87","Lounge"], tags_en=["Genelec","U87","Lounge"], about_de="Premium-Suite für fokussierte Sessions mit hochwertigem Monitoring, Lounge und diskretem Zugang.", about_en="Premium suite for focused sessions with high-end monitoring, lounge and discreet access."),
    dict(slug="jona-k", category="producer", name="Jona K.", city="Berlin", image_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1000&q=88", rating="4.98", reviews=76, distance_km="2.1", price="180", instant=True, top=True, genres=["Hip-Hop","Trap","R&B"], meta_de="Producer · 38 Releases · 12 Mio. Streams", meta_en="Producer · 38 releases · 12M streams", tags_de=["Beatmaking","Vocal Production","Arrangement"], tags_en=["Beatmaking","Vocal production","Arrangement"], about_de="Producer mit Fokus auf modernen Hip-Hop, Trap und R&B – von der ersten Idee bis zur finalen Vocal Production.", about_en="Producer focused on modern hip-hop, trap and R&B, from the first idea through final vocal production."),
    dict(slug="lena-nova", category="producer", name="Lena Nova", city="Berlin", image_url="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1000&q=88", rating="4.93", reviews=52, distance_km="5.4", price="220", instant=False, top=True, genres=["Pop","Electronic","Indie"], meta_de="Producerin · Songwriterin · 8 Mio. Streams", meta_en="Producer · Songwriter · 8M streams", tags_de=["Production","Synths","Songwriting"], tags_en=["Production","Synths","Songwriting"], about_de="Genreübergreifende Producerin und Songwriterin für Pop, Electronic und Indie mit Stärke in Arrangement und Artist Development.", about_en="Genre-fluid producer and songwriter for pop, electronic and indie, strong in arrangement and artist development."),
    dict(slug="mia-l", category="engineer", name="Mia L.", city="Berlin", image_url="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=88", rating="4.97", reviews=109, distance_km="2.9", price="120", instant=True, top=True, genres=["Hip-Hop","Pop","R&B"], meta_de="Mix-Toningenieurin · Dolby Atmos · 64 Credits", meta_en="Mix engineer · Dolby Atmos · 64 credits", tags_de=["Mixing","Mastering","Atmos"], tags_en=["Mixing","Mastering","Atmos"], about_de="Mix-Toningenieurin für moderne Vocals und druckvolle Low-Ends. Remote oder vor Ort buchbar.", about_en="Mix engineer for modern vocals and powerful low end. Available remotely or in person."),
    dict(slug="finn-audio", category="engineer", name="Finn Audio", city="Berlin", image_url="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=1000&q=88", rating="4.90", reviews=68, distance_km="4.1", price="95", instant=True, top=False, genres=["Rock","Indie","Pop"], meta_de="Recording & Mix · 47 Credits", meta_en="Recording & mix · 47 credits", tags_de=["Tracking","Mixing","Drums"], tags_en=["Tracking","Mixing","Drums"], about_de="Recording und Mixing für Bands, Indie und Pop mit schnellem Editing und viel Erfahrung mit Live-Setups.", about_en="Recording and mixing for bands, indie and pop with fast editing and strong live-setup experience."),
    dict(slug="nia-words", category="songwriter", name="Nia Words", city="Berlin", image_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=88", rating="4.95", reviews=61, distance_km="3.6", price="160", instant=True, top=True, genres=["Pop","R&B","Soul"], meta_de="Songwriterin · Toplinerin · 31 Credits", meta_en="Songwriter · Topliner · 31 credits", tags_de=["Lyrics","Topline","Vocal Demo"], tags_en=["Lyrics","Topline","Vocal demo"], about_de="Songwriterin und Toplinerin für Pop, R&B und Soul mit Fokus auf Hooks, Story und singbare Melodien.", about_en="Songwriter and topliner for pop, R&B and soul, focused on hooks, story and singable melodies."),
]


class Command(BaseCommand):
    help = "Seed Audora with production-like demo data"

    def handle(self, *args, **options):
        demo, _ = User.objects.get_or_create(username="demo", defaults={"email": "demo@audora.local", "first_name": "Alex", "last_name": "M."})
        if not demo.has_usable_password():
            demo.set_unusable_password(); demo.save(update_fields=["password"])
        ProviderProfile.objects.get_or_create(user=demo, defaults={"display_name": "Alex M.", "role": "Artist", "active": False})

        providers = {}
        for username, first, last in [("jona","Jona","K."),("mia","Mia","L."),("neon","Neon Room","Berlin"),("lena","Lena","Nova"),("finn","Finn","Audio"),("nia","Nia","Words")]:
            user, _ = User.objects.get_or_create(username=username, defaults={"first_name": first, "last_name": last, "email": f"{username}@audora.local"})
            user.set_unusable_password(); user.save(update_fields=["password"])
            ProviderProfile.objects.get_or_create(user=user, defaults={"display_name": f"{first} {last}".strip(), "role": "Creator", "verified": True, "active": True})
            providers[username] = user

        provider_map = {"neon-room":"neon","atlas-sound":"neon","noir-suite":"neon","jona-k":"jona","lena-nova":"lena","mia-l":"mia","finn-audio":"finn","nia-words":"nia"}
        objects = {}
        for payload in LISTINGS:
            slug = payload["slug"]
            obj, _ = Listing.objects.update_or_create(slug=slug, defaults={**payload, "provider": providers.get(provider_map.get(slug, ""))})
            objects[slug] = obj

        start = timezone.now().replace(hour=20, minute=0, second=0, microsecond=0) + timedelta(days=3)
        midnight = SessionProject.objects.filter(user=demo, title="Midnight EP").first()
        if not midnight:
            midnight = SessionProject.objects.create(user=demo, title="Midnight EP", goal="record", city="Berlin", start_at=start, duration_hours=Decimal("3"), budget=Decimal("700"), total=Decimal("567"), status="confirmed", studio=objects["neon-room"], genres=["Hip-Hop","R&B"])
            midnight.team.set([objects["jona-k"], objects["mia-l"]])
            SessionTask.objects.bulk_create([
                SessionTask(session=midnight, title="References & Brief finalisieren", assignee_name="Alex", due_label="Heute", done=True, order=1),
                SessionTask(session=midnight, title="Session-Dateien hochladen", assignee_name="Alex", due_label="Heute", order=2),
                SessionTask(session=midnight, title="Vocal Chain vorbereiten", assignee_name="Mia L.", due_label="FR", order=3),
            ])

        def ensure_conversation(key, listing_slug, provider_key, initial):
            listing = objects[listing_slug]
            convo = Conversation.objects.filter(listing=listing, participants=demo).first()
            if not convo:
                convo = Conversation.objects.create(title=listing.name, listing=listing)
                convo.participants.add(demo, providers[provider_key])
                for sender_key, text in initial:
                    Message.objects.create(conversation=convo, sender=demo if sender_key == "demo" else providers[provider_key], text=text)
            return convo

        ensure_conversation("jona", "jona-k", "jona", [("jona","Hey Alex, ich habe mir deine Referenzen angehört. Sehr klare Richtung."),("demo","Perfekt. Ich will die Vocals eher dunkel und direkt halten."),("jona","Passt. Ich bringe zwei Beat-Ideen mit und wir entscheiden im Studio.")])
        ensure_conversation("mia", "mia-l", "mia", [("mia","Session ist bestätigt ✓ Ich bin am Freitag ab 19:45 da."),("demo","Super, bis Freitag!")])
        ensure_conversation("neon", "neon-room", "neon", [("neon","Der Raum ist ab 19:30 frei. Ihr könnt gerne etwas früher rein.")])

        if not Notification.objects.filter(user=demo).exists():
            Notification.objects.bulk_create([
                Notification(user=demo, title_de="Session bestätigt", title_en="Session confirmed", text_de="Mia L. hat deine Session bestätigt.", text_en="Mia L. confirmed your session."),
                Notification(user=demo, title_de="Neue Nachricht", title_en="New message", text_de="Jona K. hat dir geschrieben.", text_en="Jona K. sent you a message."),
                Notification(user=demo, title_de="Studio verfügbar", title_en="Studio available", text_de="Neon Room ist am Freitag verfügbar.", text_en="Neon Room is available Friday."),
            ])

        self.stdout.write(self.style.SUCCESS(f"Audora seed complete: {Listing.objects.count()} listings, {SessionProject.objects.count()} sessions"))
