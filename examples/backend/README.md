# Example backend

A minimal Python backend (single-file [nanodjango](https://github.com/radiac/nanodjango) app) that shows how to integrate visual-react with a server-side page store instead of the demo's file-based API routes.

It exposes a small HTTP API for pages and assets (backed by SQLite via Django models) that the visual-react `FetchStorageAdapter` can talk to, plus a Django admin UI for the stored pages.

This is an **integration example**, not part of the npm package.

## Run

```bash
python -m venv venv
./venv/bin/pip install -r requirements.txt   # Windows: venv\Scripts\pip install -r requirements.txt
./venv/bin/python app.py                     # Windows: venv\Scripts\python app.py
```

Or from `examples/demo`: `npm run backend`.

## Import / export page content

`manage_data.py` moves page JSON between the demo's `pages/` directory and the backend database:

```bash
python manage_data.py import ../demo/pages/
python manage_data.py export ../pages-export/
```
