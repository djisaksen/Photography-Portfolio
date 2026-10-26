"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="content">
      <Container className="py-24">
        <h1 className="font-display text-4xl tracking-tight">Something went quiet.</h1>
        <p className="mt-3 text-muted-foreground">The page did not load.</p>
        <Button type="button" className="mt-6" onClick={() => reset()}>
          Try again
        </Button>
      </Container>
    </main>
  );
}
