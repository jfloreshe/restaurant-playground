import { CONFIG } from "./core/config.js";
import { EditorStore } from "./core/store.js";
import { Camera2D } from "./core/camera.js";
import { Renderer2D } from "./render/renderer.js";
import { InteractionController } from "./input/interaction.js";
import { createDefaultSprites } from "./render/sprites.js";

const RESOLUTION_PRESETS = [
  { label: "Desktop XL", width: 1920, height: 1080 },
  { label: "Desktop", width: 1200, height: 675 },
  { label: "Tablet", width: 860, height: 484 },
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
  signInput.value = index === 0 ? "BAR" : index === 1 ? "SSH" : "A1";
  signInput.title = "Sign label";

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
  store.addItemAt("rect-table", 8 + seedOffset, 8);
  store.addItemAt("round-table", 20 + seedOffset, 14);
  store.addItemAt("chair", 16 + seedOffset, 12);
  store.addItemAt("sign", 38 + seedOffset, 10, seedOffset === 0 ? "BAR" : "SSH");

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

function setupInstance(preset, index) {
  const ui = createEditorCard(preset, index);
  app.appendChild(ui.card);

  const store = new EditorStore(CONFIG);
  const camera = new Camera2D(CONFIG);
  const renderer = new Renderer2D(ui.canvas, store, camera, CONFIG, sprites);
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
    () => ui.signInput.value
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

  return { resize, stop: () => rafId && window.cancelAnimationFrame(rafId) };
}

function buildPage() {
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <div class="header-title">Canvas Restaurant Layout Editor</div>
    <div class="header-sub">3 independent contexts: 1920, 1200, 860. Use toolbar zoom controls (no mouse wheel zoom).</div>
  `;
  app.appendChild(header);

  for (let i = 0; i < RESOLUTION_PRESETS.length; i += 1) {
    const instance = setupInstance(RESOLUTION_PRESETS[i], i);
    instances.push(instance);
  }
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
