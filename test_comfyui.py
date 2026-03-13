"""ComfyUI 서버 상태 확인 & 사용 가능한 노드/모델 확인"""
import urllib.request
import json

URL = "127.0.0.1:8188"

# 1. 서버 상태
try:
    resp = urllib.request.urlopen(f"http://{URL}/system_stats")
    stats = json.loads(resp.read())
    print("=== System Stats ===")
    print(json.dumps(stats, indent=2)[:500])
except Exception as e:
    print(f"Server not running: {e}")
    exit(1)

# 2. 사용 가능한 노드 목록 (핵심만)
try:
    resp = urllib.request.urlopen(f"http://{URL}/object_info")
    nodes = json.loads(resp.read())

    # Flux/UNET/CLIP 관련 노드 찾기
    keywords = ['unet', 'flux', 'clip', 'vae', 'sampler', 'latent', 'save', 'gguf']
    print(f"\n=== Available Nodes (filtered) ===")
    found = []
    for name in sorted(nodes.keys()):
        for kw in keywords:
            if kw in name.lower():
                found.append(name)
                break
    for n in found:
        print(f"  {n}")

    # 특정 노드 상세 정보
    check_nodes = ['UNETLoader', 'UnetLoaderGGUF', 'DualCLIPLoader', 'CLIPTextEncode',
                   'KSampler', 'EmptySD3LatentImage', 'EmptyLatentImage',
                   'FluxGuidance', 'VAELoader', 'VAEDecode', 'SaveImage',
                   'BasicGuider', 'BasicScheduler', 'SamplerCustomAdvanced',
                   'RandomNoise', 'KSamplerSelect']

    print(f"\n=== Node Details ===")
    for cn in check_nodes:
        if cn in nodes:
            info = nodes[cn]
            req = info.get('input', {}).get('required', {})
            print(f"\n  [{cn}] required inputs:")
            for k, v in req.items():
                print(f"    {k}: {v}")
        else:
            print(f"\n  [{cn}] NOT AVAILABLE")

except Exception as e:
    print(f"Error fetching nodes: {e}")

# 3. 사용 가능한 모델 파일 확인
print(f"\n=== Checking model files via API ===")
for check_node in ['UNETLoader', 'UnetLoaderGGUF', 'DualCLIPLoader', 'VAELoader']:
    if check_node in nodes:
        req_inputs = nodes[check_node].get('input', {}).get('required', {})
        for k, v in req_inputs.items():
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], list):
                print(f"\n  {check_node}.{k} choices:")
                for f in v[0][:10]:
                    print(f"    - {f}")
