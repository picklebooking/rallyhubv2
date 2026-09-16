import Image from "next/image"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Court photo thumbnail with a subtle navy tint so real photography still
 * reads as part of the dark brand palette. Falls back to the decorative
 * diagonal lime-gradient + court-line treatment when no image is given.
 */
function CourtThumbnail({
  src,
  alt = "",
  insetPercent = 14,
  className,
  priority,
}: {
  src?: string
  alt?: string
  insetPercent?: number
  className?: string
  priority?: boolean
}) {
  if (src) {
    return (
      <div className={cn("bg-brand-ink-elevated absolute inset-0", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(18,20,23,0.05) 0%, rgba(18,20,23,0.35) 100%)",
          }}
        />
      </div>
    )
  }

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
