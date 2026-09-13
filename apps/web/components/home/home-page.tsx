"use client"

import { AuthHeader } from "@/components/auth/auth-header"
import { FacilityPartnersCta } from "@/components/home/facility-partners-cta"
import { FeaturedFacilities } from "@/components/home/featured-facilities"
import { HowItWorks } from "@/components/home/how-it-works"
import { LandingFooter } from "@/components/home/landing-footer"
import { LandingHero } from "@/components/home/landing-hero"
import { MetricsTestimonials } from "@/components/home/metrics-testimonials"
import { TodaysOpenings } from "@/components/home/todays-openings"

export function HomePage() {
  return (
    <>
      <AuthHeader />
      <main className="bg-background text-foreground min-h-svh">
        <LandingHero />
        <TodaysOpenings />
        <FeaturedFacilities />
        <HowItWorks />
        <FacilityPartnersCta />
        <MetricsTestimonials />
      </main>
      <LandingFooter />
    </>
  )
}
