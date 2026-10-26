import { failure, json, requireAdmin } from "@/lib/api"
import { isUuid } from "@/lib/files"
import { getStorage } from "@/lib/storage"

export const maxDuration = 60

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await context.params
  if (!isUuid(id)) {
    return json({ error: "That album is no longer in the archive." }, 404)
  }

  try {
    await getStorage().deleteAlbum(id)
    return json({ ok: true })
  } catch (error) {
    return failure(error, "The album could not be removed.")
  }
}
