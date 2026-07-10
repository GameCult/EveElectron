export interface EveCultMeshProviderTarget {
  providerId?: string;
  advertisementRecordRef: string;
  peerId?: string;
  verseId?: string;
  role?: string;
  endpoints?: string[];
}

export interface EveCommandSubmission extends Record<string, unknown> {
  commandId: string;
  providerId: string;
  surfaceId: string;
  state: "submitted";
  receiptSchema: string;
  receiptRecordRef: string;
}

export declare class EveCultMeshProviderClient {
  constructor(target: EveCultMeshProviderTarget, dependencies: { CultMesh: object; encode: (value: unknown) => Uint8Array }, options?: { runtimeId?: string; timeoutMs?: number });
  close(): Promise<void>;
  providerAdvertisement(): Promise<Record<string, unknown>>;
  surface(surfaceId?: string): Promise<Record<string, unknown>>;
  document(request: { schemaId: string; recordRef: string }): Promise<unknown>;
  resolveDocument(request: { documentId: string; schemaId: string }): Promise<{ documentId: string; schemaId: string; document?: unknown; surface?: Record<string, unknown> }>;
  asset(uri: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
  submitCommand(request: Record<string, unknown>): Promise<EveCommandSubmission>;
  receipt(submission: Record<string, unknown>): Promise<unknown>;
}

export declare function normalizeProviderAdvertisement(value: unknown): Record<string, unknown>;
export declare function normalizeSurfaceDocument(value: unknown): Record<string, unknown>;
export declare function normalizeCommandReceipt(value: unknown): Record<string, unknown>;
