"use client"

import { useMemo, useState } from "react"
import { RiSearchLine } from "@remixicon/react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { VenueCard, type Venue } from "@/components/venues/venue-card"
import { COURT_IMAGES } from "@/lib/court-images"

const VENUES: Venue[] = [
  {
    id: "the-baseline-club",
    name: "The Baseline Club",
    area: "IT Park & Lahug",
    address: "Jose Maria Del Mar St., IT Park, Cebu City",
    rating: 4.9,
    reviewCount: 380,
    pricePerHour: 800,
    courtBadge: "Indoor AC · 10 courts",
    amenities: ["High-power AC", "PIN gate lock", "Locker & hot shower"],
    todaysSlots: ["5:00 PM", "6:30 PM", "8:00 PM"],
    image: COURT_IMAGES.aerialNight,
  },
  {
    id: "dink-and-chill",
    name: "Dink & Chill",
    area: "Mandaue & Banilad",
    address: "A.S. Fortuna St., Mandaue City",
    rating: 4.8,
    reviewCount: 210,
    pricePerHour: 450,
    courtBadge: "Covered · 8 hardcourts",
    amenities: ["Food park lounge", "500 lux lighting", "Free surface parking"],
    todaysSlots: ["6:00 PM", "7:30 PM", "9:00 PM"],
    image: COURT_IMAGES.blueLines,
  },
  {
    id: "apex-racquet-center",
    name: "Apex Racquet Center",
    area: "Banilad",
    address: "Banilad Rd., near Gaisano Country Mall, Cebu City",
    rating: 4.9,
    reviewCount: 460,
    pricePerHour: 750,
    courtBadge: "Indoor buffered · 12 courts",
    amenities: ["Replay AI cameras", "Ball machine rental", "Certified coaching"],
    todaysSlots: ["4:30 PM", "7:00 PM", "9:30 PM"],
    image: COURT_IMAGES.aerialThreeCourts,
  },
  {
    id: "mactan-dink-pavilion",
    name: "Mactan Dink Pavilion",
    area: "Mactan & Lapu-Lapu",
    address: "Airport Rd., Lapu-Lapu City",
    rating: 4.7,
    reviewCount: 140,
    pricePerHour: 400,
    courtBadge: "Weather-proof shaded · 6 courts",
    amenities: ["HVLS ceiling fans", "Secure parking", "Beginner clinics"],
    todaysSlots: ["7:00 AM", "8:30 AM", "5:00 PM"],
    image: COURT_IMAGES.aerialCyan,
  },
  {
    id: "ayala-smash-hub",
    name: "Ayala Smash Hub",
    area: "Cebu Business Park & Ayala",
    address: "Cardinal Rosales Ave., Cebu Business Park, Cebu City",
    rating: 4.9,
    reviewCount: 185,
    pricePerHour: 850,
    courtBadge: "Boutique indoor · 5 premium courts",
    amenities: ["Espresso bar", "Sauna & showers", "Demo paddle center"],
    todaysSlots: ["7:00 PM", "8:30 PM", "10:00 PM"],
    image: COURT_IMAGES.aerialGoldenHour,
  },
  {
    id: "srp-south-courts",
    name: "SRP South Courts",
    area: "South Road Properties",
    address: "South Road Properties, Talisay-Cebu Coastal Rd.",
    rating: 4.8,
    reviewCount: 95,
    pricePerHour: 500,
    courtBadge: "Lighted hardcourts · 8 outdoor courts",
    amenities: ["Outdoor tournament spec", "Clubhouse café", "Ladder leagues"],
    todaysSlots: ["8:00 PM", "9:00 PM", "10:00 PM"],
    image: COURT_IMAGES.courtCorner,
  },
]

const AREAS = ["All locations", ...Array.from(new Set(VENUES.map((v) => v.area)))]

function VenueDirectory() {
  const [query, setQuery] = useState("")
  const [area, setArea] = useState("All locations")

  const filtered = useMemo(() => {
    return VENUES.filter((venue) => {
      const matchesArea = area === "All locations" || venue.area === area
      const matchesQuery =
        query.trim().length === 0 ||
        venue.name.toLowerCase().includes(query.toLowerCase()) ||
        venue.address.toLowerCase().includes(query.toLowerCase())
      return matchesArea && matchesQuery
    })
  }, [query, area])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <RiSearchLine className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search club, barangay, or landmark"
            className="h-11 rounded-lg pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {AREAS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setArea(label)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                area === label
                  ? "bg-brand-ink text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {label !== "All locations" &&
                ` (${VENUES.filter((v) => v.area === label).length})`}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Showing {filtered.length} of {VENUES.length} Cebu City venues
      </p>

      <div className="space-y-4">
        {filtered.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No venues match your search. Try a different location or keyword.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { VenueDirectory }
