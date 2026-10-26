import "server-only"

import sharp from "sharp"

import { StorageError } from "@/lib/storage/errors"

export type ProcessedImage = {
  full: Buffer
  thumb: Buffer
  width: number
  height: number
  blurDataUrl: string
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) {
    throw new StorageError("That file is empty.")
  }

  let full: { data: Buffer; info: { width?: number; height?: number } }
  try {
    full = await sharp(input, { animated: false })
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new StorageError("This file could not be read as a photograph.")
  }

  if (!full.info.width || !full.info.height) {
    throw new StorageError("This file could not be read as a photograph.")
  }

  const thumb = await sharp(full.data)
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 74, effort: 4 })
    .toBuffer()

  const blur = await sharp(full.data)
    .resize({ width: 16, withoutEnlargement: true })
    .webp({ quality: 30 })
    .toBuffer()

  return {
    full: full.data,
    thumb,
    width: full.info.width,
    height: full.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  }
}
