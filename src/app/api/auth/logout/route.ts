import { cookies } from "next/headers"

import { json } from "@/lib/api"
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/auth"

export async function POST() {
  const store = await cookies()
  store.set(COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 })
  return json({ authenticated: false })
}
