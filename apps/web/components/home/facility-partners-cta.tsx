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
        className="border-t-4 border-primary bg-card mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 rounded-2xl p-8 sm:flex-row sm:p-10"
      >
        <div className="max-w-xl">
          <h2 className="font-heading text-xl font-semibold">
            Facility partners
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Automate door locks, court lighting, player reservations, and
            payments with our unified club software.
          </p>
        </div>
        <Button size="lg" className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          List your facility
        </Button>
      </motion.div>
    </section>
  )
}
