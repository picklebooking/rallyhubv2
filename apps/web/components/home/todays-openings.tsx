"use client"

import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

type Opening = {
  venue: string
  location: string
  slots: string[]
}

const OPENINGS: Opening[] = [
  {
    venue: "The Kitchen Club BGC",
    location: "Bonifacio Global City • Courts 2 & 4",
    slots: ["5:00 PM", "6:30 PM", "8:00 PM"],
  },
  {
    venue: "Apex Racquet Center",
    location: "Bridgetowne / Pasig • Court 1",
    slots: ["4:30 PM", "6:00 PM", "7:30 PM"],
  },
]

function OpeningCard({ opening }: { opening: Opening }) {
  const [selected, setSelected] = useState(opening.slots[opening.slots.length - 1])

  return (
    <div className="bg-muted flex flex-col items-start justify-between gap-4 rounded-xl p-5 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h3 className="text-base font-bold">{opening.venue}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{opening.location}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {opening.slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setSelected(slot)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              slot === selected
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-primary/10 hover:text-primary text-foreground"
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TodaysOpenings() {
  return (
    <section className="bg-card border-border border-b px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-2">
          <h2 className="font-heading text-xl font-semibold">Today&apos;s openings</h2>
          <span className="text-muted-foreground text-sm">
            • Real-time digital PIN booking
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
