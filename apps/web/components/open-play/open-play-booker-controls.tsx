"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "sonner"

import { useCancelOpenPlay, useSetOpenPlayVisibility } from "@/hooks/open-play/use-open-play-mutations"

type OpenPlayBookerControlsProps = {
  bookingId: string
  isPublic: boolean
}

function OpenPlayBookerControls({ bookingId, isPublic }: OpenPlayBookerControlsProps) {
  const visibility = useSetOpenPlayVisibility()
  const cancel = useCancelOpenPlay()

  async function copyLink() {
    // writeText rejects without permission, outside a secure context, or when
    // `navigator.clipboard` is missing (some in-app browsers), so never let it
    // fail silently or as an unhandled rejection.
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Invite link copied.")
    } catch {
      toast.error("Couldn't copy the link. Copy it from your browser's address bar instead.")
    }
  }

  return (
    <div className="border-border space-y-4 rounded-xl border p-5">
      <p className="text-sm font-semibold">You booked this court</p>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="open-play-public" className="flex-col items-start gap-0.5">
          <span>List publicly</span>
          <span className="text-muted-foreground text-xs font-normal">
            Show this game on the Open Play page. People with your link can always join.
          </span>
        </Label>
        <Switch
          id="open-play-public"
          checked={isPublic}
          disabled={visibility.isPending}
          onCheckedChange={(checked) => visibility.mutate({ bookingId, isPublic: checked })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copyLink}>
          Copy invite link
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Cancel booking</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this booking?</DialogTitle>
              <DialogDescription>
                This releases the court for everyone on the roster. Within 24 hours of the start time,
                you can only cancel if no other players have joined.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep booking</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(bookingId)}
              >
                Cancel booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export { OpenPlayBookerControls }
