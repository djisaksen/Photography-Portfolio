export type Photo = {
  id: string
  title: string
  caption: string
  albumId: string | null
  width: number
  height: number
  blurDataUrl: string
  originalName: string
  bytes: number
  createdAt: string
  thumbUrl?: string
  fullUrl?: string
}

export type Album = {
  id: string
  slug: string
  name: string
  description: string
  createdAt: string
}

export type ContactMessage = {
  id: string
  name: string
  email: string
  message: string
  createdAt: string
}

export type Library = {
  version: 1
  photos: Photo[]
  albums: Album[]
  messages: ContactMessage[]
}
