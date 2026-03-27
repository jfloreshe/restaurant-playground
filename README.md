# Canvas Restaurant Layout Editor (Minimal)

This is a minimal, from-scratch canvas prototype for a high-scale grid editor:

- 1000 x 1000 grid in memory (`Uint8Array` wall layer)
- viewport-based rendering (only visible cells are scanned/drawn)
- 3 independent editor contexts rendered inside separate div containers:
  - 1920 x 1080
  - 1200 x 675
  - 860 x 484
- zoom via UI controls (`-`, numeric input, `+`) per context
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

## Controls (Per Context)

- Select tool in top toolbar
- Left drag: paint/erase walls (when wall tools are active)
- Left click: place selected item on snapped grid cells
- Left drag on item: move item
- Drag border/corner of selected item: resize by grid cells (blocked by collisions)
- Sign tool uses the text input (example `BAR`, `SSH`)
- Use `-`, numeric input, `+` to zoom (mouse wheel zoom disabled)
- `Center` resets camera position to the default focal point for that context
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
  main.js           # composition root for 3 editor instances + zoom UI
```

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
