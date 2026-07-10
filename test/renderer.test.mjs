import assert from "node:assert/strict";
import test from "node:test";
import { createEveElectronRendererTransport } from "../src/eve-electron-renderer.mjs";

test("adapts only the generic Eve provider renderer boundary", async () => {
  const calls = [];
  const provider = {
    providerAdvertisement: async () => ({ providerId: "fixture" }),
    surface: async request => { calls.push(["surface", request]); return { surface: { id: "world" } }; },
    document: async request => { calls.push(["document", request]); return { document: true }; },
    submitCommand: async request => { calls.push(["command", request]); return { state: "accepted" }; },
  };
  const transport = createEveElectronRendererTransport(provider);
  assert.equal(transport.resolveAssetUrl("cultmesh://fixture/icon"), "eve-asset://asset?uri=cultmesh%3A%2F%2Ffixture%2Ficon");
  await transport.surface({ surfaceId: "world", recordRef: "provider-owned" });
  await transport.resolveDocument({ documentId: "objects", schemaId: "objects.v1" });
  await transport.submitCommand({ providerId: "fixture", surfaceId: "world", command: "move", clientId: "renderer", issuedAt: "now", payload: { x: 1 } });
  assert.deepEqual(calls, [
    ["surface", { surfaceId: "world" }],
    ["document", { documentId: "objects", schemaId: "objects.v1" }],
    ["command", { providerId: "fixture", surfaceId: "world", command: "move", clientId: "renderer", issuedAtUtc: "now", payload: { x: 1 } }],
  ]);
});
