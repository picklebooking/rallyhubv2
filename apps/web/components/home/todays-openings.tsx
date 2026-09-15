"use client"

import { useState } from "react"
import { motion } from "framer-motion"

import { cn } from "@workspace/ui/lib/utils"

type Opening = {
  venue: string
  location: string
  slots: string[]
}

const OPENINGS: Opening[] = [
  {
    venue: "The Baseline Club",
    location: "IT Park, Lahug • Courts 2 & 4",
    slots: ["5:00 PM", "6:30 PM", "8:00 PM"],
  },
  {
    venue: "Apex Racquet Center",
    location: "Banilad • Court 1",
    slots: ["4:30 PM", "6:00 PM", "7:30 PM"],
  },
]

function OpeningCard({ opening }: { opening: Opening }) {
  const [selected, setSelected] = useState(opening.slots[opening.slots.length - 1])

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="border-primary flex flex-col items-start justify-between gap-4 rounded-[18px] border-l-4 bg-[#ECEEE8] p-5 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(12,14,17,0.1)] sm:flex-row sm:items-center"
    >
      <div className="min-w-0">
        <h3 className="font-heading text-[17px] font-bold">{opening.venue}</h3>
        <p className="mt-1 text-sm" style={{ color: "#6B7076" }}>{opening.location}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {opening.slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setSelected(slot)}
            className={cn(
              "rounded-full px-3.5 py-2 text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95",
              slot === selected
                ? "bg-brand-ink text-white"
                : "bg-white text-foreground hover:opacity-80"
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

export function TodaysOpenings() {
  return (
    <section className="bg-card border-border border-b px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-2">
          <h2 className="font-heading text-[22px] font-bold tracking-[-0.01em]">Today&apos;s openings</h2>
          <span className="text-sm" style={{ color: "#6B7076" }}>
            • Real-time availability, book instantly
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {OPENINGS.map((opening) => (
            <OpeningCard key={opening.venue} opening={opening} />
          ))}
        </div>
      </div>
    </section>
  )
}
