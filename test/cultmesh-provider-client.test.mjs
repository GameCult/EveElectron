import assert from "node:assert/strict";
import test from "node:test";
import { EveCultMeshProviderClient } from "../src/cultmesh-provider-client.mjs";

const advertisement = [
  "gamecult.eve.provider_advertisement.v1", "test-provider", "test.service", "test.verse",
  "Test Provider", "game.runtime", "cultmesh://test/provider", "2026-07-10T00:00:00Z",
  ["live", "2026-07-10T00:00:00Z", 15000], [], [], [[
    "world", "gamecult.eve.surface.v1", "records/world", "cultmesh-record", "available", "interactive-world",
    ["provider-world", [], "commands", "records/commands", "gamecult.eve.command_receipt.v1", "records/receipts", "records/assets", ["electron-shell"], "provider owns truth"],
  ]], [],
];
const surface = ["surface-state", "gamecult.eve.surface.v1", "test-provider", "daemon", "World", 3, "now", ["world", { id: "root", kind: "world.scene", children: [] }, []], []];

function harness() {
  const sent = [];
  const records = new Map([["records/provider", advertisement], ["records/world", surface], ["records/receipts/cmd-1", { state: "accepted" }]]);
  const peer = { send: message => sent.push(message), close() {}, on() {} };
  const mesh = {
    createPeerCatalog: () => ({ upsert() {} }), createAuthorityLeaseCatalog: () => ({ upsert() {} }),
    createRudpPeerForAuthorizedPeer: async () => peer,
    documentFromPublication: (_source, _schema, recordRef) => ({ latest: async () => {
      if (!records.has(recordRef)) throw new Error(`missing ${recordRef}`);
      return records.get(recordRef);
    } }),
    verse: () => ({ context: { routeHint: { transport: "network" } } }),
  };
  const client = new EveCultMeshProviderClient({
    providerId: "test-provider", advertisementRecordRef: "records/provider", peerId: "test-peer",
    verseId: "test.verse", role: "provider", endpoints: ["rudp://127.0.0.1:7777"],
  }, { CultMesh: mesh, encode: value => Uint8Array.from([value.length]) }, { runtimeId: "test-runtime" });
  return { client, sent };
}

test("follows provider-advertised record references", async () => {
  const { client } = harness();
  const provider = await client.providerAdvertisement();
  assert.equal(provider.surfaces[0].recordRef, "records/world");
  assert.equal((await client.surface("world")).surface.id, "world");
});

test("submits at the advertised command boundary and reads the advertised receipt", async () => {
  const { client, sent } = harness();
  const submission = await client.submitCommand({ surfaceId: "world", command: "move", commandId: "cmd-1", payload: { x: 1 } });
  assert.equal(sent[0].document.recordKey, "records/commands/cmd-1");
  assert.equal(sent[0].document.sourceRole, "eve-runtime");
  assert.equal(submission.receiptRecordRef, "records/receipts/cmd-1");
  assert.deepEqual(await client.receipt(submission), { state: "accepted" });
});

test("refuses unadvertised surfaces", async () => {
  const { client } = harness();
  await assert.rejects(() => client.surface("missing"), /does not advertise/);
});
