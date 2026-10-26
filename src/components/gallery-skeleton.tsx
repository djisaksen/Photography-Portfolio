import { Container } from "@/components/container"
import { cn } from "cn"

const ratios = [
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-[3/4]",
  "aspect-[16/9]",
  "aspect-[4/3]",
  "aspect-[3/4]",
]

export function GallerySkeleton() {
  return (
    <Container className="pb-20" aria-hidden="true">
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="columns-1 gap-x-5 sm:columns-2 lg:columns-3">
        {ratios.map((ratio, index) => (
          <div
            key={index}
            className={cn("mb-8 break-inside-avoid animate-pulse bg-muted", ratio)}
          />
        ))}
      </div>
    </Container>
  )
}
