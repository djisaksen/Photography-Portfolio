import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/container";
import { PasswordGate, Studio } from "@/components/upload-studio";
import { COOKIE_NAME, adminConfigured, isAdminToken } from "@/lib/auth";
import { directUploadsEnabled } from "@/lib/storage/driver";
import { getStorage } from "@/lib/storage";

export const metadata: Metadata = {
  title: "Studio",
  description: "Add and remove photographs in the Daniel Isaksen archive.",
  robots: { index: false, follow: false },
};

export default function UploadPage() {
  return (
    <main id="content">
      <Suspense fallback={<StudioSkeleton />}>
        <StudioLoader />
      </Suspense>
    </main>
  );
}

async function StudioLoader() {
  await connection();
  const configured = adminConfigured();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!configured || !isAdminToken(token)) {
    return <PasswordGate configured={configured} />;
  }

  const storage = getStorage();
  const [photos, albums, messages] = await Promise.all([
    storage.listPhotos(),
    storage.listAlbums(),
    storage.listMessages(),
  ]);

  return (
    <Studio
      initialPhotos={photos}
      initialAlbums={albums}
      messages={messages}
      directUpload={directUploadsEnabled()}
    />
  );
}

function StudioSkeleton() {
  return (
    <Container className="py-16" aria-hidden="true">
      <div className="h-4 w-24 animate-pulse bg-muted" />
      <div className="mt-4 h-12 w-48 animate-pulse bg-muted" />
      <div className="mt-10 h-56 animate-pulse bg-muted" />
    </Container>
  );
}
