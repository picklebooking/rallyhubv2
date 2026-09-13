import { RiArrowLeftLine } from "@remixicon/react"
import Link from "next/link"

import { AuthBrandPanel } from "@/components/auth/auth-brand-panel"
import { AuthForm } from "@/components/auth/auth-form"

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"

  return (
    <main className="bg-background grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel mode={mode} />

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <RiArrowLeftLine className="size-4" />
            Back to RallyHub
          </Link>

          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "Start organizing your club." : "Welcome back."}
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-normal">
              {isSignUp ? "Create your account" : "Sign in"}
            </h1>
          </div>

          <div className="mt-7">
            <AuthForm mode={mode} />
          </div>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {isSignUp ? "Already have an account?" : "New to RallyHub?"}{" "}
            <Link
              className="text-foreground font-medium underline underline-offset-4"
              href={isSignUp ? "/sign-in" : "/sign-up"}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export { AuthPage }
