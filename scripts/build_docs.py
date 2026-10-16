"""Render docs/dossier/*.html to A4 PDF with headless Chrome/Chromium.  Usage: python scripts/build_docs.py"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser",
]


def find_browser() -> str:
    for c in CANDIDATES:
        path = c if Path(c).is_file() else shutil.which(c)
        if path:
            return path
    sys.exit("Chrome / Chromium / Edge introuvable : installez-le ou ajoutez son chemin dans CANDIDATES.")


def main():
    browser = find_browser()
    for html in sorted((ROOT / "docs" / "dossier").glob("*.html")):
        pdf = html.with_suffix(".pdf")
        subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
                        f"--print-to-pdf={pdf}", html.as_uri()], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"{pdf.relative_to(ROOT)}  ({pdf.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    main()
