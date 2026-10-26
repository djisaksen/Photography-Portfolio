import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { Container, Eyebrow } from "@/components/container";
import { GallerySkeleton } from "@/components/gallery-skeleton";
import { mediaUrl, photoCount } from "@/lib/format";
import { getStorage } from "@/lib/storage";

export const metadata: Metadata = {
  title: "Albums",
  description: "Collections of photographs by Daniel Isaksen.",
};

export default function AlbumsPage() {
  return (
    <main id="content">
      <Container className="pt-12 pb-8 sm:pt-16">
        <Eyebrow>Collections</Eyebrow>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-6xl">Albums</h1>
        <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">
          Groups of pictures that belong together.
        </p>
      </Container>
      <Suspense fallback={<GallerySkeleton />}>
        <AlbumList />
      </Suspense>
    </main>
  );
}

async function AlbumList() {
  await connection();
  const storage = getStorage();
  const [albums, photos] = await Promise.all([
    storage.listAlbums(),
    storage.listPhotos(),
  ]);

  if (albums.length === 0) {
    return (
      <Container className="pb-20">
        <p className="font-display text-3xl tracking-tight">No albums yet.</p>
        <p className="mt-3 text-muted-foreground">Albums are made in the studio.</p>
      </Container>
    );
  }

  return (
    <Container className="pb-20">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album, index) => {
          const cover = photos.find((photo) => photo.albumId === album.id);
          const count = photos.filter((photo) => photo.albumId === album.id).length;
          return (
            <Link key={album.id} href={`/albums/${album.slug}`} className="group block">
              <div className="overflow-hidden bg-muted">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(cover.id, "thumb")}
                    alt=""
                    width={cover.width}
                    height={cover.height}
                    loading={index === 0 ? "eager" : "lazy"}
                    className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="aspect-[4/5]" />
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl tracking-tight">{album.name}</h2>
                <span className="text-sm text-muted-foreground">{photoCount(count)}</span>
              </div>
              {album.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {album.description}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
