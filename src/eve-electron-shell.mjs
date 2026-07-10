export class EveElectronShell {
  constructor({ clientId = "electron-shell" } = {}) {
    this.clientId = clientId;
  }

  selectSurface(providerAdvertisement, requestedSurfaceId = "") {
    const provider = normalizeProviderAdvertisement(providerAdvertisement);
    const surfaces = provider.surfaces;
    const surface = requestedSurfaceId
      ? surfaces.find(candidate => candidate.surfaceId === requestedSurfaceId)
      : surfaces[0];

    if (!surface) {
      throw new Error(`Provider ${provider.providerId} does not advertise surface ${requestedSurfaceId || "(first)"}`);
    }

    return {
      providerId: provider.providerId,
      surfaceId: surface.surfaceId,
      transport: surface.transport || "",
      url: surface.url || surface.key || "",
      worldInteraction: normalizeWorldInteraction(surface.worldInteraction),
    };
  }

  lowerSurface(surfaceDocument, providerAdvertisement, requestedSurfaceId = "") {
    const selected = this.selectSurface(providerAdvertisement, requestedSurfaceId);
    const document = normalizeSurfaceDocument(surfaceDocument);
    if (document.surfaceId !== selected.surfaceId) {
      throw new Error(`Surface document ${document.surfaceId} does not match advertised Electron surface ${selected.surfaceId}.`);
    }

    return {
      type: "electron-shell-projection",
      schema: "gamecult.eve.electron_shell_projection.v1",
      providerId: selected.providerId,
      surfaceId: selected.surfaceId,
      projectionKind: selected.worldInteraction.projectionKind,
      commandBoundary: selected.worldInteraction.commandBoundary,
      receiptSchema: selected.worldInteraction.receiptSchema,
      ownership: selected.worldInteraction.ownership,
      root: buildShellNode(document.root),
    };
  }

  createCommandIntent(providerAdvertisement, requestedSurfaceId, command, payload = {}) {
    if (!command) throw new Error("Command is required.");
    const selected = this.selectSurface(providerAdvertisement, requestedSurfaceId);
    const action = objectValue(payload.action);
    const commandBoundary = firstString(
      selected.worldInteraction.commandBoundary,
      payload.commandBoundary,
      action.commandBoundary,
      action.target,
    );
    const receiptSchema = firstString(
      selected.worldInteraction.receiptSchema,
      payload.receiptSchema,
      action.receiptSchema,
    );

    const intent = {
      type: "surface-command",
      schema: "gamecult.eve.command_invocation.v1",
      providerId: selected.providerId,
      surfaceId: selected.surfaceId,
      command,
      payload: {
        ...payload,
        transport: payload.transport ?? null,
      },
      issuedAt: new Date().toISOString(),
      clientId: this.clientId,
    };

    if (commandBoundary) intent.commandBoundary = commandBoundary;
    if (receiptSchema) intent.receiptSchema = receiptSchema;
    return intent;
  }
}

export function normalizeProviderAdvertisement(providerAdvertisement) {
  if (!providerAdvertisement || typeof providerAdvertisement !== "object") {
    throw new Error("Provider advertisement is required.");
  }
  const providerId = String(providerAdvertisement.providerId || "");
  if (!providerId) throw new Error("Provider advertisement missing providerId.");
  const surfaces = Array.isArray(providerAdvertisement.surfaces)
    ? providerAdvertisement.surfaces
      .filter(surface => surface && typeof surface === "object" && surface.surfaceId)
      .map(surface => ({
        ...surface,
        surfaceId: String(surface.surfaceId),
      }))
    : [];
  if (!surfaces.length) throw new Error(`Provider ${providerId} advertises no surfaces.`);
  return { ...providerAdvertisement, providerId, surfaces };
}

export function normalizeSurfaceDocument(surfaceDocument) {
  if (!surfaceDocument || typeof surfaceDocument !== "object") {
    throw new Error("Surface document is required.");
  }
  if (surfaceDocument.schema !== "gamecult.eve.surface.v1") {
    throw new Error(`Unexpected surface schema: ${surfaceDocument.schema || ""}`);
  }
  const surface = objectValue(surfaceDocument.surface);
  const surfaceId = firstString(surface.id);
  if (!surfaceId) throw new Error("Surface document missing surface.id.");
  const root = objectValue(surface.root);
  if (!root.id) throw new Error(`Surface document ${surfaceId} missing surface.root.`);
  return { ...surfaceDocument, surfaceId, root };
}

function buildShellNode(component) {
  const source = objectValue(component);
  const children = Array.isArray(source.children) ? source.children.map(buildShellNode) : [];
  const embeddedDocuments = normalizeEmbeddedDocuments(source.embeddedDocuments);
  const componentKind = firstString(source.kind);
  const pluginProjection = buildPluginProjection(componentKind, source);
  return {
    id: firstString(source.id),
    componentKind,
    shellElementKind: shellElementKind(componentKind),
    props: objectValue(source.props),
    layout: objectValue(source.layout),
    style: objectValue(source.style),
    stateBindingCount: Array.isArray(source.stateBindings) ? source.stateBindings.length : 0,
    embeddedDocumentCount: embeddedDocuments.length,
    embeddedDocuments,
    ...(pluginProjection ? { pluginProjection } : {}),
    children,
  };
}

function normalizeEmbeddedDocuments(value) {
  return Array.isArray(value)
    ? value
      .filter(document => document && typeof document === "object")
      .map(document => ({
        slotId: firstString(document.slotId, document.id),
        documentId: firstString(document.documentId, document.href, document.url),
        schemaId: firstString(document.schemaId, document.schema),
        presentationKind: firstString(document.presentationKind, document.kind),
      }))
      .filter(document => document.slotId || document.documentId)
    : [];
}

function shellElementKind(componentKind) {
  if (!componentKind) return "empty";
  if (componentKind === "vn.stage") return "sai-vn-stage-shell";
  if (componentKind === "embed.norn") return "norn-graph-shell";
  if (componentKind === "embed.tex") return "tex-math-shell";
  if (componentKind.startsWith("control.")) return "command-control";
  if (componentKind.startsWith("embed.")) return "plugin-placeholder";
  if (componentKind === "surface.slot") return "embedded-surface-slot";
  if (componentKind.startsWith("field.") || componentKind.startsWith("world.")) return "world-projection-node";
  if (componentKind.startsWith("text.") || componentKind === "text" || componentKind === "label") return "text";
  return "shell-node";
}

function buildPluginProjection(componentKind, component) {
  if (componentKind === "vn.stage") {
    return {
      pluginId: "sai.vn",
      projectionKind: "sai-vn-electron-stage-shell",
      abiSchema: "gamecult.eve.plugin_abi.v1",
      commandBoundary: "sidecar-advertised-plugin-abi",
      capabilities: ["vn.stage", "story.choose", "story.continue", "story.jump"],
      documentId: firstString(component.props?.storyId, component.id),
      semanticOwner: "Sai",
      availability: "required",
    };
  }

  if (componentKind === "embed.norn") {
    return {
      pluginId: "norn.graph",
      projectionKind: "norn-graph-electron-overlay-shell",
      abiSchema: "gamecult.eve.plugin_abi.v1",
      commandBoundary: "sidecar-advertised-plugin-abi",
      capabilities: ["embed.norn"],
      documentId: firstString(component.props?.sourceUri, component.props?.documentId, component.id),
      semanticOwner: "Norn",
      availability: "optional-nested",
    };
  }

  if (componentKind === "embed.tex") {
    return {
      pluginId: "tex.math",
      projectionKind: texProjectionKind(component),
      abiSchema: "gamecult.eve.plugin_abi.v1",
      commandBoundary: "sidecar-advertised-plugin-abi",
      capabilities: ["embed.tex", "tex.inline", "tex.block"],
      documentId: firstString(component.props?.sourceUri, component.props?.source, component.id),
      semanticOwner: "EvePlugins",
      availability: "optional-nested",
    };
  }

  return null;
}

function texProjectionKind(component) {
  const display = firstString(component.props?.display, "inline");
  if (display === "block") return "tex-math-electron-block-source-shell";
  if (display === "page") return "tex-math-electron-page-source-shell";
  return "tex-math-electron-inline-source-shell";
}

function normalizeWorldInteraction(value) {
  const source = objectValue(value);
  return {
    projectionKind: firstString(source.projectionKind),
    commandBoundary: firstString(source.commandBoundary),
    receiptSchema: firstString(source.receiptSchema),
    ownership: firstString(source.ownership),
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}
