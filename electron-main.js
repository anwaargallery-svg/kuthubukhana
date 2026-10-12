const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = process.env.PORT || 5000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Check if backend server is already running
function checkServerRunning(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/api/health`, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1200, () => {
            req.abort();
            resolve(false);
        });
    });
}

// Start backend server child process if needed
async function ensureBackendServer() {
    const isRunning = await checkServerRunning(SERVER_PORT);
    if (isRunning) {
        console.log(`[PC-App] Backend server is already running on ${SERVER_URL}`);
        return true;
    }

    console.log(`[PC-App] Launching internal backend server on port ${SERVER_PORT}...`);
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = fork(serverPath, [], {
        cwd: __dirname,
        env: { ...process.env, PORT: SERVER_PORT },
        stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
        console.error('[PC-App] Failed to start backend server:', err);
    });

    // Wait until server is up
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 300));
        const ready = await checkServerRunning(SERVER_PORT);
        if (ready) {
            console.log(`[PC-App] Internal backend server started successfully.`);
            return true;
        }
    }
    return false;
}

function createMainWindow() {
    const appIcon = path.join(__dirname, 'assets', 'images', 'app-icon.ico');
    const fallbackIcon = path.join(__dirname, 'assets', 'images', 'image.png');
    const windowIcon = fs.existsSync(appIcon) ? appIcon : fallbackIcon;

    mainWindow = new BrowserWindow({
        width: 1300,
        height: 860,
        minWidth: 950,
        minHeight: 650,
        title: 'Kuthbukhana Anwariyya - Library Management System',
        icon: windowIcon,
        backgroundColor: '#f8fafc',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
        }
    });

    // Build Native Menu
    const template = [
        {
            label: 'Library Nav',
            submenu: [
                {
                    label: '🏠 Home Screen',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => mainWindow.loadURL(`${SERVER_URL}/index.html`)
                },
                {
                    label: '👑 Principal Executive Portal',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => mainWindow.loadURL(`${SERVER_URL}/assets/subpages/lead/principal/principal.html`)
                },
                {
                    label: '🛠️ Admin Dashboard',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => mainWindow.loadURL(`${SERVER_URL}/assets/subpages/lead/admin/admin.html`)
                },
                {
                    label: '📱 Fast Data Entry (Multi-Device)',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => mainWindow.loadURL(`${SERVER_URL}/assets/subpages/data-entry.html`)
                },
                {
                    label: '📖 Open Library Search',
                    click: () => mainWindow.loadURL(`${SERVER_URL}/assets/subpages/openlibrary.html`)
                },
                { type: 'separator' },
                {
                    label: '❌ Exit App',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload', label: '🔄 Refresh (Reload)', accelerator: 'F5' },
                { role: 'forceReload', label: 'Hard Reload', accelerator: 'Ctrl+F5' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Fullscreen (F11)' },
                { role: 'toggleDevTools', label: 'Developer Console' }
            ]
        },
        {
            label: 'Help & Network',
            submenu: [
                {
                    label: '🌐 Open in Web Browser',
                    click: () => shell.openExternal(SERVER_URL)
                },
                {
                    label: 'ℹ️ About Kuthbukhana Anwariyya',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Kuthbukhana Anwariyya',
                            message: 'Kuthbukhana Anwariyya - Library Management System',
                            detail: `Dedicated Desktop & Multi-Device Hybrid System.\nLocal Server: ${SERVER_URL}\nSupports simultaneous multi-phone and computer data entry.`
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.loadURL(SERVER_URL);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(async () => {
    await ensureBackendServer();
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) {
            try {
                serverProcess.kill();
            } catch (e) {}
        }
        app.quit();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        try {
            serverProcess.kill();
        } catch (e) {}
    }
});
