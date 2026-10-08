# weft-web

Authority dashboard for Weft — the web client where municipal staff triage,
assign and resolve citizen-reported civic issues.

Citizen reporting lives in the Flutter app (`weft-mobile`). This app is
authority- and admin-facing only.

## Stack

React 19 · TypeScript · Vite · TailwindCSS v4 · React Router 6 · Zustand ·
Axios · Leaflet + react-leaflet (map) · Recharts (analytics) · Oxlint

## Running it

```bash
npm install
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve the production build locally |

### Pointing at an API

`VITE_API_BASE_URL` selects the backend, defaulting to `http://localhost:8000/v1`
— the `weft-backend` dev server. Most endpoints it calls are still Phase 0 mock
routes returning static JSON; `POST /auth/{register,login,refresh,logout}` and
`GET /users/me` are real.

## Auth — read before touching `src/stores/authStore.ts`

Access and refresh tokens are held **in memory only**, in the Zustand store.
Nothing is written to `localStorage` or `sessionStorage`, and that is deliberate,
not an oversight: this dashboard renders citizen-submitted issue text — untrusted
public input — to privileged AUTHORITY/ADMIN users, which is a stored-XSS path
into a privileged UI. A token in web storage is readable by any injected script
and outlives the tab.

The accepted cost: **a page reload ends the session and the user logs in again.**
There is intentionally no silent-refresh-on-load bootstrap. Adding one would mean
persisting the refresh token somewhere a script can read it, which is the exposure
this design exists to avoid. Don't add it without recording the decision in
`../DECISIONS.md`.

`src/lib/axios.ts` handles 401 → single serialised refresh → retry, and sends the
refresh token in the JSON body (not a cookie), matching the backend.

## Layout

```
src/
  lib/axios.ts        API client: JWT header injection, 401 refresh-and-retry
  stores/authStore.ts Zustand auth state — see the note above
  routes/index.tsx    Route table
  pages/              Login, Dashboard, Issues, Analytics, Admin
  index.css           Tailwind v4 @theme — brand tokens from DECISIONS.md
```

The five pages are placeholders. They are built out in Phase 3; see
`../PROGRESS.md` for what is actually implemented.
