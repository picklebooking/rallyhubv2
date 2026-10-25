"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AuthHeader } from "@/components/auth/auth-header"
import { LandingFooter } from "@/components/home/landing-footer"
import { OpenPlayBookerControls } from "@/components/open-play/open-play-booker-controls"
import { OpenPlayCard } from "@/components/open-play/open-play-card"
import { useOpenPlayByToken } from "@/hooks/open-play/use-open-play-by-token"
import { useJoinOpenPlayByToken, useLeaveOpenPlay } from "@/hooks/open-play/use-open-play-mutations"

function OpenPlayJoinPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isPending, isError } = useOpenPlayByToken(token)
  const join = useJoinOpenPlayByToken()
  const leave = useLeaveOpenPlay()

  return (
    <>
      <AuthHeader />
      <main className="bg-background text-foreground min-h-svh pt-16">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Open play invite
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-normal md:text-4xl">
              You&apos;re invited to play
            </h1>
          </div>

          {isPending ? (
            <Skeleton className="h-24 w-full rounded-xl" aria-busy="true" />
          ) : isError ? (
            <Alert>
              <AlertTitle>This game isn&apos;t available</AlertTitle>
              <AlertDescription>
                The link may be wrong, or the booking was cancelled.{" "}
                <Link href="/open-play" className="underline">
                  Browse other open games
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <OpenPlayCard
                listing={data.listing}
                action={
                  data.viewer === null ? (
                    <Button asChild variant="outline">
                      <Link href="/sign-in">Sign in to join</Link>
                    </Button>
                  ) : data.viewer.isBooker ? null : data.viewer.hasSeat ? (
                    <Button
                      variant="outline"
                      disabled={leave.isPending}
                      onClick={() => leave.mutate(data.listing.id)}
                    >
                      Leave
                    </Button>
                  ) : data.listing.isFull ? (
                    <Button disabled>Full</Button>
                  ) : (
                    <Button disabled={join.isPending} onClick={() => join.mutate(token)}>
                      Join
                    </Button>
                  )
                }
              />
              {data.viewer?.isBooker ? (
                <OpenPlayBookerControls bookingId={data.listing.id} isPublic={data.isPublic} />
              ) : null}
            </>
          )}
        </div>
      </main>
      <LandingFooter />
    </>
  )
}

export { OpenPlayJoinPage }
