# Study Library Management System — Frontend

React frontend for the Study Library Management System, a multi-tenant SaaS platform for
managing study library businesses.

Architecture is documented in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Tech Stack

- React 19 + TypeScript
- Vite (dev server + build)
- MUI v7 (components + theming, `@mui/x-data-grid`, `@mui/x-date-pickers`)
- Redux Toolkit + RTK Query (custom axios-based `baseQuery`, not `fetchBaseQuery`)
- react-router-dom, react-hook-form + zod, dayjs, @nivo (charts)

## Architecture

```
src/
  app/
    App.tsx            Theme provider + top-level layout/routes
    store.ts            Redux store (RTK Query middleware + reducers)
  shared/
    api/
      apiClient.ts       axios instance, baseURL '/api/v1'
      axiosBaseQuery.ts   custom RTK Query baseQuery wrapping axios
      baseApi.ts          createApi() root, feature APIs inject into this
    theme/
      theme.ts            buildTheme(mode, primaryColor, secondaryColor)
  features/               One folder per module (auth, dashboard, students, ...),
                           mirroring the backend's module boundaries 1:1
    dashboard/
      dashboardApi.ts      RTK Query endpoints for this feature
      DashboardPage.tsx     UI for this feature
main.tsx                 React root, wraps App in Redux Provider
```

Each feature owns its own RTK Query API slice (injected into `baseApi`) and its own pages/
components — no feature reaches into another feature's internals.

## Prerequisites

- Node.js 22+
- The backend running locally on port 8000 (see [`../backend/README.md`](../backend/README.md))

## Setup

```bash
cd frontend
npm install
```

## Run the app

```bash
npm run dev
```

The app is now available at **http://localhost:9999**.

The Vite dev server proxies all `/api/*` requests to `http://localhost:8000` (configured in
[`vite.config.ts`](vite.config.ts)), so the frontend never needs to know the backend's host in
code — it always calls relative `/api/v1/...` paths via `shared/api/apiClient.ts`.

On load, the dashboard page calls `GET /api/v1/health/db` and shows a "Connected" chip with the
live table count and Postgres version once the backend + database are reachable — this is the
fastest way to confirm the full stack is wired correctly.

## Other scripts

```bash
npm run build      # production build to dist/
npm run preview    # preview the production build locally
npm run lint        # ESLint
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard shows "Could not reach the backend" | Confirm the backend is running: `curl http://localhost:8000/api/v1/health` |
| Port 9999 already in use | Change `server.port` in `vite.config.ts` |
| API calls 404 | Confirm the backend is actually on port 8000, or update the `proxy` target in `vite.config.ts` |
