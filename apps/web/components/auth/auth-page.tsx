"use client"

import { RiArrowLeftLine } from "@remixicon/react"
import { motion } from "framer-motion"
import Link from "next/link"

import { AuthBrandPanel } from "@/components/auth/auth-brand-panel"
import { AuthForm } from "@/components/auth/auth-form"
import { fadeUp, staggerContainer } from "@/components/home/motion-presets"

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"

  return (
    <main className="bg-background relative isolate grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel mode={mode} />

      <div className="relative isolate flex flex-col justify-center overflow-hidden px-6 py-10 sm:px-12 lg:px-16">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -z-10 rounded-full"
          style={{
            right: "-10%",
            top: "-14%",
            width: 340,
            height: 340,
            background:
              "radial-gradient(circle, rgba(215,242,5,0.1), rgba(215,242,5,0) 70%)",
          }}
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          key={mode}
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="mx-auto w-full max-w-sm"
        >
          <motion.div variants={fadeUp}>
            <Link
              href="/"
              className="group text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <RiArrowLeftLine className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Back to RallyHub
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="bg-muted mb-7 grid grid-cols-2 gap-1 rounded-full p-1"
          >
            <Link
              href="/sign-in"
              className={
                isSignUp
                  ? "text-muted-foreground hover:text-foreground rounded-full py-2 text-center text-sm font-semibold transition-colors"
                  : "bg-brand-ink rounded-full py-2 text-center text-sm font-semibold text-white shadow-sm"
              }
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={
                isSignUp
                  ? "bg-brand-ink rounded-full py-2 text-center text-sm font-semibold text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground rounded-full py-2 text-center text-sm font-semibold transition-colors"
              }
            >
              Create account
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "Start organizing your club." : "Welcome back."}
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-normal">
              {isSignUp ? "Create your account" : "Sign in"}
            </h1>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-7">
            <AuthForm mode={mode} />
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="text-muted-foreground mt-6 text-center text-sm"
          >
            {isSignUp ? "Already have an account?" : "New to RallyHub?"}{" "}
            <Link
              className="text-foreground decoration-primary hover:text-foreground/70 font-medium underline underline-offset-4 transition-colors"
              href={isSignUp ? "/sign-in" : "/sign-up"}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </main>
  )
}

export { AuthPage }
