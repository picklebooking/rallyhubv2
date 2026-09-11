import { cookies } from "next/headers"

import type { CurrentUserResponse } from "@workspace/shared"
import { serverApiClient } from "@/lib/server-api"

type DashboardUser = {
  email: string
  imageUrl?: string | null
  name: string
}

async function getCurrentDashboardUser(): Promise<DashboardUser> {
  const cookieHeader = (await cookies()).toString()
  const response = await serverApiClient.get<CurrentUserResponse>("/users/me", {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  })

  return response.data
}

export { getCurrentDashboardUser }
export type { DashboardUser }
