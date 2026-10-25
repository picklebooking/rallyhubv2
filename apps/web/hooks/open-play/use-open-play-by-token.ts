"use client"

import { useQuery } from "@tanstack/react-query"

import { getOpenPlayByToken } from "@/lib/api/open-play"
import { openPlayQueryKeys } from "@/hooks/open-play/use-open-play-listings"

function useOpenPlayByToken(token: string) {
  return useQuery({
    queryKey: openPlayQueryKeys.token(token),
    queryFn: () => getOpenPlayByToken(token),
    retry: false,
  })
}

export { useOpenPlayByToken }
