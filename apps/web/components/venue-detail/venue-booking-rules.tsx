import { Card } from "@workspace/ui/components/card"

const RULES = [
  "100% instant refund — cancel up to 4 hours before your court booking start time.",
  "Non-marking athletic court shoes required at all times.",
  "Outdoor running shoes with dirt tread are prohibited on cushioned courts.",
]

function VenueBookingRules() {
  return (
    <Card className="bg-muted gap-2 p-5">
      <p className="text-sm font-semibold">Cancellation & venue rules</p>
      <ul className="space-y-2">
        {RULES.map((rule) => (
          <li key={rule} className="text-muted-foreground text-xs leading-relaxed">
            • {rule}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export { VenueBookingRules }
