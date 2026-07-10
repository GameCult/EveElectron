import type { BrowserWindow, BrowserWindowConstructorOptions, IpcMain, Shell } from "electron";

export * from "./cultmesh-provider-client.js";

export interface EveElectronWindowOptions extends BrowserWindowConstructorOptions {
  browserWindow?: BrowserWindowConstructorOptions;
  openExternal?: boolean;
  preload?: string;
  sandbox?: boolean;
  webPreferences?: BrowserWindowConstructorOptions["webPreferences"];
}

export declare const defaultWindowControlChannel: string;
export declare function createEveElectronWindow(
  options: EveElectronWindowOptions,
  electron: { BrowserWindow: typeof BrowserWindow; shell: Shell },
): BrowserWindow;
export declare function registerEveWindowControls(
  ipcMain: IpcMain,
  BrowserWindow: typeof import("electron").BrowserWindow,
  channel?: string,
): () => void;

export declare class EveElectronShell {
  constructor(options?: { clientId?: string });
  selectSurface(providerAdvertisement: object, requestedSurfaceId?: string): object;
  lowerSurface(surfaceDocument: object, providerAdvertisement: object, requestedSurfaceId?: string): object;
  createCommandIntent(providerAdvertisement: object, requestedSurfaceId: string, command: string, payload?: object): object;
}
