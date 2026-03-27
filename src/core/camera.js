function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Camera2D {
  constructor({
    gridWidth,
    gridHeight,
    initialZoom,
    minZoom,
    maxZoom,
    cameraPaddingCells,
  }) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.zoom = initialZoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.padding = cameraPaddingCells;
    this.x = 0;
    this.y = 0;
    this.viewportWidth = 1;
    this.viewportHeight = 1;
  }

  resize(viewportWidth, viewportHeight) {
    this.viewportWidth = Math.max(1, viewportWidth);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.clampToBounds();
  }

  setCenter(worldX, worldY) {
    this.x = worldX - this.viewportWidth / (2 * this.zoom);
    this.y = worldY - this.viewportHeight / (2 * this.zoom);
    this.clampToBounds();
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom,
      y: (worldY - this.y) * this.zoom,
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: this.x + screenX / this.zoom,
      y: this.y + screenY / this.zoom,
    };
  }

  screenToCell(screenX, screenY) {
    const point = this.screenToWorld(screenX, screenY);
    return { x: Math.floor(point.x), y: Math.floor(point.y) };
  }

  panByPixels(deltaX, deltaY) {
    this.x -= deltaX / this.zoom;
    this.y -= deltaY / this.zoom;
    this.clampToBounds();
  }

  zoomAt(screenX, screenY, wheelDeltaY) {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const zoomFactor = Math.exp(-wheelDeltaY * 0.0015);
    this.zoom = clamp(this.zoom * zoomFactor, this.minZoom, this.maxZoom);
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
    this.clampToBounds();
  }

  getVisibleCellRange() {
    const startX = Math.floor(this.x);
    const startY = Math.floor(this.y);
    const endX = Math.ceil(this.x + this.viewportWidth / this.zoom);
    const endY = Math.ceil(this.y + this.viewportHeight / this.zoom);
    return {
      startX: Math.max(0, startX),
      startY: Math.max(0, startY),
      endX: Math.min(this.gridWidth, endX),
      endY: Math.min(this.gridHeight, endY),
    };
  }

  clampToBounds() {
    const minX = -this.padding;
    const minY = -this.padding;
    const maxX =
      this.gridWidth + this.padding - this.viewportWidth / Math.max(this.zoom, 1e-6);
    const maxY =
      this.gridHeight + this.padding - this.viewportHeight / Math.max(this.zoom, 1e-6);

    if (minX <= maxX) {
      this.x = clamp(this.x, minX, maxX);
    } else {
      this.x = (minX + maxX) * 0.5;
    }

    if (minY <= maxY) {
      this.y = clamp(this.y, minY, maxY);
    } else {
      this.y = (minY + maxY) * 0.5;
    }
  }
}
