import type { BrowserWindow, BrowserWindowConstructorOptions, IpcMain, Shell } from "electron";

export declare class EveCultMeshProviderClient {
  constructor(target: object, dependencies: { CultMesh: object; encode: (value: unknown) => Uint8Array }, options?: { runtimeId?: string; timeoutMs?: number });
  close(): Promise<void>;
  providerAdvertisement(): Promise<object>;
  surface(surfaceId?: string): Promise<object>;
  document(request: { schemaId: string; recordRef: string }): Promise<unknown>;
  submitCommand(request: object): Promise<object>;
  receipt(submission: object): Promise<unknown>;
}

export declare function normalizeProviderAdvertisement(value: unknown): object;
export declare function normalizeSurfaceDocument(value: unknown): object;

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
