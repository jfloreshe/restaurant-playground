# Canvas Restaurant Layout Editor (Minimal)

This is a minimal, from-scratch canvas prototype for a high-scale grid editor:

- 1000 x 1000 grid in memory (`Uint8Array` wall layer)
- viewport-based rendering (only visible cells are scanned/drawn)
- single editor context in a div container with portrait breakpoint presets:
  - XXL: 1920 x 2560
  - XL: 1200 x 1600
  - MD: 720 x 960
  - XS: 480 x 640
- dynamic portrait size menu in header (switches viewport without reloading state)
- zoom via UI controls (`-`, numeric input, `+`)
- HTML/CSS overlay above SVG elements (name + state badges) that scales with zoom
- 3 random table UI templates (stable per element) to visualize dynamic styling
- drag/move elements without HTML5 Drag and Drop API
- placeable SVG-based item types: rectangular table, circular table, chair, sign
- border/corner resize handles with collision-aware snapping
- invalidation-based rendering (`requestAnimationFrame` only when dirty)

## Run

Because ES modules are used, run from a local web server (not `file://`):

```powershell
cd C:\Users\USER\source\repos\poc-canvas
python -m http.server 5173
```

Then open `http://localhost:5173`.

## Controls

- Select tool in top toolbar
- Left drag: paint/erase walls (when wall tools are active)
- Left click: place selected item on snapped grid cells
- Left drag on item: move item
- Drag border/corner of selected item: resize by grid cells (blocked by collisions)
- Sign tool uses the text input (example `BAR`, `SSH`)
- Click a table to open tooltip editor near it (`name`, `state`, `style`)
- Tooltip `Style` button rotates one of 3 table template variants
- Optional dynamic UI templates:
  - define `window.RestaurantOverlayTemplates` with per-type templates/factories
  - overlay auto-fits and clips template HTML into the element occupied space
- Use `-`, numeric input, `+` to zoom (mouse wheel zoom disabled)
- Use `Portrait Size` dropdown to switch XXL/XL/MD/XS viewport presets
- Canvas has `touch-action: none` to improve drag behavior on touch devices
- `Center` resets camera position to the default focal point
- Middle drag / Right drag / Space + Left drag: pan

## Suggested Module Structure

```text
src/
  core/
    config.js       # constants/tuning values
    camera.js       # world<->screen transforms + bounds
    store.js        # authoritative state + mutations
  input/
    interaction.js  # pointer/keyboard/wheel event orchestration
  render/
    renderer.js     # draw pipeline (viewport cull + batching)
    labelOverlay.js # HTML/CSS overlay labels synchronized with camera
  main.js           # composition root for portrait breakpoints + zoom UI
```

## Dynamic Template Hook

Add a global registry before app bootstrap:

```html
<script>
  window.RestaurantOverlayTemplates = {
    "rect-table": (el) => ({
      html: `
        <div class="ux-card table">
          <div class="title">${el.meta?.name || "TABLE"}</div>
          <div class="badge ${el.meta?.state || "open"}">${el.meta?.state || "open"}</div>
        </div>
      `,
      baseWidth: 220,
      baseHeight: 110,
      className: "ux-table-template",
    }),
  };
</script>
```

Template sizing:
- `baseWidth`/`baseHeight` represent your design canvas size.
- Overlay scales that HTML proportionally to fit the current element box at current zoom.

## Key Performance Patterns

1. Keep state in typed arrays and plain objects:
   - `wallCells` (`Uint8Array`) for tile occupancy
   - `elementOwner` (`Uint32Array`) for O(1) hit tests and collision checks
2. Render only visible world range:
   - `camera.getVisibleCellRange()` bounds all loops.
3. Batch contiguous cell draws:
   - wall rows are run-length batched into fewer `fillRect` calls.
4. Invalidate instead of continuous redraw:
   - draw only after state/camera changes.
5. Cull elements before drawing:
   - skip objects outside viewport before any paint call.

## Patterns To Avoid

1. One DOM node per cell.
2. Full-grid redraw loops independent of camera.
3. Recomputing expensive geometry every frame without change tracking.
4. Per-pixel effects/shadows on every cell at low zoom.
5. Allocating transient objects inside inner render loops.

## Path To WebGL Later

1. Keep `store` and `camera` unchanged (same data model).
2. Replace `render/renderer.js` with `render/webglRenderer.js`.
3. First migration:
   - draw walls as instanced quads from visible range.
   - draw elements from a dynamic instance buffer.
4. Add chunking:
   - split grid into fixed chunks (for example 64x64) and upload only dirty chunks.
5. Keep input system identical:
   - pointer interactions remain CPU-side in world/cell coordinates.
