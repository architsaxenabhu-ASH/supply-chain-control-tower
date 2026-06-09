# Deployment

This folder runs the whole app — frontend, backend, and PostgreSQL — with one
command using Docker.

## Prerequisites

- Install **Docker Desktop** (Windows/Mac) or Docker Engine + Compose (Linux),
  and make sure it is running.

## Run it locally

From this `deployment/` folder:

```powershell
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Backend:  `http://localhost:8000`
- Backend health: `http://localhost:8000/health`
- PostgreSQL: `localhost:5432`

Stop everything with `Ctrl+C`, or remove the containers with `docker compose down`.
Data persists in the named volumes `postgres_data` and `app_data`; add `-v` to
`docker compose down` only if you want to wipe it.

## How the database works

The backend talks to any database through the `DATABASE_URL` environment
variable and **creates its own tables automatically on startup** (SQLAlchemy).
You do not need to run `database/schema.sql` by hand — that file is the target
relational model for future, fully-normalised tables, not what the prototype
uses today.

- Local default: the bundled `postgres` service.
- Local prototype without Docker: leave `DATABASE_URL` unset and the app uses
  `data/control_tower.db` (SQLite).

## Using a managed (cloud) database

1. Create a `.env` file in this `deployment/` folder (it is git-ignored — never
   commit it, and never paste the password into chat).

   ```env
   POSTGRES_PASSWORD=choose-a-strong-password
   DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
   VITE_API_BASE_URL=https://api.your-domain.com/api/v1
   ```

2. `docker compose up --build` will pick these up automatically.

When `DATABASE_URL` points at your managed database, you can remove the local
`postgres` service from `docker-compose.yml` if you no longer need it.

## Pointing the frontend at a public API

The frontend is a static site. By default (empty `VITE_API_BASE_URL`) the
browser calls the same host on port `8000`, which is correct for local Docker.
For a real host, set `VITE_API_BASE_URL` (see above) so the built site calls
your public backend URL.

## Deploying to a host

The two `Dockerfile`s build standalone images, so this works on any container
host (Render, Railway, Azure Container Apps, Fly.io, a VPS, etc.):

1. Build and push `backend/` and `frontend/` images to your registry.
2. Provision a managed PostgreSQL and set `DATABASE_URL` on the backend service.
3. Set `VITE_API_BASE_URL` as a build argument for the frontend image.
4. Keep all secrets in the host's environment settings, never in Git.
