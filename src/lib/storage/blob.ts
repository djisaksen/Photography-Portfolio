import "server-only"

import { processImage } from "@/lib/images"

import { createBlobPhotoStorage, vercelBlobClient } from "./blob-store"
import { readSeedContent } from "./seed"

export const blobPhotoStorage = createBlobPhotoStorage({
  client: vercelBlobClient,
  processImage,
  readSeed: readSeedContent,
})
