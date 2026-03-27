export class Renderer2D {
  constructor(canvas, store, camera, config, sprites) {
    this.canvas = canvas;
    this.store = store;
    this.camera = camera;
    this.config = config;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.sprites = sprites;
  }

  resize(width, height) {
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * this.pixelRatio);
    this.canvas.height = Math.floor(height * this.pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  render() {
    const { ctx, camera, store } = this;
    const width = camera.viewportWidth;
    const height = camera.viewportHeight;
    const zoom = camera.zoom;
    const palette = this.config.palette;
    const visible = camera.getVisibleCellRange();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    this.drawWalls(visible, zoom, palette.wallFill);
    if (zoom >= this.config.drawGridMinZoom) {
      this.drawGridLines(visible, zoom, palette.gridMinor, palette.gridMajor);
    }
    this.drawElements(visible, zoom, palette);
    this.drawStatus(store, zoom, visible);
  }

  drawWalls(visible, zoom, fillStyle) {
    const { ctx, store, camera } = this;
    ctx.fillStyle = fillStyle;

    const rowWidth = store.gridWidth;
    for (let y = visible.startY; y < visible.endY; y += 1) {
      let runStart = -1;
      const rowOffset = y * rowWidth;

      for (let x = visible.startX; x <= visible.endX; x += 1) {
        const inRange = x < visible.endX;
        const cellFilled = inRange ? store.wallCells[rowOffset + x] === 1 : false;

        if (cellFilled && runStart < 0) {
          runStart = x;
        } else if (!cellFilled && runStart >= 0) {
          const startScreen = camera.worldToScreen(runStart, y);
          const runWidth = (x - runStart) * zoom;
          ctx.fillRect(
            Math.floor(startScreen.x),
            Math.floor(startScreen.y),
            Math.ceil(runWidth),
            Math.ceil(zoom)
          );
          runStart = -1;
        }
      }
    }
  }

  drawGridLines(visible, zoom, minorColor, majorColor) {
    const { ctx, camera } = this;
    const left = Math.floor(camera.worldToScreen(visible.startX, 0).x) + 0.5;
    const right = Math.ceil(camera.worldToScreen(visible.endX, 0).x) + 0.5;
    const top = Math.floor(camera.worldToScreen(0, visible.startY).y) + 0.5;
    const bottom = Math.ceil(camera.worldToScreen(0, visible.endY).y) + 0.5;

    for (let x = visible.startX; x <= visible.endX; x += 1) {
      const screenX = Math.floor(camera.worldToScreen(x, 0).x) + 0.5;
      const isMajor = x % 10 === 0;
      ctx.strokeStyle = isMajor ? majorColor : minorColor;
      ctx.beginPath();
      ctx.moveTo(screenX, top);
      ctx.lineTo(screenX, bottom);
      ctx.stroke();
    }

    for (let y = visible.startY; y <= visible.endY; y += 1) {
      const screenY = Math.floor(camera.worldToScreen(0, y).y) + 0.5;
      const isMajor = y % 10 === 0;
      ctx.strokeStyle = isMajor ? majorColor : minorColor;
      ctx.beginPath();
      ctx.moveTo(left, screenY);
      ctx.lineTo(right, screenY);
      ctx.stroke();
    }

    if (zoom > 40) {
      ctx.fillStyle = "#7f8dac";
      ctx.font = "11px Consolas, monospace";
      for (let x = visible.startX; x <= visible.endX; x += 10) {
        const p = camera.worldToScreen(x, visible.startY);
        ctx.fillText(String(x), p.x + 4, top + 12);
      }
    }
  }

  drawElements(visible, zoom, palette) {
    const { ctx, store, camera } = this;
    const minX = visible.startX;
    const minY = visible.startY;
    const maxX = visible.endX;
    const maxY = visible.endY;

    for (let i = 0; i < store.drawOrder.length; i += 1) {
      const id = store.drawOrder[i];
      const element = store.elements.get(id);
      if (!element) {
        continue;
      }
      if (
        element.x + element.w <= minX ||
        element.y + element.h <= minY ||
        element.x >= maxX ||
        element.y >= maxY
      ) {
        continue;
      }

      const topLeft = camera.worldToScreen(element.x, element.y);
      const screenW = element.w * zoom;
      const screenH = element.h * zoom;

      ctx.fillStyle = palette.shadow;
      ctx.fillRect(
        Math.floor(topLeft.x + 2),
        Math.floor(topLeft.y + 3),
        Math.ceil(screenW),
        Math.ceil(screenH)
      );

      ctx.fillStyle = "#1f293f";
      ctx.fillRect(
        Math.floor(topLeft.x),
        Math.floor(topLeft.y),
        Math.ceil(screenW),
        Math.ceil(screenH)
      );

      ctx.strokeStyle = "#3a4a68";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.floor(topLeft.x) + 0.5,
        Math.floor(topLeft.y) + 0.5,
        Math.ceil(screenW) - 1,
        Math.ceil(screenH) - 1
      );

      const sprite = this.sprites.get(element.type);
      if (sprite && sprite.complete) {
        const pad = Math.max(1, zoom * 0.08);
        ctx.drawImage(
          sprite,
          topLeft.x + pad,
          topLeft.y + pad,
          screenW - pad * 2,
          screenH - pad * 2
        );
      }

      if (element.type === "sign") {
        ctx.fillStyle = "#e6f2ff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.max(10, Math.floor(zoom * 0.38))}px 'Segoe UI', sans-serif`;
        ctx.fillText(
          element.label || "SIGN",
          topLeft.x + screenW * 0.5,
          topLeft.y + screenH * 0.53
        );
      }

      if (id === store.selectedElementId) {
        ctx.strokeStyle = palette.selection;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.floor(topLeft.x) + 1.5,
          Math.floor(topLeft.y) + 1.5,
          Math.ceil(screenW) - 3,
          Math.ceil(screenH) - 3
        );
        this.drawResizeHandles(topLeft.x, topLeft.y, screenW, screenH, zoom, palette.selection);
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawStatus(store, zoom, visible) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(13, 16, 23, 0.85)";
    ctx.fillRect(12, this.camera.viewportHeight - 44, 350, 32);
    ctx.fillStyle = "#d6e4ff";
    ctx.font = "12px Consolas, monospace";
    const text = `zoom:${zoom.toFixed(2)}  visible:${visible.endX - visible.startX}x${
      visible.endY - visible.startY
    }  elements:${store.elements.size}  rev:${store.revision}`;
    ctx.fillText(text, 20, this.camera.viewportHeight - 24);
  }

  drawResizeHandles(x, y, width, height, zoom, color) {
    const ctx = this.ctx;
    const size = Math.max(5, Math.min(10, zoom * 0.3));
    const half = size * 0.5;
    const points = [
      [x, y],
      [x + width * 0.5, y],
      [x + width, y],
      [x + width, y + height * 0.5],
      [x + width, y + height],
      [x + width * 0.5, y + height],
      [x, y + height],
      [x, y + height * 0.5],
    ];

    ctx.fillStyle = color;
    ctx.strokeStyle = "#10233a";
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length; i += 1) {
      const px = Math.floor(points[i][0] - half) + 0.5;
      const py = Math.floor(points[i][1] - half) + 0.5;
      ctx.fillRect(px, py, size, size);
      ctx.strokeRect(px, py, size, size);
    }
  }
}
