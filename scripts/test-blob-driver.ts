import assert from "node:assert/strict"
import { test } from "node:test"

import { BlobPreconditionFailedError } from "@vercel/blob"
import sharp from "sharp"

import { storageKind } from "../src/lib/storage/driver"
import {
  contactNotesPathname,
  createBlobPhotoStorage,
  publicBlobReadUrl,
  vercelBlobClient,
  type BlobClient,
  type BlobGetResult,
  type BlobObject,
  type BlobPutOptions,
} from "../src/lib/storage/blob-store"
import { StorageError } from "../src/lib/storage/errors"
import { readSeedContent } from "../src/lib/storage/seed"

type Stored = {
  body: Buffer
  access: "public" | "private"
  contentType: string
  url: string
  etag: string
  pathname: string
}

function memoryClient() {
  const store = new Map<string, Stored>()
  let revision = 0

  const client: BlobClient = {
    async put(pathname, body, options: BlobPutOptions): Promise<BlobObject> {
      if (options.access === "private") {
        throw new Error("Vercel Blob: Failed to fetch blob: 400 Bad Request")
      }
      const existing = store.get(pathname)
      if (options.ifMatch) {
        if (!existing || existing.etag !== options.ifMatch) {
          throw new BlobPreconditionFailedError()
        }
      } else if (existing && options.allowOverwrite === false) {
        throw new BlobPreconditionFailedError()
      }
      revision += 1
      const etag = `W/"${revision}"`
      const host = "memory.public.blob.vercel-storage.com"
      const stored: Stored = {
        body: Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body),
        access: options.access,
        contentType: options.contentType ?? "application/octet-stream",
        url: `https://${host}/${pathname}`,
        etag,
        pathname,
      }
      store.set(pathname, stored)
      return {
        url: stored.url,
        pathname,
        contentType: stored.contentType,
        etag,
      }
    },

    async get(pathname, options): Promise<BlobGetResult | null> {
      if (options.access === "private") {
        throw new Error("Vercel Blob: Failed to fetch blob: 400 Bad Request")
      }
      const item = store.get(pathname)
      if (!item || item.access !== options.access) return null
      const bytes = item.body
      return {
        statusCode: 200,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(bytes))
            controller.close()
          },
        }),
        etag: item.etag,
        contentType: item.contentType,
        size: bytes.byteLength,
      }
    },

    async del(pathnames) {
      for (const key of pathnames) {
        store.delete(key)
        for (const [pathname, item] of store) {
          if (item.url === key) store.delete(pathname)
        }
      }
    },
  }

  return { client, store }
}

test("storage driver names", () => {
  assert.equal(storageKind(undefined), "local")
  assert.equal(storageKind(""), "local")
  assert.equal(storageKind("local"), "local")
  assert.equal(storageKind("blob"), "blob")
  assert.equal(storageKind("s3"), "cloud")
  assert.throws(() => storageKind("ftp"), /Unknown STORAGE_DRIVER/)
})

test("vercel blob client refuses to call the network without a token", async () => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.BLOB_READ_WRITE_TOKEN
  try {
    await assert.rejects(
      () => vercelBlobClient.put("library.json", "{}", { access: "public" }),
      (error: unknown) => {
        assert.ok(error instanceof StorageError)
        assert.match(error.message, /BLOB_READ_WRITE_TOKEN/)
        return true
      },
    )
  } finally {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = previous
  }
})

test("seed files are present and sharp can read one", async () => {
  const seed = await readSeedContent()
  assert.ok(seed)
  assert.equal(seed.albums.length, 3)
  assert.equal(seed.photos.length, 8)
  const webp = await sharp(seed.photos[0]?.bytes).rotate().webp().toBuffer()
  assert.ok(webp.byteLength > 100)
})

test("public blob reads bypass the CDN cache", () => {
  assert.equal(
    publicBlobReadUrl("library.json", "vercel_blob_rw_store123_secret"),
    "https://store123.public.blob.vercel-storage.com/library.json?cache=0",
  )
  assert.equal(publicBlobReadUrl("https://example.com/library.json", "vercel_blob_rw_store123_secret"), "https://example.com/library.json")
})

test("contact notes pathname is an unguessable hash of the blob token", () => {
  const secret = "vercel_blob_rw_store123_supersecret"
  const pathname = contactNotesPathname(secret)
  assert.match(pathname, /^notes\/[a-f0-9]{64}\.json$/)
  assert.equal(pathname.includes("supersecret"), false)
  assert.equal(pathname.includes("store123"), false)
  assert.equal(pathname, contactNotesPathname(secret))
  assert.notEqual(pathname, contactNotesPathname(`${secret}x`))
})

test("blob driver seeds, edits, and deletes against an in-memory store", async () => {
  const { client, store } = memoryClient()
  let seedReads = 0
  const notesSecret = () => "memory-store-secret"
  const storage = createBlobPhotoStorage({
    client,
    notesSecret,
    readSeed: async () => {
      seedReads += 1
      return {
        albums: [
          { slug: "coast", name: "Coast", description: "Water." },
        ],
        photos: [
          {
            file: "harbor.jpg",
            title: "Harbor, late",
            caption: "Windows still on.",
            album: "coast",
            createdAt: "2026-10-20T12:00:00.000Z",
            bytes: Buffer.from("harbor-bytes"),
          },
        ],
      }
    },
    processImage: async (bytes) => ({
      full: Buffer.from(`full:${bytes.toString("utf8")}`),
      thumb: Buffer.from("thumb"),
      width: 12,
      height: 8,
      blurDataUrl: "data:image/webp;base64,abc",
    }),
  })

  const photos = await storage.listPhotos()
  assert.equal(photos.length, 1)
  assert.equal(photos[0]?.title, "Harbor, late")
  assert.equal(seedReads, 1)

  const library = store.get("library.json")
  assert.ok(library)
  assert.equal(library.access, "public")
  const catalog = JSON.parse(library.body.toString("utf8")) as {
    messages: unknown[]
  }
  assert.deepEqual(catalog.messages, [])
  assert.match(library.body.toString("utf8"), /Harbor, late/)

  const image = [...store.values()].find((item) => item.pathname.endsWith("/full.webp"))
  assert.ok(image)
  assert.equal(image.access, "public")
  assert.equal(image.contentType, "image/webp")
  assert.equal(image.body.toString("utf8"), "full:harbor-bytes")

  const variant = await storage.readVariant(photos[0]!.id, "thumb")
  assert.equal(variant?.contentType, "image/webp")
  assert.match(variant?.redirectUrl ?? "", /thumb\.webp$/)
  assert.match(variant?.redirectUrl ?? "", /\.blob\.vercel-storage\.com/)

  const again = createBlobPhotoStorage({
    client,
    notesSecret,
    readSeed: async () => {
      seedReads += 1
      return null
    },
    processImage: async () => {
      throw new Error("process should not run when the library exists")
    },
  })
  assert.equal((await again.listPhotos()).length, 1)
  assert.equal(seedReads, 1)

  const albums = await storage.listAlbums()
  const added = await storage.savePhoto({
    bytes: Buffer.from("new-photo"),
    originalName: "road.jpg",
    mimeType: "image/jpeg",
    title: "After the rain",
    caption: "Wet road.",
    albumId: albums[0]?.id ?? null,
  })
  assert.equal(added.title, "After the rain")
  assert.equal((await storage.listPhotos())[0]?.title, "After the rain")

  await client.put("incoming/road.jpg", Buffer.from("from-browser"), {
    access: "public",
    contentType: "image/jpeg",
    allowOverwrite: false,
  })
  const fromBrowser = await storage.savePhoto({
    bytes: Buffer.alloc(0),
    sourcePathname: "incoming/road.jpg",
    originalName: "road.jpg",
    mimeType: "application/octet-stream",
    title: "From the browser",
    caption: "",
    albumId: null,
  })
  assert.equal(fromBrowser.title, "From the browser")
  assert.equal(store.has("incoming/road.jpg"), false)
  const browserFull = [...store.values()].find(
    (item) => item.pathname === `photos/${fromBrowser.id}/full.webp`,
  )
  assert.equal(browserFull?.body.toString("utf8"), "full:from-browser")

  await assert.rejects(
    () =>
      storage.savePhoto({
        bytes: Buffer.alloc(0),
        sourcePathname: "../library.json",
        originalName: "x.jpg",
        mimeType: "image/jpeg",
        title: "Nope",
        caption: "",
        albumId: null,
      }),
    /could not be found/,
  )

  const updated = await storage.updatePhoto(added.id, { title: "After" })
  assert.equal(updated.title, "After")
  await storage.deletePhoto(fromBrowser.id)
  assert.equal(
    (await storage.listPhotos()).some((photo) => photo.id === fromBrowser.id),
    false,
  )
  assert.equal(store.has(`photos/${fromBrowser.id}/full.webp`), false)
  assert.equal(store.has(`photos/${fromBrowser.id}/thumb.webp`), false)

  const note = await storage.saveMessage({
    name: "Ada",
    email: "ada@example.com",
    message: "Hello from the coast.",
  })
  assert.equal(note.email, "ada@example.com")
  const notesPath = contactNotesPathname(notesSecret())
  const notes = store.get(notesPath)
  assert.ok(notes)
  assert.equal(notes.access, "public")
  assert.match(notes.body.toString("utf8"), /ada@example.com/)
  const catalogAfter = JSON.parse(store.get("library.json")!.body.toString("utf8")) as {
    messages: unknown[]
  }
  assert.deepEqual(catalogAfter.messages, [])
  assert.equal(store.get("library.json")!.body.toString("utf8").includes("ada@example.com"), false)
  assert.equal((await storage.listMessages())[0]?.email, "ada@example.com")

  await storage.deletePhoto(added.id)
  assert.equal((await storage.listMessages())[0]?.id, note.id)
})
