import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptureDocument } from "../src/capture-model.mjs";

test("builds an owner-rendered capture document from a generic provider", () => {
  const advertisement = {
    schema: "gamecult.eve.provider_advertisement.v1",
    providerId: "fixture",
    surfaces: [{ surfaceId: "fixture.world", worldInteraction: { projectionKind: "provider-authored-world-surface" } }],
  };
  const surface = { schema: "gamecult.eve.surface.v1", surface: { id: "fixture.world", root: { id: "root", kind: "world.scene3d", children: [] } } };
  const result = buildCaptureDocument(advertisement, surface, "fixture.world");
  assert.equal(result.projection.providerId, "fixture");
  assert.match(result.html, /INTERACTIVE WORLD SURFACE/);
  assert.match(result.html, /EveElectron/);
});
