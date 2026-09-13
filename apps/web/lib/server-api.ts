import "server-only"

import axios from "axios"

const serverApiClient = axios.create({
  baseURL: process.env.API_INTERNAL_URL ?? "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
})

export { serverApiClient }
