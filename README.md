# Audora — Marketplace Prototype

A high-fidelity frontend prototype for a music-session marketplace: studios, producers, engineers, songwriters and session musicians in one product experience.

## Prototype scope

This repository intentionally contains **no backend yet**. The goal is to demonstrate what the product can feel like, how the core discovery/booking flows can work, and which differentiating features can make it stronger than a basic studio marketplace.

### Included in the demo

- Premium responsive landing + marketplace UI
- Studio / Producer / Engineer / Songwriter / Session Musician discovery
- Category and availability filters
- Map preview mode
- Favorites
- Three-item comparison flow
- Rich listing/profile modal
- Audio-preview interaction mock
- **Audora Smart Match** package builder
- Three-step **Session Builder**
- Studio + Producer + Engineer package concept with one total
- **Session Room** product concept
- One-checkout / protected-payment concept
- Creative Fit Score concept
- Live availability concept
- Creator/provider business dashboard teaser
- Floating AI session assistant
- Mobile app-style bottom navigation
- Fully responsive desktop/tablet/mobile layout
- Full German and English UI dictionaries
- Language switcher that also communicates readiness for additional locales (ES / FR / TR / FA / AR / +)

## Language architecture

All interface copy is stored in `i18n.js` and selected through the language switcher. German and English are separate complete dictionaries; dynamic cards, modals, toasts and actions also use the selected locale.

To add a language later, add a new dictionary next to `de` and `en` in `i18n.js`, then add it to the language selector and locale activation logic.

## Changing the brand later

The current working name is **Audora** and is intentionally treated as replaceable.

- Product name: change `BRAND.name` at the top of `app.js`.
- Visual mark: replace the `.brand-mark` SVG in `index.html` (header + footer).
- Main colors: change `--violet`, `--violet-2`, `--pink`, `--mint` at the top of `styles.css`.
- Fonts and visual personality can be changed without touching product/data logic.

This separation keeps a later rename/rebrand cheap.

## Local preview

No build step is required.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Validation

`.github/workflows/validate.yml` checks:

- JavaScript syntax
- Presence of required prototype files
- German + English translation coverage for all static `data-i18n` keys

## Backend-ready next layer

When the prototype direction is approved, the current UI can be connected to real services without redesigning the flows. Suggested domain model:

- Users / creator profiles / studio profiles
- Listings and equipment
- Availability calendars and time slots
- Session projects
- Team/package composition
- Booking requests / instant booking
- Payments / payouts / cancellation rules
- Reviews and verification
- Favorites and comparisons
- Messaging / Session Room files and notes
- Smart Match ranking service
- Localization content

The mock listing data currently lives at the top of `app.js`; replacing that array with API responses is the cleanest first integration step.
