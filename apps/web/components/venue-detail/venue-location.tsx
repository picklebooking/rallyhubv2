import { RiMapPin2Line, RiPhoneLine, RiRouteLine } from "@remixicon/react"

const INFO_BLOCKS = [
  {
    icon: RiRouteLine,
    title: "Walking from Ayala Center Cebu",
    description:
      "8-minute walk north along Cardinal Rosales Ave. Club entrance is on the ground level.",
  },
  {
    icon: RiPhoneLine,
    title: "Concierge & assistance",
    description: "On-site support available, or live chat inside the app.",
  },
]

function VenueLocation({ mapQuery }: { mapQuery: string }) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">
          Location, parking & transit guide
        </h2>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm font-medium hover:underline"
        >
          Open in Google Maps
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="bg-muted relative flex h-64 items-center justify-center overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.85_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0_0)_1px,transparent_1px)] bg-[size:24px_24px] opacity-50 dark:bg-[linear-gradient(to_right,oklch(1_0_0/6%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/6%)_1px,transparent_1px)]" />
          <div className="text-muted-foreground relative flex flex-col items-center gap-1.5 text-center text-xs">
            <RiMapPin2Line className="text-primary size-5" />
            Cebu City map preview
          </div>
        </div>

        <div className="space-y-3">
          {INFO_BLOCKS.map((block) => (
            <div key={block.title} className="bg-muted rounded-xl p-4">
              <div className="flex items-center gap-2">
                <block.icon className="text-primary size-4" />
                <span className="text-sm font-semibold">{block.title}</span>
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                {block.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { VenueLocation }
