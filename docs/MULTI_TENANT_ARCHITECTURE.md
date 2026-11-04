# RallyHub Multi-Tenant Architecture Plan

**Version:** 1.1
**Date:** September 15, 2026 (last updated September 19, 2026 — added the `Venue` layer, see §Data Model)
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Tenant Isolation Strategy](#tenant-isolation-strategy)
4. [Data Model & Schema](#data-model--schema)
5. [Entity Relationship Diagrams](#entity-relationship-diagrams)
6. [Routing & Domain Strategy](#routing--domain-strategy)
7. [Authentication & Authorization](#authentication--authorization)
8. [API Design & Tenant Context](#api-design--tenant-context)
9. [Onboarding Flow](#onboarding-flow)
10. [Billing & Pricing Model](#billing--pricing-model)
11. [Implementation Phases](#implementation-phases)
12. [Security Considerations](#security-considerations)
13. [Performance & Scalability](#performance--scalability)
14. [Migration Strategy](#migration-strategy)

---

## Executive Summary

RallyHub will implement a **shared database multi-tenant architecture** where:

- Each **business** (e.g., "Cebu Sports Group") is modeled as a `Tenant` — the billing account, and the entity that owns one or more physical locations
- Each **venue** (e.g., "Cebu Pickleball Club - Downtown") — a physical location with its own address, hours, and courts — is modeled as a `Venue`, owned by exactly one `Tenant`. A tenant may operate a single venue (the common case at launch) or several; nothing in the model caps it at one
- **Users** can book courts across multiple venues, even across different tenants, with a single account
- **Venue owners** manage their courts, schedules, pricing, and bookings per venue
- **Data isolation** enforced via `tenantId` (and, for venue-scoped models, `venueId`) foreign keys + Prisma middleware
- **Subdomain routing**: `cebu-club.rallyhub.com` resolves to a `Venue` (not directly to a `Tenant`); `app.rallyhub.com` for the user dashboard
- **Hybrid pricing**: Base monthly fee + percentage per booking, billed at the tenant level

**Key Design Decisions:**
- ✅ Shared database (simpler ops, cross-venue queries)
- ✅ Row-level security with `tenantId` filtering
- ✅ Subdomain-based routing, one subdomain per venue
- ✅ `Tenant` (business/billing) is separate from `Venue` (physical location) — a tenant can own multiple venues
- ✅ Single user account across all venues
- ✅ Role-based access per tenant (Owner/Staff), optionally scoped to one venue

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DNS Layer                                │
│  *.rallyhub.com → Vercel Wildcard (Next.js App)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Middleware                            │
│  • Extract subdomain from host header                           │
│  • Resolve venueId (and its tenantId) from venue slug (cached)  │
│  • Inject tenant + venue context into request                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┬──────────────────┬──────────────────────────┐
│  Marketing Site  │   Venue Booking  │   User Dashboard         │
│  rallyhub.com    │  {slug}.rally... │   app.rallyhub.com       │
│                  │                  │                          │
│  • Landing page  │  • Court browser │   • All bookings         │
│  • Venue dir     │  • Book courts   │   • User settings        │
│  • Pricing       │  • Venue info    │   • Payment methods      │
└──────────────────┴──────────────────┴──────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS API Layer                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TenantContextMiddleware                                 │  │
│  │  • Reads host header or X-Tenant-Id                      │  │
│  │  • Resolves venue by slug, derives tenantId from it      │  │
│  │  • Injects req.tenantId, req.venueId + req.tenant/venue  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @CurrentTenant() Decorator                              │  │
│  │  • Extracts tenantId from request                        │  │
│  │  • Throws BadRequest if missing                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @TenantRoles() Guard                                    │  │
│  │  • Checks user's role for current tenant                 │  │
│  │  • Queries TenantMember table                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Prisma Middleware Layer                       │
│  • Auto-inject tenantId filter on all tenant tables             │
│  • Prevent queries without tenantId on scoped models            │
│  • Enforce data isolation at ORM level                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Single Instance)               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Shared Tables│  │ Tenant Tables│  │  Join Tables │         │
│  │              │  │              │  │              │         │
│  │ • users      │  │ • tenants    │  │ • tenant_    │         │
│  │ • accounts   │  │ • venues     │  │   members    │         │
│  │ • sessions   │  │ • courts     │  │              │         │
│  │              │  │ • bookings   │  │              │         │
│  │              │  │ • pricing_   │  │              │         │
│  │              │  │   rules      │  │              │         │
│  │              │  │ • tenant_    │  │              │         │
│  │              │  │   schedules  │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tenant Isolation Strategy

### Chosen Approach: Shared Database with Row-Level Security

**How it works:**
1. All tenant-scoped data includes a `tenantId` foreign key
2. Every query must filter by `tenantId` (enforced by Prisma middleware)
3. Users table is shared (cross-tenant accounts)
4. TenantMember join table tracks user roles per tenant

**Pros:**
- ✅ Simple deployment (one database, one connection string)
- ✅ Cross-tenant queries trivial (user sees all bookings)
- ✅ Cost-efficient (shared resources)
- ✅ Better Auth compatibility (auth tables stay simple)
- ✅ Easy to scale with partitioning later

**Cons:**
- ⚠️ Risk of data leakage if filter missed (mitigated with middleware)
- ⚠️ Performance degrades with massive row counts (partition at 1M+ rows)
- ⚠️ Cannot offer per-tenant DB for enterprise (future enhancement)

**Security Measures:**
1. **Prisma Middleware** - Auto-inject `tenantId` filter
2. **NestJS Guard** - Validate user has role for current tenant
3. **Repository Pattern** - All queries go through tenant-aware repositories
4. **Custom Decorator** - `@CurrentTenant()` enforces tenant context
5. **Database Indexes** - Composite indexes on `(tenantId, createdAt)` for all tenant tables

### Alternative Considered: Database-Per-Tenant

**Not chosen for initial launch** because:
- Complex migration management (N schemas)
- Harder cross-tenant features
- Higher infrastructure cost
- Connection pool exhaustion

**When to reconsider:** If an enterprise tenant demands isolated DB for compliance, offer as premium tier.

---

## Data Model & Schema

### Core Entities

```
Users (Shared)
  ↓
TenantMembers (Join Table) ← Links users to tenants with roles,
  │                           optionally scoped to one venue
  ↓
Tenants (Business / billing root — one RallyHub account)
  ↓
Venues (Physical location — a tenant may have 1..N) ← subdomain lives here
  ↓
├── Courts (venueId + tenantId)
├── Bookings (venueId + tenantId)
├── PricingRules (venueId + tenantId)
└── TenantSchedules (venueId + tenantId)
```

Every model under `Venue` keeps `tenantId` as well (denormalized), so the
existing tenant-isolation middleware keeps working unchanged — `venueId`
just narrows further, within a tenant, to one physical location. A tenant
with exactly one venue (the common case at launch) behaves identically to
the original single-level design; nothing changes for that case except an
extra foreign key.

### Complete Prisma Schema

```prisma
// ============================================================================
// SHARED MODELS (No tenantId - shared across all tenants)
// ============================================================================

model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  tenantMembers TenantMember[]
  bookings      Booking[]

  @@index([email])
}

model Account {
  id                String   @id @default(uuid())
  userId            String
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  idToken           String?
  expiresAt         DateTime?
  password          String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, accountId])
  @@index([userId])
}

model Session {
  id          String   @id @default(uuid())
  token       String   @unique
  userId      String
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  ipAddress   String?
  userAgent   String?

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model Verification {
  id         String   @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([identifier, value])
}

// ============================================================================
// TENANT ROOT MODEL (the business / billing account)
// ============================================================================

model Tenant {
  id              String        @id @default(uuid())
  name            String                          // Business name, e.g. "Cebu Sports Group"
  status          TenantStatus  @default(PENDING)

  // Contact (billing / business-level — not tied to any one location)
  email           String?
  phone           String?

  // Branding (brand-wide default; a venue can override with its own photos)
  primaryColor    String?       // Hex color for theming

  // Metadata
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  members         TenantMember[]
  venues          Venue[]
  courts          Court[]
  bookings        Booking[]
  pricingRules    PricingRule[]
  schedules       TenantSchedule[]

  @@index([status])
}

enum TenantStatus {
  PENDING       // Awaiting first venue to finish setup
  ACTIVE        // At least one venue is live
  SUSPENDED     // Temporarily disabled (billing, ToS)
  INACTIVE      // Permanently closed
}

// ============================================================================
// VENUE MODEL (a physical location, owned by exactly one Tenant)
// ============================================================================

model Venue {
  id              String        @id @default(uuid())
  tenantId        String
  name            String                          // "Downtown", "Westside" — distinguishes venues under one tenant
  slug            String        @unique           // For subdomain (e.g., "cebu-club-downtown")
  status          VenueStatus   @default(PENDING)

  // Location
  address         String?
  city            String?
  state           String?
  zipCode         String?
  country         String        @default("PH")
  timezone        String        @default("Asia/Manila")

  // Contact
  phone           String?
  email           String?
  website         String?

  // Branding
  logo            String?       // URL to logo image
  coverImage      String?       // URL to cover/hero image
  description     String?       @db.Text

  // Metadata
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  courts          Court[]
  bookings        Booking[]
  pricingRules    PricingRule[]
  schedules       TenantSchedule[]

  @@index([tenantId])
  @@index([slug])
  @@index([status])
}

enum VenueStatus {
  PENDING       // Awaiting setup completion
  ACTIVE        // Live and bookable
  SUSPENDED     // Temporarily disabled
  INACTIVE      // Permanently closed
}

// ============================================================================
// TENANT-SCOPED MODELS (all include tenantId, denormalized from venue, so
// the existing tenant-isolation middleware keeps working unchanged; the
// ones tied to a physical location also carry venueId to narrow further)
// ============================================================================

model TenantMember {
  id        String      @id @default(uuid())
  userId    String
  tenantId  String
  venueId   String?                                // null = access to every venue under this tenant (typically OWNER); set = scoped to one venue (typically STAFF)
  role      TenantRole
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant    Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId, venueId])
  @@index([tenantId])
  @@index([userId])
  @@index([tenantId, role])
}

enum TenantRole {
  OWNER         // Full access: settings, billing, all venues, courts, bookings
  STAFF         // Limited access: view bookings, check-in players — usually scoped to one venue
}

model Court {
  id          String      @id @default(uuid())
  tenantId    String                          // denormalized from venue
  venueId     String
  name        String                          // "Court 1", "Main Court"
  courtType   CourtType
  isIndoor    Boolean     @default(false)
  surface     String?                         // "Hardcourt", "Cushioned"
  status      CourtStatus @default(ACTIVE)
  image       String?                         // Court photo URL
  description String?     @db.Text
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue       Venue       @relation(fields: [venueId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@index([tenantId])
  @@index([venueId])
  @@index([venueId, status])
}

enum CourtType {
  SINGLES           // Singles-only court
  DOUBLES           // Doubles-only court
  MULTI_PURPOSE     // Can be used for both
}

enum CourtStatus {
  ACTIVE            // Available for booking
  MAINTENANCE       // Temporarily unavailable
  INACTIVE          // Permanently unavailable
}

model Booking {
  id              String        @id @default(uuid())
  tenantId        String                          // denormalized from venue
  venueId         String                          // denormalized from court
  courtId         String
  userId          String

  // Time slot
  startTime       DateTime
  endTime         DateTime

  // Pricing
  totalPrice      Decimal       @db.Decimal(10, 2)

  // Payment
  isPaid          Boolean       @default(false)
  paidAt          DateTime?

  // Booking lifecycle
  status          BookingStatus @default(CONFIRMED)
  checkedInAt     DateTime?
  cancelledAt     DateTime?
  cancellationReason String?    @db.Text

  // Metadata
  notes           String?       @db.Text
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue           Venue         @relation(fields: [venueId], references: [id], onDelete: Cascade)
  court           Court         @relation(fields: [courtId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, startTime])
  @@index([venueId, startTime])
  @@index([userId])
  @@index([courtId, startTime])
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
}

enum BookingStatus {
  CONFIRMED         // Booking confirmed, payment captured
  COMPLETED         // User checked in or time passed
  CANCELLED         // User or tenant cancelled
  NO_SHOW           // User didn't show up
}

enum PaymentStatus {
  PENDING           // Payment not yet processed
}

model PricingRule {
  id              String    @id @default(uuid())
  tenantId        String                        // denormalized from venue
  venueId         String                        // pricing is set per physical location, not per business
  name            String                        // "Weekday Mornings", "Peak Hours"

  // When this rule applies
  dayOfWeek       Int?                          // 0-6 (Sun-Sat), null = all days
  startTime       String?                       // "09:00" (24h format)
  endTime         String?                       // "17:00"

  // Date range (optional, for special events/seasons)
  validFrom       DateTime?
  validUntil      DateTime?

  // Pricing
  pricePerHour    Decimal   @db.Decimal(10, 2)

  // Priority (higher number = higher priority, for overlapping rules)
  priority        Int       @default(0)

  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue           Venue     @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([venueId, isActive])
}

model TenantSchedule {
  id          String    @id @default(uuid())
  tenantId    String                            // denormalized from venue
  venueId     String                            // hours of operation are per physical location
  dayOfWeek   Int                               // 0-6 (Sun-Sat)
  openTime    String                            // "06:00" (24h format)
  closeTime   String                            // "22:00"
  isClosed    Boolean   @default(false)         // Venue closed this day
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue       Venue     @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@unique([venueId, dayOfWeek])
  @@index([tenantId])
  @@index([venueId])
}

// ============================================================================
// BILLING & SUBSCRIPTION (Future)
// ============================================================================

model Subscription {
  id                  String              @id @default(uuid())
  tenantId            String
  plan                SubscriptionPlan
  status              SubscriptionStatus
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  cancelAtPeriodEnd   Boolean            @default(false)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([tenantId])
}

enum SubscriptionPlan {
  STARTER         // $29/mo + 8% per booking
  PRO             // $79/mo + 5% per booking
  ENTERPRISE      // Custom pricing
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}
```

### Field-Level Details

| Model | Field | Purpose | Constraints |
|-------|-------|---------|-------------|
| **Tenant** | `status` | Business-account lifecycle state | PENDING (no live venue yet), ACTIVE, SUSPENDED, INACTIVE |
| **Venue** | `slug` | URL-safe location identifier for subdomain | Unique, lowercase, alphanumeric + hyphens |
| **Venue** | `status` | This location's lifecycle state | PENDING (setup), ACTIVE (live), SUSPENDED, INACTIVE |
| **TenantMember** | `role` | User's permission level for this tenant | OWNER (full access), STAFF (bookings only), CUSTOMER (can book) |
| **TenantMember** | `venueId` | Scopes the role to one venue instead of the whole tenant | Nullable — null means all venues under the tenant |
| **Court** | `courtType` | Court size/usage | SINGLES, DOUBLES, MULTI_PURPOSE |
| **Booking** | `
| **Booking** | `
| **PricingRule** | `priority` | For overlapping rules (e.g., holiday override) | Higher number wins |
| **TenantSchedule** | `dayOfWeek` | 0 = Sunday, 6 = Saturday | Matches JavaScript Date.getDay() |

---

## Entity Relationship Diagrams

### High-Level ERD

```
┌─────────────────────────────────────────────────────────────────┐
│                      SHARED DOMAIN                               │
│                                                                  │
│  ┌────────────┐                                                 │
│  │   User     │                                                 │
│  │────────────│                                                 │
│  │ id  (PK)   │                                                 │
│  │ email      │                                                 │
│  │ name       │                                                 │
│  └────────────┘                                                 │
│       │                                                          │
│       │ 1:N                                                      │
│       ↓                                                          │
│  ┌────────────┐        ┌────────────┐        ┌──────────────┐  │
│  │  Account   │        │  Session   │        │Verification  │  │
│  │────────────│        │────────────│        │──────────────│  │
│  │ id  (PK)   │        │ id  (PK)   │        │ id  (PK)     │  │
│  │ userId (FK)│        │ userId (FK)│        │ identifier   │  │
│  │ providerId │        │ token      │        │ value        │  │
│  └────────────┘        └────────────┘        └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ N:M (via TenantMember)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TENANT DOMAIN                               │
│                                                                  │
│  ┌────────────────┐                                             │
│  │     Tenant     │  ← the business / billing account           │
│  │────────────────│                                             │
│  │ id  (PK)       │                                             │
│  │ name           │                                             │
│  │ status         │                                             │
│  └────────────────┘                                             │
│         │                                                        │
│         │ 1:N  (a tenant may own several venues)                 │
│         ↓                                                        │
│  ┌────────────────┐                                             │
│  │     Venue      │  ← one physical location                    │
│  │────────────────│                                             │
│  │ id  (PK)       │                                             │
│  │ tenantId (FK)  │                                             │
│  │ slug (UNIQUE)  │ ← Used for subdomain routing                │
│  │ status         │                                             │
│  └────────────────┘                                             │
│         │                                                        │
│         │ 1:N                                                    │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │ │TenantMember  │  │   Court      │  │PricingRule    │  │  │
│  │ │──────────────│  │──────────────│  │───────────────│  │  │
│  │ │ id  (PK)     │  │ id  (PK)     │  │ id  (PK)      │  │  │
│  │ │ userId (FK)  │  │ tenantId(FK) │  │ tenantId (FK) │  │  │
│  │ │ tenantId(FK) │  │ venueId (FK) │  │ venueId (FK)  │  │  │
│  │ │ venueId(FK?) │  │ name         │  │ pricePerHour  │  │  │
│  │ │ role         │  │ courtType    │  │ dayOfWeek     │  │  │
│  │ └──────────────┘  │ status       │  │ startTime     │  │  │
│  │        ↑          └──────────────┘  └───────────────┘  │  │
│  │        │                   │                            │  │
│  │        │                   │ 1:N                        │  │
│  │        │                   ↓                            │  │
│  │   Links User    ┌──────────────────┐                   │  │
│  │   to Tenant,    │     Booking      │                   │  │
│  │   optionally    │──────────────────│                   │  │
│  │   one Venue     │ id  (PK)         │                   │  │
│  │                 │ tenantId (FK)    │                   │  │
│  │                 │ venueId (FK)     │                   │  │
│  │                 │ courtId (FK)     │                   │  │
│  │                 │ userId (FK)      │                   │  │
│  │                 │ startTime        │                   │  │
│  │                 │ endTime          │                   │  │
│  │                 │ totalPrice       │                   │  │
│  │                 │ status           │                   │  │
│  │                 └──────────────────┘                   │  │
│  │                          ↑                             │  │
│  │                          │                             │  │
│  │                          └─ References User (shared)   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ TenantSchedule   │  ← hours of operation, per venue          │
│  │──────────────────│                                          │
│  │ id  (PK)         │                                          │
│  │ tenantId (FK)    │                                          │
│  │ venueId (FK)     │                                          │
│  │ dayOfWeek        │                                          │
│  │ openTime         │                                          │
│  │ closeTime        │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Booking Flow ERD

```
User creates booking → Pricing calculation → Payment → Booking created

┌──────┐
│ User │
└───┬──┘
    │ 1. Browse courts at cebu-club.rallyhub.com
    │
    ↓
┌────────────────────────────────────────────────┐
│ GET /courts?tenantId=xxx                       │
│ → Returns all ACTIVE courts for venue          │
└────────────────────────────────────────────────┘
    │
    │ 2. Select court + time slot
    │
    ↓
┌────────────────────────────────────────────────┐
│ GET /courts/:id/availability                   │
│   ?date=2026-09-20&tenantId=xxx               │
│                                                │
│ Query:                                         │
│ SELECT * FROM Booking                          │
│ WHERE courtId = :id                            │
│   AND tenantId = :tenantId                     │
│   AND startTime <= :endOfDay                   │
│   AND endTime >= :startOfDay                   │
│                                                │
│ → Returns blocked time slots                   │
└────────────────────────────────────────────────┘
    │
    │ 3. Calculate price
    │
    ↓
┌────────────────────────────────────────────────┐
│ POST /bookings/calculate-price                 │
│   { courtId, tenantId, startTime, endTime }   │
│                                                │
│ Logic:                                         │
│ 1. Get duration (hours)                        │
│ 2. Find matching PricingRule:                  │
│    - dayOfWeek matches                         │
│    - time range overlaps                       │
│    - isActive = true                           │
│    - ORDER BY priority DESC                    │
│ 3. price = duration * pricePerHour            │
│                                                │
│ → Returns { totalPrice, breakdown }            │
└────────────────────────────────────────────────┘
    │
    │
    ↓
┌────────────────────────────────────────────────┐
│ POST /bookings                                 │
│   { courtId, tenantId, startTime, endTime }   │
│                                                │
│ Logic:                                         │
│ 1. Validate time slot not taken               │
│ 2. Calculate price                             │
│ 3. Calculate 
│ 4. 
│ 6. Create Booking (status=CONFIRMED)          │
│                                                │
│ → Returns { booking, clientSecret }            │
└────────────────────────────────────────────────┘
    │
    │ 5. User completes payment (frontend)
    │
    ↓
┌────────────────────────────────────────────────┐
│                                                │
│ Logic:                                         │
│ 1. Find booking by isPaid          Boolean       @default(false)
│ 2. Update paidAt          DateTime?
│ 3. Send confirmation email                     │
│ 4. Transfer 
└────────────────────────────────────────────────┘
```

### TenantMember Role Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                   TenantMember Role Matrix                       │
│                                                                  │
│  User ──┬── TenantMember (Cebu Sports Group, role=OWNER,      │
│         │                 venueId=null → all venues)            │
│         │                                                        │
│         ├── TenantMember (Downtown Courts Inc., role=STAFF,    │
│         │                 venueId=<Westside venue> → one venue) │
│         │                                                        │
│         └── TenantMember (Manila Pickle Co., role=CUSTOMER,     │
│                            venueId=null → can book any of its   │
│                            venues)                               │
│                                                                  │
│  Note: the same person can hold different roles at different    │
│  tenants (owns one business, staffs another, books at a third), │
│  and within one tenant a STAFF row can be scoped to a single     │
│  venue while an OWNER row typically is not.                     │
│                                                                  │
│  Permissions by role:                                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              OWNER (Full Access)                       │    │
│  │────────────────────────────────────────────────────────│    │
│  │ ✅ Edit venue settings                                 │    │
│  │ ✅ Add/remove courts                                   │    │
│  │ ✅ Set pricing rules                                   │    │
│  │ ✅ Configure schedule                                  │    │
│  │ ✅ View all bookings                                   │    │
│  │ ✅ Cancel any booking                                  │    │
│  │ ✅ Invite staff members                                │    │
│  │ ✅ Access billing & payouts                            │    │
│  │ ✅ View analytics                                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              STAFF (Limited Access)                    │    │
│  │────────────────────────────────────────────────────────│    │
│  │ ✅ View all bookings                                   │    │
│  │ ✅ Check in players                                    │    │
│  │ ✅ Mark no-shows                                       │    │
│  │ ❌ Edit venue settings                                 │    │
│  │ ❌ Access billing                                      │    │
│  │ ❌ Add/remove courts                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              CUSTOMER (Self-Service Only)              │    │
│  │────────────────────────────────────────────────────────│    │
│  │ ✅ Book courts                                         │    │
│  │ ✅ View own bookings                                   │    │
│  │ ✅ Cancel own bookings (per policy)                   │    │
│  │ ❌ View other bookings                                 │    │
│  │ ❌ Access admin features                               │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Routing & Domain Strategy

### Domain Structure

```
Production Domains:
├── rallyhub.com                      → Marketing site (Next.js)
│   ├── /                            → Landing page
│   ├── /venues                      → Venue directory
│   ├── /pricing                     → Pricing page
│   └── /for-venues                  → Venue owner signup
│
├── app.rallyhub.com                 → User dashboard (Next.js)
│   ├── /bookings                    → All user bookings (cross-venue)
│   ├── /settings                    → User settings
│   └── /payment-methods             → Saved payment methods
│
└── *.rallyhub.com                   → Venue-specific booking (Next.js)
    └── cebu-club.rallyhub.com
        ├── /                        → Court browser
        ├── /courts/:id              → Court detail + booking
        ├── /about                   → Venue info
        └── /admin                   → Venue management (OWNER/STAFF only)
            ├── /courts              → Manage courts
            ├── /bookings            → All bookings
            ├── /pricing             → Pricing rules
            ├── /schedule            → Hours of operation
            ├── /settings            → Venue settings
            └── /analytics           → Booking metrics
```

### Next.js Middleware (Tenant Resolution)

**File:** `apps/web/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

const VENUE_CACHE = new Map<string, { id: string; slug: string }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const subdomain = extractSubdomain(host)

  // Marketing site (no subdomain or 'www')
  if (!subdomain || subdomain === 'www') {
    return NextResponse.next()
  }

  // User dashboard (app.rallyhub.com)
  if (subdomain === 'app') {
    return NextResponse.next()
  }

  // Venue subdomain - resolve the venue, and the tenant that owns it
  const venue = await resolveVenue(subdomain)

  if (!venue) {
    // Unknown subdomain - redirect to venue directory
    return NextResponse.redirect(new URL('/venues', request.url))
  }

  // Inject tenant + venue context into headers for API calls
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', venue.tenantId)
  response.headers.set('x-venue-id', venue.id)
  response.headers.set('x-venue-slug', venue.slug)

  return response
}

function extractSubdomain(host: string): string | null {
  const parts = host.split('.')

  // localhost:3000 → no subdomain
  if (parts.length === 1) return null

  // cebu-club.rallyhub.com → "cebu-club"
  if (parts.length >= 3) return parts[0]

  return null
}

async function resolveVenue(slug: string): Promise<{ id: string; slug: string; tenantId: string } | null> {
  // Check cache first
  const cached = VENUE_CACHE.get(slug)
  if (cached) return cached

  // Fetch from API — venues, not tenants, own the subdomain slug
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL}/venues/by-slug/${slug}`)

    if (!response.ok) return null

    const venue = await response.json()

    // Cache result
    const resolved = { id: venue.id, slug: venue.slug, tenantId: venue.tenantId }
    VENUE_CACHE.set(slug, resolved)

    // Clear cache after TTL
    setTimeout(() => VENUE_CACHE.delete(slug), CACHE_TTL)

    return resolved
  } catch (error) {
    console.error('Failed to resolve venue:', error)
    return null
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
```

### Vercel Configuration

**File:** `vercel.json`

```json
{
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        {
          "key": "X-DNS-Prefetch-Control",
          "value": "on"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/",
      "has": [
        {
          "type": "host",
          "value": "www.rallyhub.com"
        }
      ],
      "destination": "https://rallyhub.com",
      "permanent": true
    }
  ]
}
```

**DNS Setup:**

```
Type    Name        Value
────────────────────────────────────────────────
A       @           76.76.21.21 (Vercel IP)
A       *           76.76.21.21 (Wildcard for subdomains)
CNAME   www         cname.vercel-dns.com
```

**SSL Certificate:** Vercel automatically provisions SSL for `*.rallyhub.com`

---

## Authentication & Authorization

### User Authentication Flow (Better Auth)

```
1. User visits cebu-club.rallyhub.com
   ↓
2. Clicks "Sign In" or "Book Court"
   ↓
3. Redirected to /sign-in (shared across all subdomains)
   ↓
4. Options:
   - Email + Password
   - Google OAuth
   ↓
5. Better Auth creates session
   ↓
6. Session cookie set (domain: .rallyhub.com)
   ← Cookie accessible across all subdomains
   ↓
7. Redirect back to original subdomain
   ↓
8. User is now authenticated across all venues
```

**Session Cookie Configuration:**

```typescript
// apps/api/src/auth/auth.ts
export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    // ...
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieName: 'rallyhub_session',
      cookieOptions: {
        domain: process.env.NODE_ENV === 'production'
          ? '.rallyhub.com'  // Accessible across all subdomains
          : 'localhost',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
  })
}
```

### Authorization: Tenant-Scoped Roles

**NestJS Guard:** `@TenantRoles()`

```typescript
// apps/api/src/auth/tenant-roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TenantRole } from '@prisma/client'
import { TenantMemberRepository } from '../users/tenant-member.repository'

@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantMemberRepo: TenantMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<TenantRole[]>(
      'tenantRoles',
      context.getHandler(),
    )

    if (!requiredRoles) {
      return true // No role restriction
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user
    const tenantId = request.tenantId

    if (!user || !tenantId) {
      return false
    }

    // Check if user has required role for this tenant
    const membership = await this.tenantMemberRepo.findByUserAndTenant(
      user.id,
      tenantId,
    )

    if (!membership) {
      return false // User not a member of this tenant
    }

    return requiredRoles.includes(membership.role)
  }
}
```

**Custom Decorator:**

```typescript
// apps/api/src/auth/tenant-roles.decorator.ts
import { SetMetadata } from '@nestjs/common'
import { TenantRole } from '@prisma/client'

export const TenantRoles = (...roles: TenantRole[]) =>
  SetMetadata('tenantRoles', roles)
```

**Usage in Controllers:**

```typescript
// apps/api/src/tenants/tenants.controller.ts
@Controller('tenants')
export class TenantsController {

  // Anyone can view venue details
  @Get(':id')
  async getTenant(@Param('id') id: string) {
    return this.tenantsService.findById(id)
  }

  // Only OWNER can update venue settings
  @Patch(':id')
  @TenantRoles(TenantRole.OWNER)
  async updateTenant(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    if (id !== tenantId) {
      throw new ForbiddenException('Cannot modify other venues')
    }
    return this.tenantsService.update(id, dto)
  }

  // OWNER and STAFF can view all bookings
  @Get(':id/bookings')
  @TenantRoles(TenantRole.OWNER, TenantRole.STAFF)
  async getBookings(@CurrentTenant() tenantId: string) {
    return this.bookingsService.findByTenant(tenantId)
  }
}
```

---

## API Design & Tenant Context

### Tenant Context Injection

**NestJS Middleware:**

```typescript
// apps/api/src/common/middleware/tenant-context.middleware.ts
import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { VenuesRepository } from '../../venues/venues.repository'

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private venuesRepo: VenuesRepository) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Priority 1: Subdomain resolution — the slug lives on Venue, not Tenant
    const host = req.headers.host || ''
    const subdomain = this.extractSubdomain(host)

    if (subdomain && subdomain !== 'app' && subdomain !== 'www') {
      const venue = await this.venuesRepo.findBySlug(subdomain)
      if (venue) {
        req['tenantId'] = venue.tenantId
        req['venueId'] = venue.id
        req['venue'] = venue
        return next()
      }
    }

    // Priority 2: X-Venue-Id header (for testing/API clients)
    const venueIdHeader = req.headers['x-venue-id'] as string
    if (venueIdHeader) {
      const venue = await this.venuesRepo.findById(venueIdHeader)
      if (venue) {
        req['tenantId'] = venue.tenantId
        req['venueId'] = venue.id
        req['venue'] = venue
        return next()
      }
    }

    // Fallback: X-Tenant-Id header (for tenant-level endpoints with no venue in scope)
    const tenantIdHeader = req.headers['x-tenant-id'] as string
    if (tenantIdHeader) {
      req['tenantId'] = tenantIdHeader
      return next()
    }

    // No tenant context found - OK for non-tenant endpoints
    next()
  }

  private extractSubdomain(host: string): string | null {
    const parts = host.split('.')
    if (parts.length >= 3) return parts[0]
    return null
  }
}
```

**Register Middleware:**

```typescript
// apps/api/src/app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes('*') // Apply to all routes
  }
}
```

**Custom Parameter Decorators:**

```typescript
// apps/api/src/common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common'

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()

    if (!request.tenantId) {
      throw new BadRequestException(
        'Tenant context required. This endpoint must be called with a valid tenant context (subdomain, X-Venue-Id, or X-Tenant-Id header).'
      )
    }

    return request.tenantId
  },
)

// apps/api/src/common/decorators/current-venue.decorator.ts
export const CurrentVenue = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()

    if (!request.venueId) {
      throw new BadRequestException(
        'Venue context required. This endpoint must be called with a valid venue in scope (subdomain or X-Venue-Id header) — a bare tenantId is not enough.'
      )
    }

    return request.venueId
  },
)
```

Use `@CurrentTenant()` for business-level endpoints (billing, tenant settings, listing all of a tenant's venues) and `@CurrentVenue()` for anything tied to one physical location (courts, bookings, pricing, schedules) — most of the routes elsewhere in this document that read `@CurrentTenant() tenantId` for a court/booking/pricing/schedule endpoint should now read `@CurrentVenue() venueId` instead; they predate this section and haven't all been individually rewritten.

### Prisma Middleware (Auto-Filter Enforcement)

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from './generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()

    // Register middleware to enforce tenantId filtering
    this.$use(async (params, next) => {
      const tenantModels = [
        'Venue',
        'Court',
        'Booking',
        'PricingRule',
        'TenantSchedule',
        'TenantMember',
      ]

      // Only apply to tenant-scoped models
      if (!tenantModels.includes(params.model || '')) {
        return next(params)
      }

      // Read operations: ensure tenantId filter exists
      if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
        // Skip if already filtered by tenantId
        if (params.args?.where?.tenantId) {
          return next(params)
        }

        // CRITICAL: Do NOT auto-inject tenantId on reads
        // Instead, throw error to catch missing filters during development
        console.warn(
          `⚠️  Query on ${params.model} without tenantId filter. This may leak data across tenants.`,
          JSON.stringify(params.args, null, 2)
        )
      }

      // Write operations: ensure tenantId is set
      if (['create', 'update', 'upsert', 'delete', 'deleteMany'].includes(params.action)) {
        if (params.action === 'create' || params.action === 'upsert') {
          if (!params.args?.data?.tenantId) {
            throw new Error(
              `tenantId is required when creating ${params.model} records`
            )
          }
        }
      }

      return next(params)
    })
  }
}
```

**Repository Pattern (Tenant-Aware Base):**

```typescript
// apps/api/src/common/repositories/tenant-repository.base.ts
export abstract class TenantRepository<T> {
  constructor(
    protected prisma: PrismaService,
    private modelName: string,
  ) {}

  async findMany(tenantId: string, where: any = {}) {
    return this.prisma[this.modelName].findMany({
      where: { ...where, tenantId },
    })
  }

  async findById(tenantId: string, id: string) {
    return this.prisma[this.modelName].findUnique({
      where: { id, tenantId },
    })
  }

  async create(tenantId: string, data: any) {
    return this.prisma[this.modelName].create({
      data: { ...data, tenantId },
    })
  }

  async update(tenantId: string, id: string, data: any) {
    return this.prisma[this.modelName].update({
      where: { id, tenantId },
      data,
    })
  }

  async delete(tenantId: string, id: string) {
    return this.prisma[this.modelName].delete({
      where: { id, tenantId },
    })
  }
}
```

**Example Usage:**

```typescript
// apps/api/src/courts/courts.repository.ts
@Injectable()
export class CourtsRepository extends TenantRepository<Court> {
  constructor(prisma: PrismaService) {
    super(prisma, 'court')
  }

  async findActiveByTenant(tenantId: string) {
    return this.findMany(tenantId, { status: CourtStatus.ACTIVE })
  }
}

// apps/api/src/courts/courts.controller.ts
@Controller('courts')
export class CourtsController {
  constructor(private courtsRepo: CourtsRepository) {}

  @Get()
  async getCourts(@CurrentTenant() tenantId: string) {
    return this.courtsRepo.findActiveByTenant(tenantId)
  }
}
```

---

## Onboarding Flow

### Venue Owner Journey

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Discovery & Signup                                       │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ User visits: rallyhub.com/for-venues                             │
│                                                                   │
│ Landing page highlights:                                          │
│ • "List your venue in minutes"                                   │
│ • "Accept online bookings 24/7"                                  │
│ • "Manage courts, pricing, and schedules"                        │
│ • Pricing: $29-79/mo + 5-8% per booking                          │
│                                                                   │
│ CTA: "Get Started" → /venues/create                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Create Account                                           │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ Better Auth Signup:                                               │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Email: _______________________________________________     │  │
│ │ Password: _____________________________________________     │  │
│ │                                                            │  │
│ │ OR                                                         │  │
│ │ [ Continue with Google ]                                   │  │
│ │                                                            │  │
│ │ [ Create Account ]                                         │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ → User record created in database                                │
│ → Email verification sent (if using email/password)              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Create Venue                                             │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ Form: /venues/create                                              │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Venue Name: ___________________________________________     │  │
│ │ Slug: _________________ (auto-generated from name)         │  │
│ │                                                            │  │
│ │ Address: _______________________________________________    │  │
│ │ City: ___________________ State: _____ ZIP: ________       │  │
│ │                                                            │  │
│ │ Phone: _________________ Email: ____________________       │  │
│ │                                                            │  │
│ │ Timezone: [ America/New_York ▼ ]                           │  │
│ │                                                            │  │
│ │ [ Create Venue ]                                           │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ Validation:                                                       │
│ • Slug uniqueness check (AJAX)                                   │
│ • Address format validation                                      │
│ • Phone format validation                                        │
│                                                                   │
│ On submit (first venue for this user):                           │
│ 1. Create Tenant record (status=PENDING) — the business account │
│ 2. Create Venue record (tenantId, status=PENDING)                │
│ 3. Create TenantMember (userId, tenantId, venueId=null,          │
│    role=OWNER) — OWNER is tenant-wide, not venue-scoped          │
│ 4. Redirect to {slug}.rallyhub.com/setup                         │
│                                                                   │
│ Adding a 2nd+ venue to an existing tenant skips steps 1 & 3 —    │
│ reuses the caller's Tenant and existing OWNER membership.        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: Setup Wizard (cebu-club.rallyhub.com/setup)           │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ Progress: [●○○○] 1 of 4                                          │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Add Your Courts                                            │  │
│ │                                                            │  │
│ │ Court 1:                                                   │  │
│ │   Name: _____________________                              │  │
│ │   Type: [ ● Doubles  ○ Singles  ○ Multi-purpose ]         │  │
│ │   Indoor: [ ✓ ]                                            │  │
│ │                                                            │  │
│ │ [ + Add Another Court ]                                    │  │
│ │                                                            │  │
│ │ [ Continue ]                                               │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ Progress: [●●○○] 2 of 4                                          │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Set Your Hours                                             │  │
│ │                                                            │  │
│ │ Monday:    [ 06:00 ] to [ 22:00 ]  [ ○ Closed ]          │  │
│ │ Tuesday:   [ 06:00 ] to [ 22:00 ]  [ ○ Closed ]          │  │
│ │ Wednesday: [ 06:00 ] to [ 22:00 ]  [ ○ Closed ]          │  │
│ │ Thursday:  [ 06:00 ] to [ 22:00 ]  [ ○ Closed ]          │  │
│ │ Friday:    [ 06:00 ] to [ 22:00 ]  [ ○ Closed ]          │  │
│ │ Saturday:  [ 08:00 ] to [ 20:00 ]  [ ○ Closed ]          │  │
│ │ Sunday:    [ 08:00 ] to [ 20:00 ]  [ ○ Closed ]          │  │
│ │                                                            │  │
│ │ [ Continue ]                                               │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ Progress: [●●●○] 3 of 4                                          │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Configure Pricing                                          │  │
│ │                                                            │  │
│ │ Default Price: $_____ per hour                             │  │
│ │                                                            │  │
│ │ Advanced Pricing Rules:                                    │  │
│ │                                                            │  │
│ │ Peak Hours (Mon-Fri, 5pm-9pm):                            │  │
│ │   $_____ per hour                                          │  │
│ │                                                            │  │
│ │ [ + Add Pricing Rule ]                                     │  │
│ │                                                            │  │
│ │ [ Continue ]                                               │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ Progress: [●●●●] 4 of 4                                          │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │                                                            │  │
│ │ Customers pay via card, funds go directly to you.         │  │
│ │                                                            │  │
│ │ Platform fee: 8% per booking                               │  │
│ │                                                            │  │
│ │                                                            │  │
│ │ OR                                                         │  │
│ │                                                            │  │
│ │ [ Skip for Now ] (can connect later)                      │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Venue Published                                          │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 🎉 Your venue is live!                                     │  │
│ │                                                            │  │
│ │ Venue URL: cebu-club.rallyhub.com                        │  │
│ │                                                            │  │
│ │ Next steps:                                                │  │
│ │ • Share your booking link with members                     │  │
│ │ • Upload photos & logo                                     │  │
│ │ • Invite staff members                                     │  │
│ │                                                            │  │
│ │ [ Go to Dashboard ]  [ Share Link ]                        │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ Database changes:                                                 │
│ • Venue.status → ACTIVE                                           │
│ • Venue appears in rallyhub.com/venues directory                 │
└──────────────────────────────────────────────────────────────────┘
```

### API Endpoints for Onboarding

```typescript
// POST /tenants
// Creates the business account only — no venue yet
{
  "name": "Cebu Sports Group"
}
// → { id: "tenant-uuid", status: "PENDING" }
// Also creates a TenantMember(userId, tenantId, venueId=null, role=OWNER)

// POST /venues
// Creates a venue under an existing tenant and assigns the caller as its OWNER
// (if this is the caller's first venue, the frontend calls POST /tenants first,
// as in Step 3 above; adding a 2nd+ venue skips straight to this call)
{
  "tenantId": "tenant-uuid",
  "name": "Cebu Pickleball Club - Downtown",
  "slug": "cebu-club",  // Validated for uniqueness
  "address": "123 Main St",
  "city": "Cebu",
  "state": "TX",
  "zipCode": "78701",
  "phone": "+1-512-555-0100",
  "email": "info@cebuclub.com",
  "timezone": "America/Chicago"
}

// POST /courts
// Creates courts for a venue
{
  "tenantId": "tenant-uuid",
  "venueId": "venue-uuid",
  "name": "Court 1",
  "courtType": "DOUBLES",
  "isIndoor": true
}

// POST /tenant-schedules/bulk
// Sets hours for all 7 days, for one venue
{
  "tenantId": "tenant-uuid",
  "venueId": "venue-uuid",
  "schedules": [
    { "dayOfWeek": 0, "openTime": "08:00", "closeTime": "20:00" },
    { "dayOfWeek": 1, "openTime": "06:00", "closeTime": "22:00" },
    // ... 7 total
  ]
}

// POST /pricing-rules
// Sets pricing rules, for one venue
{
  "tenantId": "tenant-uuid",
  "venueId": "venue-uuid",
  "name": "Default",
  "pricePerHour": 40.00,
  "isActive": true
}

{
  "returnUrl": "https://cebu-club.rallyhub.com/setup/complete",
}

// PATCH /venues/:id/publish
// Marks the venue as ACTIVE and publishable
{
  "status": "ACTIVE"
}
```

---

## Billing & Pricing Model

### Pricing Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                        STARTER PLAN                              │
│                        $29/month                                 │
│─────────────────────────────────────────────────────────────────│
│ ✅ Up to 3 courts                                                │
│ ✅ Unlimited bookings                                            │
│ ✅ Basic pricing rules (1 default + 2 custom)                   │
│ ✅ Weekly schedule                                               │
│ ✅ Email notifications                                           │
│ ✅ Basic analytics                                               │
│ ❌ Staff accounts                                                │
│ ❌ Advanced pricing rules                                        │
│ ❌ API access                                                    │
│                                                                   │
│ Platform fee: 8% per booking                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        PRO PLAN                                  │
│                        $79/month                                 │
│─────────────────────────────────────────────────────────────────│
│ ✅ Unlimited courts                                              │
│ ✅ Unlimited bookings                                            │
│ ✅ Unlimited pricing rules                                       │
│ ✅ Multi-day availability                                        │
│ ✅ Up to 5 staff accounts                                        │
│ ✅ Advanced analytics & reports                                  │
│ ✅ Custom branding (logo, colors)                                │
│ ✅ Priority support                                              │
│ ❌ API access                                                    │
│ ❌ Custom domain                                                 │
│                                                                   │
│ Platform fee: 5% per booking                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE PLAN                           │
│                        Custom Pricing                            │
│─────────────────────────────────────────────────────────────────│
│ ✅ Everything in Pro                                             │
│ ✅ Unlimited staff accounts                                      │
│ ✅ API access                                                    │
│ ✅ Custom domain (booking.yourvenue.com)                         │
│ ✅ SSO / SAML integration                                        │
│ ✅ Dedicated account manager                                     │
│ ✅ SLA guarantee                                                 │
│ ✅ White-label option                                            │
│                                                                   │
│ Platform fee: Negotiable (3-5%)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Revenue Calculation

**Example Booking:**
```
Court: Cebu Pickleball Club - Court 1
Time: 2 hours (5pm-7pm, peak pricing)
Price: $50/hour × 2 hours = $100

Revenue Split (Pro Plan, 5% platform fee):
├── Platform fee (5%): $5.00
└── Venue payout (95%): $95.00

└── Net to platform: $1.80

Venue receives: $95.00
Platform net: $1.80
```

### Subscription Management Schema

```prisma
model Subscription {
  id                    String              @id @default(uuid())
  tenantId              String              @unique
  plan                  SubscriptionPlan
  status                SubscriptionStatus  @default(TRIAL)


  // Billing period
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean             @default(false)
  cancelledAt           DateTime?

  // Trial
  trialEndsAt           DateTime?

  // Metadata
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  tenant                Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([status])
}

enum SubscriptionPlan {
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIAL           // 14-day free trial
  ACTIVE          // Paid and current
  PAST_DUE        // Payment failed, grace period
  CANCELLED       // Cancelled by user
  EXPIRED         // Trial or subscription ended
}

model Invoice {
  id                String          @id @default(uuid())
  tenantId          String
  subscriptionId    String

  // Amount
  subtotal          Decimal         @db.Decimal(10, 2)  // Monthly base fee
  
  total             Decimal         @db.Decimal(10, 2)


  // Billing period
  periodStart       DateTime
  periodEnd         DateTime

  // Status
  status            InvoiceStatus   @default(DRAFT)
  paidAt            DateTime?

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([tenantId])
  @@index([subscriptionId])
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}
```


```
┌──────────────────────────────────────────────────────────────────┐
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│    ↓                                                              │
│    {                                                              │
│      "account": "acct_xxx",                                       │
│      "refresh_url": "https://cebu-club.rallyhub.com/setup",   │
│      "return_url": "https://cebu-club.rallyhub.com/setup/done",│
│      "type": "account_onboarding"                                │
│    }                                                              │
│    ↓                                                              │
│    ↓                                                              │
│    ↓                                                              │
│    ↓                                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CUSTOMER BOOKING: Payment Flow                                   │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ 1. Customer books court for $100                                 │
│    ↓                                                              │
│    {                                                              │
│      "amount": 10000,  // $100 in cents                          │
│      "currency": "usd",                                           │
│      "application_fee_amount": 500,  // $5 platform fee (5%)     │
│      "transfer_data": {                                           │
│      }                                                            │
│    }                                                              │
│    ↓                                                              │
│    ↓                                                              │
│ 4. Customer enters payment info & confirms                       │
│    ↓                                                              │
│    • Charges customer $100                                       │
│    ↓                                                              │
│    ↓                                                              │
│ 7. Backend updates Booking:                                      │
│    UPDATE bookings SET                                            │
│      paidAt          DateTime?
│      isPaid          Boolean       @default(false)
│    ↓                                                              │
│ 8. Send confirmation email to customer                           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ MONTHLY BILLING: Venue Subscription                              │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│ 1. Venue upgrades to Pro Plan ($79/mo)                           │
│    ↓                                                              │
│    {                                                              │
│      "customer": "cus_venue_owner_xxx",                           │
│      "items": [{ "price": "price_pro_plan_xxx" }],               │
│      "metadata": { "tenantId": "tenant-uuid" }                      │
│    }                                                              │
│    ↓                                                              │
│    ↓                                                              │
│    ↓                                                              │
│ 5. Backend updates Subscription:                                 │
│    UPDATE subscriptions SET                                       │
│      status = 'ACTIVE',                                           │
│      currentPeriodStart = NOW(),                                  │
│      currentPeriodEnd = NOW() + INTERVAL '1 month'                │
│    ↓                                                              │
│    → Backend creates Invoice record                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)

**Goal:** Establish multi-tenant data model and basic CRUD

**Tasks:**
- [x] Design Prisma schema (Tenant, Venue, TenantMember, Court, Booking, etc.)
- [ ] Generate and apply initial migration
- [ ] Create `TenantsModule` with CRUD endpoints (business/account level)
- [ ] Create `VenuesModule` with CRUD endpoints (physical location level)
- [ ] Implement slug validation (unique, URL-safe) — slug lives on `Venue`
- [ ] Create `TenantContextMiddleware` (subdomain + header resolution, resolves venue then derives tenantId)
- [ ] Add `@CurrentTenant()` and `@CurrentVenue()` parameter decorators
- [ ] Write unit tests for middleware & decorators

**API Endpoints:**
```
POST   /tenants                # Create a business account
GET    /tenants/:id            # Get tenant by ID
PATCH  /tenants/:id            # Update tenant (business-level fields)
DELETE /tenants/:id            # Soft delete tenant (cascades its venues)

POST   /venues                 # Create a venue under a tenant
GET    /venues/:id             # Get venue by ID
GET    /venues/by-slug/:slug   # Get venue by slug (for middleware)
PATCH  /venues/:id             # Update venue
DELETE /venues/:id             # Soft delete venue
```

> `TenantMember` CRUD endpoints moved to [Phase 3: Access Control](#phase-3-access-control-1-week) — they depend on the role/permission model built there.

**Verification:**
- Can create venue via API
- Slug uniqueness enforced
- Middleware resolves `tenantId` from subdomain
- `@CurrentTenant()` throws error if missing

**Deliverables:**
- Prisma schema in `apps/api/prisma/schema.prisma`
- Migration files in `apps/api/prisma/migrations/`
- `TenantsModule` in `apps/api/src/tenants/`
- Middleware in `apps/api/src/common/middleware/`

---

### Phase 2: Onboarding Flow (1 week)

**Goal:** Venue owners can sign up and configure their venue

**Tasks:**
- [ ] Create `/for-venues` marketing page (Next.js)
- [ ] Build "Create Venue" form with React Hook Form + Zod
- [ ] Implement `POST /tenants` endpoint with auto-assignment of OWNER role
- [ ] Create `/venues/:slug/setup` wizard (multi-step)
  - Step 1: Add courts
  - Step 2: Set hours
  - Step 3: Configure pricing
- [ ] Add court creation UI and API
- [ ] Add schedule configuration UI and API
- [ ] Implement venue publishing (`status: ACTIVE`)

**API Endpoints:**
```
POST   /courts                     # Create court
GET    /courts?tenantId=xxx        # List courts for venue
PATCH  /courts/:id                 # Update court
DELETE /courts/:id                 # Delete court

POST   /tenant-schedules/bulk      # Set all 7 days at once
GET    /tenant-schedules?tenantId=xxx
PATCH  /tenant-schedules/:id

POST   /pricing-rules              # Create pricing rule
GET    /pricing-rules?tenantId=xxx
PATCH  /pricing-rules/:id
DELETE /pricing-rules/:id

PATCH  /venues/:id/publish         # Mark venue as ACTIVE
```

**Verification:**
- Venue owner can complete full setup wizard
- Venue appears in directory after publishing
- Subdomain resolves correctly (e.g., `cebu-club.rallyhub.com`)

**Deliverables:**
- Frontend pages in `apps/web/app/(marketing)/for-venues/`
- Setup wizard in `apps/web/app/(protected)/venues/[slug]/setup/`
- Backend modules: `CourtsModule`, `SchedulesModule`, `PricingModule`

---

### Phase 3: Access Control (1 week)

**Goal:** Enforce role-based permissions per tenant

**Tasks:**
- [ ] Create `TenantMembersModule` with CRUD endpoints (moved from Phase 1)
- [ ] Create `@TenantRoles()` guard
- [ ] Add `TenantMemberRepository` (find user roles for tenant)
- [ ] Protect venue settings routes with `@TenantRoles('OWNER')`
- [ ] Add Prisma middleware to enforce `tenantId` filtering
- [ ] Create frontend role checks (`useVenueRole()` hook)
- [ ] Add "Invite Staff" feature (send email invite with link)

**API Endpoints:**
```
POST   /tenant-members       # Add user to venue
GET    /tenant-members       # List members for venue
PATCH  /tenant-members/:id   # Update role
DELETE /tenant-members/:id   # Remove member
```

**Guard Implementation:**
```typescript
// apps/api/src/auth/tenant-roles.guard.ts
@Injectable()
export class TenantRolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<TenantRole[]>('tenantRoles', context.getHandler())
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const tenantId = request.tenantId

    const membership = await this.tenantMemberRepo.findByUserAndTenant(user.id, tenantId)
    return membership && requiredRoles.includes(membership.role)
  }
}
```

**Frontend Hook:**
```typescript
// apps/web/hooks/use-venue-role.ts
export function useVenueRole(venueId: string) {
  const { data: membership } = useQuery({
    queryKey: ['venue-member', venueId],
    queryFn: () => api.get(`/tenant-members/me?tenantId=${venueId}`),
  })

  return {
    role: membership?.role,
    isOwner: membership?.role === 'OWNER',
    isStaff: membership?.role === 'STAFF' || membership?.role === 'OWNER',
    isCustomer: membership?.role === 'CUSTOMER',
  }
}
```

**Verification:**
- Only owners can edit venue settings
- Staff can view bookings but not edit settings
- Customers cannot access admin routes
- Prisma middleware prevents queries without `tenantId`

**Deliverables:**
- `TenantMembersModule` in `apps/api/src/tenant-members/`
- `TenantRolesGuard` in `apps/api/src/auth/`
- Prisma middleware in `apps/api/src/prisma/prisma.service.ts`
- `useVenueRole` hook in `apps/web/hooks/`

---

### Phase 4: Booking Engine (2 weeks)

**Goal:** Users can browse courts and book time slots

**Tasks:**
- [ ] Create `BookingsModule` with CRUD
- [ ] Build court availability endpoint (`GET /courts/:id/availability`)
- [ ] Implement pricing calculation logic (apply pricing rules)
- [ ] Create booking calendar UI (weekly view, time slots)
- [ ] Implement booking creation flow:
  - Select court + time
  - Calculate price
  - Create booking
  - Send confirmation email
- [ ] Add `useUserBookings()` hook (fetch all bookings across venues)
- [ ] Create `app.rallyhub.com/bookings` page (unified view)

**Booking Calendar UI:**
```
cebu-club.rallyhub.com/courts/court-1

┌────────────────────────────────────────────────────────────┐
│ Court 1 - Doubles Court (Indoor)                           │
│────────────────────────────────────────────────────────────│
│                                                            │
│ [← Prev Week]  Sep 20-26, 2026  [Next Week →]            │
│                                                            │
│        Mon    Tue    Wed    Thu    Fri    Sat    Sun      │
│ 6am    ───    ───    ───    ───    ───    ───    ───     │
│ 7am    ───    ───    ───    ───    ───    ───    ───     │
│ 8am    ███    ───    ███    ───    ───    ───    ───     │ ← Booked
│ 9am    ───    ───    ───    ───    ───    ███    ───     │
│ 10am   ───    [+]    ───    [+]    ───    ███    ───     │ ← Available
│ ...                                                        │
│ 5pm    [+]    ███    [+]    ███    ███    ███    ───     │
│ 6pm    [+]    ███    [+]    ███    ███    ███    ───     │
│                                                            │
│ [+] = Available to book                                    │
│ ███ = Already booked                                       │
│ ─── = Outside venue hours                                  │
└────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
```
GET    /courts/:id/availability
  ?date=2026-09-20
  &tenantId=xxx
  → Returns blocked time slots

POST   /bookings/calculate-price
  { courtId, tenantId, startTime, endTime }
  → Returns { totalPrice, breakdown }

POST   /bookings
  { courtId, tenantId, startTime, endTime }
  → Creates payment intent + booking

GET    /bookings/me
  ?tenantId=xxx (optional - omit for all venues)
  → Returns user's bookings

PATCH  /bookings/:id/cancel
  → Cancels booking & refunds payment
```

**Verification:**
- User can browse courts at `cebu-club.rallyhub.com`
- Calendar shows available vs booked slots
- User visits `app.rallyhub.com/bookings` → sees all bookings

**Deliverables:**
- `BookingsModule` in `apps/api/src/bookings/`
- Court browser UI in `apps/web/app/(venues)/[slug]/courts/`
- Booking calendar in `apps/web/app/(venues)/[slug]/courts/[courtId]/`
- User bookings page in `apps/web/app/(dashboard)/bookings/`

---

### Phase 5: Subdomain Routing (1 week)

**Goal:** Production-ready subdomain routing with SSL

**Tasks:**
- [ ] Configure Vercel wildcard domain (`*.rallyhub.com`)
- [ ] Add SSL cert for wildcard (auto-provisioned by Vercel)
- [ ] Update middleware to redirect unknown subdomains to venue directory
- [ ] Add venue-specific theming (logo, colors in UI)
- [ ] Create `app.rallyhub.com` unified user dashboard
- [ ] Update Better Auth `TRUSTED_ORIGINS` to allow all subdomains

**DNS Configuration:**
```bash
# Add these records to your DNS provider
Type    Name    Value
A       @       76.76.21.21 (Vercel IP)
A       *       76.76.21.21 (Wildcard)
CNAME   www     cname.vercel-dns.com
```

**Vercel Domain Setup:**
1. Go to Vercel project → Settings → Domains
2. Add `rallyhub.com`
3. Add `*.rallyhub.com`
4. Vercel auto-provisions SSL for both

**Verification:**
- `rallyhub.com` → marketing site
- `app.rallyhub.com` → user dashboard
- `cebu-club.rallyhub.com` → Cebu venue
- `invalid-slug.rallyhub.com` → redirects to `/venues`
- All subdomains use HTTPS

**Deliverables:**
- DNS configuration documented
- Vercel domain config
- Middleware redirect logic
- User dashboard at `app.rallyhub.com`

---

### Phase 6: Payments & Subscriptions (2 weeks)

**Goal:** Collect revenue from venues and bookings

**Tasks:**
- [ ] Create subscription plans (Starter/Pro/Enterprise)
- [ ] Build billing portal for venue owners
- [ ] Implement per-booking fee calculation
- [ ] Create invoice generation (monthly platform fees)
  - `payment_intent.succeeded` → confirm booking
  - `invoice.paid` → activate subscription
  - `customer.subscription.deleted` → cancel subscription

```typescript
async createConnectAccount(tenantId: string) {
    type: 'standard',
    metadata: { tenantId },
  })

    account: account.id,
    return_url: `https://${slug}.rallyhub.com/setup/complete`,
    type: 'account_onboarding',
  })

  return accountLink.url // Redirect user here
}
```

**Subscription Creation:**
```typescript
async createSubscription(tenantId: string, plan: SubscriptionPlan) {
  const tenant = await this.tenantsRepo.findById(tenantId)

      email: tenant.email,
      metadata: { tenantId },
    })
  }

  // Create subscription
    items: [{ price: this.getPriceId(plan) }],
    metadata: { tenantId },
    trial_period_days: 14,
  })

  // Save to database
  await this.subscriptionsRepo.create({
    tenantId,
    plan,
    status: 'TRIAL',
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialEndsAt: new Date(subscription.trial_end * 1000),
  })
}
```

**Verification:**
- Venue owner can subscribe to a plan
- Customer booking triggers payment → venue receives payout
- Monthly invoice generated for platform fees
- Webhooks handled correctly

**Deliverables:**
- `BillingModule` in `apps/api/src/billing/`
- Billing portal in `apps/web/app/(venues)/[slug]/admin/billing/`

---

### Phase 7: Analytics & Reporting (1 week)

**Goal:** Venue owners see booking metrics

**Tasks:**
- [ ] Create `TenantAnalyticsService` (bookings per day, revenue, utilization)
- [ ] Build dashboard at `{slug}.rallyhub.com/admin/analytics`
- [ ] Add charts:
  - Bookings over time (last 30 days)
  - Revenue over time
  - Peak hours heatmap
  - Court utilization %
  - Top customers
- [ ] Export reports (CSV, PDF)

**Analytics Dashboard:**
```
cebu-club.rallyhub.com/admin/analytics

┌────────────────────────────────────────────────────────────┐
│ Analytics Dashboard                                        │
│────────────────────────────────────────────────────────────│
│                                                            │
│ Last 30 Days:                                              │
│ ┌──────────────┬──────────────┬──────────────┐            │
│ │ 247 Bookings │ $9,880 Revenue│ 78% Occupied│            │
│ └──────────────┴──────────────┴──────────────┘            │
│                                                            │
│ Bookings Over Time:                                        │
│ ┌────────────────────────────────────────────────┐        │
│ │     ▃▅▇█▇▅▃    ▅▇█▇▅    ▃▅▇█▇▅▃              │        │
│ │    ▁▃▅▇█▇▅▃▁  ▃▅▇█▇▅▃  ▁▃▅▇█▇▅▃▁            │        │
│ │ Sep 1    Sep 10    Sep 20    Sep 30          │        │
│ └────────────────────────────────────────────────┘        │
│                                                            │
│ Peak Hours Heatmap:                                        │
│        Mon Tue Wed Thu Fri Sat Sun                         │
│ 6am    ░░░ ░░░ ░░░ ░░░ ░░░ ░░░ ░░░                       │
│ 9am    ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ███ ███                       │
│ 12pm   ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ███ ███                       │
│ 3pm    ░░░ ░░░ ░░░ ░░░ ░░░ ▓▓▓ ▓▓▓                       │
│ 6pm    ███ ███ ███ ███ ███ ███ ▓▓▓                       │
│                                                            │
│ Top Courts:                                                │
│ 1. Court 1 (92% occupied)                                 │
│ 2. Court 2 (85% occupied)                                 │
│ 3. Court 3 (73% occupied)                                 │
│                                                            │
│ [ Export CSV ]  [ Export PDF ]                            │
└────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
```
GET /analytics/bookings
  ?tenantId=xxx
  &startDate=2026-09-01
  &endDate=2026-09-30
  → Returns daily booking counts

GET /analytics/revenue
  ?tenantId=xxx
  &startDate=2026-09-01
  &endDate=2026-09-30
  → Returns daily revenue

GET /analytics/utilization
  ?tenantId=xxx
  &startDate=2026-09-01
  &endDate=2026-09-30
  → Returns court utilization %

GET /analytics/export
  ?tenantId=xxx
  &format=csv|pdf
  &startDate=2026-09-01
  &endDate=2026-09-30
  → Returns file download
```

**Verification:**
- Venue owner visits analytics → sees booking trends
- Can filter by date range
- Can export CSV/PDF reports

**Deliverables:**
- `AnalyticsModule` in `apps/api/src/analytics/`
- Analytics dashboard in `apps/web/app/(venues)/[slug]/admin/analytics/`

---

## Security Considerations

### Data Isolation

**Risk:** User from Tenant A sees bookings from Tenant B — or, with multiple venues per tenant, a STAFF member scoped to one venue sees another venue's bookings under the same tenant

**Mitigations:**
1. **Prisma Middleware** - Auto-inject `tenantId` filter on all tenant-scoped queries; auto-inject `venueId` too wherever `TenantMember.venueId` scopes the caller to one location
2. **Repository Pattern** - All queries go through tenant-aware (and, where relevant, venue-aware) base repository
3. **Guard Layer** - `@TenantRoles()` validates user has access to current tenant, and to the current venue when the member's `venueId` isn't null
4. **Unit Tests** - Test data leakage scenarios, including across venues within the same tenant

**Example Test:**
```typescript
describe('Data Isolation', () => {
  it('should not return bookings from other tenants', async () => {
    // Create two tenants
    const tenantA = await createTenant('tenant-a')
    const tenantB = await createTenant('tenant-b')

    // Create booking for tenant A
    const booking = await createBooking({ tenantId: tenantA.id })

    // Try to fetch with tenant B context
    const result = await request(app.getHttpServer())
      .get('/bookings')
      .set('x-tenant-id', tenantB.id)
      .expect(200)

    // Should return empty array
    expect(result.body).toEqual([])
  })
})
```

### Authentication & Sessions

**Risk:** Session hijacking, CSRF attacks

**Mitigations:**
1. **HTTP-Only Cookies** - Session cookie not accessible via JavaScript
2. **Secure Flag** - Cookie only sent over HTTPS in production
3. **SameSite: Lax** - Prevents CSRF attacks
4. **Short Session TTL** - Sessions expire after 7 days
5. **Session Rotation** - New session ID on role changes

**Better Auth Configuration:**
```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // Refresh daily
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}
```

### Payment Security

**Risk:** Payment manipulation, unauthorized refunds

**Mitigations:**
1. **Server-Side Pricing** - Never trust client-provided prices
3. **Idempotency Keys** - Prevent duplicate charges
4. **Payment Intent Verification** - Confirm amount matches booking

**Webhook Verification:**
```typescript


  try {
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    throw new BadRequestException('Invalid signature')
  }

  // Process event...
}
```

### Role Escalation

**Risk:** User grants themselves OWNER role

**Mitigations:**
1. **Role Assignment Endpoint** - Only owners can change roles
2. **Database Constraints** - Unique constraint on `(userId, tenantId)`
3. **Audit Log** - Track all role changes

**Protected Endpoint:**
```typescript
@Patch('/tenant-members/:id')
@TenantRoles(TenantRole.OWNER)
async updateRole(
  @CurrentTenant() tenantId: string,
  @Param('id') id: string,
  @Body() dto: UpdateRoleDto,
) {
  const member = await this.tenantMemberRepo.findById(id)

  // Verify member belongs to current tenant
  if (member.tenantId !== tenantId) {
    throw new ForbiddenException()
  }

  // Cannot demote last owner
  const ownerCount = await this.tenantMemberRepo.countOwners(tenantId)
  if (ownerCount === 1 && member.role === 'OWNER' && dto.role !== 'OWNER') {
    throw new BadRequestException('Cannot remove last owner')
  }

  return this.tenantMemberRepo.update(id, dto)
}
```

---

## Performance & Scalability

### Database Indexes

**Critical Indexes:**
```sql
-- Tenant lookup by slug (subdomain resolution)
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- Booking queries (most common)
CREATE INDEX idx_bookings_tenant_start ON bookings(tenantId, startTime);
CREATE INDEX idx_bookings_court_start ON bookings(courtId, startTime);
CREATE INDEX idx_bookings_user ON bookings(userId);

-- TenantMember role checks
CREATE INDEX idx_tenant_members_user_tenant ON tenant_members(userId, tenantId);
CREATE INDEX idx_tenant_members_tenant_role ON tenant_members(tenantId, role);

-- Court availability
CREATE INDEX idx_courts_tenant_status ON courts(tenantId, status);

-- Pricing rule lookup
CREATE INDEX idx_pricing_rules_tenant_active ON pricing_rules(tenantId, isActive);
```

### Caching Strategy

**What to Cache:**
1. **Venue Slug Resolution** (5 min TTL)
   - Map slug → venueId (and its tenantId) in Redis — slug lives on `Venue`, not `Tenant`
   - Avoid DB query on every request

2. **Pricing Rules** (1 hour TTL)
   - Cache per tenant
   - Invalidate on update

3. **Tenant Settings** (10 min TTL)
   - Logo, colors, name
   - Used for theming

**Redis Keys:**
```
venue:slug:{slug} → { venueId, tenantId }
tenant:pricing:{tenantId} → [PricingRule]
tenant:settings:{tenantId} → { logo, colors, name }
```

**Implementation:**
```typescript
// apps/api/src/common/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(@InjectRedis() private redis: Redis) {}

  async getVenueBySlug(slug: string): Promise<{ venueId: string; tenantId: string } | null> {
    const key = `venue:slug:${slug}`
    const cached = await this.redis.get(key)

    if (cached) return JSON.parse(cached)

    const venue = await this.venuesRepo.findBySlug(slug)
    if (!venue) return null

    const value = { venueId: venue.id, tenantId: venue.tenantId }
    await this.redis.setex(key, 300, JSON.stringify(value)) // 5 min TTL
    return value
  }
}
```

### Query Optimization

**N+1 Query Prevention:**
```typescript
// BAD: N+1 queries
async getBookingsWithCourts(tenantId: string) {
  const bookings = await this.prisma.booking.findMany({ where: { tenantId } })

  for (const booking of bookings) {
    booking.court = await this.prisma.court.findUnique({ where: { id: booking.courtId } })
  }

  return bookings
}

// GOOD: Single query with include
async getBookingsWithCourts(tenantId: string) {
  return this.prisma.booking.findMany({
    where: { tenantId },
    include: { court: true, user: true },
  })
}
```

### Scaling Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Database Size** | 1M rows per tenant table | Partition by `tenantId` |
| **Concurrent Users** | 10,000 | Add read replicas |
| **API Requests** | 1,000 req/sec | Horizontal scaling (Vercel auto-scales) |
| **Tenant Count** | 10,000 venues | Consider database sharding |
| **Redis Cache Size** | 10 GB | Add Redis cluster |

**Partitioning Strategy (Future):**
```sql
-- Partition bookings by tenantId hash
CREATE TABLE bookings_part_0 PARTITION OF bookings
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE bookings_part_1 PARTITION OF bookings
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);

-- etc.
```

---

## Migration Strategy

### Rollout Plan

**Pre-Launch (Current State):**
- Single-tenant (no venue concept)
- Users book "courts" globally
- No subdomain routing

**Phase 1: Soft Launch (Internal Testing):**
1. Deploy multi-tenant schema to staging
2. Create 3 test venues
3. Invite beta testers (5-10 venue owners)
4. Collect feedback on onboarding flow

**Phase 2: Public Beta:**
1. Deploy to production
2. Migrate existing data (if any) to first venue
3. Open signup to waitlist (50 venues)
4. Monitor performance & errors

**Phase 3: General Availability:**
1. Remove waitlist
2. Launch marketing campaign

### Data Migration

**Scenario:** Migrate existing single-tenant bookings to multi-tenant

**Migration Script:**
```typescript
// scripts/migrate-to-multi-tenant.ts
async function migrate() {
  // 1. Create "Default Venue" for existing data
  const defaultTenant = await prisma.tenant.create({
    data: {
      name: 'Legacy Courts',
      slug: 'legacy',
      status: 'ACTIVE',
    },
  })

  // 2. Update all courts to belong to default venue
  await prisma.court.updateMany({
    data: { tenantId: defaultTenant.id },
  })

  // 3. Update all bookings to belong to default venue
  await prisma.booking.updateMany({
    data: { tenantId: defaultTenant.id },
  })

  // 4. Create TenantMember for all users (as CUSTOMER)
  const users = await prisma.user.findMany()

  for (const user of users) {
    await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId: defaultTenant.id,
        role: 'CUSTOMER',
      },
    })
  }

  console.log('Migration complete')
}
```

### Rollback Plan

**If multi-tenant causes critical issues:**

1. **Immediate:** Feature flag to disable multi-tenant routing
   ```typescript
   const MULTI_TENANT_ENABLED = process.env.FEATURE_MULTI_TENANT === 'true'

   if (!MULTI_TENANT_ENABLED) {
     // Use legacy single-tenant code path
   }
   ```

2. **Database Rollback:**
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   npx prisma migrate deploy
   ```

3. **Communication:**
   - Email all venue owners
   - Post status update on rallyhub.com/status
   - Offer refunds for affected bookings

---

## Next Steps

1. **Review & Approve** this architecture plan with stakeholders
2. **Spike Test** Phase 1 (2 days):
   - Create Prisma schema
   - Test middleware tenant resolution
   - Verify no data leakage
3. **Set up Vercel Wildcard Domain** and confirm subdomain routing works
4. **User Research** - Interview 3 venue owners about onboarding expectations
5. **Pricing Validation** - Research competitor pricing (CourtReserve, Playbypoint)
6. **Start Phase 1** - Begin implementation of foundation

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **Tenant** | A business using RallyHub — the billing account (e.g., Cebu Sports Group). May own one or more venues |
| **Venue** | One physical location owned by a tenant, with its own address, hours, and courts (e.g., Cebu Pickleball Club - Downtown) |
| **Court** | Bookable resource at a venue (Singles, Doubles, Multi-purpose) |
| **Booking** | Reservation of a court for a time slot |
| **TenantMember** | User's role for a tenant (Owner/Staff), optionally scoped to a single venue |
| **Subdomain** | Venue-specific URL (e.g., `cebu-club.rallyhub.com`) |
| **Pricing Rule** | Time-based pricing configuration for a venue (e.g., peak hours) |

### Related Documents

- `AGENTS.md` - Repository conventions and rules
- `CLAUDE.md` - Development guide for Claude Code
- `README.md` - Setup and deployment instructions
- `apps/api/DEPLOYMENT.md` - Backend deployment guide

### Questions & Decisions Log

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| 2026-09-15 | Shared DB vs DB-per-tenant? | Shared DB | Simpler ops, cross-tenant features easier |
| 2026-09-15 | Subdomain vs path routing? | Subdomain | Professional feel, better branding |
| 2026-09-15 | Pricing model? | Hybrid (base + %) | Fair for all venue sizes |
| 2026-09-19 | Can one business run multiple physical locations? | Yes — added `Venue` as its own layer between `Tenant` and `Court` | Original design conflated tenant and venue 1:1 (see glossary v1.0); real operators (multiple courts in different cities) need one account, several locations. `TenantMember` gained an optional `venueId` to scope STAFF to a single venue while OWNER stays tenant-wide |
| TBD | Trial period length? | TBD | Need to validate with users |
| TBD | Approval flow for new venues? | TBD | Start auto-approve, add manual review if spam |

---

**End of Document**

---

## Payment Processing Note

**Current Approach: External Payment Handling**

RallyHub initially does **not** handle payment processing. Venues manage their own payment collection:
- **In-person**: Cash, card readers at the venue
- **Digital**: Venmo, CashApp, Zelle, etc.
- **Manual marking**: Staff mark bookings as "paid" in the system

This approach:
- ✅ Simplifies initial MVP
- ✅ No payment processor fees/complexity  
- ✅ Venues keep 100% of booking revenue
- ✅ Works for small local venues

**Future Enhancement: Integrated Payments**

When ready to scale, consider adding:
- Payment processor integration (Stripe, Square, etc.)
- Automatic payment capture on booking
- Revenue sharing model (platform fee)
- Automated payouts to venues

