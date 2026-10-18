import type { OpenPlayListing } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

import { formatStartsAt } from "@/components/open-play/open-play-dates"

type OpenPlayCardProps = {
  listing: OpenPlayListing
  action: React.ReactNode
  onVenueClick?: (venueId: string, venueName: string) => void
}

function OpenPlayCard({ listing, action, onVenueClick }: OpenPlayCardProps) {
  const seatsLeft = Math.max(listing.capacity - listing.confirmedSeats, 0)

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {formatStartsAt(listing.startsAt, listing.venue.timezone)}
        </p>
        <p className="font-heading text-lg font-semibold">
          {onVenueClick ? (
            <Button
              variant="link"
              className="h-auto p-0 text-lg font-semibold"
              onClick={() => onVenueClick(listing.venue.id, listing.venue.name)}
            >
              {listing.venue.name}
            </Button>
          ) : (
            listing.venue.name
          )}
          <span className="text-muted-foreground font-normal"> · {listing.court.name}</span>
        </p>
        {listing.venue.city ? (
          <p className="text-muted-foreground text-sm">{listing.venue.city}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums">
          {listing.confirmedSeats} / {listing.capacity} players
        </span>
        {listing.isFull ? (
          <Badge variant="secondary">Full</Badge>
        ) : (
          <Badge variant="outline">{seatsLeft} open</Badge>
        )}
        {action}
      </div>
    </Card>
  )
}

export { OpenPlayCard }
export type { OpenPlayCardProps }
