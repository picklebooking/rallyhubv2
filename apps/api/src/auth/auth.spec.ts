import { getGoogleProviderConfig } from "./auth"

describe("getGoogleProviderConfig", () => {
  const initialClientId = process.env.GOOGLE_CLIENT_ID
  const initialClientSecret = process.env.GOOGLE_CLIENT_SECRET

  afterEach(() => {
    if (initialClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID
    } else {
      process.env.GOOGLE_CLIENT_ID = initialClientId
    }

    if (initialClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET
    } else {
      process.env.GOOGLE_CLIENT_SECRET = initialClientSecret
    }
  })

  it("returns undefined when Google OAuth is not configured", () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET

    expect(getGoogleProviderConfig()).toBeUndefined()
  })

  it("rejects a partial Google credential pair", () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id"
    delete process.env.GOOGLE_CLIENT_SECRET

    expect(() => getGoogleProviderConfig()).toThrow(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"
    )
  })

  it("returns the provider credentials when both values are configured", () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id"
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret"

    expect(getGoogleProviderConfig()).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    })
  })
})
