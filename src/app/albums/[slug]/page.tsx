import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { Container, Eyebrow } from "@/components/container";
import { Gallery } from "@/components/gallery";
import { GallerySkeleton } from "@/components/gallery-skeleton";
import { getStorage } from "@/lib/storage";

export const metadata: Metadata = {
  title: "Album",
};

export default function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main id="content">
      <Suspense fallback={<GallerySkeleton />}>
        <AlbumBody params={params} />
      </Suspense>
    </main>
  );
}

async function AlbumBody({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const storage = getStorage();
  const album = await storage.getAlbumBySlug(slug);

  if (!album) {
    return (
      <Container className="py-20">
        <h1 className="font-display text-4xl tracking-tight">No such album</h1>
        <p className="mt-3 text-muted-foreground">It may have been removed from the archive.</p>
        <Link
          href="/albums"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          All albums
        </Link>
      </Container>
    );
  }

  const photos = (await storage.listPhotos()).filter((photo) => photo.albumId === album.id);
  const albums = await storage.listAlbums();

  return (
    <>
      <Container className="pt-12 pb-8 sm:pt-16">
        <Link
          href="/albums"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          All albums
        </Link>
        <Eyebrow className="mt-6">Album</Eyebrow>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-6xl">{album.name}</h1>
        {album.description && (
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">{album.description}</p>
        )}
      </Container>
      <Gallery photos={photos} albums={albums} />
    </>
  );
}
