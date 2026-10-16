# Averomira — Minimal Linen Design Foundation 1.0

Phase 1 implements **isolated, opt-in** UI primitives only. It does not replace the
production shell, marketing site, authentication screens, RFQ workflows, Support AI,
or any database structures.

## Scope

- The stylesheet `styles/minimal-linen.css` provides one approved token palette,
  typography, spacing, radii, motion and component states.
- All selectors are gated behind `.ml-theme`. Existing pages remain unchanged
  until a separately reviewed integration phase.
- `components/design-system/MinimalLinen.tsx` exports reusable accessible
  button, field, badge, card, alert, tabs, table, dialog and feedback primitives.
- `components/design-system/MinimalLinenGallery.tsx` demonstrates realistic
  interactive states using **only synthetic example data**.
- `/design-system-preview` is an authenticated preview route, reachable only
  locally in development or with `VERCEL_ENV=preview`. Production returns 404.

## Key design decisions

- Background #FAF7F3; surface #FFFFFF; muted text #665E57;
  ink #24211F; primary #635244.
- Focus is indicated by a single 2 px visible outline on active controls.
- Normal button/input min height is 44 px, and mobile text inputs are 16 px.
- Status badges always contain textual status labels, never color alone.
- Tabs support arrow, Home and End navigation.
- Dialog uses native modal semantics and supports Escape.
- Motion is minimized under `prefers-reduced-motion: reduce`.
- A reusable font stack uses Inter if available and a local system fallback;
  no paid font or remote font request is introduced.

## Review and verification

Run `npm run typecheck`, `npm test`, and `npm run build`.
Review the preview route at desktop and mobile widths. Check keyboard
navigation, focus visibility, input error descriptions, dialog Escape,
horizontal data-table scrolling and reduced-motion behavior.

**Not included:** applying the palette to existing pages, database migrations,
AI Copilot backend, persistent conversation storage, or production activation.
Those require subsequent approved phases and independent tests.
