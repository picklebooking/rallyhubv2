"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import type { ListOpenPlayQuery } from "@workspace/shared"

import { AuthHeader } from "@/components/auth/auth-header"
import { LandingFooter } from "@/components/home/landing-footer"
import { localDayRange } from "@/components/open-play/open-play-dates"
import { OpenPlayFilters } from "@/components/open-play/open-play-filters"
import { OpenPlayIntro } from "@/components/open-play/open-play-intro"
import { OpenPlayList } from "@/components/open-play/open-play-list"

function OpenPlayPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const date = searchParams.get("date") ?? ""
  const venueId = searchParams.get("venueId")
  const venueName = searchParams.get("venueName")
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1)

  const query = useMemo<ListOpenPlayQuery>(
    () => ({
      page,
      ...(venueId ? { venueId } : {}),
      ...(date ? localDayRange(date) ?? {} : {}),
    }),
    [date, venueId, page]
  )

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <AuthHeader />
      <main className="bg-background text-foreground min-h-svh pt-16">
        <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
          <OpenPlayIntro />
          <OpenPlayFilters
            date={date}
            venueName={venueId ? (venueName ?? "Selected venue") : null}
            onDateChange={(value) => update({ date: value || null, page: null })}
            onClearVenue={() => update({ venueId: null, venueName: null, page: null })}
          />
          <OpenPlayList
            query={query}
            onVenueClick={(id, name) => update({ venueId: id, venueName: name, page: null })}
            onPageChange={(next) => update({ page: String(next) })}
          />
        </div>
      </main>
      <LandingFooter />
    </>
  )
}

export { OpenPlayPage }
