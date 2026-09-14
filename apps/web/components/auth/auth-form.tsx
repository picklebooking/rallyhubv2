"use client"

import { useState } from "react"
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLockPasswordLine,
  RiMailLine,
  RiUserLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { authClient } from "@/lib/auth/auth-client"
import { startGoogleSignIn } from "@/lib/auth/google-oauth"
import { signInSchema, signUpSchema } from "@/lib/validations/auth"

type AuthFormProps = {
  mode: "sign-in" | "sign-up"
}

type AuthFormValues = {
  email: string
  name: string
  password: string
}

const FIELD_ICONS = {
  name: RiUserLine,
  email: RiMailLine,
  password: RiLockPasswordLine,
} as const

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.5 0-14 4.2-17.7 10.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-1.9 14-5.6l-6.5-5.4c-2 1.5-4.6 2.4-7.5 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.9 39.7 16.4 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.4C41.2 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5Z"
      />
    </svg>
  )
}

function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [googleIsPending, setGoogleIsPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const isSignUp = mode === "sign-up"
  const form = useForm<AuthFormValues>({
    defaultValues: { name: "", email: "", password: "" },
  })

  async function onSubmit(values: AuthFormValues) {
    setServerError(null)
    const validation = (isSignUp ? signUpSchema : signInSchema).safeParse(values)

    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0]
        if (field === "email" || field === "name" || field === "password") {
          form.setError(field, { message: issue.message })
        }
      }
      return
    }

    const result = isSignUp
      ? await authClient.signUp.email({
          name: values.name,
          email: values.email,
          password: values.password,
        })
      : await authClient.signIn.email({
          email: values.email,
          password: values.password,
        })

    if (result.error) {
      setServerError(result.error.message ?? "Authentication failed.")
      return
    }

    router.replace("/dashboard")
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setGoogleIsPending(true)
    setServerError(null)

    const result = await startGoogleSignIn(authClient.signIn.social)

    if (result.error) {
      setServerError(result.error.message ?? "Unable to continue with Google.")
      setGoogleIsPending(false)
    }
  }

  const fields = isSignUp
    ? [
        { id: "name", label: "Name", type: "text" },
        { id: "email", label: "Email", type: "email" },
        { id: "password", label: "Password", type: "password" },
      ]
    : [
        { id: "email", label: "Email", type: "email" },
        { id: "password", label: "Password", type: "password" },
      ]

  return (
    <div className="border-border bg-card rounded-2xl border p-6 shadow-sm sm:p-7">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Button
          className="hover:border-border h-11 w-full gap-2.5 rounded-full font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          disabled={form.formState.isSubmitting || googleIsPending}
          onClick={handleGoogleSignIn}
          type="button"
          variant="outline"
        >
          <GoogleIcon className="size-4" />
          {googleIsPending ? "Connecting to Google…" : "Continue with Google"}
        </Button>
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs font-medium">or</span>
          <div className="bg-border h-px flex-1" />
        </div>
        {fields.map((field) => {
          const fieldName = field.id as keyof AuthFormValues
          const error = form.formState.errors[fieldName]?.message
          const Icon = FIELD_ICONS[fieldName]
          const isPassword = field.id === "password"
          const inputType = isPassword && showPassword ? "text" : field.type

          return (
            <div className="space-y-2" key={field.id}>
              <Label htmlFor={field.id}>{field.label}</Label>
              <div className="relative">
                <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  id={field.id}
                  type={inputType}
                  autoComplete={
                    field.id === "password" ? "current-password" : field.id
                  }
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${field.id}-error` : undefined}
                  className={isPassword ? "h-11 pr-10 pl-10" : "h-11 pl-10"}
                  {...form.register(fieldName)}
                />
                {isPassword ? (
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 transition-colors"
                  >
                    {showPassword ? (
                      <RiEyeOffLine className="size-4" />
                    ) : (
                      <RiEyeLine className="size-4" />
                    )}
                  </button>
                ) : null}
              </div>
              <AnimatePresence>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-destructive text-sm"
                    id={`${field.id}-error`}
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
        <AnimatePresence>
          {serverError ? (
            <motion.p
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-destructive text-sm"
              role="alert"
            >
              {serverError}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <Button
          className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting
            ? "Please wait…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
    </div>
  )
}

export { AuthForm }
