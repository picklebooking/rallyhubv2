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
    <header className="border-brand-ink/20 bg-brand-ink/95 fixed inset-x-0 top-0 z-50 border-b px-6 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2 font-heading text-lg font-black tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12">
              R
            </span>
            <span>
              Rally<span className="text-primary">Hub</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/"
              className="group relative text-sm font-semibold text-white transition-colors hover:text-primary"
            >
              Find Courts
              <span className="bg-primary absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
            <Link
              href="/venues"
              className="group relative text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Explore Venues
              <span className="bg-primary absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
            <Link
              href="/#how-it-works"
              className="group relative text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              How It Works
              <span className="bg-primary absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? null : session?.user ? (
            <>
            <Button asChild variant="ghost" size="sm" className="text-white hover:text-white/80">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <AccountMenu email={session.user.email} imageUrl={session.user.image} name={session.user.name} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-white hover:text-white/80">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold transition-transform duration-200 hover:scale-105 active:scale-95">
                <Link href="/sign-up">Sign up</Link>
              </Button>
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
