export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_QUEUE = 30

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
}

const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXT))

export function detectMime(fileName: string, mime: string): string | null {
  const normalized = mime.trim().toLowerCase()
  if (normalized === "image/jpg") return "image/jpeg"
  if (ALLOWED_MIME.has(normalized)) return normalized

  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const fromExt = MIME_BY_EXT[ext]
  if (!fromExt) return null
  if (!normalized || normalized === "application/octet-stream") return fromExt
  return null
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function incomingPathname(fileName: string) {
  const cleaned = fileName
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return `incoming/${cleaned || "photograph"}`
}

export function isIncomingPathname(value: string) {
  return /^incoming\/[A-Za-z0-9._-]{1,200}$/.test(value)
}
