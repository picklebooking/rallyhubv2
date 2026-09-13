"use client"

import { AuthHeader } from "@/components/auth/auth-header"
import { LandingFooter } from "@/components/home/landing-footer"
import { OpenPlayCta } from "@/components/venues/open-play-cta"
import { VenueDirectory } from "@/components/venues/venue-directory"
import { VenuesIntro } from "@/components/venues/venues-intro"
import { VenuesSidebar } from "@/components/venues/venues-sidebar"

export function VenuesPage() {
  return (
    <>
      <AuthHeader />
      <main className="bg-background text-foreground min-h-svh pt-16">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
          <VenuesIntro />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <VenueDirectory />
            <VenuesSidebar />
          </div>
        </div>

        <OpenPlayCta />
      </main>
      <LandingFooter />
    </>
  )
}
