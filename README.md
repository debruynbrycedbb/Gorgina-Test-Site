# Gorgina — scroll-walk prototype

Scroll to walk down a painted autumn path. Trees and bushes pass the camera as 2D cut-outs, the path ends in golden light, and the light opens onto a photo gallery.

## How it works

- `index.html`: one page. A tall `.journey` section holds a sticky full-screen `<canvas>`, and the `#gallery` section follows it.
- `js/scene.js`: the walk. Each tree and bush has a position along the path, in metres. Scroll progress moves the camera forward, and each cut-out is drawn with simple perspective (`size = focal / distance`), so near ones grow and slide off the sides while far ones hardly move. The backdrop zooms gently toward the vanishing point. At the end, a warm glow fills the screen with the gallery's cream colour, so the hand-off is seamless.
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
| `trees.every`, `bushes.every` | spacing between cut-outs |
| `pathLeft`, `pathRight` | where the verges are (metres from the camera) |
| `smoothing` | lower = floatier scroll |
| `seed` | change it for a different random arrangement |

The scroll distance itself is `--walk-length` in `css/style.css` (800vh on desktop, 650vh on phones).

You can also tune it live in the browser console:
```js
walkScene.config.walkLength = 90; walkScene.redraw();
```

## Assets

- `assets/scene/backdrop.webp`: background plate (empty path to the light)
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
