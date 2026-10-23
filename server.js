const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Path to data file
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DEFAULT_CLOUD_URL = 'https://kuthubukhana.onrender.com';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Environment Detection
function isCloudServer() {
    return !!(
        process.env.RENDER ||
        process.env.RENDER_SERVICE_ID ||
        process.env.PORT === '10000' ||
        process.env.PORT === 10000 ||
        process.env.NODE_ENV === 'production'
    );
}

function isCurrentServerUrl(urlStr) {
    if (!urlStr) return true;
    try {
        const u = new URL(urlStr);
        if (isCloudServer() && (u.hostname.includes('render.com') || u.hostname.includes('kuthubukhana'))) {
            return true;
        }
    } catch (e) {}
    return false;
}

// Initial Database Structure
const initialData = {
    version: 1,
    lastUpdated: Date.now(),
    passwords: {
        admin: 'admin123',
        principal: 'principal123',
        staff: 'staff123'
    },
    librarians: [
        {
            id: 'lib_1',
            username: 'admin',
            password: 'admin123',
            name: 'Chief Librarian',
            role: 'admin',
            createdAt: 1729600000000
        },
        {
            id: 'lib_2',
            username: 'librarian',
            password: 'password123',
            name: 'Assistant Librarian',
            role: 'librarian',
            createdAt: 1729600000000
        }
    ],
    staff: [
        {
            id: 'staff_1',
            username: 'majeed',
            password: '321',
            name: 'Prof. Abdul Majeed',
            department: 'Arabic Literature',
            phone: '',
            role: 'staff',
            createdAt: 1729600000000
        }
    ],
    cloudSync: {
        cloudUrl: DEFAULT_CLOUD_URL,
        lastSynced: null,
        autoSync: true
    },
    books: {},
    ledger: [],
    categories: {},
    students: [],
    classes: [],
    isLibraryClosed: false
};

// Helper: Get local network IP addresses (Wi-Fi / Ethernet)
function getNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({ name, ip: iface.address });
            }
        }
    }
    return addresses;
}

// Two-Way Database Merge Engine (Local + Remote)
function mergeDatabases(localDb, remoteDb) {
    const merged = { ...localDb };
    const remoteTime = remoteDb.lastUpdated || 0;
    const localTime = localDb.lastUpdated || 0;

    // 1. Principal Library Closed status: respect the newer change
    if (remoteTime > localTime && remoteDb.isLibraryClosed !== undefined) {
        merged.isLibraryClosed = !!remoteDb.isLibraryClosed;
    }

    // 2. Books: Local App changes take precedence
    merged.books = { ...(remoteDb.books || {}), ...(localDb.books || {}) };

    // 3. Ledger Union
    const ledgerMap = new Map();
    (remoteDb.ledger || []).forEach(item => ledgerMap.set(item.id, item));
    (localDb.ledger || []).forEach(item => ledgerMap.set(item.id, item));
    merged.ledger = Array.from(ledgerMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

    // 4. Categories & Students & Classes & Librarians
    merged.categories = { ...(remoteDb.categories || {}), ...(localDb.categories || {}) };

    const studentMap = new Map();
    (remoteDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    (localDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    merged.students = Array.from(studentMap.values());

    merged.classes = Array.from(new Set([...(remoteDb.classes || []), ...(localDb.classes || [])]));

    const libMap = new Map();
    (remoteDb.librarians || []).forEach(l => { if (l && l.username) libMap.set(String(l.username).toLowerCase(), l); });
    (localDb.librarians || []).forEach(l => { if (l && l.username) libMap.set(String(l.username).toLowerCase(), l); });
    merged.librarians = Array.from(libMap.values());

    const staffMap = new Map();
    (remoteDb.staff || []).forEach(s => { if (s && s.username) staffMap.set(String(s.username).toLowerCase(), s); });
    (localDb.staff || []).forEach(s => { if (s && s.username) staffMap.set(String(s.username).toLowerCase(), s); });
    merged.staff = Array.from(staffMap.values());

    merged.lastUpdated = Date.now();
    merged.version = Math.max(localDb.version || 0, remoteDb.version || 0) + 1;
    return merged;
}

// Read database from file
function readDb() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            saveDbInternal(initialData, false);
            return { ...initialData };
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const resolvedCloudSync = {
            cloudUrl: DEFAULT_CLOUD_URL,
            autoSync: true,
            ...(parsed.cloudSync || {})
        };
        if (!resolvedCloudSync.cloudUrl) {
            resolvedCloudSync.cloudUrl = DEFAULT_CLOUD_URL;
        }

        const defaultLibrarians = [
            {
                id: 'lib_1',
                username: 'admin',
                password: 'admin123',
                name: 'Chief Librarian',
                role: 'admin',
                createdAt: 1729600000000
            },
            {
                id: 'lib_2',
                username: 'librarian',
                password: 'password123',
                name: 'Assistant Librarian',
                role: 'librarian',
                createdAt: 1729600000000
            }
        ];

        const librarians = (Array.isArray(parsed.librarians) && parsed.librarians.length > 0)
            ? parsed.librarians.map(l => {
                if (String(l.username).toLowerCase() === 'librarian') {
                    return { ...l, role: 'librarian' };
                }
                return l;
            })
            : defaultLibrarians;

        const defaultStaff = [
            {
                id: 'staff_1',
                username: 'majeed',
                password: '321',
                name: 'Prof. Abdul Majeed',
                department: 'Arabic Literature',
                phone: '',
                role: 'staff',
                createdAt: 1729600000000
            }
        ];

        const staff = (Array.isArray(parsed.staff) && parsed.staff.length > 0)
            ? parsed.staff
            : defaultStaff;

        return {
            ...initialData,
            ...parsed,
            passwords: { ...initialData.passwords, ...(parsed.passwords || {}) },
            librarians,
            staff,
            cloudSync: resolvedCloudSync
        };
    } catch (err) {
        console.error('Error reading database file:', err);
        return { ...initialData };
    }
}

// Real-Time Server-Sent Events (SSE) Client Pool
const sseClients = new Set();

function broadcastUpdate(reason = 'data_changed') {
    const db = readDb();
    const payload = JSON.stringify({
        type: 'update',
        reason,
        version: db.version,
        lastUpdated: db.lastUpdated,
        isLibraryClosed: !!db.isLibraryClosed,
        bookCount: Object.keys(db.books || {}).length,
        ledgerCount: (db.ledger || []).length
    });

    for (const client of sseClients) {
        try {
            client.res.write(`data: ${payload}\n\n`);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

// Write database atomically to file & auto-push to cloud
let pushDebounceTimer = null;
let isPushingToCloud = false;

function scheduleImmediateCloudPush(reason = 'local_edit') {
    if (isCloudServer()) return;
    if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    pushDebounceTimer = setTimeout(() => {
        pushLatestStateToCloud(reason);
    }, 150);
}

async function pushLatestStateToCloud(reason = 'instant_sync') {
    if (isCloudServer()) return;
    if (isPushingToCloud) return;

    const db = readDb();
    const cloudUrl = (db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');
    if (!cloudUrl || !cloudUrl.startsWith('http') || db.cloudSync?.autoSync === false) return;
    if (isCurrentServerUrl(cloudUrl)) return;

    isPushingToCloud = true;
    try {
        console.log(`[Cloud-Sync] ⚡ Instantly pushing app changes to Web (${cloudUrl}) [${reason}]...`);
        const res = await fetch(`${cloudUrl}/api/cloud-sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: db,
                source: 'desktop_app',
                timestamp: Date.now()
            }),
            signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
            const result = await res.json();
            db.cloudSync = db.cloudSync || {};
            db.cloudSync.lastSynced = Date.now();
            saveDbInternal(db, false, 'sync_timestamp_update');
            console.log(`[Cloud-Sync] ✅ Web successfully updated! Remote Version: ${result.version}`);
        } else {
            console.warn(`[Cloud-Sync] Web returned status ${res.status}`);
        }
    } catch (err) {
        console.warn(`[Cloud-Sync] Push to web queued/offline (${err.message})`);
    } finally {
        isPushingToCloud = false;
    }
}

function saveDbInternal(data, triggerSync = true, reason = 'mutation') {
    try {
        data.lastUpdated = Date.now();
        data.version = (data.version || 0) + 1;
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');

        // Broadcast to local and connected browsers immediately
        broadcastUpdate(reason);

        // If running locally, push to Cloud Website right away!
        if (triggerSync && !isCloudServer()) {
            scheduleImmediateCloudPush(reason);
        }
        return true;
    } catch (err) {
        console.error('Error saving database file:', err);
        return false;
    }
}

function saveDb(data) {
    return saveDbInternal(data, true, 'local_mutation');
}

// Initialize db file if missing
readDb();

// API Endpoints

// 1. Healthcheck & Network State
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Real-time Version & State check for instant multi-device polling
app.get('/api/version', (req, res) => {
    const db = readDb();
    res.json({
        version: db.version || 1,
        lastUpdated: db.lastUpdated || Date.now(),
        isLibraryClosed: !!db.isLibraryClosed,
        bookCount: Object.keys(db.books || {}).length,
        studentCount: (db.students || []).length,
        ledgerCount: (db.ledger || []).length,
        librarianCount: (db.librarians || []).length,
        staffCount: (db.staff || []).length
    });
});

// Network details for QR Code and Phone Access
app.get('/api/network-info', (req, res) => {
    const ips = getNetworkAddresses();
    const primaryIp = ips.length > 0 ? ips[0].ip : 'localhost';
    res.json({
        port: PORT,
        primaryIp: primaryIp,
        localUrl: `http://localhost:${PORT}`,
        networkUrl: `http://${primaryIp}:${PORT}`,
        ips: ips,
        urls: {
            home: `http://${primaryIp}:${PORT}/index.html`,
            principal: `http://${primaryIp}:${PORT}/assets/subpages/lead/principal/principal.html`,
            admin: `http://${primaryIp}:${PORT}/assets/subpages/lead/admin/admin.html`,
            staffPortal: `http://${primaryIp}:${PORT}/assets/subpages/staff-portal.html`,
            dataEntry: `http://${primaryIp}:${PORT}/assets/subpages/data-entry.html`,
            login: `http://${primaryIp}:${PORT}/assets/subpages/login.html`
        }
    });
});

// Full state
app.get('/api/data', (req, res) => {
    const db = readDb();
    res.json(db);
});

// Role & Individual Librarian & Staff Authentication API
app.post('/api/auth/login', (req, res) => {
    const db = readDb();
    const { role, username, password } = req.body;
    const enteredUsername = String(username || '').trim().toLowerCase();
    const enteredPassword = String(password || '').trim();

    // 1. Individual Username + Password Authentication (Librarian or Staff Teacher)
    if (enteredUsername) {
        // A. Check in db.librarians (Admin / Librarian)
        const librarians = Array.isArray(db.librarians) ? db.librarians : [];
        const libFound = librarians.find(l => String(l.username || '').toLowerCase() === enteredUsername);

        if (libFound && String(libFound.password || '').trim() === enteredPassword) {
            // Strictly assign user role: 'librarian' can NEVER be admin
            let userRole = 'librarian';
            if (enteredUsername === 'admin') {
                userRole = 'admin';
            } else if (libFound.role === 'admin' && enteredUsername !== 'librarian') {
                userRole = 'admin';
            } else {
                userRole = 'librarian';
            }

            const token = Buffer.from(`${libFound.username}:${userRole}:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: userRole,
                token,
                user: {
                    id: libFound.id,
                    username: libFound.username,
                    name: libFound.name || libFound.username,
                    role: userRole
                },
                message: `Authenticated successfully as ${libFound.name || libFound.username} (${userRole.toUpperCase()})`
            });
        }

        // B. Check in db.staff (College Teachers / Staff)
        const staffList = Array.isArray(db.staff) ? db.staff : [];
        const staffFound = staffList.find(s => String(s.username || '').toLowerCase() === enteredUsername);

        if (staffFound && String(staffFound.password || '').trim() === enteredPassword) {
            const token = Buffer.from(`${staffFound.username}:staff:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'staff',
                token,
                user: {
                    id: staffFound.id,
                    username: staffFound.username,
                    name: staffFound.name || staffFound.username,
                    department: staffFound.department || '',
                    role: 'staff'
                },
                message: `Authenticated successfully as ${staffFound.name}`
            });
        }

        // C. Support fallback accounts
        const fallbackCreds = ['admin', 'admin123', 'cyber', '1234'];
        if (enteredUsername === 'admin' && fallbackCreds.includes(enteredPassword)) {
            const token = Buffer.from(`admin:admin:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'admin',
                token,
                user: {
                    id: 'admin',
                    username: 'admin',
                    name: 'Chief Librarian',
                    role: 'admin'
                },
                message: 'Authenticated successfully as Administrator'
            });
        }

        if (enteredUsername === 'librarian' && (fallbackCreds.includes(enteredPassword) || enteredPassword === 'password123')) {
            const token = Buffer.from(`librarian:librarian:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'librarian',
                token,
                user: {
                    id: 'librarian',
                    username: 'librarian',
                    name: 'Assistant Librarian',
                    role: 'librarian'
                },
                message: 'Authenticated successfully as Librarian'
            });
        }

        if ((enteredUsername === 'majeed' || enteredUsername === 'maje') && enteredPassword === '321') {
            const token = Buffer.from(`${enteredUsername}:staff:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'staff',
                token,
                user: {
                    id: 'staff_1',
                    username: enteredUsername,
                    name: 'Prof. Abdul Majeed',
                    department: 'Arabic Literature',
                    role: 'staff'
                },
                message: 'Authenticated successfully as Prof. Abdul Majeed'
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // 2. Fallback to Role-based password (e.g. Principal portal or quick code)
    const targetRole = role || 'admin';
    const storedPassword = db.passwords && db.passwords[targetRole] ? db.passwords[targetRole] : null;
    const fallbackCreds = {
        principal: ['principal', 'principal123', '1234', 'cyber'],
        admin: ['admin', 'admin123', 'cyber', '1234'],
        staff: ['staff', 'staff123', '1234', 'operator']
    };

    const isValid = (storedPassword && storedPassword === enteredPassword) ||
                    (fallbackCreds[targetRole] && fallbackCreds[targetRole].includes(enteredPassword));

    if (isValid) {
        const token = Buffer.from(`${targetRole}:${Date.now()}:${Math.random()}`).toString('base64');
        return res.json({
            success: true,
            role: targetRole,
            token,
            user: {
                id: targetRole,
                username: targetRole,
                name: targetRole.toUpperCase(),
                role: targetRole
            },
            message: `Authenticated successfully as ${targetRole.toUpperCase()}`
        });
    }

    res.status(401).json({ success: false, message: 'Invalid credentials. Please check your password.' });
});

// Update Role Passwords API (Admin Protected)
app.post('/api/auth/update-passwords', (req, res) => {
    const db = readDb();
    const { currentAdminPassword, newAdminPassword, newPrincipalPassword, newStaffPassword } = req.body;

    const currentAdmin = db.passwords?.admin || 'admin123';
    if (!currentAdminPassword || (currentAdminPassword !== currentAdmin && currentAdminPassword !== 'admin' && currentAdminPassword !== 'cyber')) {
        return res.status(401).json({ success: false, message: 'Incorrect Current Admin Password' });
    }

    db.passwords = db.passwords || {};
    if (newAdminPassword && newAdminPassword.trim()) {
        db.passwords.admin = newAdminPassword.trim();
        // Also update default 'admin' librarian password if present
        if (Array.isArray(db.librarians)) {
            const adminLib = db.librarians.find(l => l.username.toLowerCase() === 'admin');
            if (adminLib) adminLib.password = newAdminPassword.trim();
        }
    }
    if (newPrincipalPassword && newPrincipalPassword.trim()) {
        db.passwords.principal = newPrincipalPassword.trim();
    }
    if (newStaffPassword && newStaffPassword.trim()) {
        db.passwords.staff = newStaffPassword.trim();
    }

    saveDb(db);
    res.json({ success: true, message: 'Passwords updated successfully!' });
});

// ==============================================================
// LIBRARIAN ACCOUNT MANAGEMENT APIS
// ==============================================================

// 1. Get all librarians
app.get('/api/librarians', (req, res) => {
    const db = readDb();
    const librarians = (db.librarians || []).map(l => ({
        id: l.id,
        username: l.username,
        name: l.name || l.username,
        role: l.role || (String(l.username).toLowerCase() === 'admin' ? 'admin' : 'librarian'),
        createdAt: l.createdAt || Date.now()
    }));
    res.json(librarians);
});

// 2. Create a new librarian
app.post('/api/librarians', (req, res) => {
    const db = readDb();
    const { username, password, name, role } = req.body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim() || cleanUsername;
    const cleanRole = (role === 'admin') ? 'admin' : 'librarian';

    if (!cleanUsername) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (cleanUsername.length < 2) {
        return res.status(400).json({ success: false, message: 'Username must be at least 2 characters long.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, dots, and underscores.' });
    }
    if (!cleanPassword) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (cleanPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
    }

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const exists = db.librarians.some(l => String(l.username || '').toLowerCase() === cleanUsername);
    if (exists) {
        return res.status(409).json({ success: false, message: `Username "${cleanUsername}" is already taken. Please choose another username.` });
    }

    const newLibrarian = {
        id: 'lib_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        role: cleanRole,
        createdAt: Date.now()
    };

    db.librarians.push(newLibrarian);
    saveDb(db);

    console.log(`[Auth] ✅ Created new librarian: ${cleanName} (@${cleanUsername})`);

    res.status(201).json({
        success: true,
        message: `Librarian "${cleanName}" (@${cleanUsername}) created successfully!`,
        librarian: {
            id: newLibrarian.id,
            username: newLibrarian.username,
            name: newLibrarian.name,
            role: newLibrarian.role,
            createdAt: newLibrarian.createdAt
        }
    });
});

// 3. Update librarian (name, password, or role)
app.put('/api/librarians/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, password, role } = req.body;

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const index = db.librarians.findIndex(l => l.id === id || String(l.username).toLowerCase() === String(id).toLowerCase());

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Librarian account not found.' });
    }

    if (name && String(name).trim()) {
        db.librarians[index].name = String(name).trim();
    }
    if (password && String(password).trim()) {
        const cleanPassword = String(password).trim();
        if (cleanPassword.length < 3) {
            return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
        }
        db.librarians[index].password = cleanPassword;
    }
    if (role && ['admin', 'librarian'].includes(role)) {
        db.librarians[index].role = role;
    }
    db.librarians[index].updatedAt = Date.now();

    saveDb(db);
    res.json({
        success: true,
        message: `Librarian "${db.librarians[index].name}" updated successfully.`,
        librarian: {
            id: db.librarians[index].id,
            username: db.librarians[index].username,
            name: db.librarians[index].name,
            role: db.librarians[index].role,
            createdAt: db.librarians[index].createdAt
        }
    });
});

// 4. Delete librarian
app.delete('/api/librarians/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const target = db.librarians.find(l => l.id === id || String(l.username).toLowerCase() === String(id).toLowerCase());

    if (!target) {
        return res.status(404).json({ success: false, message: 'Librarian account not found.' });
    }

    if (db.librarians.length <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the only librarian account.' });
    }

    db.librarians = db.librarians.filter(l => l.id !== id && String(l.username).toLowerCase() !== String(id).toLowerCase());
    saveDb(db);

    console.log(`[Auth] 🗑️ Deleted librarian: ${target.name} (@${target.username})`);

    res.json({
        success: true,
        message: `Librarian "${target.name || target.username}" deleted successfully.`
    });
});

// ==============================================================
// COLLEGE STAFF & TEACHERS ACCOUNT MANAGEMENT APIS
// ==============================================================

// 1. Get all teachers/staff accounts
app.get('/api/staff', (req, res) => {
    const db = readDb();
    const ledger = Array.isArray(db.ledger) ? db.ledger : [];
    const books = db.books || {};

    const staffList = (db.staff || []).map(s => {
        // Count currently taken books for this teacher
        const sName = (s.name || '').toLowerCase();
        const sUser = (s.username || '').toLowerCase();

        let takenCount = 0;
        ledger.forEach(r => {
            const isStaffMatch = (r.rollNo === 'STAFF') || (r.status && r.status.includes('Staff'));
            const matches = (r.staffUsername && String(r.staffUsername).toLowerCase() === sUser) ||
                            (sName && r.studentName && r.studentName.toLowerCase().includes(sName)) ||
                            (r.studentName && r.studentName.toLowerCase().includes(sUser));
            if (isStaffMatch && matches && r.status && r.status.includes('Issued')) {
                takenCount++;
            }
        });

        return {
            id: s.id,
            username: s.username,
            name: s.name || s.username,
            department: s.department || 'College Faculty',
            phone: s.phone || '',
            role: 'staff',
            takenBooksCount: takenCount,
            createdAt: s.createdAt || Date.now()
        };
    });
    res.json(staffList);
});

// 2. Create a new teacher / staff account
app.post('/api/staff', (req, res) => {
    const db = readDb();
    const { username, password, name, department, phone } = req.body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim() || cleanUsername;
    const cleanDept = String(department || '').trim() || 'College Faculty';
    const cleanPhone = String(phone || '').trim();

    if (!cleanUsername) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (cleanUsername.length < 2) {
        return res.status(400).json({ success: false, message: 'Username must be at least 2 characters long.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, dots, and underscores.' });
    }
    if (!cleanPassword) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (cleanPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
    }

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const existsInStaff = db.staff.some(s => String(s.username || '').toLowerCase() === cleanUsername);
    const existsInLib = (db.librarians || []).some(l => String(l.username || '').toLowerCase() === cleanUsername);

    if (existsInStaff || existsInLib) {
        return res.status(409).json({ success: false, message: `Username "${cleanUsername}" is already taken. Please choose another username.` });
    }

    const newStaff = {
        id: 'staff_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        department: cleanDept,
        phone: cleanPhone,
        role: 'staff',
        createdAt: Date.now()
    };

    db.staff.push(newStaff);
    saveDb(db);

    console.log(`[Auth] ✅ Created new teacher / staff account: ${cleanName} (@${cleanUsername})`);

    res.status(201).json({
        success: true,
        message: `Teacher account "${cleanName}" (@${cleanUsername}) created successfully!`,
        staff: {
            id: newStaff.id,
            username: newStaff.username,
            name: newStaff.name,
            department: newStaff.department,
            phone: newStaff.phone,
            role: newStaff.role,
            createdAt: newStaff.createdAt
        }
    });
});

// 3. Update staff account (name, password, department, phone)
app.put('/api/staff/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, password, department, phone } = req.body;

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const index = db.staff.findIndex(s => s.id === id || String(s.username).toLowerCase() === String(id).toLowerCase());

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Teacher account not found.' });
    }

    if (name && String(name).trim()) {
        db.staff[index].name = String(name).trim();
    }
    if (department && String(department).trim()) {
        db.staff[index].department = String(department).trim();
    }
    if (phone !== undefined) {
        db.staff[index].phone = String(phone).trim();
    }
    if (password && String(password).trim()) {
        const cleanPassword = String(password).trim();
        if (cleanPassword.length < 3) {
            return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
        }
        db.staff[index].password = cleanPassword;
    }
    db.staff[index].updatedAt = Date.now();

    saveDb(db);
    res.json({
        success: true,
        message: `Account for "${db.staff[index].name}" updated successfully.`,
        staff: {
            id: db.staff[index].id,
            username: db.staff[index].username,
            name: db.staff[index].name,
            department: db.staff[index].department,
            phone: db.staff[index].phone,
            role: 'staff'
        }
    });
});

// 4. Delete staff account
app.delete('/api/staff/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const target = db.staff.find(s => s.id === id || String(s.username).toLowerCase() === String(id).toLowerCase());

    if (!target) {
        return res.status(404).json({ success: false, message: 'Teacher account not found.' });
    }

    db.staff = db.staff.filter(s => s.id !== id && String(s.username).toLowerCase() !== String(id).toLowerCase());
    saveDb(db);

    console.log(`[Auth] 🗑️ Deleted teacher / staff: ${target.name} (@${target.username})`);

    res.json({
        success: true,
        message: `Teacher account "${target.name || target.username}" deleted successfully.`
    });
});

// 5. Get Books for a Specific Staff/Teacher (Active Borrowed Books & Past History)
app.get('/api/staff/:username/books', (req, res) => {
    const db = readDb();
    const rawUsername = String(req.params.username || '').toLowerCase().trim();

    const staffList = Array.isArray(db.staff) ? db.staff : [];
    const staffMember = staffList.find(s => String(s.username || '').toLowerCase() === rawUsername || String(s.id) === rawUsername);
    const staffName = staffMember ? staffMember.name.toLowerCase() : rawUsername;

    const ledger = Array.isArray(db.ledger) ? db.ledger : [];
    const books = db.books || {};

    const activeBooksMap = new Map();
    const historyBooks = [];

    // Search ledger
    ledger.forEach(r => {
        const isStaffMatch = (r.rollNo === 'STAFF') || (r.status && r.status.includes('Staff'));
        const matchesUser = (r.staffUsername && String(r.staffUsername).toLowerCase() === rawUsername) ||
                            (staffMember && r.staffUsername && String(r.staffUsername).toLowerCase() === String(staffMember.username).toLowerCase()) ||
                            (staffName && r.studentName && r.studentName.toLowerCase().includes(staffName)) ||
                            (r.studentName && r.studentName.toLowerCase().includes(rawUsername));

        if (isStaffMatch && matchesUser) {
            const bInfo = books[r.bookId] || {};
            if (r.status && r.status.includes('Issued')) {
                activeBooksMap.set(r.bookId, {
                    id: r.id,
                    bookId: r.bookId,
                    title: r.bookTitle || bInfo.title || `Book #${r.bookId}`,
                    author: r.author || bInfo.author || 'General',
                    section: bInfo.sectionName || bInfo.section || 'General',
                    cover: bInfo.cover || '',
                    issueDate: r.issueDate || 'Recent',
                    issueTime: r.issueTime || '',
                    issuedBy: r.issuedBy || 'Staff',
                    status: 'Active (With Staff)'
                });
            } else if (r.status === 'Returned') {
                historyBooks.push({
                    id: r.id,
                    bookId: r.bookId,
                    title: r.bookTitle || bInfo.title || `Book #${r.bookId}`,
                    author: r.author || bInfo.author || 'General',
                    section: bInfo.sectionName || bInfo.section || 'General',
                    issueDate: r.issueDate,
                    issueTime: r.issueTime || '',
                    returnDate: r.returnDate,
                    returnTime: r.returnTime || '',
                    issuedBy: r.issuedBy || 'Staff',
                    returnedBy: r.returnedBy || 'Staff'
                });
            }
        }
    });

    // Check inventory books
    Object.keys(books).forEach(bId => {
        const b = books[bId];
        if (b && b.status === 'Issued') {
            const matchesUser = (b.staffUsername && String(b.staffUsername).toLowerCase() === rawUsername) ||
                                (staffMember && b.staffUsername && String(b.staffUsername).toLowerCase() === String(staffMember.username).toLowerCase()) ||
                                (staffName && b.issuedTo && b.issuedTo.toLowerCase().includes(staffName)) ||
                                (b.issuedTo && b.issuedTo.toLowerCase().includes(rawUsername));
            if (matchesUser && !activeBooksMap.has(bId)) {
                activeBooksMap.set(bId, {
                    id: 'book_' + bId,
                    bookId: bId,
                    title: b.title || `Book #${bId}`,
                    author: b.author || 'General',
                    section: b.sectionName || b.section || 'General',
                    cover: b.cover || '',
                    issueDate: b.issueDate || 'Current',
                    issueTime: b.issueTime || '',
                    issuedBy: b.issuedBy || 'Staff',
                    status: 'Active (With Staff)'
                });
            }
        }
    });

    res.json({
        success: true,
        staff: staffMember ? {
            id: staffMember.id,
            name: staffMember.name,
            username: staffMember.username,
            department: staffMember.department,
            phone: staffMember.phone
        } : { username: rawUsername, name: rawUsername, department: 'College Faculty' },
        borrowedCount: activeBooksMap.size,
        historyCount: historyBooks.length,
        borrowedBooks: Array.from(activeBooksMap.values()),
        historyBooks
    });
});

// Cloud Sync APIs (Two-Way Sync between PC App and Online Website)
app.get('/api/cloud-sync/config', (req, res) => {
    const db = readDb();
    res.json({
        cloudUrl: db.cloudSync?.cloudUrl || '',
        lastSynced: db.cloudSync?.lastSynced || null,
        autoSync: db.cloudSync?.autoSync !== false
    });
});

app.post('/api/cloud-sync/config', (req, res) => {
    const db = readDb();
    const { cloudUrl, autoSync } = req.body;
    db.cloudSync = db.cloudSync || {};
    if (cloudUrl !== undefined) db.cloudSync.cloudUrl = String(cloudUrl).trim().replace(/\/+$/, '');
    if (autoSync !== undefined) db.cloudSync.autoSync = !!autoSync;
    saveDb(db);
    res.json({ success: true, cloudSync: db.cloudSync });
});

// Accept push from another peer/server and apply atomically
app.post('/api/cloud-sync/push', (req, res) => {
    const db = readDb();
    const incomingData = req.body.data;
    if (!incomingData) {
        return res.status(400).json({ success: false, message: 'No sync data provided' });
    }

    console.log(`[Cloud-Sync] 📥 Received App update! Applying to Web database...`);

    // The App is authoritative for catalog, ledger, students, categories
    if (incomingData.books) {
        db.books = incomingData.books;
    }
    if (incomingData.ledger) {
        db.ledger = Array.isArray(incomingData.ledger) ? incomingData.ledger : [];
    }
    if (incomingData.categories) {
        db.categories = incomingData.categories;
    }
    if (incomingData.students) {
        db.students = Array.isArray(incomingData.students) ? incomingData.students : [];
    }
    if (incomingData.classes) {
        db.classes = Array.isArray(incomingData.classes) ? incomingData.classes : [];
    }
    if (incomingData.isLibraryClosed !== undefined) {
        db.isLibraryClosed = !!incomingData.isLibraryClosed;
    }
    if (incomingData.passwords) {
        db.passwords = { ...db.passwords, ...incomingData.passwords };
    }
    if (incomingData.librarians && Array.isArray(incomingData.librarians)) {
        db.librarians = incomingData.librarians;
    }

    db.cloudSync = db.cloudSync || {};
    db.cloudSync.lastSynced = Date.now();

    // Save and broadcast immediately to all open web browsers!
    saveDbInternal(db, false, 'remote_app_push');

    console.log(`[Cloud-Sync] ✅ Web database updated! Books: ${Object.keys(db.books || {}).length}, Ledger: ${(db.ledger || []).length}, Version: ${db.version}`);

    res.json({
        success: true,
        version: db.version,
        lastSynced: db.cloudSync.lastSynced,
        booksCount: Object.keys(db.books || {}).length,
        ledgerCount: (db.ledger || []).length,
        isLibraryClosed: db.isLibraryClosed
    });
});

// Trigger Two-Way Sync with Cloud Website
app.post('/api/cloud-sync/execute', async (req, res) => {
    const db = readDb();
    const targetUrl = (req.body.cloudUrl || db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');

    if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            message: 'No valid Cloud Website URL configured. Please enter the site URL.'
        });
    }

    if (isCurrentServerUrl(targetUrl)) {
        return res.json({
            success: true,
            message: 'Already running as Cloud Website.',
            version: db.version,
            booksCount: Object.keys(db.books || {}).length
        });
    }

    try {
        // Push local state to cloud
        const pushRes = await fetch(`${targetUrl}/api/cloud-sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: db, source: 'manual_sync', timestamp: Date.now() }),
            signal: AbortSignal.timeout(8000)
        });

        if (!pushRes.ok) {
            throw new Error(`Cloud server responded with status ${pushRes.status}`);
        }

        const pushData = await pushRes.json();
        db.cloudSync = db.cloudSync || {};
        db.cloudSync.lastSynced = Date.now();
        db.cloudSync.cloudUrl = targetUrl;
        saveDbInternal(db, false, 'manual_sync_completed');

        res.json({
            success: true,
            message: 'PC App and Website synchronized successfully!',
            version: pushData.version || db.version,
            lastSynced: db.cloudSync.lastSynced,
            booksCount: Object.keys(db.books || {}).length,
            isLibraryClosed: db.isLibraryClosed
        });
    } catch (err) {
        console.warn('[Cloud-Sync] Execute sync warning:', err.message);
        res.status(503).json({
            success: false,
            offline: true,
            message: `Could not reach cloud website (${err.message}).`
        });
    }
});

// Library Open/Closed Status
app.get('/api/status', (req, res) => {
    const db = readDb();
    res.json({ isLibraryClosed: !!db.isLibraryClosed });
});

app.post('/api/status', (req, res) => {
    const db = readDb();
    db.isLibraryClosed = !!req.body.isLibraryClosed;
    saveDb(db);
    res.json({ success: true, isLibraryClosed: db.isLibraryClosed });
});

// 2. Books API (Multi-device concurrent safe)
app.get('/api/books', (req, res) => {
    const db = readDb();
    res.json(db.books || {});
});

// Atomic single book upsert (Safe for concurrent multiple phones/computers)
app.post('/api/books/upsert', (req, res) => {
    const db = readDb();
    const { id, book } = req.body;
    if (!id || !book) {
        return res.status(400).json({ success: false, message: 'Book ID and book payload required' });
    }
    db.books = db.books || {};
    db.books[id] = { ...book, id };
    saveDb(db);
    res.json({ success: true, book: db.books[id], totalBooks: Object.keys(db.books).length });
});

// Batch book upsert (Merges without destroying other devices' additions)
app.post('/api/books/batch', (req, res) => {
    const db = readDb();
    const booksToAdd = req.body.books || req.body;
    if (!booksToAdd) {
        return res.status(400).json({ success: false, message: 'No books provided' });
    }
    db.books = db.books || {};
    if (Array.isArray(booksToAdd)) {
        booksToAdd.forEach(b => {
            if (b && b.id) db.books[b.id] = b;
        });
    } else if (typeof booksToAdd === 'object') {
        Object.assign(db.books, booksToAdd);
    }
    saveDb(db);
    res.json({ success: true, totalBooks: Object.keys(db.books).length });
});

// Full overwrite (legacy compatibility)
app.post('/api/books', (req, res) => {
    const db = readDb();
    const newBooks = req.body;
    db.books = newBooks;
    saveDb(db);
    res.json({ success: true, books: db.books });
});

app.delete('/api/books/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (db.books && db.books[id]) {
        delete db.books[id];
        saveDb(db);
        return res.json({ success: true, message: `Book #${id} deleted` });
    }
    res.status(404).json({ success: false, message: 'Book not found' });
});

// 3. Ledger API
app.get('/api/ledger', (req, res) => {
    const db = readDb();
    res.json(db.ledger || []);
});

// Safe atomic ledger entry append
app.post('/api/ledger/entry', (req, res) => {
    const db = readDb();
    const entry = req.body;
    if (!entry) {
        return res.status(400).json({ success: false, message: 'Invalid ledger entry' });
    }
    db.ledger = Array.isArray(db.ledger) ? db.ledger : [];
    if (!entry.id) {
        entry.id = Date.now();
    }
    db.ledger.unshift(entry);
    saveDb(db);
    res.json({ success: true, entry, totalLedger: db.ledger.length });
});

app.post('/api/ledger', (req, res) => {
    const db = readDb();
    const newLedger = req.body;
    db.ledger = Array.isArray(newLedger) ? newLedger : [];
    saveDb(db);
    res.json({ success: true, ledger: db.ledger });
});

app.delete('/api/ledger/:id', (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    if (Array.isArray(db.ledger)) {
        db.ledger = db.ledger.filter(item => item.id !== id);
        saveDb(db);
        return res.json({ success: true, message: `Ledger entry #${id} deleted` });
    }
    res.status(404).json({ success: false, message: 'Ledger record not found' });
});

// 4. Categories API
app.get('/api/categories', (req, res) => {
    const db = readDb();
    res.json(db.categories || initialData.categories);
});

app.post('/api/categories', (req, res) => {
    const db = readDb();
    db.categories = req.body || {};
    saveDb(db);
    res.json({ success: true, categories: db.categories });
});

app.delete('/api/categories/:code', (req, res) => {
    const db = readDb();
    const code = req.params.code.toUpperCase();
    if (db.categories && db.categories[code]) {
        delete db.categories[code];
        saveDb(db);
        return res.json({ success: true, categories: db.categories });
    }
    res.status(404).json({ success: false, message: 'Category not found' });
});

// 5. Students API
app.get('/api/students', (req, res) => {
    const db = readDb();
    res.json(db.students || []);
});

// Atomic single student upsert
app.post('/api/students/upsert', (req, res) => {
    const db = readDb();
    const student = req.body;
    if (!student || !student.rollNo) {
        return res.status(400).json({ success: false, message: 'Roll number required' });
    }
    db.students = Array.isArray(db.students) ? db.students : [];
    const idx = db.students.findIndex(s => String(s.rollNo) === String(student.rollNo));
    if (idx >= 0) {
        db.students[idx] = { ...db.students[idx], ...student };
    } else {
        db.students.push(student);
    }
    saveDb(db);
    res.json({ success: true, student, totalStudents: db.students.length });
});

// Batch students upload
app.post('/api/students/batch', (req, res) => {
    const db = readDb();
    const newStudents = Array.isArray(req.body) ? req.body : (req.body.students || []);
    db.students = Array.isArray(db.students) ? db.students : [];
    
    newStudents.forEach(st => {
        if (!st || !st.rollNo) return;
        const idx = db.students.findIndex(s => String(s.rollNo) === String(st.rollNo));
        if (idx >= 0) {
            db.students[idx] = { ...db.students[idx], ...st };
        } else {
            db.students.push(st);
        }
    });

    saveDb(db);
    res.json({ success: true, totalStudents: db.students.length });
});

app.post('/api/students', (req, res) => {
    const db = readDb();
    db.students = Array.isArray(req.body) ? req.body : [];
    saveDb(db);
    res.json({ success: true, students: db.students });
});

app.delete('/api/students/:rollNo', (req, res) => {
    const db = readDb();
    const rollNo = String(req.params.rollNo);
    if (Array.isArray(db.students)) {
        db.students = db.students.filter(st => String(st.rollNo) !== rollNo);
        saveDb(db);
        return res.json({ success: true, students: db.students });
    }
    res.status(404).json({ success: false, message: 'Student not found' });
});

// 6. Custom Classes API
app.get('/api/classes', (req, res) => {
    const db = readDb();
    res.json(db.classes || []);
});

app.post('/api/classes', (req, res) => {
    const db = readDb();
    db.classes = Array.isArray(req.body) ? req.body : [];
    saveDb(db);
    res.json({ success: true, classes: db.classes });
});

app.delete('/api/classes/:className', (req, res) => {
    const db = readDb();
    const className = req.params.className.trim();
    if (Array.isArray(db.classes)) {
        db.classes = db.classes.filter(c => String(c).toLowerCase() !== className.toLowerCase());
        saveDb(db);
        return res.json({ success: true, classes: db.classes });
    }
    res.status(404).json({ success: false, message: 'Class not found' });
});

// 7. Reset System Data API (Password Protected)
app.post('/api/reset', (req, res) => {
    const { password } = req.body;
    const validPasswords = ['admin', 'admin123', 'cyber', '1234'];
    
    if (!password || !validPasswords.includes(String(password).trim())) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Incorrect Admin Password' });
    }

    const resetState = {
        version: 1,
        lastUpdated: Date.now(),
        books: {},
        ledger: [],
        categories: { ...initialData.categories },
        students: [],
        classes: [],
        isLibraryClosed: false
    };
    saveDb(resetState);
    res.json({ success: true, message: 'System data successfully reset to factory defaults', data: resetState });
});

// Background sync worker: Runs on the local server every 5 seconds
if (!isCloudServer()) {
    setInterval(async () => {
        try {
            const db = readDb();
            const cloudUrl = (db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');
            if (!cloudUrl || !cloudUrl.startsWith('http') || db.cloudSync?.autoSync === false) return;
            if (isCurrentServerUrl(cloudUrl)) return;

            // Ping remote version to pull any remote changes (like Principal closing library)
            const res = await fetch(`${cloudUrl}/api/version`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const remote = await res.json();
                if (remote.isLibraryClosed !== undefined && remote.isLibraryClosed !== db.isLibraryClosed) {
                    db.isLibraryClosed = !!remote.isLibraryClosed;
                    saveDbInternal(db, false, 'remote_status_update');
                    console.log(`[Cloud-Sync] 🔄 Updated Library status from Web: ${db.isLibraryClosed ? 'CLOSED' : 'OPEN'}`);
                }
            }
        } catch (e) {
            // Offline or timeout
        }
    }, 5000);

    // Initial push on server startup to make sure Web is fresh immediately
    setTimeout(() => {
        pushLatestStateToCloud('server_startup');
    }, 2000);
}

// Mobile Application APK Download Endpoint
app.get('/download/app', (req, res) => {
    const candidates = [
        path.join(__dirname, 'Kuthbukhana-Library.apk'),
        path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
        path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return res.download(p, 'Kuthbukhana-Library.apk');
        }
    }
    res.status(404).send('<h2>Mobile App APK is being generated. Please check back in 1 minute or run Build-Mobile-App-APK.bat.</h2>');
});

// Serve static frontend files
app.use(express.static(__dirname));

// Start backend server
app.listen(PORT, '0.0.0.0', () => {
    const ips = getNetworkAddresses();
    const primaryIp = ips.length > 0 ? ips[0].ip : 'localhost';

    console.log(`==============================================================`);
    console.log(`  🚀 KUTHBUKHANA ANWARIYYA - LIBRARY SERVER (LIVE)`);
    console.log(`  🖥️  PC Desktop / Localhost: http://localhost:${PORT}`);
    console.log(`  📱 Phone / Wi-Fi Access:   http://${primaryIp}:${PORT}`);
    console.log(`  👑 Principal Portal:       http://${primaryIp}:${PORT}/assets/subpages/lead/principal/principal.html`);
    console.log(`  🛠️  Admin Dashboard:        http://${primaryIp}:${PORT}/assets/subpages/lead/admin/admin.html`);
    console.log(`  📝 Multi-Device Data Entry: http://${primaryIp}:${PORT}/assets/subpages/data-entry.html`);
    console.log(`  📁 Database Path:          ${DB_FILE}`);
    console.log(`==============================================================`);
});

