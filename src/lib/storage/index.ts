import "server-only"

import { blobPhotoStorage } from "./blob"
import { cloudPhotoStorage } from "./cloud"
import { storageKind } from "./driver"
import { localPhotoStorage } from "./local"
import type { PhotoStorage } from "./types"

let singleton: PhotoStorage | null = null

export function getStorage(): PhotoStorage {
  if (singleton) return singleton
  const kind = storageKind()
  if (kind === "local") {
    singleton = localPhotoStorage
  } else if (kind === "blob") {
    singleton = blobPhotoStorage
  } else {
    singleton = cloudPhotoStorage
  }
  return singleton
}

export type { PhotoStorage } from "./types"
