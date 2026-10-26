import { cn } from "cn"

export function Container({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  )
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-[0.72rem] font-medium uppercase tracking-[0.22em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  )
}
