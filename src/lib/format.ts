export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function photoCount(count: number) {
  return `${count} ${count === 1 ? "photograph" : "photographs"}`
}

export function mediaUrl(id: string, variant: "thumb" | "full" = "thumb") {
  return `/api/media/${id}?variant=${variant}`
}
