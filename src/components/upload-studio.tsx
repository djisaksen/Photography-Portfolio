"use client"

import { upload } from "@vercel/blob/client"
import { LogOut, Trash } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Container, Eyebrow } from "@/components/container"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { detectMime, incomingPathname, MAX_QUEUE, MAX_UPLOAD_BYTES } from "@/lib/files"
import { formatBytes, formatDate, mediaUrl } from "@/lib/format"
import { ApiError, api } from "@/lib/http"
import type { Album, ContactMessage, Photo } from "@/lib/types"
import { cn } from "cn"

function formBody(item: QueueItem) {
  const form = new FormData()
  form.set("file", item.file)
  form.set("title", item.title)
  form.set("caption", item.caption)
  form.set("albumId", item.albumId)
  return form
}

async function uploadToBlob(
  item: QueueItem,
  index: number,
  total: number,
  setProgress: (value: string) => void,
) {
  const mime = detectMime(item.file.name, item.file.type)
  const blob = await upload(incomingPathname(item.file.name), item.file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload",
    contentType: mime ?? undefined,
    multipart: item.file.size > 4 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => {
      setProgress(
        `Sending ${index + 1} of ${total} · ${Math.round(percentage)}%`,
      )
    },
  })
  return {
    pathname: blob.pathname,
    title: item.title,
    caption: item.caption,
    albumId: item.albumId,
    originalName: item.file.name,
  }
}

type QueueItem = {
  key: string
  file: File
  previewUrl: string
  title: string
  caption: string
  albumId: string
  status: "ready" | "uploading" | "error"
  error?: string
}

export function PasswordGate({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      })
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not sign in.")
      setPending(false)
    }
  }

  return (
    <Container className="max-w-xl py-16 sm:py-24">
      <Eyebrow>Private</Eyebrow>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Studio</h1>
      {configured ? (
        <>
          <p className="mt-4 text-muted-foreground">
            The archive is locked. Enter the studio password to add or remove photographs.
          </p>
          <form onSubmit={onSubmit} className="mt-8 grid gap-4" data-testid="password-form">
            <div className="grid gap-2">
              <Label htmlFor="studio-password">Password</Label>
              <Input
                id="studio-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                className="h-10"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="h-10 w-fit px-4">
              {pending ? "Checking…" : "Enter studio"}
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-4 max-w-md text-muted-foreground">
          This studio has no password yet. Set <code>ADMIN_PASSWORD</code> in the
          environment and restart the server.
        </p>
      )}
    </Container>
  )
}

export function Studio({
  initialPhotos,
  initialAlbums,
  messages,
  directUpload = false,
}: {
  initialPhotos: Photo[]
  initialAlbums: Album[]
  messages: ContactMessage[]
  directUpload?: boolean
}) {
  const router = useRouter()
  const [photos, setPhotos] = useState(initialPhotos)
  const [albums, setAlbums] = useState(initialAlbums)
  const inputRef = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [defaultAlbum, setDefaultAlbum] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState("")
  const [albumName, setAlbumName] = useState("")
  const [albumDescription, setAlbumDescription] = useState("")
  const [pendingDelete, setPendingDelete] = useState<Photo | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const tracked = urls.current
    return () => {
      for (const url of tracked) URL.revokeObjectURL(url)
    }
  }, [])

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const next: QueueItem[] = []
    const errors: string[] = []
    for (const file of incoming) {
      if (queue.length + next.length >= MAX_QUEUE) {
        errors.push("You can queue up to 30 photographs at a time.")
        break
      }
      if (!detectMime(file.name, file.type)) {
        errors.push(`${file.name} is not a JPEG, PNG, WebP, GIF, or AVIF.`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        errors.push(`${file.name} is larger than 25 MB.`)
        continue
      }
      if (file.size === 0) {
        errors.push(`${file.name} is empty.`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      urls.current.push(previewUrl)
      const stem = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        title: stem,
        caption: "",
        albumId: defaultAlbum,
        status: "ready",
      })
    }
    if (errors.length) toast.error(errors[0])
    if (next.length) setQueue((current) => [...current, ...next])
  }

  function patchQueue(key: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  function removeQueued(item: QueueItem) {
    URL.revokeObjectURL(item.previewUrl)
    setQueue((current) => current.filter((entry) => entry.key !== item.key))
  }

  async function uploadAll() {
    const pending = queue.filter((item) => item.status !== "uploading")
    if (!pending.length || uploading) return
    setUploading(true)
    let added = 0
    let archive = photos
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index]
      if (!item) continue
      setProgress(`Adding ${index + 1} of ${pending.length}`)
      patchQueue(item.key, { status: "uploading", error: undefined })
      try {
        const result = await api<{ photo: Photo }>("/api/photos", {
          method: "POST",
          body: directUpload
            ? JSON.stringify(await uploadToBlob(item, index, pending.length, setProgress))
            : formBody(item),
        })
        added += 1
        archive = [
          result.photo,
          ...archive.filter((photo) => photo.id !== result.photo.id),
        ]
        setPhotos(archive)
        removeQueued(item)
      } catch (error) {
        patchQueue(item.key, {
          status: "error",
          error:
            error instanceof ApiError
              ? error.message
              : error instanceof Error && error.message
                ? error.message
                : "Upload failed.",
        })
      }
    }
    setUploading(false)
    setProgress("")
    if (added) {
      toast.success(
        added === 1 ? "1 photograph added to the archive." : `${added} photographs added to the archive.`,
      )
    }
  }

  async function createAlbum(event: React.FormEvent) {
    event.preventDefault()
    try {
      const result = await api<{ album: Album }>("/api/albums", {
        method: "POST",
        body: JSON.stringify({ name: albumName, description: albumDescription }),
      })
      setAlbums([...albums, result.album].sort((a, b) => a.name.localeCompare(b.name)))
      setDefaultAlbum(result.album.id)
      setAlbumName("")
      setAlbumDescription("")
      toast.success(`Album “${result.album.name}” is ready.`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The album could not be saved.")
    }
  }

  async function deleteAlbum(album: Album) {
    try {
      await api(`/api/albums/${album.id}`, { method: "DELETE" })
      setAlbums(albums.filter((item) => item.id !== album.id))
      setPhotos(
        photos.map((photo) =>
          photo.albumId === album.id ? { ...photo, albumId: null } : photo,
        ),
      )
      if (defaultAlbum === album.id) setDefaultAlbum("")
      toast.success(`“${album.name}” was removed. Its photographs stayed in the archive.`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The album could not be removed.")
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api(`/api/photos/${pendingDelete.id}`, { method: "DELETE" })
      setPhotos(photos.filter((photo) => photo.id !== pendingDelete.id))
      toast.success("Photograph removed.")
      setPendingDelete(null)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The photograph could not be removed.")
    } finally {
      setDeleting(false)
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" })
    router.refresh()
  }

  return (
    <Container className="py-12 sm:py-16" data-testid="studio">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Private</Eyebrow>
          <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Studio</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Add photographs, write a title and caption, and remove anything that should leave the archive.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
            View gallery
          </Link>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="add-heading">
        <h2 id="add-heading" className="font-display text-2xl tracking-tight">
          Add photographs
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid w-full gap-2 sm:max-w-xs">
            <Label htmlFor="default-album">Put new photographs in</Label>
            <select
              id="default-album"
              value={defaultAlbum}
              onChange={(event) => setDefaultAlbum(event.target.value)}
              className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">No album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label
          data-testid="dropzone"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
          }}
          className={cn(
            "mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-colors",
            dragging ? "border-foreground bg-muted" : "border-border bg-card hover:bg-muted/60",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <span className="font-display text-3xl tracking-tight">Drop photographs</span>
          <span className="mt-2 max-w-sm text-sm text-muted-foreground">
            or browse. Several files at once. JPEG, PNG, WebP, GIF, or AVIF, up to 25 MB each.
          </span>
        </label>

        {queue.length > 0 && (
          <div className="mt-6 grid gap-4">
            {queue.map((item) => (
              <article
                key={item.key}
                className="grid gap-4 rounded-xl border border-border bg-card p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                {/* Local preview of a file that has not been uploaded yet. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-28 w-full rounded-md object-cover sm:h-full"
                />
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {item.file.name} · {formatBytes(item.file.size)}
                      {item.status === "uploading" ? " · uploading" : ""}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQueued(item)}
                      disabled={item.status === "uploading"}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`${item.key}-title`}>Title</Label>
                      <Input
                        id={`${item.key}-title`}
                        value={item.title}
                        onChange={(event) => patchQueue(item.key, { title: event.target.value })}
                        className="h-10"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${item.key}-album`}>Album</Label>
                      <select
                        id={`${item.key}-album`}
                        value={item.albumId}
                        onChange={(event) => patchQueue(item.key, { albumId: event.target.value })}
                        className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      >
                        <option value="">No album</option>
                        {albums.map((album) => (
                          <option key={album.id} value={album.id}>
                            {album.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${item.key}-caption`}>Caption</Label>
                    <Textarea
                      id={`${item.key}-caption`}
                      value={item.caption}
                      onChange={(event) => patchQueue(item.key, { caption: event.target.value })}
                      className="min-h-20"
                    />
                  </div>
                  {item.error && (
                    <p className="text-sm text-destructive" role="alert">
                      {item.error}
                    </p>
                  )}
                </div>
              </article>
            ))}
            <div className="flex items-center gap-4">
              <Button type="button" onClick={() => void uploadAll()} disabled={uploading} className="h-10 px-4">
                {uploading ? progress || "Adding…" : `Add ${queue.length} to archive`}
              </Button>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {progress}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-16" aria-labelledby="archive-heading">
        <h2 id="archive-heading" className="font-display text-2xl tracking-tight">
          In the archive
        </h2>
        {photos.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            No photographs yet. The ones you add will show up in the gallery.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {photos.map((photo) => (
              <PhotoEditor
                key={`${photo.id}:${photo.title}:${photo.caption}:${photo.albumId ?? ""}`}
                photo={photo}
                albums={albums}
                onUpdated={(updated) =>
                  setPhotos(photos.map((item) => (item.id === updated.id ? updated : item)))
                }
                onAskDelete={() => setPendingDelete(photo)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16" aria-labelledby="albums-heading">
        <h2 id="albums-heading" className="font-display text-2xl tracking-tight">
          Albums
        </h2>
        <form onSubmit={createAlbum} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="album-name">Name</Label>
            <Input
              id="album-name"
              value={albumName}
              onChange={(event) => setAlbumName(event.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="album-description">Description</Label>
            <Input
              id="album-description"
              value={albumDescription}
              onChange={(event) => setAlbumDescription(event.target.value)}
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10 px-4">
            Add album
          </Button>
        </form>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {albums.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No albums yet.</li>
          )}
          {albums.map((album) => {
            const count = photos.filter((photo) => photo.albumId === album.id).length
            return (
              <li key={album.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-display text-xl">{album.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {album.description || "No description"} · {count}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void deleteAlbum(album)}>
                  <Trash />
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-16 mb-8" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-display text-2xl tracking-tight">
          Notes
        </h2>
        {messages.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {messages.map((note) => (
              <li key={note.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {note.name} · {note.email} · {formatDate(note.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{note.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this photograph?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.title
                ? `“${pendingDelete.title}” will leave the gallery and the archive.`
                : "It will leave the gallery and the archive."}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  )
}

function PhotoEditor({
  photo,
  albums,
  onUpdated,
  onAskDelete,
}: {
  photo: Photo
  albums: Album[]
  onUpdated: (photo: Photo) => void
  onAskDelete: () => void
}) {
  const [title, setTitle] = useState(photo.title)
  const [caption, setCaption] = useState(photo.caption)
  const [albumId, setAlbumId] = useState(photo.albumId ?? "")
  const [saving, setSaving] = useState(false)
  const dirty =
    title !== photo.title || caption !== photo.caption || albumId !== (photo.albumId ?? "")

  async function save() {
    setSaving(true)
    try {
      const result = await api<{ photo: Photo }>(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, caption, albumId: albumId || null }),
      })
      onUpdated(result.photo)
      toast.success("Saved.")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The edit could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(photo.id, "thumb")}
        alt=""
        width={photo.width}
        height={photo.height}
        loading="lazy"
        className="h-32 w-full rounded-md object-cover sm:h-full"
      />
      <div className="grid gap-3">
        <Input
          aria-label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10"
        />
        <Textarea
          aria-label="Caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="min-h-16"
        />
        <select
          aria-label="Album"
          value={albumId}
          onChange={(event) => setAlbumId(event.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">No album</option>
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onAskDelete}>
            <Trash />
            Delete
          </Button>
        </div>
      </div>
    </article>
  )
}
