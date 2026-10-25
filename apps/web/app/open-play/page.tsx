import { Suspense } from "react"

import { OpenPlayPage } from "@/components/open-play/open-play-page"

export default function Page() {
  return (
    <Suspense>
      <OpenPlayPage />
    </Suspense>
  )
}
