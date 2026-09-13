"use client"

import { motion } from "framer-motion"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { fadeUp, viewportOnce } from "@/components/home/motion-presets"

type Facility = {
  name: string
  area: string
  description: string
  pricePerHour: number
  gradient: string
}

const FACILITIES: Facility[] = [
  {
    name: "The Baseline Club",
    area: "IT Park, Lahug",
    description: "10 air-conditioned championship courts with café lounge.",
    pricePerHour: 800,
    gradient: "from-emerald-500/25 via-emerald-500/10 to-transparent",
  },
  {
    name: "Dink & Chill",
    area: "Mandaue City",
    description: "8 stadium-lighted hard courts with spectator bleachers.",
    pricePerHour: 450,
    gradient: "from-amber-500/25 via-amber-500/10 to-transparent",
  },
  {
    name: "Apex Racquet Center",
    area: "Banilad",
    description: "12 buffered courts with automated replays and scoreboards.",
    pricePerHour: 750,
    gradient: "from-sky-500/25 via-sky-500/10 to-transparent",
  },
  {
    name: "Mactan Dink Pavilion",
    area: "Lapu-Lapu",
    description: "6 shaded weather-proof canopy courts with ventilation.",
    pricePerHour: 400,
    gradient: "from-violet-500/25 via-violet-500/10 to-transparent",
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
          <Button variant="outline" size="sm">
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
              <Card className="h-full gap-0 overflow-hidden p-0">
                <div
                  className={`bg-muted relative h-36 w-full overflow-hidden bg-gradient-to-br ${facility.gradient}`}
                >
                  <Badge
                    variant="secondary"
                    className="bg-background/90 absolute top-3 left-3 backdrop-blur-sm"
                  >
                    {facility.area}
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold">{facility.name}</h3>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {facility.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-base font-bold">
                      ₱{facility.pricePerHour}{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        /hr
                      </span>
                    </span>
                    <Button size="sm" variant="secondary">
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
