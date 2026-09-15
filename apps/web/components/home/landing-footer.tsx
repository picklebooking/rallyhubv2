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
    <footer className="bg-brand-void border-brand-ink/20 border-t px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 font-heading text-lg font-black text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                R
              </span>
              <span>
                Rally<span className="text-primary">Hub</span>
              </span>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-white/66">
              The court network powering real-time reservations, multi-venue
              operator management, and player mixers across Cebu City.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">Live network: 18 venues</Badge>
              <Badge variant="outline" className="border-white/28 text-white/80">IT Park • Mandaue • Mactan</Badge>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <span className="text-sm font-semibold text-white">{column.title}</span>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li
                    key={link}
                    className="text-sm text-white/66 transition-colors hover:text-white"
                  >
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-brand-ink/40 flex flex-col items-center justify-between gap-3 rounded-xl px-5 py-4 sm:flex-row">
          <span className="text-sm text-white/66">
            © 2026 RallyHub. All rights reserved.
          </span>
          <div className="flex items-center gap-5">
            <Link
              href="#"
              className="text-sm text-white/66 transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-sm text-white/66 transition-colors hover:text-white"
            >
              Facility Terms
            </Link>
            <Link
              href="#"
              className="text-sm text-white/66 transition-colors hover:text-white"
            >
              Player Conduct Code
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
