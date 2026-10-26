"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Container } from "@/components/container"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "cn"

const links = [
  { href: "/", label: "Work" },
  { href: "/albums", label: "Albums" },
  { href: "/about", label: "About" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Container className="flex h-14 items-center justify-between gap-3 sm:h-16">
        <Link href="/" className="font-display text-lg tracking-tight sm:text-xl">
          <span className="sm:hidden">Isaksen</span>
          <span className="hidden sm:inline">Daniel Isaksen</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "border-b px-2 py-1 text-sm sm:px-2.5",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
          <ThemeToggle />
        </nav>
      </Container>
    </header>
  )
}
