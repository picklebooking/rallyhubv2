import { AnimatedCounter } from "@/components/shared/animated-counter"

const STATS = [
  { target: 124, decimals: 0, label: "Active courts" },
  { target: 42, decimals: 0, label: "Slots today" },
  { target: 4.89, decimals: 2, label: "Avg. player rating" },
]

function VenuesIntro() {
  return (
    <div className="bg-brand-ink rounded-2xl p-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <span className="bg-brand-ink-elevated text-white/70 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <span className="bg-primary size-1.5 rounded-full" />
          Live availability · Cebu City
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-normal md:text-4xl text-white">
          All 18 partner hubs & venues
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/70">
          Championship air-conditioned arenas, covered all-weather community
          hubs, and floodlit rooftop courts — book instant time slots with
          real-time availability.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <AnimatedCounter
              value={stat.target}
              decimals={stat.decimals}
              className="text-primary block text-xl font-black tracking-tight"
            />
            <p className="text-white/60 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export { VenuesIntro }
