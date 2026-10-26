import "server-only"

import { cookies } from "next/headers"

import { COOKIE_NAME, adminConfigured, isAdminToken } from "@/lib/auth"
import { StorageError } from "@/lib/storage/errors"

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

export async function requireAdmin() {
  if (!adminConfigured()) {
    return json(
      { error: "Uploads are turned off until ADMIN_PASSWORD is set." },
      503,
    )
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!isAdminToken(token)) {
    return json({ error: "Sign in to the studio first." }, 401)
  }
  return null
}

export function failure(error: unknown, fallback: string) {
  if (error instanceof StorageError) {
    return json({ error: error.message }, error.status)
  }
  console.error(error)
  return json({ error: fallback }, 500)
}
