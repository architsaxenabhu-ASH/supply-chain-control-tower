# Deployment Scaffold

This folder contains a Docker Compose deployment scaffold.

From this folder:

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Backend health: `http://localhost:8000/health`
- PostgreSQL: `localhost:5432`

The database schema is loaded from `database/schema.sql` when PostgreSQL starts for the first time.

