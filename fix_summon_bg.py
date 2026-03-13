from PIL import Image
import numpy as np
import os

path = "F:/project/game/client/public/summons_nobg/4_icon.png"
img = Image.open(path).convert("RGBA")
data = np.array(img)
r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
brightness = r.astype(int) + g.astype(int) + b.astype(int)
threshold = 130
mask = np.clip((brightness - 35) / (threshold - 35) * 255, 0, 255).astype(np.uint8)
warmth = r.astype(int) * 2 + g.astype(int) - b.astype(int)
warm_boost = np.clip(warmth / 3, 0, 255).astype(np.uint8)
cool_boost = np.clip((g.astype(int) + b.astype(int) - r.astype(int)) / 2, 0, 255).astype(np.uint8)
final_alpha = np.maximum(mask, np.maximum(warm_boost, cool_boost))
data[:,:,3] = final_alpha
result = Image.fromarray(data)
result.save(path)
print(f"OK: {path} ({os.path.getsize(path)/1024:.0f}KB)")
