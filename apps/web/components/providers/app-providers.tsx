"use client"

import * as React from "react"

import { GlobalLoadingIndicator } from "@/components/loading/global-loading-indicator"
import { LoadingProvider } from "@/components/providers/loading-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { Toaster } from "@workspace/ui/components/sonner"

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <QueryProvider>
        {children}
        <GlobalLoadingIndicator />
        <Toaster richColors />
      </QueryProvider>
    </LoadingProvider>
  )
}

export { AppProviders }
