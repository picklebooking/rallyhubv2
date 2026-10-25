"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ListOpenPlayQuery } from "@workspace/shared"

import { listOpenPlay } from "@/lib/api/open-play"

const openPlayQueryKeys = {
  all: ["open-play"] as const,
  list: (query: ListOpenPlayQuery) => ["open-play", "list", query] as const,
  token: (token: string) => ["open-play", "token", token] as const,
}

function useOpenPlayListings(query: ListOpenPlayQuery) {
  return useQuery({
    queryKey: openPlayQueryKeys.list(query),
    queryFn: () => listOpenPlay(query),
    placeholderData: keepPreviousData,
  })
}

export { openPlayQueryKeys, useOpenPlayListings }
