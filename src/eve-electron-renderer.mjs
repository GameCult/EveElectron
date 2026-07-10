export function createEveElectronRendererTransport(eveProvider, { resolveAssetUrl } = {}) {
  if (!eveProvider) throw new Error("window.eveProvider is required.");
  return {
    providerAdvertisement: () => eveProvider.providerAdvertisement(),
    surface: surface => eveProvider.surface({ surfaceId: surface.surfaceId }),
    submitCommand: intent => eveProvider.submitCommand({
      providerId: intent.providerId,
      surfaceId: intent.surfaceId,
      command: intent.command,
      clientId: intent.clientId,
      issuedAtUtc: intent.issuedAt,
      payload: intent.payload,
    }),
    resolveDocument: request => eveProvider.document(request),
    resolveAssetUrl: resolveAssetUrl || defaultAssetUrl,
  };
}

function defaultAssetUrl(uri) {
  return String(uri || "").startsWith("cultmesh://")
    ? `eve-asset://asset?uri=${encodeURIComponent(uri)}`
    : uri;
}

export async function mountEveElectronProvider({
  EveBrowserProviderHost,
  window: windowObject = globalThis.window,
  document: documentObject = globalThis.document,
  hostSelector = "#eve-surface-host",
  statusSelector = "#status",
  clientId = "eve-electron-client",
  pollMs = 250,
  source = "CultMesh provider",
  resolveAssetUrl,
} = {}) {
  if (typeof EveBrowserProviderHost !== "function") throw new Error("EveBrowserProviderHost is required.");
  const host = requiredElement(documentObject, hostSelector);
  const status = requiredElement(documentObject, statusSelector);
  const requestedSurfaceId = new URLSearchParams(windowObject.location.search).get("surface") || "";
  const transport = createEveElectronRendererTransport(windowObject.eveProvider, { resolveAssetUrl });
  const providerHost = new EveBrowserProviderHost(host, {
    ...transport,
    submitCommand: async intent => {
      try {
        const receipt = await transport.submitCommand(intent);
        status.textContent = `${intent.command}: ${receipt?.accepted === false ? "rejected" : receipt?.state || "submitted"}`;
        return receipt;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : `Failed to submit ${intent.command}.`;
        throw error;
      }
    },
  }, {
    body: documentObject.body,
    clientId,
    pollMs,
    requestedSurfaceId,
    source,
    statusElement: status,
  });
  documentObject.body.classList.add("eve-game-mode");
  await providerHost.start();
  wireWindowControls(documentObject, windowObject.eveProvider);
  new windowObject.MutationObserver(() => wireWindowControls(documentObject, windowObject.eveProvider))
    .observe(host, { childList: true, subtree: true });
  return providerHost;
}

function wireWindowControls(documentObject, eveProvider) {
  documentObject.querySelectorAll("[data-window-control]").forEach(button => {
    if (button.dataset.windowControlWired === "true") return;
    button.dataset.windowControlWired = "true";
    button.addEventListener("click", () => {
      if (button.dataset.windowControl) void eveProvider.windowControl(button.dataset.windowControl);
    });
  });
}

function requiredElement(documentObject, selector) {
  const element = documentObject.querySelector(selector);
  if (!element) throw new Error(`EveElectron renderer is missing ${selector}.`);
  return element;
}
