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

function startGoogleSignIn(signIn: GoogleSignIn) {
  return signIn({
    provider: "google",
    callbackURL: "/dashboard",
  })
}

export { startGoogleSignIn }
