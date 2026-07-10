import assert from "node:assert/strict";
import test from "node:test";
import { createEveElectronWindow, registerEveWindowControls } from "../src/window-host.mjs";

test("creates a secure provider-agnostic Eve window", () => {
  let options;
  let opened;
  class BrowserWindow {
    constructor(value) {
      options = value;
      this.webContents = { setWindowOpenHandler: handler => { this.handler = handler; } };
      BrowserWindow.instance = this;
    }
  }
  createEveElectronWindow({ title: "Fixture", preload: "preload.cjs", show: false }, {
    BrowserWindow,
    shell: { openExternal: url => { opened = url; } },
  });
  assert.equal(options.title, "Fixture");
  assert.equal(options.show, false);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.deepEqual(BrowserWindow.instance.handler({ url: "https://example.test" }), { action: "deny" });
  assert.equal(opened, "https://example.test");
});

test("routes window controls through one generic handler", () => {
  const calls = [];
  let handler;
  const window = {
    minimize: () => calls.push("minimize"),
    maximize: () => calls.push("maximize"),
    unmaximize: () => calls.push("unmaximize"),
    close: () => calls.push("close"),
    isMaximized: () => false,
  };
  const ipcMain = {
    handle: (_channel, value) => { handler = value; },
    removeHandler: () => calls.push("removed"),
  };
  const BrowserWindow = { fromWebContents: () => window };
  const dispose = registerEveWindowControls(ipcMain, BrowserWindow);
  handler({ sender: {} }, "minimize");
  handler({ sender: {} }, "maximize");
  handler({ sender: {} }, "close");
  dispose();
  assert.deepEqual(calls, ["minimize", "maximize", "close", "removed"]);
});
