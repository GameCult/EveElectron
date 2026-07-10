const providerSchema = "gamecult.eve.provider_advertisement.v1";
const commandSchema = "gamecult.eve.command.v1";
const connectionId = 0x45564545;

export class EveCultMeshProviderClient {
  #peer = null;

  constructor(target, dependencies, options = {}) {
    this.target = normalizeTarget(target);
    this.mesh = requireFunctionSet(dependencies?.CultMesh, [
      "createAuthorityLeaseCatalog",
      "createPeerCatalog",
      "createRudpPeerForAuthorizedPeer",
      "documentFromPublication",
      "verse",
    ], "CultMesh");
    if (typeof dependencies?.encode !== "function") throw new Error("A MessagePack encode function is required.");
    this.encode = dependencies.encode;
    this.runtimeId = options.runtimeId || "eve-electron";
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.context = this.mesh.verse("eve.remote", this.runtimeId).context;
  }

  async close() {
    this.#peer?.close();
    this.#peer = null;
  }

  async providerAdvertisement() {
    const value = await this.#document(providerSchema, this.target.advertisementRecordRef, "provider");
    const advertisement = normalizeProviderAdvertisement(value);
    if (this.target.providerId && advertisement.providerId !== this.target.providerId) {
      throw new Error(`Resolved provider ${advertisement.providerId} does not match ${this.target.providerId}.`);
    }
    return advertisement;
  }

  async surface(surfaceId = "") {
    const advertisement = await this.providerAdvertisement();
    const advertised = selectSurface(advertisement, surfaceId);
    const document = normalizeSurfaceDocument(await this.#document(advertised.schema, advertised.recordRef, "surface"));
    if (document.surface.id !== advertised.surfaceId) {
      throw new Error(`Surface record ${advertised.recordRef} published ${document.surface.id}, expected ${advertised.surfaceId}.`);
    }
    return document;
  }

  async document({ schemaId, recordRef }) {
    if (!schemaId || !recordRef) throw new Error("Embedded documents require schemaId and recordRef.");
    return this.#document(schemaId, recordRef, "embedded-document");
  }

  async submitCommand(request) {
    const advertisement = await this.providerAdvertisement();
    const surface = selectSurface(advertisement, request?.surfaceId);
    const interaction = surface.worldInteraction;
    if (!interaction?.commandRecordRef) throw new Error(`Surface ${surface.surfaceId} advertises no command record reference.`);
    const command = String(request?.command || "").trim();
    if (!command) throw new Error("Command is required.");
    const issuedAtUtc = request.issuedAtUtc || new Date().toISOString();
    const commandId = request.commandId || `${this.runtimeId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
    const payload = [commandSchema, commandId, advertisement.providerId, surface.surfaceId, command, issuedAtUtc, request.clientId || this.runtimeId, objectValue(request.payload)];
    const peer = await this.#getPeer();
    peer.send({
      schemaVersion: "cultnet.document_put_raw.v0",
      messageId: commandId,
      document: {
        schemaId: commandSchema,
        recordKey: childRecordRef(interaction.commandRecordRef, commandId),
        storedAt: issuedAtUtc,
        payloadEncoding: "messagepack",
        payload: this.encode(payload),
        sourceRuntimeId: this.runtimeId,
        sourceRole: "eve-runtime",
        tags: ["eve", "surface-command"],
      },
    });
    return {
      commandId,
      providerId: advertisement.providerId,
      surfaceId: surface.surfaceId,
      state: "submitted",
      receiptSchema: interaction.receiptSchema,
      receiptRecordRef: interaction.receiptRecordRef
        ? childRecordRef(interaction.receiptRecordRef, commandId)
        : "",
    };
  }

  async receipt(submission) {
    if (!submission?.receiptSchema || !submission?.receiptRecordRef) {
      throw new Error("The command submission has no advertised receipt location.");
    }
    return this.#document(submission.receiptSchema, submission.receiptRecordRef, "receipt");
  }

  async #document(schemaId, recordRef, kind) {
    const handle = this.mesh.documentFromPublication(
      { kind: "peer-snapshot", peer: () => this.#getPeer(), endpoint: this.#endpoint() },
      schemaId,
      recordRef,
      {
        documentId: recordRef,
        routeHint: this.context.routeHint,
        sourceId: recordRef,
        timeoutMs: this.timeoutMs,
        pollMs: 100,
        messageIdPrefix: `${this.runtimeId}:${kind}`,
      },
    );
    return handle.latest(this.context);
  }

  async #getPeer() {
    if (this.#peer) return this.#peer;
    const peers = this.mesh.createPeerCatalog();
    const leases = this.mesh.createAuthorityLeaseCatalog();
    const leaseId = `${this.target.peerId}:authority`;
    peers.upsert({ peerId: this.target.peerId, verseId: this.target.verseId, endpoints: this.target.endpoints, roles: [this.target.role], authorityLeaseId: leaseId });
    leases.upsert({ leaseId, verseId: this.target.verseId, peerId: this.target.peerId, roles: [this.target.role], validFrom: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() + 60000) });
    this.#peer = await this.mesh.createRudpPeerForAuthorizedPeer(this.runtimeId, connectionId, peers, leases, this.target.verseId, this.target.role, { connectTimeoutMs: this.timeoutMs, maxFragmentBytes: 1200, maxPendingReliablePackets: 512 });
    this.#peer.on?.("close", () => { this.#peer = null; });
    return this.#peer;
  }

  #endpoint() {
    const endpoint = this.target.endpoints.find(value => value.toLowerCase().startsWith("rudp://"));
    if (!endpoint) throw new Error(`Provider ${this.target.providerId || this.target.peerId} has no Odin-resolved RUDP endpoint.`);
    return endpoint;
  }
}

export function normalizeProviderAdvertisement(value) {
  const providerId = stringField(value, "providerId", 1);
  if (!providerId) throw new Error("Provider advertisement is missing providerId.");
  const surfaces = arrayField(value, "surfaces", 11).map(normalizeAdvertisedSurface).filter(surface => surface.surfaceId);
  return {
    schema: stringField(value, "schema", 0), providerId,
    serviceId: stringField(value, "serviceId", 2), verseId: stringField(value, "verseId", 3),
    title: stringField(value, "title", 4), kind: stringField(value, "kind", 5),
    cultMeshAddress: stringField(value, "cultMeshAddress", 6), surfaces,
  };
}

export function normalizeSurfaceDocument(value) {
  const portable = stringField(value, "schema", 1) === "gamecult.eve.surface.v1";
  const surface = field(value, "surface", portable ? 7 : 5);
  const id = stringField(surface, "id", 0);
  if (!id) throw new Error("Eve surface document is missing surface.id.");
  return {
    schema: "gamecult.eve.surface.v1",
    providerId: stringField(value, "providerId", portable ? 2 : 0),
    providerKind: stringField(value, "providerKind", portable ? 3 : 1),
    title: stringField(value, "title", portable ? 4 : 2),
    version: numberField(value, "version", portable ? 5 : 3),
    updatedAtUtc: stringField(value, "updatedAtUtc", portable ? 6 : 4),
    surface: { id, root: field(surface, "root", 1), styles: arrayField(surface, "styles", 2) },
    commands: arrayField(value, "commands", portable ? 8 : 6),
  };
}

function normalizeAdvertisedSurface(value) {
  const interaction = field(value, "worldInteraction", 6);
  return {
    surfaceId: stringField(value, "surfaceId", 0), schema: stringField(value, "schema", 1),
    recordRef: stringField(value, "recordRef", 2), transport: stringField(value, "transport", 3),
    status: stringField(value, "status", 4), surfaceKind: stringField(value, "surfaceKind", 5),
    worldInteraction: interaction ? {
      projectionKind: stringField(interaction, "projectionKind", 0),
      stateSchemas: arrayField(interaction, "stateSchemas", 1),
      commandBoundary: stringField(interaction, "commandBoundary", 2),
      commandRecordRef: stringField(interaction, "commandRecordRef", 3),
      receiptSchema: stringField(interaction, "receiptSchema", 4),
      receiptRecordRef: stringField(interaction, "receiptRecordRef", 5),
      assetManifestRecordRef: stringField(interaction, "assetManifestRecordRef", 6),
      loweringTargets: arrayField(interaction, "loweringTargets", 7), ownership: stringField(interaction, "ownership", 8),
    } : null,
  };
}

function selectSurface(advertisement, surfaceId) {
  const selected = surfaceId ? advertisement.surfaces.find(value => value.surfaceId === surfaceId) : advertisement.surfaces[0];
  if (!selected) throw new Error(`Provider ${advertisement.providerId} does not advertise surface ${surfaceId || "(first)"}.`);
  if (selected.transport !== "cultmesh-record" || !selected.recordRef) throw new Error(`Surface ${selected.surfaceId} is not a readable CultMesh record.`);
  return selected;
}

function normalizeTarget(value) {
  if (!value?.advertisementRecordRef) throw new Error("An Odin-resolved advertisementRecordRef is required.");
  return { providerId: String(value.providerId || ""), advertisementRecordRef: String(value.advertisementRecordRef), peerId: String(value.peerId || "provider"), verseId: String(value.verseId || "provider"), role: String(value.role || "provider"), endpoints: Array.isArray(value.endpoints) ? value.endpoints.map(String) : [] };
}

function childRecordRef(parent, child) { return `${String(parent).replace(/\/$/u, "")}/${encodeURIComponent(child)}`; }
function field(value, name, slot) { return value && typeof value === "object" ? (value[name] ?? value[slot]) : undefined; }
function stringField(value, name, slot) { const result = field(value, name, slot); return typeof result === "string" ? result : ""; }
function numberField(value, name, slot) { const result = field(value, name, slot); return typeof result === "number" && Number.isFinite(result) ? result : 0; }
function arrayField(value, name, slot) { const result = field(value, name, slot); return Array.isArray(result) ? result : []; }
function objectValue(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function requireFunctionSet(value, names, label) { if (!value) throw new Error(`${label} is required.`); for (const name of names) if (typeof value[name] !== "function") throw new Error(`${label}.${name} is required.`); return value; }
