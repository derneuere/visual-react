"""
Import existing pages from the local pages/ directory into the Django database.

Usage:
    python manage_data.py import ../pages/
    python manage_data.py export ../pages-export/
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def setup_django():
    """Bootstrap Django from the nanodjango app."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app")
    sys.path.insert(0, os.path.dirname(__file__))

    # Import the app to trigger nanodjango setup
    import app as _app  # noqa: F401

    import django

    django.setup()


def migrate_page_data(raw: dict | list) -> dict:
    """Convert legacy format (bare Instance[]) to PageData format."""
    if isinstance(raw, list):
        return {
            "meta": {
                "title": "Untitled",
                "slug": "",
                "status": "published",
                "description": "",
                "ogTitle": "",
                "ogDescription": "",
                "ogImage": "",
                "createdAt": datetime.now(timezone.utc).isoformat() + "Z",
                "updatedAt": datetime.now(timezone.utc).isoformat() + "Z",
            },
            "content": raw,
        }
    return raw


def import_pages(pages_dir: str):
    """Import all .json pages from a directory into the database."""
    from app import Page, Folder

    pages_path = Path(pages_dir)
    if not pages_path.exists():
        print(f"Error: Directory {pages_dir} does not exist")
        sys.exit(1)

    imported = 0
    skipped = 0

    for json_file in sorted(pages_path.rglob("*.json")):
        # Compute the page path relative to the pages directory, without .json
        rel_path = json_file.relative_to(pages_path).with_suffix("")
        page_path = str(rel_path).replace(os.sep, "/")

        # Skip .keep files
        if json_file.name == ".keep":
            continue

        try:
            with open(json_file, "r") as f:
                raw = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"  SKIP {page_path}: {e}")
            skipped += 1
            continue

        page_data = migrate_page_data(raw)

        page, created = Page.objects.get_or_create(path=page_path)
        page.update_from_page_data(page_data)
        page.save()

        status = "NEW" if created else "UPD"
        print(f"  {status}  {page_path}")
        imported += 1

    # Import empty folders (directories with .keep files or no .json files)
    for keep_file in pages_path.rglob(".keep"):
        folder_rel = keep_file.parent.relative_to(pages_path)
        folder_path = str(folder_rel).replace(os.sep, "/")
        if folder_path and folder_path != ".":
            Folder.objects.get_or_create(path=folder_path)
            print(f"  DIR  {folder_path}/")

    print(f"\nDone: {imported} pages imported, {skipped} skipped")


def export_pages(output_dir: str):
    """Export all pages from the database to .json files."""
    from app import Page

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    exported = 0
    for page in Page.objects.all():
        file_path = output_path / f"{page.path}.json"
        file_path.parent.mkdir(parents=True, exist_ok=True)

        page_data = page.to_page_data()
        with open(file_path, "w") as f:
            json.dump(page_data, f, indent=2, ensure_ascii=False)

        print(f"  OUT  {page.path}")
        exported += 1

    print(f"\nDone: {exported} pages exported to {output_dir}")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python manage_data.py import <pages_directory>")
        print("  python manage_data.py export <output_directory>")
        sys.exit(1)

    command = sys.argv[1]

    setup_django()

    if command == "import":
        if len(sys.argv) < 3:
            print("Error: Please provide the pages directory path")
            sys.exit(1)
        import_pages(sys.argv[2])
    elif command == "export":
        if len(sys.argv) < 3:
            print("Error: Please provide the output directory path")
            sys.exit(1)
        export_pages(sys.argv[2])
    else:
        print(f"Unknown command: {command}")
        print("Use 'import' or 'export'")
        sys.exit(1)


if __name__ == "__main__":
    main()
