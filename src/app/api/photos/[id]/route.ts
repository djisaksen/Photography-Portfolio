import { failure, json, requireAdmin } from "@/lib/api"
import { isUuid } from "@/lib/files"
import { getStorage } from "@/lib/storage"

export const maxDuration = 60

type PhotoBody = {
  title?: unknown
  caption?: unknown
  albumId?: unknown
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await context.params
  if (!isUuid(id)) {
    return json({ error: "That photograph is no longer in the archive." }, 404)
  }

  let body: PhotoBody
  try {
    body = (await request.json()) as PhotoBody
  } catch {
    return json({ error: "The edit could not be read." }, 400)
  }

  const patch: {
    title?: string
    caption?: string
    albumId?: string | null
  } = {}
  if (typeof body.title === "string") patch.title = body.title
  if (typeof body.caption === "string") patch.caption = body.caption
  if (body.albumId === null || body.albumId === "") patch.albumId = null
  else if (typeof body.albumId === "string") {
    if (!isUuid(body.albumId)) {
      return json({ error: "That album no longer exists." }, 400)
    }
    patch.albumId = body.albumId
  }

  try {
    const photo = await getStorage().updatePhoto(id, patch)
    return json({ photo })
  } catch (error) {
    return failure(error, "The photograph could not be updated.")
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await context.params
  if (!isUuid(id)) {
    return json({ error: "That photograph is no longer in the archive." }, 404)
  }

  try {
    await getStorage().deletePhoto(id)
    return json({ ok: true })
  } catch (error) {
    return failure(error, "The photograph could not be removed.")
  }
}
