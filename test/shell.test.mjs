import assert from "node:assert/strict";
import test from "node:test";
import { EveElectronShell } from "../src/eve-electron-shell.mjs";

const advertisement = {
  schema: "gamecult.eve.provider_advertisement.v1",
  providerId: "fixture.world",
  surfaces: [{
    surfaceId: "fixture.world.surface",
    worldInteraction: {
      projectionKind: "provider-authored-world-surface",
      commandBoundary: "fixture.world.commands",
      receiptSchema: "gamecult.eve.command_receipt.v1",
      ownership: "provider-owns-world-state",
    },
  }],
};
const surface = {
  schema: "gamecult.eve.surface.v1",
  surface: { id: "fixture.world.surface", root: { id: "root", kind: "world.scene3d", children: [] } },
};

test("lowers a non-product interactive world and preserves provider command authority", () => {
  const shell = new EveElectronShell({ clientId: "fixture-electron" });
  const projection = shell.lowerSurface(surface, advertisement, "fixture.world.surface");
  assert.equal(projection.providerId, "fixture.world");
  assert.equal(projection.root.shellElementKind, "world-projection-node");
  const command = shell.createCommandIntent(advertisement, "fixture.world.surface", "fixture.world.commands", {});
  assert.equal(command.commandBoundary, "fixture.world.commands");
  assert.equal(command.clientId, "fixture-electron");
});
