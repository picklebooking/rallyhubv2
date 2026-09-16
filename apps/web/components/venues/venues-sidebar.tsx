import { RiMapPin2Line } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

function VenuesSidebar() {
  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="bg-brand-ink-elevated relative flex h-48 w-full items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="relative flex flex-col items-center gap-1.5 text-center text-xs text-white/70">
            <RiMapPin2Line className="text-primary size-5" />
            Cebu City court map
            <span>18 hubs active</span>
          </div>
        </div>
        <div className="bg-brand-ink-elevated space-y-1 p-4">
          <p className="text-sm font-semibold text-white">The Baseline Club</p>
          <p className="text-white/60 text-xs">
            Next slot 5:00 PM · ₱800/hr
          </p>
        </div>
      </Card>

      <Card className="bg-brand-ink-elevated gap-2 p-5">
        <p className="text-sm font-semibold text-white">Are you a venue operator?</p>
        <p className="text-white/70 text-xs leading-relaxed">
          Fill weekday off-peak courts, manage bookings in real time, and
          collect deposits seamlessly.
        </p>
        <Button size="sm" className="mt-2 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          Onboard your courts
        </Button>
      </Card>
    </div>
  )
}

export { VenuesSidebar }
