"""Build the walkable ground texture from the backdrop painting.

Un-warps the painted ground (perspective -> top-down), keeps the near,
high-detail part, and makes it tile seamlessly along the path so the
scene can scroll it forever. Outside the path it fills a darker,
leaf-littered forest floor.

usage: python3 tools/make_ground.py "<backdrop.png>" assets/scene/ground.webp
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter

SRC, OUT = sys.argv[1], sys.argv[2]
VPX, VPY = 1066, 545        # vanishing point in the backdrop (px)
F, EYE = 941, 1.6           # focal length (px) and eye height (m) — must match scene.js
PXM = 96                    # texture pixels per metre
Z0, Z1, BLEND = 3.85, 9.7, 1.3   # depth range taken from the painting (m)
XMIN, XMAX = -24.0, 24.0         # world width covered (m)
PATH_L, PATH_R = -3.0, 2.0       # dirt path edges (m) — keep in step with scene.js

img = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)

def sample(X, Z):
    dy = EYE * F / Z
    y, x = VPY + dy, VPX + X * dy / EYE
    return np.stack([map_coordinates(img[..., c], [y, x], order=3, mode='mirror') for c in range(3)], -1)

L = Z1 - Z0 - BLEND
rows, cols = int(L * PXM), int((XMAX - XMIN) * PXM)
Zs = Z0 + np.arange(rows) / PXM
Xs = XMIN + np.arange(cols) / PXM
X, Z = np.meshgrid(Xs, Zs)

def tiled(fn):
    a, b = fn(X, Z), fn(X, Z + L)
    w = np.clip((Z - Z0) / BLEND, 0, 1)[..., None]
    w = w * w * (3 - 2 * w)
    return w * a + (1 - w) * b

# 1. the painted path strip
strip = tiled(sample)

# 2. grass verges: a patch of the painted meadow, mirrored so it tiles
patch = Image.fromarray(img[600:760, 0:190].astype(np.uint8))
gh = rows // 2
patch = np.asarray(patch.resize((int(190 * gh / 160), gh), Image.BICUBIC)).astype(np.float32)
patch = np.concatenate([patch, patch[::-1]], 0)            # rows tall, seamless in Z
patch = np.concatenate([patch, patch[:, ::-1]], 1)         # seamless in X
gy = np.arange(rows)[:, None] % patch.shape[0]
gx = ((Xs - XMIN) * PXM).astype(int)[None, :] % patch.shape[1]
floor = patch[gy, gx]

# soft light/shade variation hides the repeat (wraps in Z so the tile stays seamless)
rng = np.random.default_rng(4)
def smooth_noise(sigma):
    n = gaussian_filter(rng.standard_normal((rows, cols)), sigma=sigma, mode='wrap')
    return n / np.abs(n).max()
floor *= (1 + 0.22 * smooth_noise(PXM * 0.7))[..., None]

# forest floor: darker, browner, leaf-littered away from the path (canopy shade)
dist = np.maximum(0, np.maximum(PATH_L - X, X - PATH_R) - 1.0)
shade = np.clip(dist / 7, 0, 1)[..., None]
leaf = np.array([92, 60, 30], np.float32)
litter = smooth_noise(PXM * 0.08)[..., None]
floor = floor * (1 - 0.5 * shade) + shade * (leaf * 0.5 + 30 * litter)

# 3. ragged path edges
edge_n = smooth_noise(PXM * 0.25) * 0.28 + smooth_noise(PXM * 0.04) * 0.12
inside = np.minimum(X - PATH_L, PATH_R - X) + edge_n
m = np.clip(inside / 0.22 + 0.5, 0, 1)[..., None]
out = m * strip + (1 - m) * floor

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT, 'WEBP', quality=84, method=6)
print('ground', cols, 'x', rows, 'px =', XMAX - XMIN, 'm x', round(L, 2), 'm')
