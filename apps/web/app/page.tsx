import { redirect } from "next/navigation"

import { HomePage } from "@/components/home/home-page"
import { getCurrentDashboardUser } from "@/lib/auth/current-dashboard-user"

export default async function Page() {
  try {
    await getCurrentDashboardUser()
    redirect("/dashboard")
  } catch {
    // Visitors without a Better Auth session stay on the public home page.
  }

  return <HomePage />
}
