import { app, BrowserWindow, shell } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { buildCaptureDocument, writeCaptureWitness } from "../src/capture-model.mjs";
import { createEveElectronWindow } from "../src/window-host.mjs";

const options = parseArguments(process.argv.slice(2));
const tracePath = `${options.witness}.trace.log`;
mkdirSync(path.dirname(tracePath), { recursive: true });
trace("starting");
process.on("uncaughtException", error => fail(error));
process.on("unhandledRejection", error => fail(error));
app.on("ready", () => trace("ready-event"));
app.on("will-quit", () => trace("will-quit"));
void app.whenReady().then(runCapture, fail);

async function runCapture() {
  trace("electron-ready");
  const started = performance.now();
  let window;
  try {
  const advertisement = parseJson(readFileSync(options.advertisement, "utf8"));
  const surface = parseJson(readFileSync(options.surface, "utf8"));
  const { projection, html } = buildCaptureDocument(advertisement, surface, options.surfaceId);
  trace("projection-built");
  mkdirSync(path.dirname(options.output), { recursive: true });
  window = createEveElectronWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: true,
    title: `EveElectron ${projection.surfaceId}`,
    webPreferences: { offscreen: true },
  }, { BrowserWindow, shell });
  const imagePromise = nextPaint(window, 10000);
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  trace("window-loaded");
  await window.webContents.executeJavaScript("document.fonts.ready.then(() => true)");
  window.webContents.invalidate();
  const image = await imagePromise;
  trace("page-captured");
  if (image.isEmpty()) throw new Error("Electron capture produced an empty native image.");
  const png = image.toPNG();
  if (png.length < 1024) throw new Error(`Electron capture is suspiciously small: ${png.length} bytes.`);
  writeFileSync(options.output, png);
  const size = image.getSize();
  writeCaptureWitness({
    outputPath: options.witness,
    imagePath: options.output,
    imageSize: size,
    durationMs: Math.round((performance.now() - started) * 1000) / 1000,
    advertisement,
    surface,
    projection,
  });
    console.log(options.witness);
    trace("complete");
  } finally {
    window?.destroy();
    app.exit(0);
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) values[args[index].slice(2)] = path.resolve(args[index + 1]);
  for (const field of ["advertisement", "surface", "surface-id", "output", "witness"]) {
    if (!values[field]) throw new Error(`Missing --${field}.`);
  }
  return { ...values, surfaceId: args[args.indexOf("--surface-id") + 1] };
}

function parseJson(value) { return JSON.parse(value.replace(/^\uFEFF/, "")); }
function trace(value) { writeFileSync(tracePath, `${new Date().toISOString()} ${value}\n`, { encoding: "utf8", flag: "a" }); }
function nextPaint(window, timeoutMs) {
  return new Promise((resolve, reject) => {
    const onPaint = (_event, _dirty, image) => {
      if (image.isEmpty() || image.toPNG().length < 1024) return;
      clearTimeout(timer);
      window.webContents.off("paint", onPaint);
      resolve(image);
    };
    const timer = setTimeout(() => {
      window.webContents.off("paint", onPaint);
      reject(new Error(`Electron offscreen paint timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    window.webContents.on("paint", onPaint);
  });
}
function fail(error) {
  trace(`failed ${error instanceof Error ? error.stack || error.message : String(error)}`);
  app.exit(1);
}
