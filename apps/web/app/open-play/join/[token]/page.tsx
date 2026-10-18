import type { Metadata } from "next"

import { OpenPlayJoinPage } from "@/components/open-play/open-play-join-page"

export const metadata: Metadata = {
  title: "Open play invite",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function Page() {
  return <OpenPlayJoinPage />
}
