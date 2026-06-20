# IT Project Management

An internal tool for tracking IT department work: projects, ongoing tasks, personnel, purchases, tenders, and contracts (with expiry tracking), organized by section.

## Stack

- **Backend**: Node.js + Express, SQLite database, JWT auth (cookie-based)
- **Frontend**: React + Vite, Tailwind CSS

## Running the app

### Backend

```bash
cd backend
npm install
npm run dev
```

Starts the API on `http://localhost:3000` (override with `PORT` env var).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`) and proxies `/api` requests to the backend on port 3000.

### Production (Docker)

```bash
docker build -t it-pm .
docker run -p 3000:3000 -v it-pm-data:/app/data it-pm
```

Builds the frontend and serves it together with the API from a single Express server on port 3000.