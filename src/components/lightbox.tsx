"use client"

import { ArrowLeft, ArrowRight, X } from "lucide-react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import type { Album, Photo } from "@/lib/types"
import { formatDate, mediaUrl } from "@/lib/format"

export function Lightbox({
  photos,
  albums,
  index,
  onClose,
  onIndex,
}: {
  photos: Photo[]
  albums: Album[]
  index: number | null
  onClose: () => void
  onIndex: (index: number) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchStart = useRef<number | null>(null)
  const focused = useRef(false)
  const photo = index === null ? null : photos[index]

  useEffect(() => {
    if (!photo || index === null) {
      focused.current = false
      return
    }
    const current = index
    if (!focused.current) {
      closeRef.current?.focus()
      focused.current = true
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight" && current < photos.length - 1) onIndex(current + 1)
      if (event.key === "ArrowLeft" && current > 0) onIndex(current - 1)
    }

    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [photo, index, onClose, onIndex, photos.length])

  useEffect(() => {
    if (index === null) return
    for (const neighbor of [photos[index - 1], photos[index + 1]]) {
      if (!neighbor) continue
      const image = new Image()
      image.src = mediaUrl(neighbor.id, "full")
    }
  }, [index, photos])

  if (!photo || index === null || typeof document === "undefined") return null

  const album = albums.find((item) => item.id === photo.albumId)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0c0b0a]/94"
        aria-label="Close photograph"
        onClick={onClose}
      />
      <div className="pointer-events-none relative z-10 flex h-full flex-col text-white">
        <div className="pointer-events-auto flex items-center justify-between px-4 py-3 sm:px-6">
          <p className="text-sm text-white/70">
            {index + 1} / {photos.length}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          >
            <X />
          </button>
        </div>
        <div
          className="pointer-events-auto relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16"
          onTouchStart={(event) => {
            touchStart.current = event.changedTouches[0]?.clientX ?? null
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current
            const end = event.changedTouches[0]?.clientX
            if (start == null || end == null) return
            const delta = end - start
            if (delta > 48 && index > 0) onIndex(index - 1)
            if (delta < -48 && index < photos.length - 1) onIndex(index + 1)
          }}
        >
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous photograph"
              onClick={() => onIndex(index - 1)}
              className="absolute top-1/2 left-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:left-4"
            >
              <ArrowLeft />
            </button>
          )}
          {/* Optimized WebP is produced at upload; next/image cannot see runtime files. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(photo.id, "full")}
            alt={photo.title || "Untitled photograph"}
            width={photo.width}
            height={photo.height}
            className="max-h-full max-w-full object-contain"
          />
          {index < photos.length - 1 && (
            <button
              type="button"
              aria-label="Next photograph"
              onClick={() => onIndex(index + 1)}
              className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:right-4"
            >
              <ArrowRight />
            </button>
          )}
        </div>
        <div className="pointer-events-auto px-4 pt-4 pb-6 sm:px-6">
          <h2 id="lightbox-title" className="font-display text-2xl tracking-tight">
            {photo.title || "Untitled"}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {[album?.name, formatDate(photo.createdAt)].filter(Boolean).join(" · ")}
          </p>
          {photo.caption && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
              {photo.caption}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
