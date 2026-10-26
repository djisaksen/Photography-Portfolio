"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api } from "@/lib/http"

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setPending(true)
    try {
      await api("/api/contact", {
        method: "POST",
        body: JSON.stringify({ name, email, message, website }),
      })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The note could not be sent.")
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <p className="font-display text-2xl tracking-tight" role="status">
        The note is in the studio. Thank you.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-10"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-message">Note</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-32"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-fit px-4">
        {pending ? "Sending…" : "Send note"}
      </Button>
    </form>
  )
}
