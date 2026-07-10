import assert from "node:assert/strict";
import test from "node:test";
import { eveProviderIpcChannels, registerEveAssetProtocol, registerEveProviderIpc } from "../src/live-provider-host.mjs";

test("registers one generic Eve IPC authority and removes it cleanly", async () => {
  const handlers = new Map();
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler), removeHandler: channel => handlers.delete(channel) };
  const client = {
    providerAdvertisement: async () => ({ providerId: "fixture" }),
    surface: async surfaceId => ({ surfaceId }),
    resolveDocument: async request => request,
    submitCommand: async () => ({ commandId: "command-1", receiptSchema: "receipt.v1", receiptRecordRef: "receipts:command-1" }),
    receipt: async () => ({ commandId: "command-1", state: "reconciled" }),
  };
  const remove = registerEveProviderIpc(ipcMain, client);
  assert.deepEqual([...handlers.keys()], [
    eveProviderIpcChannels.providerAdvertisement,
    eveProviderIpcChannels.surface,
    eveProviderIpcChannels.document,
    eveProviderIpcChannels.submitCommand,
  ]);
  assert.deepEqual(await handlers.get(eveProviderIpcChannels.submitCommand)(null, { command: "move" }), {
    commandId: "command-1", receiptSchema: "receipt.v1", receiptRecordRef: "receipts:command-1", state: "reconciled", accepted: true,
  });
  remove();
  assert.equal(handlers.size, 0);
});

test("serves CultMesh assets through the runtime-owned protocol", async () => {
  let handler;
  registerEveAssetProtocol({ handle: (_scheme, value) => { handler = value; } }, {
    asset: async uri => ({ bytes: Uint8Array.from([4, 5]), mimeType: uri.endsWith("icon") ? "image/png" : "application/octet-stream" }),
  });
  const response = await handler({ url: "eve-asset://asset?uri=cultmesh%3A%2F%2Ffixture%2Ficon" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), Uint8Array.from([4, 5]));
});
