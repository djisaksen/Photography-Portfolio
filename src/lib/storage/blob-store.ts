import { randomUUID } from "node:crypto"

import {
  BlobPreconditionFailedError,
  del as blobDel,
  get as blobGet,
  put as blobPut,
} from "@vercel/blob"

import { detectMime, isIncomingPathname, MAX_UPLOAD_BYTES } from "@/lib/files"
import type { Album, ContactMessage, Library, Photo } from "@/lib/types"

import { StorageError } from "./errors"
import type { SeedContent } from "./seed"
import type {
  ImageVariant,
  PhotoPatch,
  PhotoStorage,
  SavePhotoInput,
} from "./types"

const LIBRARY_PATH = "library.json"
const LIBRARY_LIMIT = 2 * 1024 * 1024
const YEAR_SECONDS = 60 * 60 * 24 * 365

export type ProcessedImage = {
  full: Buffer
  thumb: Buffer
  width: number
  height: number
  blurDataUrl: string
}

export type BlobPutOptions = {
  access: "public" | "private"
  contentType?: string
  allowOverwrite?: boolean
  addRandomSuffix?: boolean
  cacheControlMaxAge?: number
  ifMatch?: string
}

export type BlobObject = {
  url: string
  pathname: string
  contentType: string
  etag: string
}

export type BlobGetResult = {
  statusCode: 200 | 304
  stream: ReadableStream<Uint8Array> | null
  etag: string
  contentType: string | null
  size: number | null
}

export interface BlobClient {
  put(
    pathname: string,
    body: Buffer | string,
    options: BlobPutOptions,
  ): Promise<BlobObject>
  get(
    pathname: string,
    options: { access: "public" | "private"; useCache?: boolean },
  ): Promise<BlobGetResult | null>
  del(pathnames: string[]): Promise<void>
}

const TOKEN_MESSAGE =
  "BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in the Vercel project and add its read-write token."

function requireToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new StorageError(TOKEN_MESSAGE, 500)
  }
}

export const vercelBlobClient: BlobClient = {
  async put(pathname, body, options) {
    requireToken()
    const result = await blobPut(pathname, body, options)
    return {
      url: result.url,
      pathname: result.pathname,
      contentType: result.contentType,
      etag: result.etag,
    }
  },

  async get(pathname, options) {
    requireToken()
    const result = await blobGet(pathname, {
      access: options.access,
      useCache: options.useCache ?? false,
    })
    if (!result) return null
    return {
      statusCode: result.statusCode,
      stream: result.stream,
      etag: result.blob.etag,
      contentType: result.blob.contentType,
      size: result.blob.size,
    }
  },

  async del(pathnames) {
    requireToken()
    if (!pathnames.length) return
    await blobDel(pathnames)
  },
}

export function isConflict(error: unknown) {
  if (error instanceof BlobPreconditionFailedError) return true
  return error instanceof Error && /already exists/i.test(error.message)
}

function emptyLibrary(): Library {
  return { version: 1, photos: [], albums: [], messages: [] }
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

function parseLibrary(raw: string): Library {
  let parsed: Library
  try {
    parsed = JSON.parse(raw) as Library
  } catch {
    throw new StorageError("The photo library could not be read.", 500)
  }
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

function blobHostname(url: string) {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith(".blob.vercel-storage.com") ||
        parsed.hostname === "blob.vercel-storage.com")
    )
  } catch {
    return false
  }
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  tooLarge: string,
) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > limit) {
        throw new StorageError(tooLarge)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}

function variantPath(id: string, variant: ImageVariant) {
  return `photos/${id}/${variant}.webp`
}

export function createBlobPhotoStorage(deps: {
  client: BlobClient
  processImage: (bytes: Buffer) => Promise<ProcessedImage>
  readSeed: () => Promise<SeedContent | null>
}): PhotoStorage {
  const { client, processImage, readSeed } = deps
  let queue: Promise<void> = Promise.resolve()

  function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function readLibrary(): Promise<{ library: Library; etag: string } | null> {
    const result = await client.get(LIBRARY_PATH, {
      access: "private",
      useCache: false,
    })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const raw = (
      await readStream(
        result.stream,
        LIBRARY_LIMIT,
        "The photo library is too large to read.",
      )
    ).toString("utf8")
    return { library: parseLibrary(raw), etag: result.etag }
  }

  async function writeLibrary(
    library: Library,
    options: { allowOverwrite: boolean; ifMatch?: string },
  ) {
    await client.put(LIBRARY_PATH, JSON.stringify(library), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: options.allowOverwrite,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ifMatch: options.ifMatch,
    })
  }

  async function putVariant(id: string, variant: ImageVariant, bytes: Buffer) {
    return client.put(variantPath(id, variant), bytes, {
      access: "public",
      contentType: "image/webp",
      allowOverwrite: false,
      addRandomSuffix: false,
      cacheControlMaxAge: YEAR_SECONDS,
    })
  }

  async function removePaths(pathnames: string[]) {
    const unique = [...new Set(pathnames.filter(Boolean))]
    if (!unique.length) return
    await client.del(unique)
  }

  async function buildSeed(): Promise<{ library: Library; uploaded: string[] }> {
    const seed = await readSeed()
    const library = emptyLibrary()
    const uploaded: string[] = []
    if (!seed) return { library, uploaded }

    const albumIds = new Map<string, string>()
    for (const album of seed.albums) {
      const id = randomUUID()
      albumIds.set(album.slug, id)
      library.albums.push({
        id,
        slug: album.slug,
        name: album.name,
        description: album.description,
        createdAt: "2026-01-01T12:00:00.000Z",
      })
    }

    for (const item of seed.photos) {
      const processed = await processImage(item.bytes)
      const id = randomUUID()
      const full = await putVariant(id, "full", processed.full)
      uploaded.push(full.pathname)
      const thumb = await putVariant(id, "thumb", processed.thumb)
      uploaded.push(thumb.pathname)
      library.photos.push({
        id,
        title: item.title.slice(0, 120),
        caption: item.caption.slice(0, 600),
        albumId: albumIds.get(item.album) ?? null,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        originalName: item.file.slice(0, 180),
        bytes: item.bytes.byteLength,
        createdAt: item.createdAt,
        thumbUrl: thumb.url,
        fullUrl: full.url,
      })
    }

    return { library, uploaded }
  }

  let ready: Promise<void> | null = null

  function whenReady() {
    if (!ready) {
      ready = ensureLibrary().catch((error) => {
        ready = null
        throw error
      })
    }
    return ready
  }

  async function ensureLibrary() {
    const existing = await readLibrary()
    if (existing) return
    const seeded = await buildSeed()
    try {
      await writeLibrary(seeded.library, { allowOverwrite: false })
    } catch (error) {
      if (!isConflict(error)) throw error
      await removePaths(seeded.uploaded).catch(() => undefined)
    }
  }

  async function updateLibrary<T>(mutator: (library: Library) => Promise<T> | T) {
    await whenReady()
    return withLock(async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const current = await readLibrary()
        if (!current) {
          throw new StorageError("The photo library could not be read.", 500)
        }
        const next = structuredClone(current.library)
        const result = await mutator(next)
        try {
          await writeLibrary(next, {
            allowOverwrite: true,
            ifMatch: current.etag,
          })
          return result
        } catch (error) {
          if (!isConflict(error) || attempt === 3) throw error
        }
      }
      throw new StorageError("The archive changed while saving. Try again.", 409)
    })
  }

  async function loadLibrary() {
    await whenReady()
    const current = await readLibrary()
    if (!current) {
      throw new StorageError("The photo library could not be read.", 500)
    }
    return current.library
  }

  return {
    async listPhotos() {
      const library = await loadLibrary()
      return byNewest(library.photos)
    },

    async getPhoto(id) {
      const library = await loadLibrary()
      return library.photos.find((photo) => photo.id === id) ?? null
    },

    async savePhoto(input: SavePhotoInput) {
      let bytes = input.bytes
      let mimeType = input.mimeType
      const incoming =
        input.sourcePathname && isIncomingPathname(input.sourcePathname)
          ? input.sourcePathname
          : null
      if (input.sourcePathname && !incoming) {
        throw new StorageError("That upload could not be found.")
      }

      try {
        if (incoming) {
          const downloaded = await client.get(incoming, {
            access: "private",
            useCache: false,
          })
          if (!downloaded || downloaded.statusCode !== 200 || !downloaded.stream) {
            throw new StorageError("That upload could not be found.")
          }
          bytes = await readStream(
            downloaded.stream,
            MAX_UPLOAD_BYTES,
            "Photographs must be 25 MB or smaller.",
          )
          mimeType = (downloaded.contentType ?? mimeType).split(";")[0]?.trim() || mimeType
        }

        if (!bytes.byteLength) {
          throw new StorageError("That file is empty.")
        }
        if (bytes.byteLength > MAX_UPLOAD_BYTES) {
          throw new StorageError("Photographs must be 25 MB or smaller.")
        }
        const mime = detectMime(input.originalName, mimeType)
        if (!mime) {
          throw new StorageError("Use a JPEG, PNG, WebP, GIF, or AVIF file.")
        }

        const processed = await processImage(bytes)
        const id = randomUUID()
        let fullPath = ""
        let thumbPath = ""
        try {
          const full = await putVariant(id, "full", processed.full)
          fullPath = full.pathname
          const thumb = await putVariant(id, "thumb", processed.thumb)
          thumbPath = thumb.pathname
          const photo: Photo = {
            id,
            title: input.title.trim().slice(0, 120),
            caption: input.caption.trim().slice(0, 600),
            albumId: input.albumId,
            width: processed.width,
            height: processed.height,
            blurDataUrl: processed.blurDataUrl,
            originalName: input.originalName.slice(0, 180),
            bytes: bytes.byteLength,
            createdAt: new Date().toISOString(),
            thumbUrl: thumb.url,
            fullUrl: full.url,
          }
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
          await removePaths([fullPath, thumbPath]).catch(() => undefined)
          throw error
        }
      } finally {
        if (incoming) {
          await client.del([incoming]).catch(() => undefined)
        }
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
      let paths: string[] = []
      await updateLibrary(async (library) => {
        const photo = library.photos.find((item) => item.id === id)
        if (!photo) {
          throw new StorageError("That photograph is no longer in the archive.", 404)
        }
        paths = [variantPath(id, "full"), variantPath(id, "thumb")]
        library.photos = library.photos.filter((item) => item.id !== id)
      })
      await removePaths(paths)
    },

    async readVariant(id, variant: ImageVariant) {
      const library = await loadLibrary()
      const photo = library.photos.find((item) => item.id === id)
      if (!photo) return null
      const url = variant === "full" ? photo.fullUrl : photo.thumbUrl
      if (!url || !blobHostname(url)) return null
      return { redirectUrl: url, contentType: "image/webp" }
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
}
