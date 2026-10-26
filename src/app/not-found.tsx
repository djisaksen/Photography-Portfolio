import Link from "next/link";

import { Container } from "@/components/container";

export default function NotFound() {
  return (
    <main id="content">
      <Container className="py-24">
        <h1 className="font-display text-4xl tracking-tight">This page is not in the archive.</h1>
        <p className="mt-3 text-muted-foreground">The address may have changed.</p>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
          Back to the photographs
        </Link>
      </Container>
    </main>
  );
}
