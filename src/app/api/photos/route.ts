import { failure, json, requireAdmin } from "@/lib/api"
import { detectMime, isIncomingPathname, isUuid, MAX_UPLOAD_BYTES } from "@/lib/files"
import { directUploadsEnabled } from "@/lib/storage/driver"
import { getStorage } from "@/lib/storage"

export const maxDuration = 60

export async function GET() {
  try {
    const storage = getStorage()
    const [photos, albums] = await Promise.all([
      storage.listPhotos(),
      storage.listAlbums(),
    ])
    return json({ photos, albums })
  } catch (error) {
    return failure(error, "The archive could not be loaded.")
  }
}

function albumFrom(value: unknown) {
  const albumRaw = String(value ?? "").trim()
  const albumId = albumRaw && albumRaw !== "none" ? albumRaw : null
  if (albumId && !isUuid(albumId)) return { error: "That album no longer exists." as const }
  return { albumId }
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    if (!directUploadsEnabled()) {
      return json(
        { error: "This server accepts the photograph in the upload form." },
        400,
      )
    }
    let body: {
      pathname?: unknown
      title?: unknown
      caption?: unknown
      albumId?: unknown
      originalName?: unknown
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: "The upload could not be read." }, 400)
    }
    const pathname = String(body.pathname ?? "")
    if (!isIncomingPathname(pathname)) {
      return json({ error: "That upload could not be found." }, 400)
    }
    const album = albumFrom(body.albumId)
    if ("error" in album) return json({ error: album.error }, 400)
    try {
      const photo = await getStorage().savePhoto({
        bytes: Buffer.alloc(0),
        sourcePathname: pathname,
        originalName: String(body.originalName ?? "photograph"),
        mimeType: "application/octet-stream",
        title: String(body.title ?? ""),
        caption: String(body.caption ?? ""),
        albumId: album.albumId,
      })
      return json({ photo }, 201)
    } catch (error) {
      return failure(error, "The photograph could not be saved.")
    }
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: "The upload could not be read." }, 400)
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return json({ error: "Choose a photograph to upload." }, 400)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: "Photographs must be 25 MB or smaller." }, 400)
  }
  const mime = detectMime(file.name, file.type)
  if (!mime) {
    return json(
      { error: "Use a JPEG, PNG, WebP, GIF, or AVIF file." },
      400,
    )
  }

  const album = albumFrom(form.get("albumId"))
  if ("error" in album) return json({ error: album.error }, 400)

  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const photo = await getStorage().savePhoto({
      bytes,
      originalName: file.name || "photograph",
      mimeType: mime,
      title: String(form.get("title") ?? ""),
      caption: String(form.get("caption") ?? ""),
      albumId: album.albumId,
    })
    return json({ photo }, 201)
  } catch (error) {
    return failure(error, "The photograph could not be saved.")
  }
}
