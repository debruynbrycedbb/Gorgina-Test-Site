# Gorgina — scroll-walk prototype

Scroll to walk down a painted autumn path. Trees and bushes pass the camera as 2D cut-outs, the path ends in golden light, and the light opens onto a photo gallery.

## How it works

- `index.html`: one page. A tall `.journey` section holds a sticky full-screen `<canvas>`, and the `#gallery` section follows it.
- `js/scene.js`: the walk. Each tree and bush has a position in a small 3D world, in metres. Scroll progress moves the camera forward.
  - **Ground:** drawn row by row in true perspective from a top-down texture (`ground.webp`). It moves at exactly the same speed as everything standing on it, so trees stay rooted.
  - **Cut-outs:** projected with the same camera (`size = focal / distance`). Near ones grow and slide off the sides, and far ones turn warm and hazy, then fade out.
  - **Forest:** one row of trees lines the path, with a jittered grid of trees (and some bushes) behind them on both sides.
  - **Backdrop:** sky, canopy and the light. It drifts closer slowly, and at the end a warm glow fills the screen with the gallery's cream colour, so the hand-off is seamless.
  - **Auto quality:** if frames run slow, it drops to 1× pixels, then thins the back of the forest.
- `tools/make_ground.py`: rebuilds `ground.webp` from the backdrop. It un-warps the painted path into a top-down tile and adds grass verges and forest floor.
- `js/gallery.js`: fades paintings in as they appear, and runs a lightbox (click, ← →, Esc).
- No libraries and no build step.

## Tuning the walk

Everything is in `CONFIG` at the top of `js/scene.js`:

| Setting | What it does |
|---|---|
| `walkLength` | metres walked; more = more trees pass you |
| `walkShare` | share of the scroll spent walking (the rest is arriving in the light) |
| `eyeHeight` | camera height; lower = trees feel taller and closer |
| `backdropZoom` / `arrivalZoom` | how much the background zooms while walking / at the end |
| `trees.every`, `bushes.every` | spacing between cut-outs along the path |
| `forest.depth`, `forest.cell`, `forest.density` | how deep, how tightly packed and how full the wood behind the path is |
| `haze`, `fade` | the distances where trees start to warm up and soften / appear |
| `pathLeft`, `pathRight` | where the path edges are (metres from the camera). They're baked into `ground.webp`, so change `PATH_L`/`PATH_R` in `tools/make_ground.py` too and rebuild |
| `smoothing` | lower = floatier scroll |
| `seed` | change it for a different random arrangement |

The scroll distance itself is `--walk-length` in `css/style.css` (800vh on desktop, 650vh on phones).

You can also tune it live in the browser console:
```js
walkScene.config.walkLength = 90; walkScene.redraw();
```

## Assets

- `assets/scene/backdrop.webp`: background plate (sky, canopy, light)
- `assets/scene/ground.webp`: top-down ground tile (made by `tools/make_ground.py`)
- `assets/scene/tree-1…6.webp`, `bush-1…4.webp`: cut-outs (`-sm` versions are served to phones)
- `assets/scene/painting.webp`: the full painting, shown when reduced motion is on or JavaScript is off
- `assets/gallery/painting-1…6.webp`: gallery images (`-sm` = grid thumbnails)

To add a new tree: export a transparent WebP, add it to `TREES` in `scene.js`, and set `trunkX` to where the trunk meets the ground (as a fraction of the image width).

## Placeholders to replace

- `[Short introduction to the work, to be supplied]`
- `[Painting title 1–6]`, `[Year · medium]`, `[Description of painting 1–6]` (alt text)
- `[Contact email]`
- The gallery images themselves are temporary placeholders.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Rebuild the ground after changing the path width:

```bash
pip install numpy scipy pillow
python3 tools/make_ground.py "path/to/Autumn Canopy Path to Golden Light.png" assets/scene/ground.webp
```
