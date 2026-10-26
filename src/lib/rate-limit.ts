import "server-only"

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim()
    if (ip) return ip
  }
  return "local"
}

export function isRateLimited(key: string, limit: number) {
  const entry = buckets.get(key)
  if (!entry || entry.resetAt < Date.now()) return false
  return entry.count >= limit
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count += 1
}

export function clearFailures(key: string) {
  buckets.delete(key)
}
