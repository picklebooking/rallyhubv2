import { z } from "zod"

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Enter your name."),
  password: z.string().min(8, "Use at least 8 characters."),
})

export { signInSchema, signUpSchema }
