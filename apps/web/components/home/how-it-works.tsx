"use client"

import { motion } from "framer-motion"

import { fadeUp, viewportOnce } from "@/components/home/motion-presets"

const STEPS = [
  {
    number: "01",
    title: "One account",
    description:
      "Discover independent venues and parks across the metro with one login.",
  },
  {
    number: "02",
    title: "Instant split-pay",
    description:
      "Add players during checkout. Everyone is automatically billed their share with zero manual collection.",
  },
  {
    number: "03",
    title: "Digital gate access",
    description:
      "Receive automated door PINs and light activations timed precisely to your booking window.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-brand-ink/20 bg-brand-ink border-y px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mb-10 max-w-2xl space-y-2"
        >
          <h2 className="font-heading text-3xl font-semibold tracking-normal text-white">
            How it works
          </h2>
          <p className="text-sm leading-relaxed text-white/70">
            From finding an open court to unlocking gate lights, RallyHub
            removes the hassle.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.08 }}
              className="bg-brand-ink-elevated rounded-xl p-6"
            >
              <span className="font-heading text-4xl font-black" style={{ color: "#FF8A5B" }}>
                {step.number}
              </span>
              <h3 className="mt-2 text-base font-bold text-white">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
