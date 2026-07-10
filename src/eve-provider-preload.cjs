const defaultChannels = Object.freeze({
  providerAdvertisement: "eve:provider-advertisement",
  surface: "eve:surface",
  document: "eve:embedded-document",
  submitCommand: "eve:submit-command",
  windowControl: "eve-electron:window-control",
});

function installEveProviderBridge({ contextBridge, ipcRenderer, namespace = "eveProvider", channels = {} }) {
  if (!contextBridge?.exposeInMainWorld || !ipcRenderer?.invoke) {
    throw new Error("Electron contextBridge and ipcRenderer are required.");
  }
  const names = { ...defaultChannels, ...channels };
  const api = Object.freeze({
    providerAdvertisement: request => ipcRenderer.invoke(names.providerAdvertisement, request),
    surface: request => ipcRenderer.invoke(names.surface, request),
    document: request => ipcRenderer.invoke(names.document, request),
    submitCommand: request => ipcRenderer.invoke(names.submitCommand, request),
    windowControl: action => ipcRenderer.invoke(names.windowControl, action),
  });
  contextBridge.exposeInMainWorld(namespace, api);
  return api;
}

module.exports = { defaultChannels, installEveProviderBridge };
