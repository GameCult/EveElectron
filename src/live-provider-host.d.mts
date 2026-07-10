export declare const eveProviderIpcChannels: Readonly<Record<string, string>>;
export declare function registerEveProviderIpc(ipcMain: any, client: any, options?: { receiptTimeoutMs?: number }): () => void;
export declare function startEveElectronProviderHost(options: any): Promise<{ client: any; close(): Promise<void>; window: any }>;
