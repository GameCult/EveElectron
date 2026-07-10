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
const surface = ["surface-state", "gamecult.eve.surface.v1", "test-provider", "daemon", "World", 3, "now", ["world", ["root", "world.scene", { title: "World" }, [["child", "text", { value: "Ready" }, [], [], [], {}, {}]], [], [], {}, {}], []], []];

function harness() {
  const sent = [];
  const connections = [];
  const encoded = [];
  const records = new Map([["records/provider", advertisement], ["records/world", surface], ["records/objects", { entities: [1] }], ["records/receipts:cmd-1", ["gamecult.eve.command_receipt.v1", "receipt-1", "cmd-1", "move", "accepted", "Provider", "daemon", "test-provider", "world", "moved", "now", 4]]]);
  const peer = { send: message => sent.push(message), close() {}, on() {} };
  const mesh = {
    createPeerCatalog: () => ({ upsert() {} }), createAuthorityLeaseCatalog: () => ({ upsert() {} }),
    createRudpPeerForAuthorizedPeer: async (...args) => { connections.push(args); return peer; },
    documentFromPublication: (_source, _schema, recordRef) => ({ latest: async () => {
      if (!records.has(recordRef)) throw new Error(`missing ${recordRef}`);
      return records.get(recordRef);
    } }),
    verse: () => ({ context: { routeHint: { transport: "network" } } }),
  };
  const client = new EveCultMeshProviderClient({
    providerId: "test-provider", advertisementRecordRef: "records/provider", peerId: "test-peer",
    verseId: "test.verse", role: "provider", endpoints: ["rudp://127.0.0.1:7777"],
  }, { CultMesh: mesh, encode: value => { encoded.push(value); return Uint8Array.from([value.length]); } }, { runtimeId: "test-runtime" });
  return { client, connections, encoded, sent };
}

test("follows provider-advertised record references", async () => {
  const { client } = harness();
  const provider = await client.providerAdvertisement();
  assert.equal(provider.surfaces[0].recordRef, "records/world");
  assert.equal((await client.surface("world")).surface.id, "world");
  assert.equal((await client.surface("world")).surface.root.children[0].props.value, "Ready");
});

test("submits at the advertised command boundary and reads the advertised receipt", async () => {
  const { client, connections, encoded, sent } = harness();
  const submission = await client.submitCommand({ surfaceId: "world", command: "move", commandId: "cmd-1", payload: { x: 1 } });
  assert.equal(sent[0].document.recordKey, "records/commands:cmd-1");
  assert.equal(sent[0].document.schemaId, "gamecult.eve.command_invocation.v1");
  assert.deepEqual(encoded[0][3], ["move", "", "Network", "commands", "cmd-1"]);
  assert.equal(encoded[0][5][1], 0);
  assert.deepEqual(encoded[0][4], { x: "1" });
  assert.equal(sent[0].document.sourceRole, "eve-runtime");
  assert.equal(connections[0][1], 0x43554c54);
  assert.equal(submission.receiptRecordRef, "records/receipts:cmd-1");
  assert.deepEqual(await client.receipt(submission), {
    schema: "gamecult.eve.command_receipt.v1", receiptId: "receipt-1", commandId: "cmd-1", command: "move",
    state: "accepted", ownerRepo: "Provider", authority: "daemon", providerId: "test-provider", surfaceId: "world",
    message: "moved", issuedAtUtc: "now", sourceVersion: 4,
  });
});

test("resolves embedded documents without provider-specific slot logic", async () => {
  const { client } = harness();
  assert.deepEqual(await client.resolveDocument({ documentId: "records/objects", schemaId: "test.objects.v1" }), {
    documentId: "records/objects", schemaId: "test.objects.v1", document: { entities: [1] },
  });
});

test("resolves nested Eve surfaces as surface projections", async () => {
  const { client } = harness();
  assert.equal((await client.resolveDocument({ documentId: "records/world", schemaId: "gamecult.eve.surface.v1" })).surface.id, "world");
});

test("refuses unadvertised surfaces", async () => {
  const { client } = harness();
  await assert.rejects(() => client.surface("missing"), /does not advertise/);
});
