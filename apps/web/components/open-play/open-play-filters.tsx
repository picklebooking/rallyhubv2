"use client"

import { RiCloseLine } from "@remixicon/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type OpenPlayFiltersProps = {
  date: string
  venueName: string | null
  onDateChange: (date: string) => void
  onClearVenue: () => void
}

function OpenPlayFilters({ date, venueName, onDateChange, onClearVenue }: OpenPlayFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="open-play-date">Date</Label>
        <Input
          id="open-play-date"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="w-44"
        />
      </div>
      {date ? (
        <Button variant="ghost" size="sm" onClick={() => onDateChange("")}>
          Any date
        </Button>
      ) : null}
      {venueName ? (
        <Badge variant="secondary" className="gap-1 py-1 pr-1">
          Venue: {venueName}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear venue filter"
            onClick={onClearVenue}
          >
            <RiCloseLine />
          </Button>
        </Badge>
      ) : null}
    </div>
  )
}

export { OpenPlayFilters }
