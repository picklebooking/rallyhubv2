"use client"

import {
  RiCalendarLine,
  RiMapPinLine,
  RiSearchLine,
  RiTimeLine,
} from "@remixicon/react"
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
    <section className="relative isolate overflow-hidden border-b border-brand-ink bg-brand-ink-elevated px-6 pt-28 pb-32 sm:pt-32 sm:pb-40">
      {/* Court-line markings (baseline, sidelines, center line) + oversized "R" watermark */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ opacity: 0.5 }}
      >
        <div
          className="absolute left-1/2 w-[2px] -translate-x-1/2"
          style={{
            top: -60,
            bottom: -60,
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <div
          className="absolute h-[2px]"
          style={{
            left: "6%",
            right: "6%",
            top: "22%",
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          className="absolute h-[2px]"
          style={{
            left: "6%",
            right: "6%",
            bottom: "16%",
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          className="absolute"
          style={{
            left: "6%",
            right: "6%",
            top: "22%",
            bottom: "16%",
            borderLeft: "2px solid rgba(255,255,255,0.14)",
            borderRight: "2px solid rgba(255,255,255,0.14)",
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 font-heading leading-none font-black select-none"
          style={{
            top: -120,
            fontSize: 520,
            color: "rgba(255,255,255,0.035)",
            letterSpacing: "-0.06em",
          }}
          animate={{ x: ["-50%", "-49%", "-50%"] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        >
          R
        </motion.div>
      </div>

      {/* Decorative pickleballs */}
      <motion.div
        className="pointer-events-none absolute -z-10"
        style={{
          left: -90,
          top: -70,
          width: 260,
          height: 260,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at 35% 35%, #E8FF5C, #B6CE00 62%, rgba(182,206,0,0) 72%)",
          filter: "blur(6px)",
        }}
        animate={{ opacity: [0.7, 0.95, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -z-10"
        style={{
          right: 60,
          top: 70,
          width: 96,
          height: 96,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at 35% 35%, #E8FF5C, #B6CE00 65%, rgba(182,206,0,0) 74%)",
          filter: "blur(3px)",
        }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating live-match score card */}
      <motion.div
        className="absolute z-10 hidden w-[214px] rounded-[18px] px-4 py-3.5 2xl:block"
        style={{
          left: 32,
          bottom: 56,
          background: "#121417",
          boxShadow: "0 18px 40px rgba(10,12,15,0.45)",
          rotate: "-5deg",
        }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold"
            style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}
          >
            COURT 2
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full text-[10px] font-extrabold"
            style={{
              padding: "3px 8px",
              background: "#D7F205",
              color: "#141600",
              letterSpacing: "0.06em",
            }}
          >
            <span
              className="size-[5px] animate-pulse rounded-full"
              style={{ background: "#141600" }}
            />
            LIVE
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2.5">
          <span className="font-heading text-[13px] font-bold text-white">
            Steban &amp; Jefone
          </span>
          <span
            className="font-heading text-[22px] font-black"
            style={{ color: "#D7F205" }}
          >
            11
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2.5">
          <span
            className="font-heading text-[13px] font-bold"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Patrick &amp; John
          </span>
          <span
            className="font-heading text-[22px] font-black"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            08
          </span>
        </div>
      </motion.div>

      {/* Floating booking slot card */}
      <motion.div
        className="absolute z-10 hidden w-[236px] rounded-[18px] bg-white px-4 py-3.5 text-left 2xl:block"
        style={{
          right: 32,
          bottom: 88,
          boxShadow: "0 18px 40px rgba(10,12,15,0.3)",
          rotate: "4deg",
        }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="text-[10px] font-extrabold"
          style={{ color: "#6B7076", letterSpacing: "0.1em" }}
        >
          TODAY · 5:00 PM
        </div>
        <div
          className="mt-1.5 font-heading text-[16px] font-bold"
          style={{ color: "#15171A" }}
        >
          The Baseline Club
        </div>
        <div className="mt-1 text-[12px]" style={{ color: "#6B7076" }}>
          IT Park, Lahug · Court 2
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className="text-[13px] font-extrabold"
            style={{ color: "#15171A" }}
          >
            ₱800
            <span
              className="text-[11px] font-medium"
              style={{ color: "#6B7076" }}
            >
              /hr
            </span>
          </span>
          <span
            className="rounded-full text-[11px] font-extrabold"
            style={{
              padding: "4px 10px",
              background: "#F0F6D4",
              color: "#4A5900",
            }}
          >
            3 slots left
          </span>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="relative mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <motion.div
          variants={fadeUp}
          className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <span className="size-[7px] animate-pulse rounded-full bg-primary" />
          <span className="text-xs font-semibold text-white">
            Verified courts in Cebu City
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-heading text-balance text-white"
          style={{
            fontSize: "clamp(44px, 6.4vw, 76px)",
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.035em",
          }}
        >
          Book pickleball courts with{" "}
          <span className="text-primary">zero friction</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-[22px] max-w-[660px] text-[18px] leading-[1.6]"
          style={{ color: "rgba(255,255,255,0.82)" }}
        >
          Discover and reserve championship courts across IT Park, Mandaue,
          Banilad, and Mactan with real-time availability.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-10 w-full rounded-[24px] bg-white p-[22px] text-left"
          style={{ boxShadow: "0 24px 60px rgba(10,12,15,0.34)" }}
        >
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
            <div className="flex flex-col gap-2 md:col-span-4">
              <Label className="text-xs text-muted-foreground">
                <RiMapPinLine className="size-3.5" />
                Location
              </Label>
              <Select defaultValue="all">
                <SelectTrigger className="!h-11 w-full rounded-full">
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

            <div className="flex flex-col gap-2 md:col-span-3">
              <Label
                htmlFor="court-date"
                className="text-xs text-muted-foreground"
              >
                <RiCalendarLine className="size-3.5" />
                Date
              </Label>
              <Input
                id="court-date"
                type="date"
                defaultValue="2026-09-13"
                className="h-11 rounded-full"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-3">
              <Label className="text-xs text-muted-foreground">
                <RiTimeLine className="size-3.5" />
                Time window
              </Label>
              <Select defaultValue="any">
                <SelectTrigger className="!h-11 w-full rounded-full">
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
              <Button
                asChild
                size="lg"
                className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
              >
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
