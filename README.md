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
```
