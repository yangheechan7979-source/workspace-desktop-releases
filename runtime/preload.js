const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  newWindow: () => ipcRenderer.invoke("new-window"),
  quitForUpdate: () => ipcRenderer.invoke("quit-for-update"),
  export: (data) => ipcRenderer.invoke("export", data),
  saveLocal: (file) => ipcRenderer.invoke("save-local", file),
});
