"use client"

import Link from "next/link"
import { useState } from "react"

import { Container } from "@/components/container"
import { Lightbox } from "@/components/lightbox"
import { Button } from "@/components/ui/button"
import { mediaUrl, photoCount } from "@/lib/format"
import type { Album, Photo } from "@/lib/types"

export function Gallery({
  photos,
  albums,
  showFilters = false,
}: {
  photos: Photo[]
  albums: Album[]
  showFilters?: boolean
}) {
  const [albumId, setAlbumId] = useState<string>("all")
  const [active, setActive] = useState<number | null>(null)
  const visible =
    showFilters && albumId !== "all"
      ? photos.filter((photo) => photo.albumId === albumId)
      : photos

  function chooseAlbum(next: string) {
    setAlbumId(next)
    setActive(null)
  }

  return (
    <Container className="pb-20">
      {showFilters && albums.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by album">
            <FilterChip pressed={albumId === "all"} onClick={() => chooseAlbum("all")}>
            All
            <span className="text-current/70">{photos.length}</span>
          </FilterChip>
          {albums.map((album) => {
            const count = photos.filter((photo) => photo.albumId === album.id).length
            return (
              <FilterChip
                key={album.id}
                pressed={albumId === album.id}
                onClick={() => chooseAlbum(album.id)}
              >
                {album.name}
                <span className="text-current/70">{count}</span>
              </FilterChip>
            )
          })}
        </div>
      )}

      <p className="mb-5 text-sm text-muted-foreground">{photoCount(visible.length)}</p>

      {visible.length === 0 ? (
        <div className="py-16">
          <p className="font-display text-3xl tracking-tight">The archive is quiet.</p>
          <p className="mt-3 max-w-md text-muted-foreground">
            Photographs added in the studio will appear here.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-x-5 sm:columns-2 lg:columns-3" data-testid="gallery">
          {visible.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              album={albums.find((album) => album.id === photo.albumId)}
              eager={index < 2}
              onOpen={() => setActive(index)}
            />
          ))}
        </div>
      )}

      <Lightbox
        photos={visible}
        albums={albums}
        index={active}
        onClose={() => setActive(null)}
        onIndex={setActive}
      />
    </Container>
  )
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
      className="h-8 rounded-full px-3"
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </Button>
  )
}

function PhotoTile({
  photo,
  album,
  eager,
  onOpen,
}: {
  photo: Photo
  album?: Album
  eager: boolean
  onOpen: () => void
}) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className="mb-8 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={photo.title ? `View ${photo.title}` : "View photograph"}
        className="block w-full overflow-hidden bg-muted text-left"
        style={{
          backgroundImage: photo.blurDataUrl ? `url(${photo.blurDataUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {failed ? (
          <span className="flex aspect-[4/5] items-end p-4 text-sm text-muted-foreground">
            This photograph could not be loaded.
          </span>
        ) : (
          // Runtime uploads are served as pre-sized WebP from the storage driver.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(photo.id, "thumb")}
            alt=""
            width={photo.width}
            height={photo.height}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            onError={() => setFailed(true)}
            className="h-auto w-full"
          />
        )}
      </button>
      {(photo.title || album) && (
        <figcaption className="mt-2.5 flex items-baseline justify-between gap-3">
          <span className="font-display text-[1.05rem] leading-tight tracking-tight">
            {photo.title}
          </span>
          {album && (
            <Link
              href={`/albums/${album.slug}`}
              className="shrink-0 text-xs tracking-wide text-muted-foreground hover:text-foreground"
            >
              {album.name}
            </Link>
          )}
        </figcaption>
      )}
    </figure>
  )
}
