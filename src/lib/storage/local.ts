import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { processImage } from "@/lib/images"
import type { Album, ContactMessage, Library, Photo } from "@/lib/types"

import { StorageError } from "./errors"
import type {
  ImageVariant,
  PhotoPatch,
  PhotoStorage,
  SavePhotoInput,
} from "./types"

type SeedManifest = {
  albums: { slug: string; name: string; description: string }[]
  photos: {
    file: string
    title: string
    caption: string
    album: string
    createdAt: string
  }[]
}

function rootDir() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.join(process.cwd(), "storage")
}

function libraryPath() {
  return path.join(rootDir(), "library.json")
}

function photosDir() {
  return path.join(rootDir(), "photos")
}

function emptyLibrary(): Library {
  return { version: 1, photos: [], albums: [], messages: [] }
}

function isEnoent(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "album"
}

function uniqueSlug(name: string, albums: Album[]) {
  const base = slugify(name)
  const taken = new Set(albums.map((album) => album.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function byNewest<T extends { createdAt: string; id: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  )
}

let queue: Promise<void> = Promise.resolve()

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function writeLibrary(library: Library) {
  await mkdir(rootDir(), { recursive: true })
  const temporary = `${libraryPath()}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(library, null, 2))
  await rename(temporary, libraryPath())
}

async function readLibraryFile(): Promise<Library> {
  const raw = await readFile(libraryPath(), "utf8")
  const parsed = JSON.parse(raw) as Library
  if (
    !parsed ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.photos) ||
    !Array.isArray(parsed.albums) ||
    !Array.isArray(parsed.messages)
  ) {
    throw new StorageError("The photo library could not be read.", 500)
  }
  return parsed
}

async function seed() {
  await rm(photosDir(), { recursive: true, force: true })
  await mkdir(photosDir(), { recursive: true })

  const manifestPath = path.join(
    process.cwd(),
    "content",
    "seed",
    "manifest.json",
  )
  let manifest: SeedManifest | null = null
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as SeedManifest
  } catch (error) {
    if (!isEnoent(error)) throw error
  }

  const library = emptyLibrary()
  if (!manifest) {
    await writeLibrary(library)
    return
  }

  const albumIds = new Map<string, string>()
  for (const album of manifest.albums ?? []) {
    const id = randomUUID()
    albumIds.set(album.slug, id)
    library.albums.push({
      id,
      slug: album.slug,
      name: album.name,
      description: album.description ?? "",
      createdAt: "2026-01-01T12:00:00.000Z",
    })
  }

  for (const item of manifest.photos ?? []) {
    const source = path.join(
      process.cwd(),
      "content",
      "seed",
      "images",
      item.file,
    )
    let bytes: Buffer
    try {
      bytes = await readFile(source)
    } catch (error) {
      if (isEnoent(error)) continue
      throw error
    }
    const processed = await processImage(bytes)
    const id = randomUUID()
    const directory = path.join(photosDir(), id)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, "full.webp"), processed.full)
    await writeFile(path.join(directory, "thumb.webp"), processed.thumb)
    library.photos.push({
      id,
      title: item.title?.trim() ?? "",
      caption: item.caption?.trim() ?? "",
      albumId: albumIds.get(item.album) ?? null,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      originalName: item.file,
      bytes: bytes.byteLength,
      createdAt: item.createdAt,
    })
  }

  await writeLibrary(library)
}

let ready: Promise<void> | null = null

function whenReady() {
  if (!ready) {
    ready = (async () => {
      await mkdir(rootDir(), { recursive: true })
      try {
        await readFile(libraryPath())
      } catch (error) {
        if (!isEnoent(error)) throw error
        await seed()
      }
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

async function loadLibrary() {
  await whenReady()
  return withLock(() => readLibraryFile())
}

async function updateLibrary<T>(mutator: (library: Library) => Promise<T>) {
  await whenReady()
  return withLock(async () => {
    const library = await readLibraryFile()
    const result = await mutator(library)
    await writeLibrary(library)
    return result
  })
}

async function writeVariants(id: string, full: Buffer, thumb: Buffer) {
  const directory = path.join(photosDir(), id)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "full.webp"), full)
  await writeFile(path.join(directory, "thumb.webp"), thumb)
}

export const localPhotoStorage: PhotoStorage = {
  async listPhotos() {
    const library = await loadLibrary()
    return byNewest(library.photos)
  },

  async getPhoto(id) {
    const library = await loadLibrary()
    return library.photos.find((photo) => photo.id === id) ?? null
  },

  async savePhoto(input: SavePhotoInput) {
    const processed = await processImage(input.bytes)
    const id = randomUUID()
    try {
      await writeVariants(id, processed.full, processed.thumb)
    } catch (error) {
      await rm(path.join(photosDir(), id), { recursive: true, force: true })
      throw error
    }

    const photo: Photo = {
      id,
      title: input.title.trim().slice(0, 120),
      caption: input.caption.trim().slice(0, 600),
      albumId: input.albumId,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      originalName: input.originalName.slice(0, 180),
      bytes: input.bytes.byteLength,
      createdAt: new Date().toISOString(),
    }

    try {
      return await updateLibrary(async (library) => {
        if (
          photo.albumId &&
          !library.albums.some((album) => album.id === photo.albumId)
        ) {
          throw new StorageError("That album no longer exists.")
        }
        library.photos.push(photo)
        return photo
      })
    } catch (error) {
      await rm(path.join(photosDir(), id), { recursive: true, force: true })
      throw error
    }
  },

  async updatePhoto(id, patch: PhotoPatch) {
    return updateLibrary(async (library) => {
      const photo = library.photos.find((item) => item.id === id)
      if (!photo) {
        throw new StorageError("That photograph is no longer in the archive.", 404)
      }
      if (patch.title !== undefined) {
        photo.title = patch.title.trim().slice(0, 120)
      }
      if (patch.caption !== undefined) {
        photo.caption = patch.caption.trim().slice(0, 600)
      }
      if (patch.albumId !== undefined) {
        if (!patch.albumId) {
          photo.albumId = null
        } else if (!library.albums.some((album) => album.id === patch.albumId)) {
          throw new StorageError("That album no longer exists.")
        } else {
          photo.albumId = patch.albumId
        }
      }
      return photo
    })
  },

  async deletePhoto(id) {
    await updateLibrary(async (library) => {
      const exists = library.photos.some((photo) => photo.id === id)
      if (!exists) {
        throw new StorageError("That photograph is no longer in the archive.", 404)
      }
      library.photos = library.photos.filter((photo) => photo.id !== id)
      await rm(path.join(photosDir(), id), { recursive: true, force: true })
    })
  },

  async readVariant(id, variant: ImageVariant) {
    const library = await loadLibrary()
    const photo = library.photos.find((item) => item.id === id)
    if (!photo) return null
    try {
      const bytes = await readFile(
        path.join(photosDir(), id, `${variant}.webp`),
      )
      return { bytes, contentType: "image/webp" }
    } catch (error) {
      if (isEnoent(error)) return null
      throw error
    }
  },

  async listAlbums() {
    const library = await loadLibrary()
    return [...library.albums].sort((a, b) => a.name.localeCompare(b.name))
  },

  async getAlbumBySlug(slug) {
    const library = await loadLibrary()
    return library.albums.find((album) => album.slug === slug) ?? null
  },

  async saveAlbum(input) {
    const name = input.name.trim().slice(0, 60)
    if (!name) throw new StorageError("Give the album a name.")
    const description = input.description.trim().slice(0, 280)
    return updateLibrary(async (library) => {
      const album: Album = {
        id: randomUUID(),
        slug: uniqueSlug(name, library.albums),
        name,
        description,
        createdAt: new Date().toISOString(),
      }
      library.albums.push(album)
      return album
    })
  },

  async deleteAlbum(id) {
    await updateLibrary(async (library) => {
      const exists = library.albums.some((album) => album.id === id)
      if (!exists) {
        throw new StorageError("That album is no longer in the archive.", 404)
      }
      library.albums = library.albums.filter((album) => album.id !== id)
      for (const photo of library.photos) {
        if (photo.albumId === id) photo.albumId = null
      }
    })
  },

  async listMessages() {
    const library = await loadLibrary()
    return byNewest(library.messages)
  },

  async saveMessage(input) {
    const message: ContactMessage = {
      id: randomUUID(),
      name: input.name.trim().slice(0, 80),
      email: input.email.trim().slice(0, 160),
      message: input.message.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
    }
    if (!message.name || !message.email || !message.message) {
      throw new StorageError("Name, email, and a note are required.")
    }
    return updateLibrary(async (library) => {
      library.messages.push(message)
      library.messages = byNewest(library.messages).slice(0, 200)
      return message
    })
  },
}
