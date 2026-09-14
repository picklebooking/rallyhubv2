"use client"

import { RiStarFill, RiVerifiedBadgeFill } from "@remixicon/react"
import { motion } from "framer-motion"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { CourtThumbnail } from "@/components/shared/court-thumbnail"
import { fadeUp, viewportOnce } from "@/components/home/motion-presets"
import { COURT_IMAGES } from "@/lib/court-images"

type Facility = {
  name: string
  area: string
  description: string
  pricePerHour: number
  courtBadge: string
  rating: number
  image: string
}

const FACILITIES: Facility[] = [
  {
    name: "The Baseline Club",
    area: "IT Park, Lahug",
    description: "10 air-conditioned championship courts with café lounge.",
    pricePerHour: 800,
    courtBadge: "Indoor AC · 10 courts",
    rating: 4.9,
    image: COURT_IMAGES.aerialNight,
  },
  {
    name: "Dink & Chill",
    area: "Mandaue City",
    description: "8 stadium-lighted hard courts with spectator bleachers.",
    pricePerHour: 450,
    courtBadge: "Covered · 8 hardcourts",
    rating: 4.8,
    image: COURT_IMAGES.aerialGoldenHour,
  },
  {
    name: "Apex Racquet Center",
    area: "Banilad",
    description: "12 buffered courts with automated replays and scoreboards.",
    pricePerHour: 750,
    courtBadge: "Indoor buffered · 12 courts",
    rating: 4.9,
    image: COURT_IMAGES.aerialThreeCourts,
  },
  {
    name: "Mactan Dink Pavilion",
    area: "Lapu-Lapu",
    description: "6 shaded weather-proof canopy courts with ventilation.",
    pricePerHour: 400,
    courtBadge: "Weather-proof shaded · 6 courts",
    rating: 4.7,
    image: COURT_IMAGES.aerialCyan,
  },
]

export function FeaturedFacilities() {
  return (
    <section id="featured-facilities" className="bg-background px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div className="space-y-2">
            <h2 className="font-heading text-3xl font-semibold tracking-normal">
              Featured facilities
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              Curated premier pickleball venues with verified courts and
              seamless access.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-border rounded-full">
            <Link href="/venues">View all venues</Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FACILITIES.map((facility, i) => (
            <motion.div
              key={facility.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.06 }}
              whileHover={{ y: -5 }}
              className="group"
            >
              <Card className="border-primary h-full gap-0 overflow-hidden rounded-2xl border-t-4 p-0 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
                <div className="relative h-40 w-full overflow-hidden">
                  <div className="size-full transition-transform duration-500 ease-out group-hover:scale-110">
                    <CourtThumbnail src={facility.image} alt={facility.name} />
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-background/90 absolute top-3 left-3 backdrop-blur-sm"
                  >
                    {facility.courtBadge}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading relative inline-flex w-fit items-center gap-1.5 text-base font-bold">
                        {facility.name}
                        <RiVerifiedBadgeFill className="text-primary size-4 shrink-0" />
                      </h3>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                        <RiStarFill className="size-3.5 text-amber-500" />
                        {facility.rating}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{facility.area}</p>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {facility.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-heading text-lg font-extrabold">
                      ₱{facility.pricePerHour}{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        /hr
                      </span>
                    </span>
                    <Button
                      size="sm"
                      className="bg-[#E8EAE4] text-[#1E2126] rounded-full font-extrabold transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
                    >
                      Book
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
