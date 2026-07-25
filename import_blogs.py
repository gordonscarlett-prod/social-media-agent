"""
Import all blog PDFs from the Blog folder into the Social Media Agent library.
Run from the SocialMediaAgent directory with the backend running:
    python import_blogs.py
"""

import os
import sys
import requests

BLOG_DIR = r"C:\Users\HP\OneDrive\MenardProperties\Blog"
API_URL = "http://localhost:8000/api/blog"

CATEGORY_MAP = {
    "Denver Specific": "Denver Specific",
    "How-To":          "How-To",
    "Key Insight":     "Key Insight",
    "Reduce Risk":     "Reduce Risk",
    "Save Money":      "Save Money",
}


def extract_pdf_text(pdf_path: str) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_path)
        return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except ImportError:
        pass

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            return "\n\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    except ImportError:
        pass

    print("  ERROR: No PDF library found. Installing pypdf...")
    os.system(f'"{sys.executable}" -m pip install pypdf')
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()


def import_blogs():
    total = 0
    success = 0
    failed = []

    for category in sorted(CATEGORY_MAP.keys()):
        folder = os.path.join(BLOG_DIR, category)
        if not os.path.isdir(folder):
            print(f"  Skipping missing folder: {folder}")
            continue

        pdfs = sorted(f for f in os.listdir(folder) if f.lower().endswith(".pdf"))
        print(f"\n[{category}] — {len(pdfs)} articles")

        for pdf_file in pdfs:
            total += 1
            pdf_path = os.path.join(folder, pdf_file)
            title = os.path.splitext(pdf_file)[0]
            print(f"  Importing: {title} ...", end=" ", flush=True)

            try:
                content = extract_pdf_text(pdf_path)
                if not content:
                    print("SKIPPED (empty text)")
                    failed.append((title, "empty text"))
                    continue

                excerpt = f"[{category}] {content[:200].replace(chr(10), ' ')}"

                resp = requests.post(API_URL, json={
                    "title": title,
                    "content": content,
                    "excerpt": excerpt,
                })

                if resp.status_code == 201:
                    print("OK")
                    success += 1
                else:
                    print(f"FAILED ({resp.status_code})")
                    failed.append((title, resp.text))

            except Exception as e:
                print(f"ERROR: {e}")
                failed.append((title, str(e)))

    print(f"\n{'='*60}")
    print(f"Import complete: {success}/{total} articles imported")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for title, reason in failed:
            print(f"  - {title}: {reason}")


if __name__ == "__main__":
    print("Erin Menard Properties — Blog Import Script")
    print("=" * 60)
    print(f"Source: {BLOG_DIR}")
    print(f"Target: {API_URL}")
    print("Make sure the backend is running on port 8000.\n")

    try:
        r = requests.get("http://localhost:8000/api/blog")
        existing = len(r.json().get("posts", []))
        print(f"Existing blog posts in library: {existing}")
        if existing > 0:
            confirm = input(f"Library already has {existing} posts. Continue anyway? (y/n): ")
            if confirm.lower() != "y":
                print("Aborted.")
                sys.exit(0)
    except requests.ConnectionError:
        print("ERROR: Backend is not running. Start it first with:")
        print("  cd backend && venv\\Scripts\\activate && python main.py")
        sys.exit(1)

    import_blogs()
