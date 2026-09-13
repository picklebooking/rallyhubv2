"use client"

import { motion } from "framer-motion"

import { fadeUp, viewportOnce } from "@/components/home/motion-presets"

const METRICS = [
  { value: "120+", label: "Partner courts active across Cebu City" },
  { value: "48k+", label: "Hours booked in 2026" },
  { value: "4.9", label: "Average community player rating" },
]

const TESTIMONIALS = [
  {
    quote:
      "Booking The Baseline Club takes 30 seconds and split payments make organizing doubles completely seamless.",
    name: "Coach Anton Reyes",
    role: "Cebu Pickleball League",
  },
  {
    quote:
      "Automated gate access codes increased our court occupancy and simplified check-ins dramatically.",
    name: "Bianca M.",
    role: "Apex Racquet Center",
  },
]

export function MetricsTestimonials() {
  return (
    <section className="bg-background px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mb-14 grid grid-cols-1 gap-8 sm:grid-cols-3"
        >
          {METRICS.map((metric) => (
            <div key={metric.label}>
              <span className="text-4xl font-black tracking-tight">
                {metric.value}
              </span>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {metric.label}
              </p>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {TESTIMONIALS.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.08 }}
              className="bg-muted rounded-xl p-6"
            >
              <p className="text-sm leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-4">
                <span className="text-sm font-bold">{testimonial.name}</span>
                <p className="text-muted-foreground text-sm">
                  {testimonial.role}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
