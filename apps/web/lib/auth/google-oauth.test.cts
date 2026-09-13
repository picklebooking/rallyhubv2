const assert = require("node:assert/strict")

const { isGoogleOAuthEnabled, startGoogleSignIn } = require("./google-oauth.ts")

assert.equal(isGoogleOAuthEnabled("true"), true)
assert.equal(isGoogleOAuthEnabled("false"), false)
assert.equal(isGoogleOAuthEnabled(undefined), false)

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
