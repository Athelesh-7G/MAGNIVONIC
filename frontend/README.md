# Magnivonic — Frontend

The Next.js 16 (Turbopack) application for Magnivonic, **built with [v0](https://v0.dev)**
and **deployed on Vercel**. It serves two surfaces from one codebase:

- **Marketing site** (`app/page.tsx` + `components/home/*`) — public
- **Live platform** (`app/platform/*`) — login-gated; talks to the real AWS API
  Gateway endpoints (every score, citation, and alert is a live call)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

The login gate (`proxy.ts`) protects `/platform/*` and needs three env vars in a
gitignored `.env.local` (and the same in Vercel project settings):

```
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
```

No local backend is required to run the UI — it calls the deployed AWS endpoints.

## Where things are

- `app/` — routes (marketing, `platform/*`, `login`, `api/{login,logout}`)
- `components/{home,platform}/*`, `components/brand.tsx` — UI
- `lib/` — `api.ts` (typed AWS client), `activation.ts`, `auth.ts`

See `../docs/PROJECT_GUIDE.md` for the full system reference.
