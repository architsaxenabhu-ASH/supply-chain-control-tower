# PostgreSQL Setup For Non-IT Users

## What We Are Doing

We are separating two things:

- GitHub stores the application code.
- PostgreSQL stores live business data.

This is important because invoices, batches, customers, shipment records, and inventory transactions are business data. They should not be stored in GitHub.

## Why We Need PostgreSQL

SQLite is good for local testing, but it is a file on one computer.

PostgreSQL is better for the real application because:

- It can be hosted outside one laptop.
- It supports multiple users.
- It supports backup policies.
- It is better for audit trails and security.
- It is a normal enterprise database.

## What Codex Can Do

Codex can:

- Prepare the app to use PostgreSQL.
- Create the private `.env` settings file after you paste the database URL locally.
- Check the database connection.
- Restart the app.
- Push code changes to GitHub.

## What The User Must Do

You must create or provide the managed PostgreSQL database account because it involves:

- Your login
- Your company account
- Your password
- Possible billing or free-tier account confirmation

Codex should not create or control that account.

## Step-By-Step

### Step 1: Create A Private Managed PostgreSQL Database

Use a company-approved PostgreSQL provider. The important requirement is that the provider gives you a connection string.

The connection string usually looks like:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### Step 2: Save The Connection String Locally

Run this from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-database-url.ps1
```

Paste the connection string when asked. It will be hidden while typing.

The script saves it into:

```text
backend/.env
```

That file is ignored by Git.

### Step 3: Check The Database

The setup script automatically runs:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-database.ps1
```

If it says `Database connection OK`, the backend can reach PostgreSQL.

### Step 4: Restart Backend

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
```

Now the backend will use PostgreSQL instead of the local SQLite database.

## Important Warning

When you switch to a new PostgreSQL database, it starts empty unless we migrate data into it.

That is normal.

After connection is confirmed, the next build step is a migration/import script that copies selected local SQLite records into PostgreSQL.
