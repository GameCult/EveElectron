# EveElectron

EveElectron is the generic Electron lowering runtime for Eve/CultUI surfaces.
It owns secure window construction, the narrow provider preload bridge, shell
projection, command-intent emission, runtime packaging, and capture evidence.

Providers supply advertisements, surface and embedded-document reads, command
submission, asset resolution, and any product daemon lifecycle. EveElectron
does not import provider state or plugin semantic implementations.

```powershell
npm install
npm test
npm run pack:check
npm run capture:conformance
```

The capture runner uses EveElectron's development Electron dependency and emits
native offscreen-painted PNGs plus `gamecult.eve.runtime_witness.v1` documents.
The generic control comes from Eve; the Aetheria case comes from Aetheria's
provider-owned conformance pack. Provider state remains input data; the runtime
owns the window, projection, pixels, and evidence.
