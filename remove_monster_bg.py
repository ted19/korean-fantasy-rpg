"""Remove backgrounds from monster full images using rembg"""
import os, glob
from rembg import remove
from PIL import Image

SRC = "client/public/monsters"
OUT = "client/public/monsters_nobg"
os.makedirs(OUT, exist_ok=True)

files = sorted(glob.glob(f"{SRC}/*_full.png"))
total = len(files)
print(f"Processing {total} monster full images...")

for i, fpath in enumerate(files):
    fname = os.path.basename(fpath)
    outpath = os.path.join(OUT, fname)

    if os.path.exists(outpath):
        print(f"  [{i+1}/{total}] Skip (exists): {fname}")
        continue

    try:
        inp = Image.open(fpath)
        out = remove(inp)
        out.save(outpath)
        print(f"  [{i+1}/{total}] Done: {fname}")
    except Exception as e:
        print(f"  [{i+1}/{total}] Error {fname}: {e}")

print(f"\nAll done! Transparent images saved to {OUT}/")
