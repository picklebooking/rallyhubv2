# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players (primary).** Pickleball players who book courts and join Open Play games. The web app is designed around them first.
- **Venue operators (secondary).** Tenant owners and staff who run one or more venues: courts, opening hours, booking rules and members. They work in the protected dashboard.
- **Platform admins.** RallyHub staff who create, activate and close tenants and recover a tenant that has lost its owner. API and tooling only today; no admin UI.

## Product Purpose

RallyHub lets players find and book pickleball courts and fill games with other players, and gives venue businesses the tools to run their courts. Success for a player is a confirmed court slot, or a seat in a game, with no back-and-forth. Success for an operator is courts that stay booked under rules they control.

## Positioning

- **Open Play.** A booker can open the spare spots in a game so other players join, through a public list or a join link. A booking becomes a game, not just a reserved slot.
- **One account, many venues.** A player books across every venue and every business on the network with one login.
- **Real operator tooling.** Owners and staff get per-venue booking rules, opening hours, staff roles (tenant-wide or scoped to one venue) and multi-venue management, not just a calendar.

## Operating Context

- A business is a **tenant**; each physical location is a **venue** owned by one tenant; each venue has **courts**. A tenant may run one venue (the common case) or several.
- New tenants and venues start `PENDING` and must be made `ACTIVE` before they take bookings. Courts can be put under maintenance or closed.
- Bookings are checked against each venue's opening hours and rules in the venue's own timezone.
- Current venues and pricing are set up for the Philippines (Cebu, ₱ pricing, Asia/Manila time). This is the current configuration, not a positioning claim.

## Capabilities and Constraints

- **Built:** email/password and Google sign-in; court booking with conflict protection; Open Play (public list, join link, join, leave, cancel, visibility); venue booking-settings API; tenant, venue, court and member management APIs with role checks.
- **Not built yet** (see `docs/BACKLOG.md`): the full reserve flow, public venue pages, settings, real dashboard figures, booking-settings UI, holidays and closures, cancel/reschedule, notifications, membership UI and invitations, payments.
- **Roles:** platform admin; tenant `OWNER` and `STAFF`, either tenant-wide or scoped to one venue; any signed-in player. A tenant always keeps at least one active owner.
- **Terminology:** tenant, venue, court, booking, Open Play, owner, staff.
- **Stack constraints** (from `AGENTS.md`): Next.js App Router, shared shadcn/ui primitives from `@workspace/ui`, shared theme tokens; every screen supports light and dark mode.

## Evidence on Hand

- None yet. The home page's venue count ("Live network: 18 venues"), the "Cebu Pickleball League" testimonial, the featured venues and the ₱ prices are **all placeholder**. Future work must not present invented venues, metrics, testimonials or prices as fact.
- No real customer data, case studies, press or partner logos exist in the repo.

## Product Principles

1. **Players first.** When a decision trades player clarity against operator convenience, the player's path to a confirmed booking or seat wins; operator screens still stay dense and efficient.
2. **A booking is a game.** Design booking and Open Play as one journey, so filling spare spots is natural rather than a separate feature.
3. **The network is one place.** A player never has to think about which business owns a venue; one account and one way of booking everywhere.
4. **Operators set the rules.** Opening hours, booking rules, staff roles and court status are the operator's, and the product enforces them consistently.
5. **No invented proof.** Show real venues, real availability and real numbers, or show nothing.

## Accessibility & Inclusion

- Every screen supports both light and dark mode (repository rule).
- No product-specific accessibility standard has been set yet; this is an open decision.
