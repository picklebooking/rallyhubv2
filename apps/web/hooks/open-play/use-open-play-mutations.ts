"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getApiErrorMessage } from "@/lib/api/api-error"
import {
  cancelOpenPlay,
  joinOpenPlay,
  joinOpenPlayByToken,
  leaveOpenPlay,
  setOpenPlayVisibility,
} from "@/lib/api/open-play"
import { openPlayQueryKeys } from "@/hooks/open-play/use-open-play-listings"

function useOpenPlayMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  successMessage: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => toast.success(successMessage),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: openPlayQueryKeys.all }),
  })
}

const useJoinOpenPlay = () =>
  useOpenPlayMutation((bookingId: string) => joinOpenPlay(bookingId), "You're in. See you on court!")
const useJoinOpenPlayByToken = () =>
  useOpenPlayMutation((token: string) => joinOpenPlayByToken(token), "You're in. See you on court!")
const useLeaveOpenPlay = () =>
  useOpenPlayMutation((bookingId: string) => leaveOpenPlay(bookingId), "Your seat has been released.")
const useCancelOpenPlay = () =>
  useOpenPlayMutation((bookingId: string) => cancelOpenPlay(bookingId), "Your booking has been cancelled.")
const useSetOpenPlayVisibility = () =>
  useOpenPlayMutation(
    ({ bookingId, isPublic }: { bookingId: string; isPublic: boolean }) =>
      setOpenPlayVisibility(bookingId, { isPublic }),
    "Listing updated."
  )

export {
  useCancelOpenPlay,
  useJoinOpenPlay,
  useJoinOpenPlayByToken,
  useLeaveOpenPlay,
  useSetOpenPlayVisibility,
}
