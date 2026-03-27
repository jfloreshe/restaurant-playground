export class InteractionController {
  constructor(canvas, store, camera, requestRender, getActiveTool, getSignText) {
    this.canvas = canvas;
    this.store = store;
    this.camera = camera;
    this.requestRender = requestRender;
    this.getActiveTool = getActiveTool;
    this.getSignText = getSignText;

    this.spaceDown = false;
    this.activePointerId = null;
    this.mode = "idle";
    this.lastScreen = { x: 0, y: 0 };
    this.lastCell = null;
    this.dragElementId = 0;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeHandle = null;

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("keyup", (event) => this.onKeyUp(event));
  }

  onKeyDown(event) {
    if (event.code === "Space") {
      this.spaceDown = true;
    }
  }

  onKeyUp(event) {
    if (event.code === "Space") {
      this.spaceDown = false;
    }
  }

  onPointerDown(event) {
    this.canvas.focus?.();
    const screenX = event.offsetX;
    const screenY = event.offsetY;
    this.lastScreen = { x: screenX, y: screenY };
    this.lastCell = this.camera.screenToCell(screenX, screenY);
    this.activePointerId = event.pointerId;
    let shouldCapture = false;

    const panGesture =
      event.button === 1 || event.button === 2 || (event.button === 0 && this.spaceDown);
    if (panGesture) {
      this.mode = "panning";
      shouldCapture = true;
      this.canvas.style.cursor = "grabbing";
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) {
      this.activePointerId = null;
      return;
    }

    const activeTool = this.getActiveTool();
    const hitId = this.store.getElementIdAtCell(this.lastCell.x, this.lastCell.y);

    if (hitId !== 0) {
      const element = this.store.elements.get(hitId);
      this.store.selectElement(hitId);
      const handle = this.getResizeHandleForPoint(element, screenX, screenY);
      this.dragElementId = hitId;
      shouldCapture = true;

      if (handle) {
        this.mode = "resize-element";
        this.resizeHandle = handle;
        this.canvas.style.cursor = this.cursorForResizeHandle(handle);
      } else {
        this.mode = "drag-element";
        this.dragOffset = {
          x: this.lastCell.x - element.x,
          y: this.lastCell.y - element.y,
        };
        this.canvas.style.cursor = "grabbing";
      }
    } else {
      if (activeTool === "paint-wall" || activeTool === "erase-wall") {
        this.mode = activeTool;
        shouldCapture = true;
        this.store.paintWallLine(
          this.lastCell.x,
          this.lastCell.y,
          this.lastCell.x,
          this.lastCell.y,
          this.mode === "paint-wall"
        );
      } else {
        this.mode = "idle";
        const signText = this.getSignText();
        this.store.addItemAt(activeTool, this.lastCell.x, this.lastCell.y, signText);
        this.activePointerId = null;
      }
    }

    if (shouldCapture && this.activePointerId !== null) {
      this.canvas.setPointerCapture(event.pointerId);
    }
    this.requestRender();
  }

  onPointerMove(event) {
    if (this.activePointerId === null) {
      this.updateHoverCursor(event);
      return;
    }

    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const screenX = event.offsetX;
    const screenY = event.offsetY;
    const deltaX = screenX - this.lastScreen.x;
    const deltaY = screenY - this.lastScreen.y;
    const cell = this.camera.screenToCell(screenX, screenY);

    if (this.mode === "panning") {
      this.camera.panByPixels(deltaX, deltaY);
      this.requestRender();
    } else if (this.mode === "drag-element") {
      const targetX = cell.x - this.dragOffset.x;
      const targetY = cell.y - this.dragOffset.y;
      this.store.moveElement(this.dragElementId, targetX, targetY);
    } else if (this.mode === "resize-element") {
      this.resizeActiveElement(cell);
    } else if (this.mode === "paint-wall" || this.mode === "erase-wall") {
      const fill = this.mode === "paint-wall";
      if (this.lastCell) {
        this.store.paintWallLine(this.lastCell.x, this.lastCell.y, cell.x, cell.y, fill);
      }
    }

    this.lastScreen = { x: screenX, y: screenY };
    this.lastCell = cell;
    this.requestRender();
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.mode = "idle";
    this.dragElementId = 0;
    this.resizeHandle = null;
    this.canvas.style.cursor = "crosshair";
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.updateHoverCursor(event);
    this.requestRender();
  }

  resizeActiveElement(cell) {
    const element = this.store.elements.get(this.dragElementId);
    const handle = this.resizeHandle;
    if (!element || !handle) {
      return;
    }

    const constraints = this.store.getTypeConstraints(element.type);
    let nextX = element.x;
    let nextY = element.y;
    let nextW = element.w;
    let nextH = element.h;

    const right = element.x + element.w;
    const bottom = element.y + element.h;

    if (handle.left) {
      const maxLeft = right - constraints.minW;
      nextX = Math.min(cell.x, maxLeft);
      nextW = right - nextX;
    }
    if (handle.right) {
      nextW = cell.x - element.x + 1;
    }
    if (handle.top) {
      const maxTop = bottom - constraints.minH;
      nextY = Math.min(cell.y, maxTop);
      nextH = bottom - nextY;
    }
    if (handle.bottom) {
      nextH = cell.y - element.y + 1;
    }

    this.store.resizeElement(this.dragElementId, nextX, nextY, nextW, nextH);
  }

  getResizeHandleForPoint(element, screenX, screenY) {
    const world = this.camera.screenToWorld(screenX, screenY);
    const threshold = Math.min(0.45, Math.max(0.12, 8 / this.camera.zoom));
    const leftEdge = element.x;
    const rightEdge = element.x + element.w;
    const topEdge = element.y;
    const bottomEdge = element.y + element.h;

    const insideX = world.x >= leftEdge - threshold && world.x <= rightEdge + threshold;
    const insideY = world.y >= topEdge - threshold && world.y <= bottomEdge + threshold;
    if (!insideX || !insideY) {
      return null;
    }

    const distLeft = Math.abs(world.x - leftEdge);
    const distRight = Math.abs(world.x - rightEdge);
    const distTop = Math.abs(world.y - topEdge);
    const distBottom = Math.abs(world.y - bottomEdge);

    const handle = {
      left: distLeft <= threshold,
      right: distRight <= threshold,
      top: distTop <= threshold,
      bottom: distBottom <= threshold,
    };

    if (handle.left && handle.right) {
      if (distLeft <= distRight) {
        handle.right = false;
      } else {
        handle.left = false;
      }
    }
    if (handle.top && handle.bottom) {
      if (distTop <= distBottom) {
        handle.bottom = false;
      } else {
        handle.top = false;
      }
    }

    if (!handle.left && !handle.right && !handle.top && !handle.bottom) {
      return null;
    }
    return handle;
  }

  cursorForResizeHandle(handle) {
    if ((handle.left && handle.top) || (handle.right && handle.bottom)) {
      return "nwse-resize";
    }
    if ((handle.right && handle.top) || (handle.left && handle.bottom)) {
      return "nesw-resize";
    }
    if (handle.left || handle.right) {
      return "ew-resize";
    }
    if (handle.top || handle.bottom) {
      return "ns-resize";
    }
    return "grab";
  }

  updateHoverCursor(event) {
    if (this.spaceDown) {
      this.canvas.style.cursor = "grab";
      return;
    }

    const cell = this.camera.screenToCell(event.offsetX, event.offsetY);
    const hitId = this.store.getElementIdAtCell(cell.x, cell.y);
    if (hitId === 0) {
      this.canvas.style.cursor = "crosshair";
      return;
    }

    const element = this.store.elements.get(hitId);
    if (!element) {
      this.canvas.style.cursor = "crosshair";
      return;
    }

    const handle = this.getResizeHandleForPoint(element, event.offsetX, event.offsetY);
    this.canvas.style.cursor = handle ? this.cursorForResizeHandle(handle) : "grab";
  }
}
