import { cn } from "@workspace/ui/lib/utils"

/**
 * Dark-navy court thumbnail: diagonal lime gradient wash + faint court-line
 * markings (sidelines + center line), matching the RallyHub brand mock.
 */
function CourtThumbnail({
  insetPercent = 14,
  className,
}: {
  insetPercent?: number
  className?: string
}) {
  return (
    <div className={cn("bg-brand-ink-elevated absolute inset-0", className)}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(215,242,5,0.55), rgba(30,33,38,0) 62%)",
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          left: `${insetPercent}%`,
          right: `${insetPercent}%`,
          borderLeft: "2px solid rgba(255,255,255,0.18)",
          borderRight: "2px solid rgba(255,255,255,0.18)",
        }}
      />
      <div
        className="absolute inset-x-0 top-1/2 h-[2px]"
        style={{ background: "rgba(255,255,255,0.18)" }}
      />
    </div>
  )
}

export { CourtThumbnail }
