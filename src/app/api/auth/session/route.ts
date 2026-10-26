import { cookies } from "next/headers"

import { json } from "@/lib/api"
import {
  COOKIE_NAME,
  adminConfigured,
  isAdminToken,
} from "@/lib/auth"

export async function GET() {
  const configured = adminConfigured()
  const token = (await cookies()).get(COOKIE_NAME)?.value
  return json({
    configured,
    authenticated: configured && isAdminToken(token),
  })
}
