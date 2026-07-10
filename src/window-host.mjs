export const defaultWindowControlChannel = "eve-electron:window-control";

export function createEveElectronWindow(options = {}, electron) {
  const { BrowserWindow, shell } = requiredElectron(electron);
  const window = new BrowserWindow({
    width: options.width ?? 1440,
    height: options.height ?? 900,
    minWidth: options.minWidth ?? 800,
    minHeight: options.minHeight ?? 560,
    show: options.show ?? true,
    backgroundColor: options.backgroundColor ?? "#101214",
    title: options.title ?? "Eve",
    frame: options.frame ?? false,
    autoHideMenuBar: options.autoHideMenuBar ?? true,
    ...(options.browserWindow ?? {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: options.sandbox ?? false,
      preload: options.preload,
      ...(options.webPreferences ?? {}),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (options.openExternal !== false) void shell.openExternal(url);
    return { action: "deny" };
  });
  return window;
}

export function registerEveWindowControls(ipcMain, BrowserWindow, channel = defaultWindowControlChannel) {
  ipcMain.handle(channel, (event, action) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    else if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === "close") window.close();
    else throw new Error(`Unknown Eve window control '${action}'.`);
  });
  return () => ipcMain.removeHandler(channel);
}

function requiredElectron(electron) {
  if (!electron?.BrowserWindow || !electron?.shell) {
    throw new Error("Electron BrowserWindow and shell are required.");
  }
  return electron;
}
