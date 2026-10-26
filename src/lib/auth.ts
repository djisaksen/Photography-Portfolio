import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const COOKIE_NAME = "atelier_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14

type SessionPayload = {
  role: "admin"
  exp: number
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD)
}

function signingKey() {
  const key = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD
  if (!key) {
    throw new Error("Set ADMIN_PASSWORD before opening the studio.")
  }
  return key
}

export function passwordsMatch(input: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const left = createHash("sha256").update(input).digest()
  const right = createHash("sha256").update(expected).digest()
  return timingSafeEqual(left, right)
}

export function signSession() {
  const payload: SessionPayload = {
    role: "admin",
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url")
  return `${body}.${signature}`
}

export function isAdminToken(token: string | undefined) {
  if (!token || !adminConfigured()) return false
  const parts = token.split(".")
  if (parts.length !== 2) return false
  const [body, signature] = parts
  if (!body || !signature) return false

  const expected = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url")
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return false
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload
    return payload.role === "admin" && payload.exp > Date.now()
  } catch {
    return false
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  }
}
