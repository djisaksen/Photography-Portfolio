import Link from "next/link"

import { Container } from "@/components/container"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <Container className="flex flex-col gap-3 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Daniel Isaksen · Bergen</p>
        <div className="flex gap-5">
          <Link href="/about" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/upload" className="hover:text-foreground">
            Studio
          </Link>
        </div>
      </Container>
    </footer>
  )
}
