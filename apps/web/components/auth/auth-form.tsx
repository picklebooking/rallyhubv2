"use client"

import { useState } from "react"
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

function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [googleIsPending, setGoogleIsPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
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
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Button
        className="w-full"
        disabled={form.formState.isSubmitting || googleIsPending}
        onClick={handleGoogleSignIn}
        type="button"
        variant="outline"
      >
        {googleIsPending ? "Connecting to Google…" : "Continue with Google"}
      </Button>
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <div className="bg-border h-px flex-1" />
      </div>
      {fields.map((field) => {
        const fieldName = field.id as keyof AuthFormValues
        const error = form.formState.errors[fieldName]?.message

        return (
          <div className="space-y-2" key={field.id}>
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              type={field.type}
              autoComplete={field.id === "password" ? "current-password" : field.id}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${field.id}-error` : undefined}
              {...form.register(fieldName)}
            />
            {error ? (
              <p className="text-destructive text-sm" id={`${field.id}-error`}>
                {error}
              </p>
            ) : null}
          </div>
        )
      })}
      {serverError ? (
        <p className="text-destructive text-sm" role="alert">
          {serverError}
        </p>
      ) : null}
      <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
        {form.formState.isSubmitting
          ? "Please wait…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>
    </form>
  )
}

export { AuthForm }
