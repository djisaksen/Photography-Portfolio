import { failure, json, requireAdmin } from "@/lib/api"
import { getStorage } from "@/lib/storage"

export const maxDuration = 60

export async function GET() {
  try {
    const albums = await getStorage().listAlbums()
    return json({ albums })
  } catch (error) {
    return failure(error, "The albums could not be loaded.")
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let name = ""
  let description = ""
  try {
    const body = (await request.json()) as {
      name?: unknown
      description?: unknown
    }
    name = typeof body.name === "string" ? body.name : ""
    description = typeof body.description === "string" ? body.description : ""
  } catch {
    return json({ error: "The album could not be read." }, 400)
  }

  try {
    const album = await getStorage().saveAlbum({ name, description })
    return json({ album }, 201)
  } catch (error) {
    return failure(error, "The album could not be saved.")
  }
}
