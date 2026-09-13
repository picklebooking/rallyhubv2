import {
  RiCarLine,
  RiCupLine,
  RiFlashlightLine,
  RiFocus3Line,
  RiHeartPulseLine,
  RiShowersLine,
  RiTempColdLine,
  RiTShirtLine,
  RiWifiLine,
} from "@remixicon/react"

const SPECS = [
  {
    icon: RiFocus3Line,
    title: "Acrytech tournament surface",
    description:
      "8mm multi-layer cushion reduces joint fatigue and ensures a true, predictable ball skid.",
  },
  {
    icon: RiFlashlightLine,
    title: "750 lux broadcast lighting",
    description:
      "Even glare-free LED luminaires mapped directly to championship standards.",
  },
  {
    icon: RiTempColdLine,
    title: "Commercial climate control",
    description:
      "Constant 23°C arena environment, protected against Cebu humidity and rain.",
  },
]

const FACILITIES = [
  { icon: RiShowersLine, label: "Hot showers & lockers" },
  { icon: RiTempColdLine, label: "Reverse-osmosis water" },
  { icon: RiWifiLine, label: "High-speed player WiFi" },
  { icon: RiCarLine, label: "Free guarded parking (4 hrs)" },
  { icon: RiCupLine, label: "Specialty matcha & coffee" },
  { icon: RiTShirtLine, label: "Pro shop stringing / grip" },
  { icon: RiHeartPulseLine, label: "AED & first aid station" },
]

function VenueSpecs() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          Court specs & engineering
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SPECS.map((spec) => (
            <div key={spec.title} className="bg-muted rounded-xl p-5">
              <spec.icon className="text-primary size-5" />
              <p className="mt-2 text-sm font-semibold">{spec.title}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {spec.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold">
          Club facilities & inclusions
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {FACILITIES.map((facility) => (
            <div key={facility.label} className="flex items-center gap-2.5">
              <facility.icon className="text-primary size-4 shrink-0" />
              <span className="text-sm">{facility.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { VenueSpecs }
