import axios from "axios"

// Browser-only fallback: the relative proxy path needs a page origin. Server
// code calls the API through lib/server-api.ts instead.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/backend"

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

export { apiClient, API_BASE_URL }
