import { Geist_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google"
import NextTopLoader from "nextjs-toploader"

import "@workspace/ui/globals.css"
import { AppProviders } from "@/components/providers/app-providers"
import { cn } from "@workspace/ui/lib/utils"

const outfitHeading = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800", "900"],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "overflow-x-hidden antialiased",
        fontMono.variable,
        "font-sans",
        plusJakartaSans.variable,
        outfitHeading.variable
      )}
    >
      <body className="min-h-svh overflow-x-hidden">
        <NextTopLoader
          color="var(--primary)"
          showSpinner={false}
          shadow={false}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
