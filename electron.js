import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Gestione Turni - Punto Vendita',
    autoHideMenuBar: true, // Nasconde la barra File/Edit per un look da gestionale puro
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Carica la build di produzione generata da Vite
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});