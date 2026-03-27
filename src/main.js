import { CONFIG } from "./core/config.js";
import { EditorStore } from "./core/store.js";
import { Camera2D } from "./core/camera.js";
import { Renderer2D } from "./render/renderer.js";
import { LabelOverlay } from "./render/labelOverlay.js";
import { InteractionController } from "./input/interaction.js";
import { createDefaultSprites } from "./render/sprites.js";

const PORTRAIT_PRESETS = [
  { id: "xxl", label: "XXL Portrait", width: 1920, height: 2560 },
  { id: "xl", label: "XL Portrait", width: 1200, height: 1600 },
  { id: "md", label: "MD Portrait", width: 720, height: 960 },
  { id: "xs", label: "XS Portrait", width: 480, height: 640 },
];

const TOOL_DEFS = [
  { id: "paint-wall", label: "Wall" },
  { id: "erase-wall", label: "Erase" },
  { id: "rect-table", label: "Rect Table" },
  { id: "round-table", label: "Round Table" },
  { id: "chair", label: "Chair" },
  { id: "sign", label: "Sign" },
];

const app = document.getElementById("app");
const sprites = createDefaultSprites();
const instances = [];

function createEditorCard({ label, width, height }, index) {
  const card = document.createElement("section");
  card.className = "editor-card";

  const title = document.createElement("div");
  title.className = "editor-title";
  title.textContent = `${label} Context  ${width} x ${height}`;

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const toolGroup = document.createElement("div");
  toolGroup.className = "tool-group";
  const buttons = [];
  for (let i = 0; i < TOOL_DEFS.length; i += 1) {
    const def = TOOL_DEFS[i];
    const button = document.createElement("button");
    button.className = "tool-btn";
    button.dataset.tool = def.id;
    button.dataset.active = i === 0 ? "true" : "false";
    button.textContent = def.label;
    buttons.push(button);
    toolGroup.appendChild(button);
  }

  const signInput = document.createElement("input");
  signInput.className = "sign-text";
  signInput.maxLength = 12;
  signInput.value = index === 0 ? "BAR" : "SSH";
  signInput.title = "Sign text";

  const zoomGroup = document.createElement("div");
  zoomGroup.className = "zoom-group";
  const centerBtn = document.createElement("button");
  centerBtn.className = "tool-btn";
  centerBtn.textContent = "Center";
  const zoomOut = document.createElement("button");
  zoomOut.className = "tool-btn zoom-btn";
  zoomOut.textContent = "-";
  const zoomValue = document.createElement("input");
  zoomValue.className = "zoom-input";
  zoomValue.type = "number";
  zoomValue.step = "5";
  zoomValue.min = String(Math.round((CONFIG.minZoom / CONFIG.initialZoom) * 100));
  zoomValue.max = String(Math.round((CONFIG.maxZoom / CONFIG.initialZoom) * 100));
  zoomValue.value = "100";
  const zoomIn = document.createElement("button");
  zoomIn.className = "tool-btn zoom-btn";
  zoomIn.textContent = "+";
  zoomGroup.append(centerBtn, zoomOut, zoomValue, zoomIn);

  toolbar.append(toolGroup, signInput, zoomGroup);

  const viewport = document.createElement("div");
  viewport.className = "viewport-shell";
  viewport.style.setProperty("--native-w", String(width));
  viewport.style.setProperty("--native-h", String(height));

  const canvas = document.createElement("canvas");
  canvas.className = "canvas";
  viewport.appendChild(canvas);

  card.append(title, toolbar, viewport);
  return {
    card,
    title,
    canvas,
    viewport,
    buttons,
    signInput,
    centerBtn,
    zoomOut,
    zoomIn,
    zoomValue,
  };
}

function seedDemoContent(store, seedOffset) {
  store.addItemAt("rect-table", 8 + seedOffset, 8, { name: "T1", state: "open" });
  store.addItemAt("round-table", 20 + seedOffset, 14, { name: "T2", state: "using" });
  store.addItemAt("chair", 16 + seedOffset, 12, { name: "", state: "open" });
  store.addItemAt("sign", 38 + seedOffset, 10, {
    label: seedOffset === 0 ? "BAR" : "SSH",
    name: "ZONE",
    state: "open",
  });

  for (let x = 4; x < 60; x += 1) {
    store.setWallCell(x + seedOffset, 4, true);
    store.setWallCell(x + seedOffset, 30, true);
  }
  for (let y = 4; y < 31; y += 1) {
    store.setWallCell(4 + seedOffset, y, true);
    store.setWallCell(59 + seedOffset, y, true);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isTableType(type) {
  return type === "rect-table" || type === "round-table";
}

function createTableMetaTooltip(viewport, store, camera, requestRender) {
  const root = document.createElement("div");
  root.className = "table-tooltip";
  root.innerHTML = `
    <div class="tip-title">Edit Table</div>
    <input class="tip-name" maxlength="18" placeholder="Table name" />
    <select class="tip-state">
      <option value="open">OPEN</option>
      <option value="using">USING</option>
      <option value="reserved">RESERVED</option>
      <option value="closed">CLOSED</option>
    </select>
    <div class="tip-actions">
      <button class="tip-btn tip-apply">Apply</button>
      <button class="tip-btn tip-style">Style</button>
      <button class="tip-btn tip-close">Close</button>
    </div>
  `;
  viewport.appendChild(root);

  const nameInput = root.querySelector(".tip-name");
  const stateSelect = root.querySelector(".tip-state");
  const applyBtn = root.querySelector(".tip-apply");
  const styleBtn = root.querySelector(".tip-style");
  const closeBtn = root.querySelector(".tip-close");

  let selectedId = 0;
  let visible = false;

  function hide() {
    visible = false;
    selectedId = 0;
    root.style.display = "none";
  }

  function apply() {
    if (!selectedId) {
      return;
    }
    store.updateElementMeta(selectedId, {
      name: nameInput.value,
      state: stateSelect.value,
    });
  }

  function randomizeStyle() {
    if (!selectedId) {
      return;
    }
    store.updateElementMeta(selectedId, { uiVariant: Math.floor(Math.random() * 3) });
  }

  function openFor(element) {
    if (!element || !isTableType(element.type)) {
      hide();
      return;
    }
    selectedId = element.id;
    visible = true;
    root.style.display = "grid";
    nameInput.value = element.meta?.name || "";
    stateSelect.value = element.meta?.state || "open";
    sync();
  }

  function sync() {
    if (!visible || !selectedId) {
      return;
    }

    const element = store.elements.get(selectedId);
    if (!element || !isTableType(element.type)) {
      hide();
      return;
    }

    const topLeft = camera.worldToScreen(element.x, element.y);
    const screenW = element.w * camera.zoom;
    const viewportW = Math.max(1, viewport.clientWidth);
    const viewportH = Math.max(1, viewport.clientHeight);
    const tipW = root.offsetWidth || 220;
    const tipH = root.offsetHeight || 130;

    let x = topLeft.x + screenW + 10;
    let y = topLeft.y + 8;
    if (x + tipW > viewportW - 8) {
      x = Math.max(8, topLeft.x - tipW - 10);
    }
    if (y + tipH > viewportH - 8) {
      y = Math.max(8, viewportH - tipH - 8);
    }
    y = Math.max(8, y);
    root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  applyBtn.addEventListener("click", () => apply());
  styleBtn.addEventListener("click", () => randomizeStyle());
  closeBtn.addEventListener("click", () => hide());
  stateSelect.addEventListener("change", () => apply());
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      apply();
      requestRender();
    }
  });

  hide();

  return {
    openFor,
    hide,
    sync,
    destroy: () => root.remove(),
  };
}

function setupInstance(preset, index) {
  const ui = createEditorCard(preset, index);
  app.appendChild(ui.card);

  const store = new EditorStore(CONFIG);
  const camera = new Camera2D(CONFIG);
  const renderer = new Renderer2D(ui.canvas, store, camera, CONFIG, sprites);
  const labels = new LabelOverlay(ui.viewport, store, camera, {
    minZoom: 0,
    getTemplate: (element) => {
      const registry = window.RestaurantOverlayTemplates;
      if (registry && typeof registry === "object") {
        const templateFactory = registry[element.type];
        if (typeof templateFactory === "function") {
          return templateFactory(element);
        }
        if (templateFactory && typeof templateFactory === "object") {
          return templateFactory;
        }
      }
      return null;
    },
  });
  const tooltip = createTableMetaTooltip(ui.viewport, store, camera, requestRender);
  const homeCenter = { x: 24 + index * 4, y: 16 };

  let activeTool = "paint-wall";
  let dirty = false;
  let rafId = 0;

  function requestRender() {
    if (dirty) {
      return;
    }
    dirty = true;
    rafId = window.requestAnimationFrame(() => {
      dirty = false;
      renderer.render();
      labels.render(camera.getVisibleCellRange());
      tooltip.sync();
    });
  }

  function setActiveTool(tool) {
    activeTool = tool;
    for (let i = 0; i < ui.buttons.length; i += 1) {
      const button = ui.buttons[i];
      button.dataset.active = button.dataset.tool === tool ? "true" : "false";
    }
  }

  for (let i = 0; i < ui.buttons.length; i += 1) {
    const button = ui.buttons[i];
    button.addEventListener("click", () => setActiveTool(button.dataset.tool));
  }

  function getZoomPercent() {
    return (camera.zoom / CONFIG.initialZoom) * 100;
  }

  function applyZoomPercent(percent) {
    const boundedPercent = clamp(
      percent,
      Number(ui.zoomValue.min),
      Number(ui.zoomValue.max)
    );
    const targetZoom = (CONFIG.initialZoom * boundedPercent) / 100;
    camera.setZoomAt(ui.canvas.clientWidth * 0.5, ui.canvas.clientHeight * 0.5, targetZoom);
    ui.zoomValue.value = String(Math.round(getZoomPercent()));
    requestRender();
  }

  ui.zoomOut.addEventListener("click", () => {
    applyZoomPercent(getZoomPercent() / 1.2);
  });
  ui.zoomIn.addEventListener("click", () => {
    applyZoomPercent(getZoomPercent() * 1.2);
  });
  ui.centerBtn.addEventListener("click", () => {
    camera.setCenter(homeCenter.x, homeCenter.y);
    requestRender();
  });
  ui.zoomValue.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applyZoomPercent(Number(ui.zoomValue.value || 100));
      ui.zoomValue.blur();
    }
  });
  ui.zoomValue.addEventListener("blur", () => {
    applyZoomPercent(Number(ui.zoomValue.value || 100));
  });

  new InteractionController(
    ui.canvas,
    store,
    camera,
    requestRender,
    () => activeTool,
    () => ui.signInput.value,
    () => ({ name: "", state: "open" }),
    (_id, element) => {
      if (!element || !isTableType(element.type)) {
        tooltip.hide();
        return;
      }
      tooltip.openFor(element);
    }
  );

  store.subscribe(() => requestRender());
  seedDemoContent(store, index * 4);

  function resize() {
    const box = ui.viewport.getBoundingClientRect();
    const width = Math.max(1, Math.floor(box.width));
    const height = Math.max(1, Math.floor(box.height));
    camera.resize(width, height);
    renderer.resize(width, height);
    requestRender();
  }

  camera.setCenter(homeCenter.x, homeCenter.y);
  resize();

  function applyViewportPreset(nextPreset) {
    ui.viewport.style.setProperty("--native-w", String(nextPreset.width));
    ui.viewport.style.setProperty("--native-h", String(nextPreset.height));
    ui.title.textContent = `${nextPreset.label} Context  ${nextPreset.width} x ${nextPreset.height}`;
    resize();
  }

  return {
    resize,
    applyViewportPreset,
    stop: () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      tooltip.destroy();
      labels.destroy();
    },
  };
}

function buildPage() {
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `<div class="header-title">Canvas Restaurant Layout Editor</div>`;

  const controls = document.createElement("div");
  controls.className = "header-controls";
  const presetLabel = document.createElement("label");
  presetLabel.className = "preset-label";
  presetLabel.textContent = "Portrait Size";
  presetLabel.htmlFor = "portraitPreset";
  const presetSelect = document.createElement("select");
  presetSelect.id = "portraitPreset";
  presetSelect.className = "preset-select";
  for (let i = 0; i < PORTRAIT_PRESETS.length; i += 1) {
    const preset = PORTRAIT_PRESETS[i];
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.width} x ${preset.height}`;
    presetSelect.appendChild(option);
  }
  presetSelect.value = PORTRAIT_PRESETS[0].id;
  controls.append(presetLabel, presetSelect);

  const sub = document.createElement("div");
  sub.className = "header-sub";
  sub.textContent =
    "Portrait breakpoints (XXL, XL, MD, XS) with dynamic size menu. HTML labels can show table name/state above SVGs.";

  header.append(controls, sub);
  app.appendChild(header);

  const instance = setupInstance(PORTRAIT_PRESETS[0], 0);
  instances.push(instance);

  presetSelect.addEventListener("change", () => {
    const selected = PORTRAIT_PRESETS.find((preset) => preset.id === presetSelect.value);
    if (!selected) {
      return;
    }
    instance.applyViewportPreset(selected);
  });
}

buildPage();

window.addEventListener("resize", () => {
  for (let i = 0; i < instances.length; i += 1) {
    instances[i].resize();
  }
});

window.addEventListener("beforeunload", () => {
  for (let i = 0; i < instances.length; i += 1) {
    instances[i].stop();
  }
});
