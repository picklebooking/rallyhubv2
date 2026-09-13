const assert = require("node:assert/strict")

const { startGoogleSignIn } = require("./google-oauth.ts")

let receivedOptions: unknown
void startGoogleSignIn(async (options: unknown) => {
  receivedOptions = options
  return { error: null }
}).then(() => {
  assert.deepEqual(receivedOptions, {
    provider: "google",
    callbackURL: "/dashboard",
  })
})
