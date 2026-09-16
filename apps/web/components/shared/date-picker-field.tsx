"use client"

import { useState } from "react"
import { RiArrowDownSLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

type DatePickerFieldProps = {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  id?: string
  className?: string
  placeholder?: string
}

function DatePickerField({
  value,
  onChange,
  id,
  className,
  placeholder = "Pick a date",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-11 w-full justify-between rounded-full border-transparent bg-input/50 px-3 font-normal shadow-none hover:border-border/60 hover:bg-input/70",
            className
          )}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? formatDate(value) : placeholder}
          </span>
          <RiArrowDownSLine className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-3xl p-0">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export { DatePickerField }
