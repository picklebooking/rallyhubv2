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

function PickleBall({
  className,
  floatDuration = 5,
  floatDelay = 0,
}: {
  className?: string
  floatDuration?: number
  floatDelay?: number
}) {
  return (
    <motion.div
      className={className}
      style={{
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 32% 28%, #F3FF9E 0%, #D7F205 42%, #9CB300 78%, #7A8C00 100%)",
        boxShadow: "0 20px 60px -10px rgba(215, 242, 5, 0.35)",
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1, y: [0, -16, 0] }}
      transition={{
        opacity: { duration: 0.8, ease: "easeOut" },
        scale: { duration: 0.8, ease: "easeOut" },
        y: {
          duration: floatDuration,
          delay: floatDelay,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
    />
  )
}

export function LandingHero() {
  return (
    <section className="border-brand-ink/20 bg-brand-ink-elevated relative overflow-hidden border-b px-6 py-28 sm:py-36 lg:py-44">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-y-0 left-1/2 -z-10 w-px -translate-x-1/2 bg-white/[0.06]" />

      {/* Oversized faint "R" watermark */}
      <span
        aria-hidden="true"
        className="font-heading pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-[32rem] leading-none font-black text-white/[0.03] select-none"
      >
        R
      </span>

      {/* Decorative pickleballs */}
      <PickleBall
        className="absolute -top-16 -left-16 -z-10 size-44 sm:size-56"
        floatDuration={6}
      />
      <PickleBall
        className="absolute top-10 right-6 -z-10 size-16 sm:top-14 sm:right-16 sm:size-24"
        floatDuration={4.5}
        floatDelay={0.6}
      />

      {/* Floating live-match score card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
        className="absolute bottom-8 left-6 z-10 hidden xl:block"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
          className="border-white/10 bg-brand-ink w-52 rounded-xl border p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-white/70 uppercase">
              Court 2
            </span>
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
              <span className="bg-primary-foreground size-1.5 animate-pulse rounded-full" />
              LIVE
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Kent &amp; Mark</span>
              <span className="text-primary text-lg font-black">11</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Aaron &amp; Em</span>
              <span className="text-lg font-black text-white">08</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating booking slot card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
        className="absolute bottom-24 right-6 z-10 hidden xl:block"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
          className="bg-white w-52 rounded-xl p-4 text-left shadow-xl"
        >
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Today · 5:00 PM
          </p>
          <p className="mt-1 text-sm font-bold text-foreground">The Baseline Club</p>
          <p className="text-muted-foreground text-xs">IT Park, Lahug · Court 2</p>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">
              ₱800<span className="text-muted-foreground text-xs font-normal">/hr</span>
            </span>
            <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold">
              3 slots left
            </span>
          </div>
        </motion.div>
      </motion.div>

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
              <Button asChild size="lg" className="h-11 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
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
