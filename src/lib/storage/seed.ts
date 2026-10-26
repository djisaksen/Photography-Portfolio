import { readFile } from "node:fs/promises"
import path from "node:path"

export type SeedAlbum = {
  slug: string
  name: string
  description: string
}

export type SeedPhoto = {
  file: string
  title: string
  caption: string
  album: string
  createdAt: string
  bytes: Buffer
}

export type SeedContent = {
  albums: SeedAlbum[]
  photos: SeedPhoto[]
}

type SeedManifest = {
  albums?: SeedAlbum[]
  photos?: {
    file: string
    title?: string
    caption?: string
    album?: string
    createdAt?: string
  }[]
}

function isEnoent(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

export async function readSeedContent(): Promise<SeedContent | null> {
  const root = path.join(process.cwd(), "content", "seed")
  let manifest: SeedManifest
  try {
    manifest = JSON.parse(
      await readFile(path.join(root, "manifest.json"), "utf8"),
    ) as SeedManifest
  } catch (error) {
    if (isEnoent(error)) return null
    throw error
  }

  const photos: SeedPhoto[] = []
  for (const item of manifest.photos ?? []) {
    if (!item?.file) continue
    let bytes: Buffer
    try {
      bytes = await readFile(path.join(root, "images", item.file))
    } catch (error) {
      if (isEnoent(error)) continue
      throw error
    }
    photos.push({
      file: item.file,
      title: item.title?.trim() ?? "",
      caption: item.caption?.trim() ?? "",
      album: item.album ?? "",
      createdAt: item.createdAt ?? "2026-01-01T12:00:00.000Z",
      bytes,
    })
  }

  return {
    albums: (manifest.albums ?? []).map((album) => ({
      slug: album.slug,
      name: album.name,
      description: album.description ?? "",
    })),
    photos,
  }
}
