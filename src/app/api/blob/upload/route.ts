import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

import { json, requireAdmin } from "@/lib/api"
import { isIncomingPathname, MAX_UPLOAD_BYTES } from "@/lib/files"
import { directUploadsEnabled } from "@/lib/storage/driver"

export const maxDuration = 60

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]

export async function POST(request: Request) {
  if (!directUploadsEnabled()) {
    return json({ error: "Direct upload is off on this server." }, 404)
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in the Vercel project and add its read-write token.",
      },
      500,
    )
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return json({ error: "The upload could not be read." }, 400)
  }

  if (body.type === "blob.generate-client-token") {
    const denied = await requireAdmin()
    if (denied) return denied
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isIncomingPathname(pathname)) {
          throw new Error("That upload path is not allowed.")
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 0,
        }
      },
    })
    return Response.json(result)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "The upload could not be started."
    return json({ error: message }, 400)
  }
}
