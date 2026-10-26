import "server-only"

import { StorageError } from "./errors"
import type { PhotoStorage } from "./types"

const MESSAGE =
  "This storage driver is not wired up. Set STORAGE_DRIVER=blob for Vercel Blob, or STORAGE_DRIVER=local for the disk."

function unsupported(): never {
  throw new StorageError(MESSAGE, 501)
}

/**
 * Placeholder for a bucket other than Vercel Blob.
 * Blob itself lives in src/lib/storage/blob.ts and is selected with STORAGE_DRIVER=blob.
 */
export const cloudPhotoStorage: PhotoStorage = {
  listPhotos: async () => unsupported(),
  getPhoto: async () => unsupported(),
  savePhoto: async () => unsupported(),
  updatePhoto: async () => unsupported(),
  deletePhoto: async () => unsupported(),
  readVariant: async () => unsupported(),
  listAlbums: async () => unsupported(),
  getAlbumBySlug: async () => unsupported(),
  saveAlbum: async () => unsupported(),
  deleteAlbum: async () => unsupported(),
  listMessages: async () => unsupported(),
  saveMessage: async () => unsupported(),
}
