export type CourtStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE"

export type CourtResponse = {
  id: string
  venueId: string
  name: string
  status: CourtStatus
  createdAt: string
  updatedAt: string
}

export type CreateCourtRequest = {
  name: string
}

export type UpdateCourtRequest = {
  name?: string
  status?: CourtStatus
}

export type GetAllCourtsResponse = {
  courts: CourtResponse[]
}
