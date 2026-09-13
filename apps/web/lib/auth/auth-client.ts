"use client"

import { createAuthClient } from "better-auth/react"

const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
})

export { authClient }
