import { isAxiosError } from "axios"

/** Pulls the NestJS `message` out of an Axios error, falling back to a generic line. */
function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(" ")
    if (typeof message === "string" && message.length > 0) return message
  }
  return fallback
}

export { getApiErrorMessage }
