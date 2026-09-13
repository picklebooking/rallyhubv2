"use client"

import { RiStarFill, RiVerifiedBadgeFill } from "@remixicon/react"
import { motion } from "framer-motion"
import Link from "next/link"

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
    <section id="featured-facilities" className="bg-background px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div className="space-y-2">
            <h2 className="font-heading text-[36px] font-extrabold tracking-[-0.025em] sm:text-[42px]">
              Featured facilities
            </h2>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              Curated premier pickleball venues with verified courts and
              seamless access.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-border rounded-full">
            <Link href="/venues">View all venues</Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {FACILITIES.map((facility, i) => (
            <motion.div
              key={facility.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
              whileHover={{ y: -8 }}
              className="group"
            >
              <Card className="h-full gap-0 overflow-hidden rounded-[28px] border-0 p-0 shadow-[0_10px_30px_rgba(12,14,17,0.1)] transition-shadow duration-300 group-hover:shadow-[0_24px_60px_rgba(12,14,17,0.22)]">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <div className="size-full transition-transform duration-700 ease-out group-hover:scale-110">
                    <CourtThumbnail src={facility.image} alt={facility.name} />
                  </div>

                  {/* Bottom scrim so overlaid text stays legible on any photo */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(12,14,17,0) 40%, rgba(12,14,17,0.85) 100%)",
                    }}
                  />

                  <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-2">
                    <span
                      className="rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#15171A" }}
                    >
                      {facility.courtBadge}
                    </span>
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold"
                      style={{ background: "rgba(18,20,23,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}
                    >
                      <RiStarFill className="size-3.5" style={{ color: "#FBBF24" }} />
                      {facility.rating}
                    </span>
                  </div>

                  <div className="absolute right-5 bottom-5 left-5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-heading text-2xl font-extrabold text-white drop-shadow-sm">
                        {facility.name}
                      </h3>
                      <RiVerifiedBadgeFill className="text-primary size-5 shrink-0" />
                    </div>
                    <p className="mt-1 text-sm text-white/80">{facility.area}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-6">
                  <div className="min-w-0">
                    <p className="text-muted-foreground line-clamp-1 text-sm">
                      {facility.description}
                    </p>
                    <span className="font-heading mt-1 block text-xl font-extrabold">
                      ₱{facility.pricePerHour}
                      <span className="text-muted-foreground text-xs font-normal"> /hr</span>
                    </span>
                  </div>
                  <Button
                    size="lg"
                    className="bg-[#E8EAE4] text-[#1E2126] shrink-0 rounded-full font-extrabold transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
                  >
                    Book now
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
