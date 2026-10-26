export type StorageKind = "local" | "blob" | "cloud"

export function storageKind(value = process.env.STORAGE_DRIVER): StorageKind {
  const driver = (value ?? "local").trim().toLowerCase()
  if (driver === "" || driver === "local") return "local"
  if (driver === "blob") return "blob"
  if (driver === "s3" || driver === "cloud") return "cloud"
  throw new Error(
    `Unknown STORAGE_DRIVER "${driver}". Use "local" or "blob".`,
  )
}

export function directUploadsEnabled(value = process.env.STORAGE_DRIVER) {
  return storageKind(value) === "blob"
}
