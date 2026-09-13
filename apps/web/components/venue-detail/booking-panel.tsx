"use client"

import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

type SlotStatus = "available" | "booked" | "selected"

type Slot = {
  key: string
  time: string
  price: number
  status: SlotStatus
  tag?: string
}

type Period = {
  name: string
  window: string
  rate: string
  highDemand?: boolean
  slots: Slot[]
}

const DATES = [
  { label: "Today", day: "25", sub: "Tue • Mar" },
  { label: "Tomorrow", day: "26", sub: "Wed • Mar" },
  { label: "Weekday", day: "27", sub: "Thu • Mar" },
  { label: "Prime Fri", day: "28", sub: "Fri • Mar" },
  { label: "Weekend", day: "29", sub: "Sat • Mar" },
  { label: "Weekend", day: "30", sub: "Sun • Mar" },
]

const PERIODS: Period[] = [
  {
    name: "Morning play",
    window: "6:00 AM – 12:00 PM",
    rate: "Standard rate",
    slots: [
      { key: "06-07", time: "6:00 – 7:00 AM", price: 700, status: "booked" },
      { key: "07-08", time: "7:00 – 8:00 AM", price: 700, status: "available", tag: "Club drill clinic" },
      { key: "08-09", time: "8:00 – 9:00 AM", price: 700, status: "available" },
      { key: "10-11", time: "10:00 – 11:00 AM", price: 700, status: "available" },
    ],
  },
  {
    name: "Afternoon play",
    window: "1:00 PM – 5:00 PM",
    rate: "Standard rate",
    slots: [
      { key: "13-14", time: "1:00 – 2:00 PM", price: 750, status: "booked", tag: "Open court" },
      { key: "14-15", time: "2:00 – 3:00 PM", price: 750, status: "booked" },
      { key: "15-16", time: "3:00 – 4:00 PM", price: 750, status: "available" },
      { key: "16-17", time: "4:00 – 5:00 PM", price: 750, status: "available" },
    ],
  },
  {
    name: "Prime evening",
    window: "6:00 PM – 9:00 PM",
    rate: "Peak rate",
    highDemand: true,
    slots: [
      { key: "18-19", time: "6:00 – 7:00 PM", price: 800, status: "selected" },
      { key: "19-20", time: "7:00 – 8:00 PM", price: 800, status: "booked", tag: "Cebu Corporate Cup" },
      { key: "20-21", time: "9:00 – 10:00 PM", price: 800, status: "available" },
    ],
  },
]

const ADD_ONS = [
  {
    id: "paddle-rental",
    label: "Paddle rental set",
    description: "2 Selkirk paddles + 3 balls",
    price: "+₱150",
  },
  {
    id: "ball-machine",
    label: "Tutor Pro ball machine",
    description: "60 mins automated feeding",
    price: "+₱300",
  },
  {
    id: "dupr-recording",
    label: "DUPR cloud recording",
    description: "Court 2 HD video + stats",
    price: "Free · included",
  },
]

function statusClasses(status: SlotStatus) {
  if (status === "selected") return "bg-primary text-primary-foreground"
  if (status === "booked")
    return "bg-brand-ink text-white/40 line-through cursor-not-allowed opacity-60"
  return "bg-background hover:bg-primary/10 hover:text-primary text-foreground border border-border"
}

function BookingPanel() {
  const [selectedDate, setSelectedDate] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState("18-19")
  const [addOns, setAddOns] = useState<Record<string, boolean>>({
    "paddle-rental": true,
    "ball-machine": false,
    "dupr-recording": true,
  })

  return (
    <Card className="gap-5 p-6">
      <div>
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">
          Step 1 · Instant court booking
        </p>
        <h2 className="font-heading mt-1 text-xl font-semibold">
          Select schedule & time slot
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {DATES.map((date, i) => (
          <button
            key={`${date.label}-${date.day}`}
            type="button"
            onClick={() => setSelectedDate(i)}
            className={cn(
              "flex flex-col items-center rounded-lg px-2 py-2.5 text-center transition-colors",
              i === selectedDate
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-[11px] font-medium">{date.label}</span>
            <span className="text-lg font-bold">{date.day}</span>
            <span className="text-[10px] opacity-80">{date.sub}</span>
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {PERIODS.map((period) => (
          <div key={period.name}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">{period.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {period.window} · {period.rate}
                </span>
              </div>
              {period.highDemand ? (
                <Badge className="bg-primary/20 border border-primary/40 text-primary">
                  High demand
                </Badge>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {period.slots.map((slot) => {
                const isSelected = slot.key === selectedSlot
                const status: SlotStatus =
                  slot.status === "booked" ? "booked" : isSelected ? "selected" : "available"

                return (
                  <button
                    key={slot.key}
                    type="button"
                    disabled={slot.status === "booked"}
                    onClick={() => setSelectedSlot(slot.key)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                      statusClasses(status)
                    )}
                  >
                    <span className="block font-semibold">{slot.time}</span>
                    <span className="block opacity-80">
                      {slot.tag ?? `₱${slot.price}/hr`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-border space-y-3 border-t pt-5">
        <p className="text-sm font-semibold">Add-ons & tournament tech</p>
        {ADD_ONS.map((addOn) => (
          <div key={addOn.id} className="flex items-start gap-3">
            <Checkbox
              id={addOn.id}
              checked={addOns[addOn.id]}
              onCheckedChange={(checked) =>
                setAddOns((prev) => ({ ...prev, [addOn.id]: checked === true }))
              }
            />
            <Label htmlFor={addOn.id} className="flex-1 flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{addOn.label}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {addOn.description}
              </span>
            </Label>
            <span className="text-muted-foreground text-xs font-semibold whitespace-nowrap">
              {addOn.price}
            </span>
          </div>
        ))}
      </div>

      <Button size="lg" className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
        Reserve court
      </Button>
    </Card>
  )
}

export { BookingPanel }
