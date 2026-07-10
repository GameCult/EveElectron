const { contextBridge, ipcRenderer } = require("electron");
const { installEveProviderBridge } = require("./eve-provider-preload.cjs");

installEveProviderBridge({ contextBridge, ipcRenderer });
