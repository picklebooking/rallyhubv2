import "server-only"

import axios from "axios"

// On Vercel, API_INTERNAL_URL is injected by the web service's binding to the
// api service (see vercel.json). Bindings only exist at runtime, never during
// the build, so read it per request instead of once at import time.
// Locally and under Docker Compose it comes from the env file.
function getApiInternalUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:3001"
}

const serverApiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
})

serverApiClient.interceptors.request.use((config) => {
  config.baseURL = getApiInternalUrl()
  return config
})

export { serverApiClient }
