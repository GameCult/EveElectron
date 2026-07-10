const assert = require("node:assert/strict");
const test = require("node:test");
const { installEveProviderBridge } = require("../src/eve-provider-preload.cjs");

test("exposes only the generic Eve provider bridge", async () => {
  let exposed;
  const calls = [];
  const api = installEveProviderBridge({
    contextBridge: { exposeInMainWorld: (name, value) => { exposed = { name, value }; } },
    ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve(args); } },
    channels: { surface: "provider:surface" },
  });
  assert.equal(exposed.name, "eveProvider");
  assert.deepEqual(Object.keys(api), ["providerAdvertisement", "surface", "document", "submitCommand", "windowControl"]);
  await api.surface({ surfaceId: "fixture" });
  assert.deepEqual(calls, [["provider:surface", { surfaceId: "fixture" }]]);
});
