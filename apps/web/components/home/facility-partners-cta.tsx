"use client"

import { motion } from "framer-motion"

import { Button } from "@workspace/ui/components/button"

import { fadeUp, viewportOnce } from "@/components/home/motion-presets"

export function FacilityPartnersCta() {
  return (
    <section className="bg-background px-6 py-16">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        variants={fadeUp}
        className="border-border bg-card mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 rounded-[26px] border p-9 sm:flex-row"
      >
        <div className="max-w-xl">
          <h2 className="font-heading text-2xl font-extrabold tracking-[-0.02em]">
            Facility partners
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Automate door locks, court lighting, player reservations, and
            payments with our unified club software.
          </p>
        </div>
        <Button size="lg" className="bg-brand-ink shrink-0 rounded-full font-bold text-white hover:bg-brand-ink/90">
          List your facility
        </Button>
      </motion.div>
    </section>
  )
}
