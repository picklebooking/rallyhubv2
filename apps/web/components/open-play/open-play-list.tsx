"use client"

import Link from "next/link"
import type { ListOpenPlayQuery } from "@workspace/shared"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { OpenPlayCard } from "@/components/open-play/open-play-card"
import { useOpenPlayListings } from "@/hooks/open-play/use-open-play-listings"
import { useJoinOpenPlay } from "@/hooks/open-play/use-open-play-mutations"
import { authClient } from "@/lib/auth/auth-client"

type OpenPlayListProps = {
  query: ListOpenPlayQuery
  onVenueClick: (venueId: string, venueName: string) => void
  onPageChange: (page: number) => void
}

function OpenPlayList({ query, onVenueClick, onPageChange }: OpenPlayListProps) {
  const { data, isPending, isError, refetch } = useOpenPlayListings(query)
  const { data: session } = authClient.useSession()
  const join = useJoinOpenPlay()

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load open play games</AlertTitle>
        <AlertDescription>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (data.items.length === 0) {
    const overshotPage = data.total > 0
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No open games match</EmptyTitle>
          <EmptyDescription>
            {overshotPage
              ? "That page doesn't exist anymore."
              : "Try another date or clear the venue filter."}
          </EmptyDescription>
        </EmptyHeader>
        {overshotPage ? (
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => onPageChange(1)}>
              Go to page 1
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }

  const lastPage = Math.max(Math.ceil(data.total / data.pageSize), 1)

  return (
    <div className="space-y-3">
      {data.items.map((listing) => (
        <OpenPlayCard
          key={listing.id}
          listing={listing}
          onVenueClick={onVenueClick}
          action={
            listing.isFull ? (
              <Button disabled>Full</Button>
            ) : session ? (
              <Button
                disabled={join.isPending && join.variables === listing.id}
                onClick={() => join.mutate(listing.id)}
              >
                Join
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign in to join</Link>
              </Button>
            )
          }
        />
      ))}
      <div className="flex items-center justify-between pt-2">
        <span className="text-muted-foreground text-sm">
          Page {data.page} of {lastPage}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={data.page >= lastPage} onClick={() => onPageChange(data.page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export { OpenPlayList }
