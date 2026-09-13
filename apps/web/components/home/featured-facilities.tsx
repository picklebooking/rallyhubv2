"use client"

import { motion } from "framer-motion"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { CourtThumbnail } from "@/components/shared/court-thumbnail"
import { fadeUp, viewportOnce } from "@/components/home/motion-presets"

type Facility = {
  name: string
  area: string
  description: string
  pricePerHour: number
}

const FACILITIES: Facility[] = [
  {
    name: "The Baseline Club",
    area: "IT Park, Lahug",
    description: "10 air-conditioned championship courts with café lounge.",
    pricePerHour: 800,
  },
  {
    name: "Dink & Chill",
    area: "Mandaue City",
    description: "8 stadium-lighted hard courts with spectator bleachers.",
    pricePerHour: 450,
  },
  {
    name: "Apex Racquet Center",
    area: "Banilad",
    description: "12 buffered courts with automated replays and scoreboards.",
    pricePerHour: 750,
  },
  {
    name: "Mactan Dink Pavilion",
    area: "Lapu-Lapu",
    description: "6 shaded weather-proof canopy courts with ventilation.",
    pricePerHour: 400,
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
            <h2 className="font-heading text-[34px] font-extrabold tracking-[-0.025em]">
              Featured facilities
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              Curated premier pickleball venues with verified courts and
              seamless access.
            </p>
          </div>
          <Button variant="outline" size="sm" className="border-border rounded-full">
            View all venues
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
            >
              <Card className="h-full gap-0 overflow-hidden rounded-[22px] p-0 shadow-[0_6px_24px_rgba(12,14,17,0.07)]">
                <div className="relative h-36 w-full overflow-hidden">
                  <CourtThumbnail />
                  <span
                    className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: "rgba(255,255,255,0.94)", color: "#15171A" }}
                  >
                    {facility.area}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="space-y-1.5">
                    <h3 className="font-heading text-base font-bold">{facility.name}</h3>
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
                    <Button size="sm" className="bg-[#E8EAE4] text-[#1E2126] hover:bg-[#E8EAE4]/80 rounded-full font-extrabold">
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
