"""
ComfyUI Flux.1-dev 모델 다운로드 & 배치
실행: python setup_comfyui_models.py
"""
import subprocess
import os
import sys

# ComfyUI 경로 (수정 필요 시 변경)
COMFYUI_DIR = os.path.expanduser("~/ComfyUI")

# 경로가 없으면 물어보기
if not os.path.isdir(COMFYUI_DIR):
    # 가능한 경로들 시도
    candidates = [
        "C:/ComfyUI",
        "D:/ComfyUI",
        "F:/ComfyUI",
        os.path.join(os.getcwd(), "ComfyUI"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            COMFYUI_DIR = c
            break
    else:
        COMFYUI_DIR = input(f"ComfyUI 경로를 입력하세요: ").strip()

print(f"ComfyUI 경로: {COMFYUI_DIR}")

UNET_DIR = os.path.join(COMFYUI_DIR, "models", "unet")
CLIP_DIR = os.path.join(COMFYUI_DIR, "models", "clip")
VAE_DIR = os.path.join(COMFYUI_DIR, "models", "vae")

os.makedirs(UNET_DIR, exist_ok=True)
os.makedirs(CLIP_DIR, exist_ok=True)
os.makedirs(VAE_DIR, exist_ok=True)

def download(url, dest):
    if os.path.exists(dest):
        size_mb = os.path.getsize(dest) / (1024*1024)
        print(f"  SKIP (exists, {size_mb:.0f}MB): {os.path.basename(dest)}")
        return
    print(f"  Downloading: {os.path.basename(dest)} ...")
    subprocess.run([
        sys.executable, "-m", "huggingface_hub", "download",
        "--local-dir", os.path.dirname(dest),
        "--include", os.path.basename(dest),
        url.split("/resolve/")[0].replace("https://huggingface.co/", ""),
    ], check=False)
    # fallback: wget/curl
    if not os.path.exists(dest):
        print(f"  Trying wget...")
        subprocess.run(["wget", "-O", dest, url], check=False)
    if not os.path.exists(dest):
        print(f"  Trying curl...")
        subprocess.run(["curl", "-L", "-o", dest, url], check=False)

print("\n=== 1. Flux.1-dev UNET (safetensors, ~23GB) ===")
print("    RTX 4070 Ti는 fp8 버전 추천 (더 작음)")
print()

# fp8 버전 다운로드 (Comfy 공식 fp8, ~12GB)
unet_file = os.path.join(UNET_DIR, "flux1-dev.safetensors")
if not os.path.exists(unet_file):
    print("  huggingface-cli로 다운로드합니다...")
    print("  (처음이면 시간이 좀 걸립니다)")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "-q", "huggingface_hub"
    ], check=False)
    # Flux.1-dev from black-forest-labs (gated model - 로그인 필요)
    # 대안: Comfy 공식 fp8 버전
    subprocess.run([
        sys.executable, "-c", """
import huggingface_hub
import os
# Flux.1 dev fp8 (ComfyUI 공식 추천)
try:
    path = huggingface_hub.hf_hub_download(
        repo_id="Comfy-Org/flux1-dev",
        filename="flux1-dev-fp8.safetensors",
        local_dir=r"{unet_dir}"
    )
    print(f"Downloaded to: {{path}}")
except Exception as e:
    print(f"Download error: {{e}}")
    print("\\n수동 다운로드 필요:")
    print("  https://huggingface.co/Comfy-Org/flux1-dev")
    print(f"  다운로드 후 {{r'{unet_dir}'}} 에 넣으세요")
""".replace("{unet_dir}", UNET_DIR)
    ], check=False)
else:
    print(f"  EXISTS: {unet_file}")

print("\n=== 2. CLIP 모델 (T5-XXL + CLIP-L) ===")

clip_t5 = os.path.join(CLIP_DIR, "t5xxl_fp16.safetensors")
if not os.path.exists(clip_t5):
    # t5xxl fp8도 가능 (더 작음)
    subprocess.run([
        sys.executable, "-c", f"""
import huggingface_hub
try:
    path = huggingface_hub.hf_hub_download(
        repo_id="comfyanonymous/flux_text_encoders",
        filename="t5xxl_fp16.safetensors",
        local_dir=r"{CLIP_DIR}"
    )
    print(f"Downloaded T5-XXL to: {{path}}")
except Exception as e:
    print(f"Error: {{e}}")
    # fp8 대안
    try:
        path = huggingface_hub.hf_hub_download(
            repo_id="comfyanonymous/flux_text_encoders",
            filename="t5xxl_fp8_e4m3fn.safetensors",
            local_dir=r"{CLIP_DIR}"
        )
        print(f"Downloaded T5-XXL fp8 to: {{path}}")
    except Exception as e2:
        print(f"Error: {{e2}}")
        print("수동 다운로드: https://huggingface.co/comfyanonymous/flux_text_encoders")
"""
    ], check=False)
else:
    print(f"  EXISTS: {clip_t5}")

clip_l = os.path.join(CLIP_DIR, "clip_l.safetensors")
if not os.path.exists(clip_l):
    subprocess.run([
        sys.executable, "-c", f"""
import huggingface_hub
try:
    path = huggingface_hub.hf_hub_download(
        repo_id="comfyanonymous/flux_text_encoders",
        filename="clip_l.safetensors",
        local_dir=r"{CLIP_DIR}"
    )
    print(f"Downloaded CLIP-L to: {{path}}")
except Exception as e:
    print(f"Error: {{e}}")
    print("수동 다운로드: https://huggingface.co/comfyanonymous/flux_text_encoders")
"""
    ], check=False)
else:
    print(f"  EXISTS: {clip_l}")

print("\n=== 3. VAE (ae.safetensors) ===")

vae_file = os.path.join(VAE_DIR, "ae.safetensors")
if not os.path.exists(vae_file):
    subprocess.run([
        sys.executable, "-c", f"""
import huggingface_hub
try:
    path = huggingface_hub.hf_hub_download(
        repo_id="black-forest-labs/FLUX.1-schnell",
        filename="ae.safetensors",
        local_dir=r"{VAE_DIR}"
    )
    print(f"Downloaded VAE to: {{path}}")
except Exception as e:
    print(f"Error: {{e}}")
    print("수동 다운로드: https://huggingface.co/black-forest-labs/FLUX.1-schnell/blob/main/ae.safetensors")
"""
    ], check=False)
else:
    print(f"  EXISTS: {vae_file}")

print("\n=== 확인 ===")
for name, path in [
    ("UNET", UNET_DIR),
    ("CLIP", CLIP_DIR),
    ("VAE", VAE_DIR),
]:
    files = [f for f in os.listdir(path) if f.endswith(('.safetensors', '.gguf', '.sft'))]
    print(f"  {name} ({path}):")
    for f in files:
        size_mb = os.path.getsize(os.path.join(path, f)) / (1024*1024)
        print(f"    {f} ({size_mb:.0f}MB)")
    if not files:
        print(f"    (비어있음 - 수동 다운로드 필요!)")

print("\n모델 다운로드 후 ComfyUI를 재시작하세요: python main.py")
print("그 다음: cd F:/project/game && python generate_monster_fullbody.py")
