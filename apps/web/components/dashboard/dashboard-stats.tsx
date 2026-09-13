"use client"

import {
  RiBillLine,
  RiMoneyDollarCircleLine,
  RiPieChartLine,
} from "@remixicon/react"
import { motion } from "framer-motion"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { AnimatedCounter } from "@/components/shared/animated-counter"

const dashboardStats = [
  {
    icon: RiMoneyDollarCircleLine,
    label: "Some fake stats 1",
    value: 128430.0,
    trend: "+14.2%",
  },
  {
    icon: RiBillLine,
    label: "Some fake stats 2",
    value: 12340.5,
    trend: "3 Overdue",
  },
  {
    icon: RiPieChartLine,
    label: "Some fake stats 3",
    value: 45210.0,
    trend: "+8.1%",
  },
]

export function DashboardStats() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {dashboardStats.map((stat) => {
        const Icon = stat.icon

        return (
          <motion.div key={stat.label} whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            <Card className="border-t-4 border-primary rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
                  <Icon className="size-3.5" />
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <AnimatedCounter
                    value={stat.value}
                    decimals={2}
                    prefix="₱"
                    className="text-3xl font-black tracking-tight"
                  />
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {stat.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </section>
  )
}
