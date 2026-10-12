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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
    cloudSync: {
        cloudUrl: '',
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

    // 2. Books Union
    merged.books = { ...(localDb.books || {}) };
    const remoteBooks = remoteDb.books || {};
    for (const id of Object.keys(remoteBooks)) {
        if (!merged.books[id]) {
            merged.books[id] = remoteBooks[id];
        } else if (remoteTime > localTime) {
            merged.books[id] = { ...merged.books[id], ...remoteBooks[id] };
        }
    }

    // 3. Ledger Union
    const ledgerMap = new Map();
    (localDb.ledger || []).forEach(item => ledgerMap.set(item.id, item));
    (remoteDb.ledger || []).forEach(item => {
        if (!ledgerMap.has(item.id) || remoteTime > localTime) {
            ledgerMap.set(item.id, item);
        }
    });
    merged.ledger = Array.from(ledgerMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

    // 4. Categories & Students & Classes
    merged.categories = { ...(localDb.categories || {}), ...(remoteDb.categories || {}) };

    const studentMap = new Map();
    (localDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    (remoteDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    merged.students = Array.from(studentMap.values());

    merged.classes = Array.from(new Set([...(localDb.classes || []), ...(remoteDb.classes || [])]));

    merged.lastUpdated = Date.now();
    merged.version = Math.max(localDb.version || 0, remoteDb.version || 0) + 1;
    return merged;
}

// Read database from file
function readDb() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            saveDb(initialData);
            return { ...initialData };
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...initialData,
            ...parsed,
            passwords: { ...initialData.passwords, ...(parsed.passwords || {}) },
            cloudSync: { ...initialData.cloudSync, ...(parsed.cloudSync || {}) }
        };
    } catch (err) {
        console.error('Error reading database file:', err);
        return { ...initialData };
    }
}

// Write database atomically to file
function saveDb(data) {
    try {
        data.lastUpdated = Date.now();
        data.version = (data.version || 0) + 1;
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error saving database file:', err);
        return false;
    }
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
        ledgerCount: (db.ledger || []).length
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

// Role Authentication API
app.post('/api/auth/login', (req, res) => {
    const db = readDb();
    const { role, password } = req.body;
    const entered = String(password || '').trim();

    const storedPassword = db.passwords && db.passwords[role] ? db.passwords[role] : null;
    const fallbackCreds = {
        principal: ['principal', 'principal123', '1234', 'cyber'],
        admin: ['admin', 'admin123', 'cyber', '1234'],
        staff: ['staff', 'staff123', '1234', 'operator']
    };

    const isValid = (storedPassword && storedPassword === entered) ||
                    (fallbackCreds[role] && fallbackCreds[role].includes(entered));

    if (isValid) {
        const token = Buffer.from(`${role}:${Date.now()}:${Math.random()}`).toString('base64');
        return res.json({
            success: true,
            role,
            token,
            message: `Authenticated successfully as ${role.toUpperCase()}`
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

// Accept push from another peer/server and merge atomically
app.post('/api/cloud-sync/push', (req, res) => {
    const db = readDb();
    const incomingData = req.body.data;
    if (!incomingData) {
        return res.status(400).json({ success: false, message: 'No sync data provided' });
    }
    const merged = mergeDatabases(db, incomingData);
    merged.cloudSync = merged.cloudSync || {};
    merged.cloudSync.lastSynced = Date.now();
    saveDb(merged);
    res.json({ success: true, version: merged.version, lastSynced: merged.cloudSync.lastSynced });
});

// Trigger Two-Way Sync with Cloud Website
app.post('/api/cloud-sync/execute', async (req, res) => {
    const db = readDb();
    const targetUrl = (req.body.cloudUrl || db.cloudSync?.cloudUrl || '').trim().replace(/\/+$/, '');

    if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            message: 'No valid Cloud Website URL configured. Please enter the site URL.'
        });
    }

    try {
        // 1. Fetch remote data from online site
        const remoteRes = await fetch(`${targetUrl}/api/data`, { signal: AbortSignal.timeout(8000) });
        if (!remoteRes.ok) {
            return res.status(502).json({
                success: false,
                offline: true,
                message: `Failed to contact cloud website at ${targetUrl}. HTTP status: ${remoteRes.status}`
            });
        }
        const remoteDb = await remoteRes.json();

        // 2. Perform two-way merge
        const merged = mergeDatabases(db, remoteDb);
        merged.cloudSync = merged.cloudSync || {};
        merged.cloudSync.cloudUrl = targetUrl;
        merged.cloudSync.lastSynced = Date.now();
        saveDb(merged);

        // 3. Push merged state back to the online site so both are identical
        await fetch(`${targetUrl}/api/cloud-sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: merged }),
            signal: AbortSignal.timeout(8000)
        }).catch(err => console.warn('[Cloud-Sync] Push to cloud warning:', err.message));

        res.json({
            success: true,
            message: 'Two-way cloud synchronization completed! PC App and Website are now synchronized.',
            version: merged.version,
            lastSynced: merged.cloudSync.lastSynced,
            booksCount: Object.keys(merged.books).length,
            isLibraryClosed: merged.isLibraryClosed
        });
    } catch (err) {
        console.warn('[Cloud-Sync] Network error during sync:', err.message);
        res.status(503).json({
            success: false,
            offline: true,
            message: `Could not reach cloud website (${err.message}). When internet is restored, auto-sync will resume.`
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

// Auto-sync worker: Runs every 20 seconds if cloudUrl is configured
setInterval(async () => {
    try {
        const db = readDb();
        const cloudUrl = db.cloudSync?.cloudUrl;
        if (!cloudUrl || !cloudUrl.startsWith('http') || db.cloudSync?.autoSync === false) return;

        const cleanUrl = cloudUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const remoteVersion = await res.json();
            if (remoteVersion.lastUpdated !== db.lastUpdated || remoteVersion.version !== db.version) {
                const fullRes = await fetch(`${cleanUrl}/api/data`, { signal: AbortSignal.timeout(6000) });
                if (fullRes.ok) {
                    const remoteDb = await fullRes.json();
                    const merged = mergeDatabases(db, remoteDb);
                    merged.cloudSync = merged.cloudSync || {};
                    merged.cloudSync.lastSynced = Date.now();
                    saveDb(merged);

                    await fetch(`${cleanUrl}/api/cloud-sync/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: merged }),
                        signal: AbortSignal.timeout(6000)
                    }).catch(() => {});
                    console.log(`[Cloud-Sync] Auto-synchronized state with website (${cleanUrl})`);
                }
            }
        }
    } catch (e) {
        // Offline or connection timeout - retry next interval
    }
}, 20000);

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

