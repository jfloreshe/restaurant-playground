import { CONFIG } from "./core/config.js";
import { EditorStore } from "./core/store.js";
import { Camera2D } from "./core/camera.js";
import { Renderer2D } from "./render/renderer.js";
import { InteractionController } from "./input/interaction.js";
import { createDefaultSprites } from "./render/sprites.js";

const canvas = document.getElementById("canvas");
const toolbarButtons = Array.from(document.querySelectorAll(".tool-btn"));
const signTextInput = document.getElementById("signText");

let activeTool = "paint-wall";
const store = new EditorStore(CONFIG);
const camera = new Camera2D(CONFIG);
const sprites = createDefaultSprites();
const renderer = new Renderer2D(canvas, store, camera, CONFIG, sprites);

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

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.resize(width, height);
  renderer.resize(width, height);
  requestRender();
}

function seedDemoContent() {
  store.addItemAt("rect-table", 10, 8);
  store.addItemAt("round-table", 22, 16);
  store.addItemAt("chair", 16, 14);
  store.addItemAt("sign", 40, 12, "BAR");

  for (let x = 4; x < 55; x += 1) {
    store.setWallCell(x, 4, true);
    store.setWallCell(x, 28, true);
  }
  for (let y = 4; y < 29; y += 1) {
    store.setWallCell(4, y, true);
    store.setWallCell(54, y, true);
  }
}

function setActiveTool(tool) {
  activeTool = tool;
  for (const button of toolbarButtons) {
    button.dataset.active = button.dataset.tool === tool ? "true" : "false";
  }
}

for (const button of toolbarButtons) {
  button.addEventListener("click", () => {
    setActiveTool(button.dataset.tool);
  });
}

new InteractionController(
  canvas,
  store,
  camera,
  requestRender,
  () => activeTool,
  () => signTextInput.value
);
store.subscribe(() => requestRender());

seedDemoContent();
camera.setCenter(24, 16);
resize();
window.addEventListener("resize", resize);

window.addEventListener("beforeunload", () => {
  if (rafId) {
    window.cancelAnimationFrame(rafId);
  }
});
