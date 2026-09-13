const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  newWindow: () => ipcRenderer.invoke("new-window"),
  openMiniClock: state => ipcRenderer.invoke('mini-open',state),
  updateMiniClock: state => ipcRenderer.send('mini-update',state),
  closeMiniClock: () => ipcRenderer.send('mini-close'),
  miniAction: action => ipcRenderer.send('mini-action',action),
  miniReady: () => ipcRenderer.send('mini-ready'),
  onMiniState: callback => { const listener=(_,state)=>callback(state);ipcRenderer.on('mini-state',listener);return ()=>ipcRenderer.removeListener('mini-state',listener); },
  onMiniAction: callback => { const listener=(_,action)=>callback(action);ipcRenderer.on('mini-owner-action',listener);return ()=>ipcRenderer.removeListener('mini-owner-action',listener); },
  quitForUpdate: () => ipcRenderer.invoke("quit-for-update"),
  openDownload: () => ipcRenderer.invoke("open-download"),
  export: (data) => ipcRenderer.invoke("export", data),
  saveLocal: (file) => ipcRenderer.invoke("save-local", file),
});
