type GoogleSignInOptions = {
  callbackURL: "/dashboard"
  provider: "google"
}

type GoogleSignInResult = {
  error?: {
    message?: string | null
  } | null
}

type GoogleSignIn = (
  options: GoogleSignInOptions
) => Promise<GoogleSignInResult>

function isGoogleOAuthEnabled(value = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED) {
  return value === "true"
}

function startGoogleSignIn(signIn: GoogleSignIn) {
  return signIn({
    provider: "google",
    callbackURL: "/dashboard",
  })
}

export { isGoogleOAuthEnabled, startGoogleSignIn }
