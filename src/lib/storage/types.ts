import type { Album, ContactMessage, Photo } from "@/lib/types"

export type ImageVariant = "thumb" | "full"

export type SavePhotoInput = {
  bytes: Buffer
  originalName: string
  mimeType: string
  title: string
  caption: string
  albumId: string | null
  /**
   * Private blob pathname from a browser upload (`incoming/...`).
   * The blob driver reads and then deletes it. The local driver ignores it.
   */
  sourcePathname?: string
}

export type PhotoPatch = {
  title?: string
  caption?: string
  albumId?: string | null
}

export type StoredObject = {
  contentType: string
  bytes?: Buffer
  redirectUrl?: string
}

/**
 * The only surface the app uses to read and write photographs.
 * `local` stores bytes on disk and metadata in library.json.
 * A cloud driver (S3, R2, Vercel Blob) should implement this same contract.
 */
export interface PhotoStorage {
  listPhotos(): Promise<Photo[]>
  getPhoto(id: string): Promise<Photo | null>
  savePhoto(input: SavePhotoInput): Promise<Photo>
  updatePhoto(id: string, patch: PhotoPatch): Promise<Photo>
  deletePhoto(id: string): Promise<void>
  readVariant(id: string, variant: ImageVariant): Promise<StoredObject | null>

  listAlbums(): Promise<Album[]>
  getAlbumBySlug(slug: string): Promise<Album | null>
  saveAlbum(input: { name: string; description: string }): Promise<Album>
  deleteAlbum(id: string): Promise<void>

  listMessages(): Promise<ContactMessage[]>
  saveMessage(input: {
    name: string
    email: string
    message: string
  }): Promise<ContactMessage>
}
