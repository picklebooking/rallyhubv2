import { RiMapPin2Line } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

function VenuesSidebar() {
  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="bg-muted relative flex h-48 w-full items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.85_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0_0)_1px,transparent_1px)] bg-[size:24px_24px] opacity-50 dark:bg-[linear-gradient(to_right,oklch(1_0_0/6%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/6%)_1px,transparent_1px)]" />
          <div className="text-muted-foreground relative flex flex-col items-center gap-1.5 text-center text-xs">
            <RiMapPin2Line className="text-primary size-5" />
            Metro Manila court map
            <span>18 hubs active</span>
          </div>
        </div>
        <div className="space-y-1 p-4">
          <p className="text-sm font-semibold">The Kitchen Club BGC</p>
          <p className="text-muted-foreground text-xs">
            Next slot 5:00 PM · ₱800/hr
          </p>
        </div>
      </Card>

      <Card className="bg-muted gap-2 p-5">
        <p className="text-sm font-semibold">Are you a venue operator?</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Fill weekday off-peak courts, automate smart lighting via PIN
          locks, and collect deposits seamlessly.
        </p>
        <Button size="sm" className="mt-2 w-full">
          Onboard your courts
        </Button>
      </Card>
    </div>
  )
}

export { VenuesSidebar }
