const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
// Serve the front-end files out of the current directory
app.use(express.static(__dirname));

// Initialize local SQLite File Database
const db = new sqlite3.Database('./wiijump_vms.db', (err) => {
    if (err) console.error('Database configuration error:', err.message);
    console.log('Connected to the secure local SQLite database archive.');
});

// Structural schema build setup matching thesis specifications
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

// API Route: Register and insert a new customer intake row safely
app.post('/api/sessions', (req, { json, status }) => {
    const { name, contact, duration } = req.body;
    if (!name || !contact || !duration) {
        return status(400).json({ error: 'Required fields missing.' });
    }

    const sessionId = 'WJ-' + Math.floor(1000 + Math.random() * 9000);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const query = `INSERT INTO customer_sessions (id, name, contact, duration_minutes, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [sessionId, name, contact, duration, startTime.toISOString(), endTime.toISOString()], function(err) {
        if (err) return status(500).json({ error: err.message });
        json({ success: true, message: 'Intake synchronized to server registry.' });
    });
});

// API Route: Fetch live telemetry logs and clean expired active metrics
app.get('/api/sessions/live', (req, res) => {
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

app.listen(PORT, () => console.log(`Wiijump Backend running on http://localhost:${PORT}`));
