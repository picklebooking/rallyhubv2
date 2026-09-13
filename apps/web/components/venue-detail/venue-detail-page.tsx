"use client"

import { RiHeart3Line, RiMapPinLine, RiRouteLine, RiShareLine } from "@remixicon/react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AuthHeader } from "@/components/auth/auth-header"
import { LandingFooter } from "@/components/home/landing-footer"
import { BookingPanel } from "@/components/venue-detail/booking-panel"
import { VenueBookingRules } from "@/components/venue-detail/venue-booking-rules"
import { VenueGallery } from "@/components/venue-detail/venue-gallery"
import { VenueLocation } from "@/components/venue-detail/venue-location"
import { VenueReviews } from "@/components/venue-detail/venue-reviews"
import { VenueSpecs } from "@/components/venue-detail/venue-specs"

const VENUE = {
  name: "The Baseline Club",
  address: "Jose Maria Del Mar St., IT Park, Cebu City (200m from Ayala Center Cebu)",
}

function VenueDetailPage() {
  const directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUE.address)}`

  return (
    <>
      <AuthHeader />
      <main className="bg-background text-foreground min-h-svh pt-16">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/venues" className="hover:text-foreground transition-colors">
                Venues
              </Link>
              <span>/</span>
              <span className="text-foreground">{VENUE.name}</span>
            </div>
            <Badge variant="secondary" className="text-primary">
              Courts open now · 6:00 AM – 12:00 AM
            </Badge>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-normal md:text-4xl">
                {VENUE.name}
              </h1>
              <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-sm">
                <RiMapPinLine className="size-4" />
                {VENUE.address}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm">
                <RiShareLine data-icon="inline-start" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <RiHeart3Line data-icon="inline-start" />
                Save
              </Button>
              <Button asChild size="sm">
                <a href={directionsHref} target="_blank" rel="noreferrer">
                  <RiRouteLine data-icon="inline-start" />
                  Directions
                </a>
              </Button>
            </div>
          </div>

          <VenueGallery />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <BookingPanel />
            <VenueBookingRules />
          </div>

          <VenueSpecs />
          <VenueLocation mapQuery={VENUE.address} />
          <VenueReviews />
        </div>
      </main>
      <LandingFooter />
    </>
  )
}

export { VenueDetailPage }
