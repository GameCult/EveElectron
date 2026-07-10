export declare function createEveElectronRendererTransport(eveProvider: Record<string, (...args: any[]) => Promise<any>>, options?: { resolveAssetUrl?: (uri: string) => string }): Record<string, any>;
export declare function mountEveElectronProvider(options: {
  EveBrowserProviderHost: new (...args: any[]) => { start(): Promise<void> };
  window?: Window & { eveProvider: Record<string, (...args: any[]) => Promise<any>> };
  document?: Document;
  hostSelector?: string;
  statusSelector?: string;
  clientId?: string;
  pollMs?: number;
  source?: string;
  resolveAssetUrl?: (uri: string) => string;
}): Promise<{ start(): Promise<void> }>;
