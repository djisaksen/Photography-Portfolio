import type { NextRequest } from "next/server"

import { isUuid } from "@/lib/files"
import { getStorage } from "@/lib/storage"

export const maxDuration = 60

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const variant =
    request.nextUrl.searchParams.get("variant") === "full" ? "full" : "thumb"
  if (!isUuid(id)) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const file = await getStorage().readVariant(id, variant)
    if (!file) return new Response("Not found", { status: 404 })
    if (file.redirectUrl) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: file.redirectUrl,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }
    if (!file.bytes) return new Response("Not found", { status: 404 })
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error(error)
    return new Response("The photograph could not be loaded.", { status: 500 })
  }
}
