import type {
  JoinOpenPlayResponse,
  ListOpenPlayQuery,
  ListOpenPlayResponse,
  OpenPlayByTokenResponse,
  OpenPlayManageResponse,
  SetOpenPlayVisibilityRequest,
} from "@workspace/shared"

import { apiClient } from "@/lib/axios"

const BASE = "/v1/open-play"

async function listOpenPlay(query: ListOpenPlayQuery): Promise<ListOpenPlayResponse> {
  const response = await apiClient.get<ListOpenPlayResponse>(BASE, { params: query })
  return response.data
}

async function getOpenPlayByToken(token: string): Promise<OpenPlayByTokenResponse> {
  const response = await apiClient.get<OpenPlayByTokenResponse>(
    `${BASE}/join/${encodeURIComponent(token)}`
  )
  return response.data
}

async function joinOpenPlayByToken(token: string): Promise<JoinOpenPlayResponse> {
  const response = await apiClient.post<JoinOpenPlayResponse>(
    `${BASE}/join/${encodeURIComponent(token)}`
  )
  return response.data
}

async function joinOpenPlay(bookingId: string): Promise<JoinOpenPlayResponse> {
  const response = await apiClient.post<JoinOpenPlayResponse>(`${BASE}/${bookingId}/join`)
  return response.data
}

async function leaveOpenPlay(bookingId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${bookingId}/seat`)
}

async function cancelOpenPlay(bookingId: string): Promise<void> {
  await apiClient.post(`${BASE}/${bookingId}/cancel`)
}

async function setOpenPlayVisibility(
  bookingId: string,
  body: SetOpenPlayVisibilityRequest
): Promise<OpenPlayManageResponse> {
  const response = await apiClient.patch<OpenPlayManageResponse>(
    `${BASE}/${bookingId}/visibility`,
    body
  )
  return response.data
}

export {
  cancelOpenPlay,
  getOpenPlayByToken,
  joinOpenPlay,
  joinOpenPlayByToken,
  leaveOpenPlay,
  listOpenPlay,
  setOpenPlayVisibility,
}
