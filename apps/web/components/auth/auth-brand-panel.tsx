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
    <div className="bg-muted relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0.88_0_0)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.88_0_0)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 dark:bg-[linear-gradient(to_right,oklch(1_0_0/5%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/5%)_1px,transparent_1px)]" />
      <div className="bg-primary/15 absolute -top-32 -right-32 -z-10 h-[420px] w-[420px] rounded-full blur-[100px]" />

      <div className="space-y-3">
        <span className="bg-background text-muted-foreground inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
          RallyHub PH · Official Network
        </span>
        <h2 className="text-4xl leading-tight font-black tracking-tight text-balance">
          {isSignUp
            ? "Join thousands of players across Metro Manila."
            : "Elevate your dink game in Manila."}
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          {isSignUp
            ? "Find courts in BGC, Pasig, Mandaluyong & QC. Never miss a game."
            : "Instant court access, live partner matchmaking, and hassle-free split bookings across the metro."}
        </p>
      </div>

      <div className="space-y-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex items-start gap-3">
            <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-lg">
              <feature.icon className="text-primary size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{feature.title}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border flex items-center gap-6 border-t pt-6">
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

export { AuthBrandPanel }
