I’m building a browser-based grid editor similar to a pixel/paint tool but for designing restaurant layouts.

Constraints:

- Must be implemented from scratch (no heavy external libraries)
- Cannot rely on HTML5 drag-and-drop API
- Performance is critical (grid can be up to 1000 x 1000 = 1M cells)
- Needs zooming (like “infinite zoom” feel)
- Needs drag, placement, and movement of elements (tables, walls, etc.)
- Should behave similar to Figma or a paint app when zoomed in

Current direction:

- Using HTML "<canvas>" instead of DOM elements
- Managing grid state in memory (not DOM)
- Rendering only visible cells (virtualization)
- Handling mouse events manually (mousedown/move/up)

What I need help with:

1. Designing a clean architecture (separation of state, rendering, interaction)
2. Implementing efficient rendering (viewport, zoom, pan)
3. Drag & drop system without HTML5 API
4. Optimizing performance (avoid full redraws, batching, etc.)
5. Example code structure (preferably simple but scalable)
6. Optional: ideas to evolve into WebGL if needed later

Tech context:

- I come from a C#/.NET background (Clean Architecture, distributed systems)
- I’m comfortable with structured design, but less with low-level canvas optimization

Please provide:

- A minimal working example (canvas-based grid with zoom + drag)
- Suggested folder/module structure
- Key performance patterns I should follow or avoid