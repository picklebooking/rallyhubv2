import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"

const FOOTER_COLUMNS = [
  {
    title: "Players & Play",
    links: [
      "Instant Court Reservation",
      "Open Play Sessions",
      "Competitive Leagues",
      "Paddle Rentals & Gear",
    ],
  },
  {
    title: "Venues & Clubs",
    links: [
      "List Your Facility",
      "Club Operating System",
      "Court Lighting Controls",
      "Multi-Location Analytics",
    ],
  },
  {
    title: "Cebu Hubs",
    links: [
      "IT Park & Lahug",
      "Mandaue & Banilad",
      "Cebu Business Park & Ayala",
      "Mactan & Lapu-Lapu",
    ],
  },
]

export function LandingFooter() {
  return (
    <footer className="bg-card border-border border-t px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <span className="font-heading text-lg font-semibold">
              RallyHub
            </span>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              The court network powering real-time reservations, multi-venue
              operator management, and player mixers across Cebu City.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Live network: 18 venues</Badge>
              <Badge variant="outline">IT Park • Mandaue • Mactan</Badge>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <span className="text-sm font-semibold">{column.title}</span>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li
                    key={link}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-muted flex flex-col items-center justify-between gap-3 rounded-xl px-5 py-4 sm:flex-row">
          <span className="text-muted-foreground text-sm">
            © 2026 RallyHub. All rights reserved.
          </span>
          <div className="flex items-center gap-5">
            <Link
              href="#"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Facility Terms
            </Link>
            <Link
              href="#"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Player Conduct Code
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
