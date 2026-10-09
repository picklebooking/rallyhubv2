import type { CreateCourtBookingRequest } from "@workspace/shared"
import { z } from "zod"

/** Mirrors `MAX_OPEN_PLAY_CAPACITY` in `apps/api/src/open-play/open-play.rules.ts`. Keep them equal. */
const MAX_OPEN_PLAY_CAPACITY = 64

const openPlayBookingOptionsSchema = z
  .object({
    isOpenPlay: z.boolean(),
    openPlayCapacity: z
      .number({ error: "Enter how many players this court holds." })
      .int("Capacity must be a whole number.")
      .min(1, "Capacity must be at least 1.")
      .max(MAX_OPEN_PLAY_CAPACITY, `Capacity can be at most ${MAX_OPEN_PLAY_CAPACITY}.`),
    isOpenPlayPublic: z.boolean(),
  })
  .refine((values) => values.isOpenPlay || !values.isOpenPlayPublic, {
    path: ["isOpenPlayPublic"],
    message: "Only open play bookings can be listed publicly.",
  })

type OpenPlayBookingOptionsValues = z.infer<typeof openPlayBookingOptionsSchema>

const OPEN_PLAY_BOOKING_OPTIONS_DEFAULTS: OpenPlayBookingOptionsValues = {
  isOpenPlay: false,
  openPlayCapacity: 4,
  isOpenPlayPublic: false,
}

/** Maps form values to the create-booking payload fields (omits Open Play fields for private bookings). */
function toOpenPlayBookingFields(
  values: OpenPlayBookingOptionsValues
): Pick<CreateCourtBookingRequest, "isOpenPlay" | "openPlayCapacity" | "isOpenPlayPublic"> {
  if (!values.isOpenPlay) return { isOpenPlay: false }
  return {
    isOpenPlay: true,
    openPlayCapacity: values.openPlayCapacity,
    isOpenPlayPublic: values.isOpenPlayPublic,
  }
}

export {
  MAX_OPEN_PLAY_CAPACITY,
  OPEN_PLAY_BOOKING_OPTIONS_DEFAULTS,
  openPlayBookingOptionsSchema,
  toOpenPlayBookingFields,
}
export type { OpenPlayBookingOptionsValues }
