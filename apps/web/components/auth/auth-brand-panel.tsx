import { RiKeyLine, RiShieldCheckLine, RiTeamLine } from "@remixicon/react"

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
    icon: RiKeyLine,
    title: "Digital gate access",
    description:
      "Automated door PINs unlock precisely when your booking window starts.",
  },
]

const STATS = [
  { value: "120+", label: "Partner courts" },
  { value: "48k+", label: "Hours booked" },
  { value: "4.9", label: "Player rating" },
]

function AuthBrandPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"

  return (
    <div className="bg-brand-ink relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="bg-primary/15 absolute -top-32 -right-32 -z-10 h-[420px] w-[420px] rounded-full blur-[100px]" />

      <div className="space-y-3">
        <span className="bg-brand-ink-elevated text-white/70 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
          RallyHub PH · Official Network
        </span>
        <h2 className="text-4xl leading-tight font-black tracking-tight text-balance text-white">
          {isSignUp
            ? "Join thousands of players across Cebu City."
            : "Elevate your dink game in Cebu."}
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-white/70">
          {isSignUp
            ? "Find courts in IT Park, Mandaue, Banilad & Mactan. Never miss a game."
            : "Instant court access, live partner matchmaking, and hassle-free split bookings across the city."}
        </p>
      </div>

      <div className="space-y-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex items-start gap-3">
            <div className="bg-brand-ink-elevated flex size-9 shrink-0 items-center justify-center rounded-lg">
              <feature.icon className="text-primary size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{feature.title}</p>
              <p className="text-white/60 text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-white/14 flex items-center gap-6 border-t pt-6">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="text-xl font-black tracking-tight text-primary">{stat.value}</p>
            <p className="text-white/60 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export { AuthBrandPanel }
