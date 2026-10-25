import type { CreateCourtBookingRequest } from "@workspace/shared"
import { z } from "zod"

/** Mirrors `MAX_OPEN_PLAY_CAPACITY` in `apps/api/src/open-play/open-play.rules.ts`. Keep them equal. */
const MAX_OPEN_PLAY_CAPACITY = 64

const openPlayBookingOptionsSchema = z
  .object({
    isOpenPlay: z.boolean(),
    // Accepts NaN too: zod's base number type rejects NaN before any
    // `.check()` runs, but when `isOpenPlay` is false the field is hidden
    // and must parse successfully regardless of its (possibly NaN) value.
    openPlayCapacity: z.union([z.number(), z.nan()]),
    isOpenPlayPublic: z.boolean(),
  })
  .check((ctx) => {
    const values = ctx.value
    if (!values.isOpenPlay) return
    if (!Number.isInteger(values.openPlayCapacity)) {
      ctx.issues.push({
        code: "custom",
        input: values.openPlayCapacity,
        path: ["openPlayCapacity"],
        message: Number.isNaN(values.openPlayCapacity)
          ? "Enter how many players this court holds."
          : "Capacity must be a whole number.",
      })
      return
    }
    if (values.openPlayCapacity < 1) {
      ctx.issues.push({
        code: "custom",
        input: values.openPlayCapacity,
        path: ["openPlayCapacity"],
        message: "Capacity must be at least 1.",
      })
    } else if (values.openPlayCapacity > MAX_OPEN_PLAY_CAPACITY) {
      ctx.issues.push({
        code: "custom",
        input: values.openPlayCapacity,
        path: ["openPlayCapacity"],
        message: `Capacity can be at most ${MAX_OPEN_PLAY_CAPACITY}.`,
      })
    }
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
