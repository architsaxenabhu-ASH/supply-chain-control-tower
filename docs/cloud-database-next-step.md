# Cloud Database Next Step

## Why This Step Matters

GitHub now stores the code. It should not store live operational data.

The next step is to move runtime data from the local SQLite file to a private PostgreSQL database. This gives the application a proper database target for future backups, security, role-based access, audit trails, and deployment.

## What Is Ready Now

The backend can now read the database connection from:

```text
DATABASE_URL
```

Current local default:

```text
sqlite:///data/control_tower.db
```

Future PostgreSQL format:

```text
postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
```

If a provider gives a URL starting with `postgresql://` or `postgres://`, the backend will convert it internally to the driver format.

## What You Need To Do

1. Create a private managed PostgreSQL database.
2. Copy its connection string.
3. Create or edit this local file:

```text
backend/.env
```

4. Put this inside `backend/.env`:

```text
APP_NAME="Supply Chain Control Tower"
APP_VERSION="0.1.0"
DATABASE_URL="your-postgresql-connection-string"
```

Do not paste the database password into chat.

## Check The Database

After saving `backend/.env`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-database.ps1
```

If the check passes, restart the backend:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
```

## Important Rule

Code goes to GitHub.

Operational data goes to PostgreSQL.

Uploaded documents should later go to secure document storage, not GitHub.
