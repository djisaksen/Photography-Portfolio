import { cookies } from "next/headers"

import { json } from "@/lib/api"
import {
  COOKIE_NAME,
  adminConfigured,
  passwordsMatch,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth"
import {
  clearFailures,
  clientIp,
  isRateLimited,
  recordFailure,
} from "@/lib/rate-limit"

const WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return json(
      { error: "Uploads are turned off until ADMIN_PASSWORD is set." },
      503,
    )
  }

  const ip = clientIp(request)
  const key = `login:${ip}`
  if (isRateLimited(key, 8)) {
    return json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      429,
    )
  }

  let password = ""
  try {
    const body = (await request.json()) as { password?: unknown }
    password = typeof body.password === "string" ? body.password : ""
  } catch {
    password = ""
  }

  if (!password || !passwordsMatch(password)) {
    recordFailure(key, WINDOW_MS)
    return json({ error: "That password does not match." }, 401)
  }

  clearFailures(key)
  const store = await cookies()
  store.set(COOKIE_NAME, signSession(), sessionCookieOptions())
  return json({ authenticated: true })
}
