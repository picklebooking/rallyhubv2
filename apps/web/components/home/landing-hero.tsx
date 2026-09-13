"use client"

import { RiCalendarLine, RiMapPinLine, RiSearchLine, RiTimeLine } from "@remixicon/react"
import { motion } from "framer-motion"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { fadeUp, staggerContainer } from "@/components/home/motion-presets"

const HUBS = [
  { value: "all", label: "Cebu City (All Hubs)" },
  { value: "it-park", label: "IT Park & Lahug" },
  { value: "mandaue", label: "Mandaue & Banilad" },
  { value: "business-park", label: "Cebu Business Park & Ayala" },
  { value: "mactan", label: "Mactan & Lapu-Lapu" },
]

const TIME_WINDOWS = [
  { value: "any", label: "Any Time" },
  { value: "morning", label: "Morning (6 AM - 12 PM)" },
  { value: "afternoon", label: "Afternoon (12 PM - 5 PM)" },
  { value: "evening", label: "Evening (5 PM - 11 PM)" },
]

export function LandingHero() {
  return (
    <section className="border-brand-ink/20 bg-brand-ink-elevated relative overflow-hidden border-b px-6 py-20 sm:py-28">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px] opacity-100" />
      <div className="absolute -top-40 -left-40 -z-10 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-primary via-primary/50 to-transparent blur-[120px] opacity-30" />

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <motion.div
          variants={fadeUp}
          className="bg-brand-ink/60 mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5"
        >
          <span className="bg-primary size-1.5 animate-pulse rounded-full" />
          <span className="text-xs font-semibold text-white">
            Verified courts in Cebu City
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-heading text-4xl font-black tracking-tight text-white text-balance sm:text-5xl"
        >
          Book pickleball courts with{" "}
          <span className="text-primary">zero friction</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-5 max-w-2xl text-base leading-relaxed text-white/82"
        >
          Discover and reserve championship courts across IT Park, Mandaue,
          Banilad, and Mactan with automated pin-code access.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="border-white/12 bg-white mt-10 w-full rounded-2xl border p-5 text-left shadow-lg sm:p-6"
        >
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
            <div className="flex flex-col gap-1.5 md:col-span-4">
              <Label className="text-muted-foreground text-xs">
                <RiMapPinLine className="size-3.5" />
                Location
              </Label>
              <Select defaultValue="all">
                <SelectTrigger className="h-11 w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUBS.map((hub) => (
                    <SelectItem key={hub.value} value={hub.value}>
                      {hub.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-3">
              <Label htmlFor="court-date" className="text-muted-foreground text-xs">
                <RiCalendarLine className="size-3.5" />
                Date
              </Label>
              <Input
                id="court-date"
                type="date"
                defaultValue="2026-09-13"
                className="h-11 rounded-lg"
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-3">
              <Label className="text-muted-foreground text-xs">
                <RiTimeLine className="size-3.5" />
                Time window
              </Label>
              <Select defaultValue="any">
                <SelectTrigger className="h-11 w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_WINDOWS.map((window) => (
                    <SelectItem key={window.value} value={window.value}>
                      {window.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Button asChild size="lg" className="h-11 w-full rounded-lg">
                <a href="#featured-facilities">
                  <RiSearchLine data-icon="inline-start" />
                  Search
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
