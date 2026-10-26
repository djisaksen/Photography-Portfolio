import { Suspense } from "react";
import { connection } from "next/server";

import { Container, Eyebrow } from "@/components/container";
import { Gallery } from "@/components/gallery";
import { GallerySkeleton } from "@/components/gallery-skeleton";
import { getStorage } from "@/lib/storage";

export default function HomePage() {
  return (
    <main id="content">
      <Container className="pt-12 pb-8 sm:pt-16">
        <Eyebrow>Bergen</Eyebrow>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Weather, coast, and quiet rooms.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Photographs made in available light, kept as a working archive.
        </p>
      </Container>
      <Suspense fallback={<GallerySkeleton />}>
        <HomeGallery />
      </Suspense>
    </main>
  );
}

async function HomeGallery() {
  await connection();
  const storage = getStorage();
  const [photos, albums] = await Promise.all([
    storage.listPhotos(),
    storage.listAlbums(),
  ]);
  return <Gallery photos={photos} albums={albums} showFilters />;
}
