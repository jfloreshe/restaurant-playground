function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTemplate(template) {
  if (!template) {
    return null;
  }
  if (typeof template === "string") {
    return {
      html: template,
      baseWidth: 180,
      baseHeight: 84,
      className: "",
    };
  }
  return {
    html: template.html || "",
    baseWidth: Math.max(24, Number(template.baseWidth || 180)),
    baseHeight: Math.max(24, Number(template.baseHeight || 84)),
    className: template.className || "",
  };
}

export class LabelOverlay {
  constructor(hostElement, store, camera, options = {}) {
    this.hostElement = hostElement;
    this.store = store;
    this.camera = camera;
    this.minZoom = options.minZoom || 6;
    this.externalTemplate = options.getTemplate || null;
    this.nodes = new Map();

    this.root = document.createElement("div");
    this.root.className = "label-layer";
    this.hostElement.appendChild(this.root);
  }

  resolveTemplate(element) {
    if (this.externalTemplate) {
      const custom = this.externalTemplate(element);
      if (custom) {
        return custom;
      }
    }
    return this.defaultTemplate(element);
  }

  defaultTemplate(element) {
    if (element.type === "chair") {
      return null;
    }

    const fallbackSignName =
      element.type === "sign" ? escapeHtml(element.label || "SIGN") : "";
    const name = escapeHtml(element.meta?.name || "") || fallbackSignName;
    const state = escapeHtml(element.meta?.state || "open");
    if (!name && element.type !== "sign") {
      return null;
    }

    if (element.type === "rect-table" || element.type === "round-table") {
      const variant = ((Number(element.meta?.uiVariant) || 0) % 3 + 3) % 3;
      if (variant === 0) {
        return {
          html: `
            <div class="ui-table ui-table-v0">
              <div class="line"></div>
              <div class="name">${name}</div>
              <div class="state is-${state}">${state.toUpperCase()}</div>
            </div>
          `,
          baseWidth: 220,
          baseHeight: 110,
          className: "tpl-table-v0",
        };
      }
      if (variant === 1) {
        return {
          html: `
            <div class="ui-table ui-table-v1">
              <div class="name">${name}</div>
              <div class="state is-${state}">${state.toUpperCase()}</div>
            </div>
          `,
          baseWidth: 220,
          baseHeight: 110,
          className: "tpl-table-v1",
        };
      }
      return {
        html: `
          <div class="ui-table ui-table-v2">
            <div class="name">${name}</div>
            <div class="state is-${state}">${state.toUpperCase()}</div>
          </div>
        `,
        baseWidth: 220,
        baseHeight: 110,
        className: "tpl-table-v2",
      };
    }

    return {
      html: `
        <div class="ui-card">
          <div class="ui-card-name">${name || escapeHtml(element.type.toUpperCase())}</div>
          <div class="ui-card-state is-${state}">${state.toUpperCase()}</div>
        </div>
      `,
      baseWidth: 180,
      baseHeight: element.type === "sign" ? 70 : 88,
      className: `tpl-${element.type}`,
    };
  }

  render(visibleRange) {
    if (this.camera.zoom < this.minZoom) {
      this.clear();
      return;
    }

    const seen = new Set();
    const minX = visibleRange.startX;
    const minY = visibleRange.startY;
    const maxX = visibleRange.endX;
    const maxY = visibleRange.endY;

    for (let i = 0; i < this.store.drawOrder.length; i += 1) {
      const id = this.store.drawOrder[i];
      const element = this.store.elements.get(id);
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

      const template = normalizeTemplate(this.resolveTemplate(element));
      if (!template || !template.html) {
        continue;
      }

      const topLeft = this.camera.worldToScreen(element.x, element.y);
      const screenW = element.w * this.camera.zoom;
      const screenH = element.h * this.camera.zoom;
      const inset = Math.max(2, Math.min(8, this.camera.zoom * 0.08));
      const boxW = Math.floor(screenW - inset * 2);
      const boxH = Math.floor(screenH - inset * 2);
      if (boxW < 20 || boxH < 16) {
        continue;
      }

      let entry = this.nodes.get(id);
      if (!entry) {
        const shell = document.createElement("div");
        shell.className = "element-ui-shell";
        const content = document.createElement("div");
        content.className = "element-ui-content";
        shell.appendChild(content);
        this.root.appendChild(shell);
        entry = { shell, content };
        this.nodes.set(id, entry);
      }

      const { shell, content } = entry;
      const htmlKey = `${template.className}|${template.html}`;
      if (content.dataset.htmlKey !== htmlKey) {
        content.className = `element-ui-content ${template.className}`.trim();
        content.innerHTML = template.html;
        content.dataset.htmlKey = htmlKey;
      }

      const scale = Math.max(0.1, Math.min(boxW / template.baseWidth, boxH / template.baseHeight));
      const pixelX = Math.round(topLeft.x + inset);
      const pixelY = Math.round(topLeft.y + inset);
      shell.style.transform = `translate(${pixelX}px, ${pixelY}px)`;
      shell.style.width = `${boxW}px`;
      shell.style.height = `${boxH}px`;

      content.style.width = `${template.baseWidth}px`;
      content.style.height = `${template.baseHeight}px`;
      content.style.transform = `scale(${scale})`;
      content.style.transformOrigin = "top left";

      seen.add(id);
    }

    for (const [id, entry] of this.nodes) {
      if (seen.has(id)) {
        continue;
      }
      entry.shell.remove();
      this.nodes.delete(id);
    }
  }

  clear() {
    for (const [, entry] of this.nodes) {
      entry.shell.remove();
    }
    this.nodes.clear();
  }

  destroy() {
    this.clear();
    this.root.remove();
  }
}
