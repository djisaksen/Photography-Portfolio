# Daniel Isaksen

A photography portfolio and private studio. The public site is a masonry gallery with a lightbox, albums, and an about page. Daniel signs in with a password to upload, caption, and delete photographs.

Images are resized to WebP on upload and stored on the local disk. Metadata lives in a JSON library. Both sit behind one storage interface so the disk can later be swapped for S3, Cloudflare R2, or Vercel Blob.

## Requirements

- Node.js 20.9 or newer
- npm

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set a real `ADMIN_PASSWORD` before anyone else can reach the server.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The gallery is public. The studio is at [http://localhost:3000/upload](http://localhost:3000/upload).

The first request copies the seed photographs in `content/seed` into `storage/`. After that, the archive is whatever you upload or delete.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes, to upload | Password for the studio. Upload, edit, and delete stay off until this is set. |
| `SESSION_SECRET` | No | Signs the studio cookie. Defaults to `ADMIN_PASSWORD`. Set a separate long random value in production. |
| `STORAGE_DRIVER` | No | `local` (default). `s3`, `blob`, or `cloud` select the cloud adapter once it is implemented. |
| `STORAGE_DIR` | No | Directory for image files and `library.json`. Defaults to `./storage`. |

Do not commit `.env.local`. `.env.example` lists the names only.

## Scripts

```bash
npm run dev     # local development
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## How storage works

`getStorage()` in `src/lib/storage/index.ts` returns a `PhotoStorage`. Pages and API routes talk only to that interface. `STORAGE_DRIVER` picks the implementation.

### Local disk (`STORAGE_DRIVER=local`)

`src/lib/storage/local.ts` writes `storage/photos/{id}/thumb.webp` and `full.webp` (sharp, EXIF-rotated, max 1600px and 2560px) and metadata to `storage/library.json`. `/api/media/{id}` serves the bytes. The first run copies `content/seed` when `library.json` is missing.

`storage/photos` and `storage/library.json` are gitignored. The seed files are committed so a fresh checkout is not an empty gallery.

This driver needs a persistent disk. Use it for `npm run dev` and for a long-running Node server.

### Vercel Blob (`STORAGE_DRIVER=blob`)

`src/lib/storage/blob.ts` uses `@vercel/blob` and `BLOB_READ_WRITE_TOKEN`.

- Photographs are public WebP objects at `photos/{id}/full.webp` and `thumb.webp`. `/api/media` redirects to those URLs, so a large image is not streamed through the function body limit.
- The library (photographs, albums, and contact notes) is a private object at `library.json`. Notes are not world-readable.
- The first request seeds from `content/seed` when `library.json` is absent, then uploads the derivatives. Later requests leave the store alone.
- The studio uploads the original from the browser with `@vercel/blob/client` to a private `incoming/…` object (multipart above 4 MB). Vercel’s request body limit is about 4.5 MB, so the file never passes through the function. The server downloads it, builds the WebP sizes, writes the library, and deletes the original.

`src/lib/storage/cloud.ts` remains a stub for any other bucket. `STORAGE_DRIVER=s3` or `cloud` returns that stub.

## Deploy on Vercel

1. Import this GitHub repository in [Vercel](https://vercel.com/new). Framework preset: Next.js. Root directory: the repository root.
2. Create a Blob store for the project (Storage → Blob, or `vercel blob create-store`). Connect it to the project so Vercel sets `BLOB_READ_WRITE_TOKEN` in Production and Preview.
3. Set these environment variables, then redeploy:

| Variable | Production value |
| --- | --- |
| `ADMIN_PASSWORD` | A long studio password |
| `SESSION_SECRET` | A long random string, different from the password |
| `STORAGE_DRIVER` | `blob` |
| `BLOB_READ_WRITE_TOKEN` | Provided when the Blob store is connected |

Do not set `STORAGE_DIR` on Vercel. Leave `BLOB_READ_WRITE_TOKEN` empty for local disk development.

4. Open the deployment once. That first request creates the private library and uploads the seed photographs. After that, sign in at `/upload` and add photographs there.

`sharp` runs on Vercel’s Node runtime. Page and route functions allow 60 seconds so the first seed and a large upload can finish. New projects use Fluid Compute, which accepts that duration. The session cookie is `Secure` in production.

There is no `vercel.json`. Duration is set with `export const maxDuration` on the routes that touch the archive.

## Deploy on a server with a disk

```bash
npm run build
npm run start
```

Keep `STORAGE_DRIVER=local` (or unset). Point `STORAGE_DIR` at a volume if the process working directory is ephemeral. Put a reverse proxy in front for HTTPS.

## Studio

Signing in sets an httpOnly cookie for 14 days, signed with HMAC-SHA256. Wrong passwords are rate-limited. Changing `ADMIN_PASSWORD` (or `SESSION_SECRET`, if you set one) invalidates existing sessions when that value is what signs the cookie.

Contact notes from the About page are stored in the library and listed in the studio. They are not emailed.
