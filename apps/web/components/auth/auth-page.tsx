import Link from "next/link"

import { AuthForm } from "@/components/auth/auth-form"

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"

  return (
    <main className="bg-muted/20 flex min-h-svh items-center justify-center px-5 py-10">
      <section className="border-border bg-card w-full max-w-md rounded-3xl border p-7 shadow-sm sm:p-9">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          RallyHub
        </Link>
        <div className="mt-8 space-y-2">
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
          <Link className="text-foreground font-medium underline underline-offset-4" href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Sign in" : "Create one"}
          </Link>
        </p>
      </section>
    </main>
  )
}

export { AuthPage }
