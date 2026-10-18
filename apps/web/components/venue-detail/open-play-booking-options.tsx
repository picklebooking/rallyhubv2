"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { FieldError } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import {
  MAX_OPEN_PLAY_CAPACITY,
  type OpenPlayBookingOptionsValues,
} from "@/lib/validations/open-play"

const CAPACITY_ERROR_ID = "open-play-capacity-error"

type OpenPlayBookingOptionsProps = {
  form: UseFormReturn<OpenPlayBookingOptionsValues>
}

function OpenPlayBookingOptions({ form }: OpenPlayBookingOptionsProps) {
  const isOpenPlay = form.watch("isOpenPlay")
  const capacityError = form.formState.errors.openPlayCapacity?.message

  return (
    <div className="border-border space-y-3 border-t pt-5">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="is-open-play" className="flex-col items-start gap-0.5">
          <span className="text-sm font-semibold">Open play</span>
          <span className="text-muted-foreground text-xs font-normal">
            Let other players join your court. You keep the first seat and pay as usual.
          </span>
        </Label>
        <Controller
          control={form.control}
          name="isOpenPlay"
          render={({ field }) => (
            <Switch
              id="is-open-play"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked)
                if (!checked) form.setValue("isOpenPlayPublic", false)
              }}
            />
          )}
        />
      </div>

      {isOpenPlay ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="open-play-capacity">Players (including you)</Label>
            <Controller
              control={form.control}
              name="openPlayCapacity"
              render={({ field }) => (
                <Input
                  id="open-play-capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_OPEN_PLAY_CAPACITY}
                  step={1}
                  className="w-28"
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  aria-invalid={capacityError ? true : undefined}
                  aria-describedby={capacityError ? CAPACITY_ERROR_ID : undefined}
                />
              )}
            />
            {capacityError ? (
              <FieldError id={CAPACITY_ERROR_ID}>{capacityError}</FieldError>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="open-play-public-create" className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">List publicly</span>
              <span className="text-muted-foreground text-xs font-normal">
                Off by default. Only people with your invite link can join.
              </span>
            </Label>
            <Controller
              control={form.control}
              name="isOpenPlayPublic"
              render={({ field }) => (
                <Switch
                  id="open-play-public-create"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export { OpenPlayBookingOptions }
