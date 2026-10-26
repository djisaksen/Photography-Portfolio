import { failure, json, requireAdmin } from "@/lib/api"
import { getStorage } from "@/lib/storage"
import { clientIp, isRateLimited, recordFailure } from "@/lib/rate-limit"

export const maxDuration = 60

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WINDOW_MS = 10 * 60 * 1000

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const messages = await getStorage().listMessages()
    return json({ messages })
  } catch (error) {
    return failure(error, "Notes could not be loaded.")
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  const key = `contact:${ip}`
  if (isRateLimited(key, 6)) {
    return json({ error: "Too many notes. Try again in a little while." }, 429)
  }

  let name = ""
  let email = ""
  let message = ""
  let website = ""
  try {
    const body = (await request.json()) as {
      name?: unknown
      email?: unknown
      message?: unknown
      website?: unknown
    }
    name = typeof body.name === "string" ? body.name.trim() : ""
    email = typeof body.email === "string" ? body.email.trim() : ""
    message = typeof body.message === "string" ? body.message.trim() : ""
    website = typeof body.website === "string" ? body.website.trim() : ""
  } catch {
    return json({ error: "The note could not be read." }, 400)
  }

  if (website) return json({ ok: true })

  if (!name || name.length > 80) {
    return json({ error: "Add your name." }, 400)
  }
  if (!EMAIL.test(email) || email.length > 160) {
    return json({ error: "Add a valid email address." }, 400)
  }
  if (!message || message.length > 2000) {
    return json({ error: "Write a note, up to 2000 characters." }, 400)
  }

  try {
    await getStorage().saveMessage({ name, email, message })
    recordFailure(key, WINDOW_MS)
    return json({ ok: true }, 201)
  } catch (error) {
    return failure(error, "The note could not be saved.")
  }
}
