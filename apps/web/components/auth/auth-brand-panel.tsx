"use client"

import { RiCalendarCheckLine, RiShieldCheckLine, RiTeamLine } from "@remixicon/react"
import { motion } from "framer-motion"

import { AnimatedCounter } from "@/components/shared/animated-counter"
import { fadeUp, staggerContainer } from "@/components/home/motion-presets"

const FEATURES = [
  {
    icon: RiTeamLine,
    title: "One account, every venue",
    description:
      "Discover independent clubs and parks across the metro with a single login.",
  },
  {
    icon: RiShieldCheckLine,
    title: "Instant split-pay",
    description:
      "Add players at checkout. Everyone is billed their share automatically.",
  },
  {
    icon: RiCalendarCheckLine,
    title: "Instant confirmation",
    description:
      "Get your booking confirmed instantly, with reminders ahead of your session.",
  },
]

const STATS = [
  { target: 120, decimals: 0, suffix: "+", label: "Partner courts" },
  { target: 48, decimals: 0, suffix: "k+", label: "Hours booked" },
  { target: 4.9, decimals: 1, suffix: "", label: "Player rating" },
]

function AuthBrandPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"

  return (
    <div className="bg-brand-ink relative isolate hidden flex-col justify-between overflow-hidden p-10 lg:flex">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <motion.div
        aria-hidden="true"
        className="bg-primary/15 absolute -top-32 -right-32 -z-10 h-[420px] w-[420px] rounded-full blur-[100px]"
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-24 -left-16 -z-10 h-[260px] w-[260px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #E8FF5C, #B6CE00 62%, rgba(182,206,0,0) 72%)",
          filter: "blur(50px)",
          opacity: 0.14,
        }}
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        key={mode}
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="space-y-3"
      >
        <motion.span
          variants={fadeUp}
          className="bg-brand-ink-elevated text-white/70 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
        >
          <span className="size-[6px] animate-pulse rounded-full bg-primary" />
          RallyHub PH · Official Network
        </motion.span>
        <motion.h2
          variants={fadeUp}
          className="text-4xl leading-tight font-black tracking-tight text-balance text-white"
        >
          {isSignUp
            ? "Join thousands of players across Cebu City."
            : "Elevate your dink game in Cebu."}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="max-w-sm text-sm leading-relaxed text-white/70"
        >
          {isSignUp
            ? "Find courts in IT Park, Mandaue, Banilad & Mactan. Never miss a game."
            : "Instant court access, live partner matchmaking, and hassle-free split bookings across the city."}
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="space-y-4"
      >
        {FEATURES.map((feature) => (
          <motion.div
            key={feature.title}
            variants={fadeUp}
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-start gap-3"
          >
            <div className="bg-brand-ink-elevated flex size-9 shrink-0 items-center justify-center rounded-lg">
              <feature.icon className="text-primary size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{feature.title}</p>
              <p className="text-white/60 text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="border-white/14 flex items-center gap-6 border-t pt-6"
      >
        {STATS.map((stat) => (
          <motion.div key={stat.label} variants={fadeUp}>
            <AnimatedCounter
              value={stat.target}
              decimals={stat.decimals}
              suffix={stat.suffix}
              className="text-primary text-xl font-black tracking-tight"
            />
            <p className="text-white/60 text-xs">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export { AuthBrandPanel }
