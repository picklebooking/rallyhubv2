export type OpenPlayListing = {
  id: string
  startsAt: string
  venue: {
    id: string
    name: string
    slug: string
    city: string | null
    /** IANA zone (e.g. "Asia/Manila"). Format `startsAt` in this zone, not the browser's. */
    timezone: string
  }
  court: { id: string; name: string }
  capacity: number
  confirmedSeats: number
  isFull: boolean
}

export type ListOpenPlayQuery = {
  venueId?: string
  /** ISO instant, inclusive lower bound on start time. */
  from?: string
  /** ISO instant, exclusive upper bound on start time. */
  to?: string
  page?: number
  pageSize?: number
}

export type ListOpenPlayResponse = {
  items: OpenPlayListing[]
  page: number
  pageSize: number
  total: number
}

export type OpenPlayViewerState = {
  hasSeat: boolean
  isBooker: boolean
}

export type OpenPlayByTokenResponse = {
  listing: OpenPlayListing
  isPublic: boolean
  /** `null` when the viewer is not signed in. */
  viewer: OpenPlayViewerState | null
}

export type JoinOpenPlayResponse = {
  bookingId: string
  confirmedSeats: number
  capacity: number
  isFull: boolean
}

export type EnableOpenPlayRequest = {
  capacity?: number
  isPublic?: boolean
}

export type SetOpenPlayVisibilityRequest = {
  isPublic: boolean
}

export type OpenPlayRosterEntry = {
  name: string
  isBooker: boolean
  joinedAt: string
}

export type OpenPlayManageResponse = {
  listing: OpenPlayListing
  isPublic: boolean
  isActive: boolean
  joinToken: string
  roster: OpenPlayRosterEntry[]
}
