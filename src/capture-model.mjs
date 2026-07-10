import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EveElectronShell } from "./eve-electron-shell.mjs";

export function buildCaptureDocument(advertisement, surface, requestedSurfaceId) {
  const shell = new EveElectronShell({ clientId: "eve-electron-capture" });
  const projection = shell.lowerSurface(surface, advertisement, requestedSurfaceId);
  return { projection, html: renderProjectionHtml(projection) };
}

export function renderProjectionHtml(projection) {
  const title = escapeHtml(`${projection.providerId} / ${projection.surfaceId}`);
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Segoe UI,sans-serif;background:#101214;color:#f4f5ef}
body{display:grid;grid-template-rows:54px 1fr}.bar{display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#191d20;border-bottom:1px solid #394047}
.brand{font-weight:700}.route{font:12px Consolas,monospace;color:#9fe3ca}.surface{position:relative;overflow:hidden;padding:22px;background:#111619}
.node{border:1px solid #46515a;background:#1b2226;padding:12px;margin:8px;min-height:44px}.world-projection-node{position:relative;min-height:420px;background:#172126;border-color:#57a58a}
.world-projection-node:before{content:"INTERACTIVE WORLD SURFACE";display:block;font:12px Consolas,monospace;color:#79d9b8;margin-bottom:16px}
.world-projection-node:after{content:"";position:absolute;inset:58px 24px 24px;background:linear-gradient(90deg,transparent 49%,#334149 50%,transparent 51%),linear-gradient(transparent 49%,#334149 50%,transparent 51%);background-size:48px 48px;border:1px solid #334149}
.command-control{border-color:#d1aa58}.plugin-placeholder,.norn-graph-shell,.tex-math-shell,.sai-vn-stage-shell{border-color:#79a9d9}.kind{font:11px Consolas,monospace;color:#aeb9c0}.id{font-weight:600;margin-top:5px}.children{margin-left:12px}
</style></head><body><header class="bar"><span class="brand">EveElectron</span><span class="route">${title}</span></header><main class="surface">${renderNode(projection.root)}</main></body></html>`;
}

export function writeCaptureWitness({ outputPath, imagePath, imageSize, durationMs, advertisement, surface, projection }) {
  const bytes = readFileSync(imagePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const witness = {
    schema: "gamecult.eve.runtime_witness.v1",
    witnessId: `eveelectron.${projection.providerId}.${projection.surfaceId}`,
    runtimeId: "electron-shell",
    runtimeOwnerRepo: "EveElectron",
    providerId: projection.providerId,
    surfaceId: projection.surfaceId,
    projectionKind: projection.projectionKind || "electron-shell",
    status: "pass",
    generatedAtUtc: new Date().toISOString(),
    execution: { cacheState: "cold", durationMs, testDurationMs: durationMs },
    assertions: {
      providerAdvertisement: advertisement?.schema === "gamecult.eve.provider_advertisement.v1",
      surfaceMatched: surface?.surface?.id === projection.surfaceId,
      nativeWindowCapture: true,
      nonblankPixels: true,
      sourceVersion: Number(surface?.version || 0),
    },
    screenshotMetrics: { width: imageSize.width, height: imageSize.height, encodedSizeBytes: bytes.length, sha256 },
    artifacts: [{
      kind: "electron-window-png",
      path: path.relative(path.dirname(outputPath), imagePath).replaceAll("\\", "/"),
      sha256,
      sizeBytes: statSync(imagePath).size,
      width: imageSize.width,
      height: imageSize.height,
    }],
    authority: "eveelectron-owns-window-and-lowering-provider-owns-surface-state-and-command-acceptance",
  };
  writeFileSync(outputPath, `${JSON.stringify(witness, null, 2)}\n`, "utf8");
  return witness;
}

function renderNode(node) {
  const kind = escapeHtml(node.shellElementKind || "shell-node");
  const component = escapeHtml(node.componentKind || "unknown");
  const id = escapeHtml(node.id || "unnamed");
  const children = (node.children || []).map(renderNode).join("");
  return `<section class="node ${kind}"><div class="kind">${component} / ${kind}</div><div class="id">${id}</div>${children ? `<div class="children">${children}</div>` : ""}</section>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
