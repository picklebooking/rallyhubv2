"use client"

import { RiMapPinLine, RiStarFill, RiVerifiedBadgeFill } from "@remixicon/react"
import { motion } from "framer-motion"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { CourtThumbnail } from "@/components/shared/court-thumbnail"

const VENUES_WITH_DETAIL_PAGE = new Set(["the-baseline-club"])

export type Venue = {
  id: string
  name: string
  area: string
  address: string
  rating: number
  reviewCount: number
  pricePerHour: number
  courtBadge: string
  amenities: string[]
  todaysSlots: string[]
  image: string
}

function VenueCard({ venue }: { venue: Venue }) {
  const hasDetailPage = VENUES_WITH_DETAIL_PAGE.has(venue.id)

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.25, ease: "easeOut" }} className="group">
      <Card className="gap-0 overflow-hidden p-0 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 group-hover:shadow-[0_16px_40px_rgba(12,14,17,0.12)] sm:flex-row">
        <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-56">
          <div className="size-full transition-transform duration-500 ease-out group-hover:scale-110">
            <CourtThumbnail src={venue.image} alt={venue.name} />
          </div>
          <Badge
            variant="secondary"
            className="bg-background/90 absolute top-3 left-3 backdrop-blur-sm"
          >
            {venue.courtBadge}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold">
                  {hasDetailPage ? (
                    <Link href={`/venues/${venue.id}`} className="hover:underline">
                      {venue.name}
                    </Link>
                  ) : (
                    venue.name
                  )}
                </h3>
                <RiVerifiedBadgeFill className="text-primary size-4" />
              </div>
              <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <RiMapPinLine className="size-3.5" />
                {venue.address}
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              <RiStarFill className="size-3.5 text-amber-500" />
              {venue.rating}
              <span className="text-muted-foreground font-normal">
                ({venue.reviewCount})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {venue.amenities.map((amenity) => (
              <Badge key={amenity} variant="outline" className="font-normal">
                {amenity}
              </Badge>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Today:</span>
              {venue.todaysSlots.map((slot) => (
                <span
                  key={slot}
                  className="bg-muted rounded-md px-2 py-1 text-xs font-medium"
                >
                  {slot}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">
                ₱{venue.pricePerHour}
                <span className="text-muted-foreground text-xs font-normal">
                  /hr
                </span>
              </span>
              {hasDetailPage ? (
                <Button asChild size="sm" className="transition-transform duration-200 hover:scale-105 active:scale-95">
                  <Link href={`/venues/${venue.id}`}>Book slot</Link>
                </Button>
              ) : (
                <Button size="sm" className="transition-transform duration-200 hover:scale-105 active:scale-95">
                  Book slot
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export { VenueCard }
