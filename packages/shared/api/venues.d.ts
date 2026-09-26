export type VenueStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE"

export type VenueResponse = {
  id: string
  tenantId: string
  name: string
  slug: string
  status: VenueStatus
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string
  timezone: string
  phone: string | null
  email: string | null
  website: string | null
  logo: string | null
  coverImage: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type CreateVenueRequest = {
  name: string
  slug: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  timezone?: string
  phone?: string
  email?: string
  website?: string
  logo?: string
  coverImage?: string
  description?: string
}

export type UpdateVenueRequest = {
  name?: string
  slug?: string
  status?: VenueStatus
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  timezone?: string
  phone?: string
  email?: string
  website?: string
  logo?: string
  coverImage?: string
  description?: string
}

export type GetAllVenuesResponse = {
  venues: VenueResponse[]
}

export type VenueBySlugResponse = {
  id: string
  tenantId: string
  slug: string
  name: string
  status: VenueStatus
}
