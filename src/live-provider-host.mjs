import { fileURLToPath } from "node:url";
import { EveCultMeshProviderClient } from "./cultmesh-provider-client.mjs";
import { createEveElectronWindow, registerEveWindowControls } from "./window-host.mjs";

export const eveProviderIpcChannels = Object.freeze({
  providerAdvertisement: "eve:provider-advertisement",
  surface: "eve:surface",
  document: "eve:embedded-document",
  submitCommand: "eve:submit-command",
  windowControl: "eve-electron:window-control",
});

export function registerEveProviderIpc(ipcMain, client, { receiptTimeoutMs = 5000 } = {}) {
  const handlers = [
    [eveProviderIpcChannels.providerAdvertisement, () => client.providerAdvertisement()],
    [eveProviderIpcChannels.surface, (_event, request) => client.surface(request?.surfaceId)],
    [eveProviderIpcChannels.document, (_event, request) => client.resolveDocument(request)],
    [eveProviderIpcChannels.submitCommand, async (_event, request) => {
      const submission = await client.submitCommand(request);
      const receipt = await waitForReceipt(client, submission, receiptTimeoutMs);
      return { ...submission, ...receipt, accepted: receiptAccepted(receipt) };
    }],
  ];
  for (const [channel, handler] of handlers) ipcMain.handle(channel, handler);
  return () => {
    for (const [channel] of handlers) ipcMain.removeHandler(channel);
  };
}

export async function startEveElectronProviderHost(options) {
  const { app, BrowserWindow, ipcMain, shell } = options.electron;
  await app.whenReady();
  const client = (options.createProviderClient || ((target, dependencies, clientOptions) =>
    new EveCultMeshProviderClient(target, dependencies, clientOptions)))(
    options.providerTarget,
    options.dependencies,
    { runtimeId: options.runtimeId || "eve-electron" },
  );
  const window = createEveElectronWindow({
    ...(options.window || {}),
    preload: options.preload || fileURLToPath(new URL("./eve-provider-preload-entry.cjs", import.meta.url)),
  }, { BrowserWindow, shell });
  const removeProviderIpc = registerEveProviderIpc(ipcMain, client, options.receipts);
  const removeWindowIpc = registerEveWindowControls(ipcMain, BrowserWindow, eveProviderIpcChannels.windowControl);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    removeProviderIpc();
    removeWindowIpc();
    await client.close();
    if (!window.isDestroyed?.()) window.destroy();
  };
  app.on("before-quit", () => void close());
  app.on("window-all-closed", () => app.quit());
  try {
    await waitForProvider(client, options.providerTimeoutMs ?? 30000);
    await window.loadFile(options.renderer, { query: { surface: options.surfaceId || "" } });
    return { client, close, window };
  } catch (error) {
    await close();
    throw error;
  }
}

async function waitForProvider(client, timeoutMs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await client.providerAdvertisement();
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError || new Error("Timed out waiting for Eve provider advertisement.");
}

async function waitForReceipt(client, submission, timeoutMs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await client.receipt(submission);
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw lastError || new Error(`Timed out waiting for Eve receipt ${submission.commandId || ""}.`);
}

function receiptAccepted(receipt) {
  const state = String(receipt?.state || "").toLowerCase();
  return state === "accepted" || state === "reconciled";
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
