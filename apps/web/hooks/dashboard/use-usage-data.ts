"use client"

export interface UsageDataPoint {
  time: string
  revenue: number
  fill: string
}

const COLORS = [
  "#10b981", // emerald
  "#38bdf8", // sky
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#fbbf24", // amber
  "#d946ef", // fuchsia
  "#22d3ee", // cyan
]

const SAMPLE_REVENUES = [
  18500, 24200, 31800, 46500, 58900, 72300, 88600, 95400, 81200, 64700, 42900,
  27300,
]

const USAGE_DATA: UsageDataPoint[] = SAMPLE_REVENUES.map((revenue, i) => ({
  time: `${(i * 2).toString().padStart(2, "0")}:00`,
  revenue,
  fill: COLORS[i % COLORS.length] as string,
}))

export function useUsageData(): {
  data: UsageDataPoint[]
  currencySymbol: string
} {
  return {
    data: USAGE_DATA,
    currencySymbol: "₱",
  }
}
