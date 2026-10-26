export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }
  const response = await fetch(input, { ...init, headers })
  const data = (await response.json().catch(() => ({}))) as { error?: unknown }
  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string"
        ? data.error
        : "Something went wrong. Try again.",
    )
  }
  return data as T
}
