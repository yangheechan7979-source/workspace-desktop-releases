const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
let localServer, appUrl;
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) { if (window.isMinimized()) window.restore();window.focus(); }
});
app.setName("Workspace");
app.setAppUserModelId("Workspace.Desktop.GreenW");
function isAuthPopupUrl(url) {
  if (url === "about:blank") return true;
  try {
    const host = new URL(url).hostname;
    return [
      "accounts.google.com",
      "the-workspace-659e5.firebaseapp.com",
      "the-workspace-659e5.web.app",
    ].includes(host) || host === "localhost" || host.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}
function create() {
  const w = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    title: "Workspace",
    icon: path.join(__dirname, process.platform === 'darwin' ? 'app.png' : 'app.ico'),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  w.setMenuBarVisibility(false);
  w.loadURL(appUrl);
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopupUrl(url)) return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 520,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      },
    };
    return { action: "deny" };
  });
  w.webContents.on("did-create-window", (child) => {
    child.webContents.on("will-navigate", (event, url) => {
      if (!isAuthPopupUrl(url)) event.preventDefault();
    });
  });
  w.webContents.on("will-navigate", (e) => e.preventDefault());
}
function startLocalServer() {
  return new Promise((resolve) => {
    localServer = http.createServer((request, response) => {
      const rawPath = new URL(request.url, "http://localhost").pathname;
      const safePath = rawPath === "/" ? "index.html" : decodeURIComponent(rawPath).replace(/^\/+/, "");
      const file = path.resolve(__dirname, safePath);
      if (!file.startsWith(__dirname + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon" };
      fs.readFile(file, (error, data) => {
        if (error) response.writeHead(404).end();
        else response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }).end(data);
      });
    });
    const portFile = path.join(app.getPath('userData'), 'workspace-port.json');
    let preferredPort = 18746;
    try {
      const savedPort = JSON.parse(fs.readFileSync(portFile, 'utf8')).port;
      if (Number.isInteger(savedPort) && savedPort > 1024 && savedPort < 65536) preferredPort = savedPort;
    } catch {}
    localServer.once('error', error => {
      if (error.code === 'EADDRINUSE') localServer.listen(0, '127.0.0.1');
      else { dialog.showErrorBox('Workspace', error.message);app.quit(); }
    });
    localServer.once('listening', () => {
      fs.mkdirSync(path.dirname(portFile), {recursive:true});
      fs.writeFileSync(portFile, JSON.stringify({port:localServer.address().port}));
      appUrl = `http://localhost:${localServer.address().port}/index.html`;
      resolve();
    });
    localServer.listen(preferredPort, '127.0.0.1');
  });
}
app.whenReady().then(async () => {
  if (!ownsInstance) return;
  await startLocalServer();
  create();
});
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => localServer?.close());
ipcMain.handle("new-window", () => create());
ipcMain.handle('quit-for-update', async event => {
  if (!event.sender.getURL().startsWith(appUrl)) throw Error('잘못된 종료 요청입니다.');
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents.id !== event.sender.id && window.webContents.getURL().startsWith(appUrl)) {
      await window.webContents.executeJavaScript('window.prepareWorkspaceUpdate()');
    }
  }
  setTimeout(() => app.quit(), 100);
  return true;
});
ipcMain.handle("export", async (_, data) => {
  const r = await dialog.showSaveDialog({
    defaultPath: "workspace-backup.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!r.canceled) require("fs").writeFileSync(r.filePath, data);
  return !r.canceled;
});
ipcMain.handle("save-local", async (_, file) => {
  const extension = file.richBody ? "json" : file.type === "note" || file.type === "idea" ? "md" : file.type === "pdf" ? "pdf" : "json";
  const result = await dialog.showSaveDialog({
    defaultPath: `${String(file.name || "workspace").replace(/[\\/:*?"<>|]/g, "-")}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (result.canceled) return false;
  const content = file.type === "pdf" && file.data
    ? Buffer.from(file.data.split(",")[1] || "", "base64")
    : !file.richBody && (file.type === "note" || file.type === "idea")
      ? `# ${file.name}\n\n${file.body || ""}`
      : JSON.stringify(file, null, 2);
  fs.writeFileSync(result.filePath, content);
  return true;
});
