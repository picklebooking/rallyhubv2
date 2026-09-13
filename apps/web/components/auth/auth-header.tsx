"use client"

import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { usePathname } from "next/navigation"

function AuthHeader() {
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()

  if (pathname.startsWith("/dashboard")) {
    return null
  }

  return (
    <header className="border-border bg-background/80 fixed inset-x-0 top-0 z-50 border-b px-6 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            RallyHub
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Find Courts
            </Link>
            <Link
              href="/venues"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Explore Venues
            </Link>
            <Link
              href="/#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              How It Works
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? null : session?.user ? (
            <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <AccountMenu email={session.user.email} imageUrl={session.user.image} name={session.user.name} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/sign-in">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/sign-up">Sign up</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export { AuthHeader }
import { AccountMenu } from "@/components/auth/account-menu"
import { authClient } from "@/lib/auth/auth-client"
