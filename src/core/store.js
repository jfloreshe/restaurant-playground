function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeState(value) {
  const allowed = new Set(["open", "using", "reserved", "closed"]);
  const candidate = String(value || "").trim().toLowerCase();
  return allowed.has(candidate) ? candidate : "open";
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .slice(0, 18)
    .toUpperCase();
}

function normalizeVariant(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.floor(Math.random() * 3);
  }
  const asInt = Math.floor(parsed);
  return ((asInt % 3) + 3) % 3;
}

export class EditorStore {
  constructor({ gridWidth, gridHeight, itemTypes }) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.gridSize = gridWidth * gridHeight;

    this.wallCells = new Uint8Array(this.gridSize);
    this.elementOwner = new Uint32Array(this.gridSize);
    this.elements = new Map();
    this.drawOrder = [];
    this.nextElementId = 1;
    this.selectedElementId = 0;
    this.itemTypes = itemTypes;

    this.listeners = new Set();
    this.revision = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyChange() {
    this.revision += 1;
    for (const listener of this.listeners) {
      listener(this.revision);
    }
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.gridWidth && y < this.gridHeight;
  }

  index(x, y) {
    return y * this.gridWidth + x;
  }

  getElementIdAtCell(x, y) {
    if (!this.inBounds(x, y)) {
      return 0;
    }
    return this.elementOwner[this.index(x, y)];
  }

  setWallCell(x, y, filled) {
    if (!this.inBounds(x, y)) {
      return false;
    }
    const idx = this.index(x, y);
    const value = filled ? 1 : 0;
    if (this.wallCells[idx] === value) {
      return false;
    }
    this.wallCells[idx] = value;
    this.notifyChange();
    return true;
  }

  paintWallLine(x0, y0, x1, y1, filled) {
    let changed = false;
    let px = x0;
    let py = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      if (this.inBounds(px, py)) {
        const idx = this.index(px, py);
        const value = filled ? 1 : 0;
        if (this.wallCells[idx] !== value) {
          this.wallCells[idx] = value;
          changed = true;
        }
      }

      if (px === x1 && py === y1) {
        break;
      }
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        px += sx;
      }
      if (e2 <= dx) {
        err += dx;
        py += sy;
      }
    }

    if (changed) {
      this.notifyChange();
    }
    return changed;
  }

  canPlaceElement(x, y, w, h, ignoreId = 0) {
    if (x < 0 || y < 0 || x + w > this.gridWidth || y + h > this.gridHeight) {
      return false;
    }

    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        const idx = this.index(col, row);
        const owner = this.elementOwner[idx];
        if (owner !== 0 && owner !== ignoreId) {
          return false;
        }
        if (this.wallCells[idx] === 1) {
          return false;
        }
      }
    }
    return true;
  }

  stampElementOwner(id, x, y, w, h) {
    for (let row = y; row < y + h; row += 1) {
      const rowStart = this.index(x, row);
      for (let col = 0; col < w; col += 1) {
        this.elementOwner[rowStart + col] = id;
      }
    }
  }

  addElement({ type, x, y, w, h, label = "", meta = {} }) {
    if (!this.canPlaceElement(x, y, w, h)) {
      return 0;
    }

    const id = this.nextElementId;
    this.nextElementId += 1;
    const isTable = type === "rect-table" || type === "round-table";
    const normalizedName = normalizeName(meta.name);
    const element = {
      id,
      type,
      x,
      y,
      w,
      h,
      label,
      meta: {
        name: normalizedName || (isTable ? `T${id}` : ""),
        state: normalizeState(meta.state),
        uiVariant: normalizeVariant(meta.uiVariant),
      },
    };
    this.elements.set(id, element);
    this.drawOrder.push(id);
    this.stampElementOwner(id, x, y, w, h);
    this.selectedElementId = id;
    this.notifyChange();
    return id;
  }

  addItemAt(type, x, y, options = {}) {
    const definition = this.itemTypes[type];
    if (!definition) {
      return 0;
    }

    const normalizedOptions =
      typeof options === "string"
        ? { label: options, name: "", state: "open", uiVariant: null }
        : {
            label: options.label || "",
            name: options.name || "",
            state: options.state || "open",
            uiVariant: options.uiVariant,
          };

    const clampedX = clamp(x, 0, this.gridWidth - definition.w);
    const clampedY = clamp(y, 0, this.gridHeight - definition.h);
    return this.addElement({
      type,
      x: clampedX,
      y: clampedY,
      w: definition.w,
      h: definition.h,
      label:
        type === "sign"
          ? String(normalizedOptions.label).trim().slice(0, 12).toUpperCase()
          : "",
      meta: {
        name: normalizedOptions.name,
        state: normalizedOptions.state,
        uiVariant: normalizedOptions.uiVariant,
      },
    });
  }

  getTypeConstraints(type) {
    const definition = this.itemTypes[type] || {};
    return {
      minW: Math.max(1, definition.minW || 1),
      minH: Math.max(1, definition.minH || 1),
      maxW: Math.max(1, definition.maxW || this.gridWidth),
      maxH: Math.max(1, definition.maxH || this.gridHeight),
    };
  }

  moveElement(id, x, y) {
    const element = this.elements.get(id);
    if (!element) {
      return false;
    }

    const targetX = clamp(x, 0, this.gridWidth - element.w);
    const targetY = clamp(y, 0, this.gridHeight - element.h);
    if (targetX === element.x && targetY === element.y) {
      return false;
    }

    this.stampElementOwner(0, element.x, element.y, element.w, element.h);
    if (!this.canPlaceElement(targetX, targetY, element.w, element.h, id)) {
      this.stampElementOwner(id, element.x, element.y, element.w, element.h);
      return false;
    }

    element.x = targetX;
    element.y = targetY;
    this.stampElementOwner(id, element.x, element.y, element.w, element.h);
    this.bringElementToFront(id);
    this.notifyChange();
    return true;
  }

  resizeElement(id, x, y, w, h) {
    const element = this.elements.get(id);
    if (!element) {
      return false;
    }

    const constraints = this.getTypeConstraints(element.type);
    const clampedX = clamp(x, 0, this.gridWidth - 1);
    const clampedY = clamp(y, 0, this.gridHeight - 1);
    const maxByBoundsW = this.gridWidth - clampedX;
    const maxByBoundsH = this.gridHeight - clampedY;
    const clampedW = clamp(
      w,
      constraints.minW,
      Math.min(constraints.maxW, maxByBoundsW)
    );
    const clampedH = clamp(
      h,
      constraints.minH,
      Math.min(constraints.maxH, maxByBoundsH)
    );

    if (
      clampedX === element.x &&
      clampedY === element.y &&
      clampedW === element.w &&
      clampedH === element.h
    ) {
      return false;
    }

    if (!this.canPlaceElement(clampedX, clampedY, clampedW, clampedH, id)) {
      return false;
    }

    this.stampElementOwner(0, element.x, element.y, element.w, element.h);
    element.x = clampedX;
    element.y = clampedY;
    element.w = clampedW;
    element.h = clampedH;
    this.stampElementOwner(id, element.x, element.y, element.w, element.h);
    this.bringElementToFront(id);
    this.notifyChange();
    return true;
  }

  bringElementToFront(id) {
    const index = this.drawOrder.indexOf(id);
    if (index < 0 || index === this.drawOrder.length - 1) {
      return;
    }
    this.drawOrder.splice(index, 1);
    this.drawOrder.push(id);
  }

  selectElement(id) {
    if (this.selectedElementId === id) {
      return;
    }
    this.selectedElementId = id;
    this.notifyChange();
  }

  updateElementMeta(id, patch = {}) {
    const element = this.elements.get(id);
    if (!element) {
      return false;
    }

    const nextName =
      patch.name === undefined ? element.meta.name : normalizeName(patch.name);
    const nextState =
      patch.state === undefined ? element.meta.state : normalizeState(patch.state);
    const nextVariant =
      patch.uiVariant === undefined
        ? element.meta.uiVariant
        : normalizeVariant(patch.uiVariant);

    if (
      nextName === element.meta.name &&
      nextState === element.meta.state &&
      nextVariant === element.meta.uiVariant
    ) {
      return false;
    }

    element.meta.name = nextName;
    element.meta.state = nextState;
    element.meta.uiVariant = nextVariant;
    this.notifyChange();
    return true;
  }
}
