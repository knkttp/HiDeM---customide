const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hidemDesktop', {
  isElectron: true,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  openFilesDialog: () => ipcRenderer.invoke('dialog:open-files'),
  saveFileDialog: (payload) => ipcRenderer.invoke('dialog:save-file', payload),
  saveFileDirect: (payload) => ipcRenderer.invoke('fs:save-direct', payload),
  backupWorkspaceFile: (payload) => ipcRenderer.invoke('fs:backup-workspace', payload),
  executeCode: (payload) => ipcRenderer.invoke('code:execute', payload),
});
