const STATS = [
  { value: "124", label: "Active courts" },
  { value: "42", label: "Slots today" },
  { value: "4.89", label: "Avg. player rating" },
]

function VenuesIntro() {
  return (
    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <span className="bg-primary size-1.5 rounded-full" />
          Live availability · Metro Manila
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-normal md:text-4xl">
          All 18 partner hubs & venues
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Championship air-conditioned arenas, covered all-weather community
          hubs, and floodlit rooftop courts — book instant time slots with
          automated gate PINs.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="text-xl font-black tracking-tight">{stat.value}</p>
            <p className="text-muted-foreground text-xs">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export { VenuesIntro }
