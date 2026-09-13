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
    <section className="bg-background px-6 pt-4 pb-[88px]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mb-14 grid grid-cols-1 gap-8 sm:grid-cols-3"
        >
          {METRICS.map((metric) => (
            <motion.div
              key={metric.label}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="border-primary border-t-[3px] pt-4"
            >
              <span className="font-heading text-[46px] leading-none font-black tracking-[-0.03em]">
                {metric.value}
              </span>
              <p className="text-muted-foreground mt-2 text-sm">
                {metric.label}
              </p>
            </motion.div>
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
              whileHover={{ y: -6 }}
              className="border-border bg-card rounded-[20px] border p-[26px] shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(12,14,17,0.1)]"
            >
              <span className="font-heading text-primary block text-[40px] leading-[0.6] font-black">
                &ldquo;
              </span>
              <p className="mt-2.5 text-[15px] leading-[1.7]">
                {testimonial.quote}
              </p>
              <div className="mt-[18px]">
                <span className="text-sm font-extrabold">{testimonial.name}</span>
                <p className="text-muted-foreground mt-0.5 text-sm">
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
