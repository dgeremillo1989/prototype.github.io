const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware configuration
app.use(express.json());

// Configure secure server-side session memory
app.use(session({
    secret: 'wiijump-capstone-super-secret-key', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 60 * 1000, // Session auto-expires after 30 minutes of inactivity
        secure: false // Set to true if deploying over HTTPS
    }
}));

// Initialize local SQLite File Database
const db = new sqlite3.Database('./wiijump_vms.db', (err) => {
    if (err) console.error('Database configuration error:', err.message);
    console.log('Connected to the secure local SQLite database archive.');
});

// Structural schema build setup
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS customer_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
    )`);
});

// SECURITY GATE: Middleware to check if the user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        return next(); // User is authenticated, proceed to the page/API
    } else {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
}

// PUBLIC GATEWAYS: Serve Kiosk registration page and its static landing routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// SECURE GATEWAYS: Protect the static admin HTML file from direct URL navigation
app.get('/admin.html', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/login.html'); // Instantly kick unauthorized guests to login screen
    }
});

// API Route: Process administrator login requests
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded Capstone Credentials (Ideally, these would be hashed in a separate database table)
    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "WiiJumpPassword2026"; 

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.adminUser = username;
        return res.json({ success: true, message: 'Authentication successful.' });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
    }
});

// API Route: Clear session states on manual logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Could not log out.' });
        res.json({ success: true });
    });
});

// API Route: Register a new customer intake row (Publicly accessible by staff)
app.post('/api/sessions', (req, res) => {
    const { name, contact, duration } = req.body;
    if (!name || !contact || !duration) {
        return res.status(400).json({ error: 'Required fields missing.' });
    }

    const sessionId = 'WJ-' + Math.floor(1000 + Math.random() * 9000);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const query = `INSERT INTO customer_sessions (id, name, contact, duration_minutes, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [sessionId, name, contact, duration, startTime.toISOString(), endTime.toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// PROTECTED API Route: Fetch live system telemetry (Requires valid session token)
app.get('/api/sessions/live', requireAuth, (req, res) => {
    const query = `SELECT * FROM customer_sessions ORDER BY rowid DESC`;
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const currentTime = new Date();
        let activeOccupancyCount = 0;

        const structuralPayload = rows.map(row => {
            const timeDiff = new Date(row.end_time) - currentTime;
            const isExpired = timeDiff <= 0;
            if (!isExpired) activeOccupancyCount++;

            return {
                id: row.id,
                name: row.name,
                contact: row.contact,
                durationLabel: row.duration_minutes === 1 ? "1 Min Demo" : `${row.duration_minutes / 60} Hour(s)`,
                endTime: row.end_time,
                expiredFlag: isExpired
            };
        });

        res.json({
            activeOccupancy: activeOccupancyCount,
            totalLogsRegistered: rows.length,
            records: structuralPayload
        });
    });
});

app.listen(PORT, () => console.log(`Secure Wiijump Backend running on http://localhost:${PORT}`));
