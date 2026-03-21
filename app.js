const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize database
db.init();

// Routes
app.get('/', (req, res) => {
  res.render('index', { properties: db.getProperties() });
});

app.get('/api/cleanings', async (req, res) => {
  try {
    const cleanings = await db.getAllCleanings();
    res.json(cleanings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cleanings', async (req, res) => {
  try {
    const { cleanerName, property, roomNumber, photoData } = req.body;
    
    if (!cleanerName || !property || !roomNumber || !photoData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.insertCleaning(cleanerName, property, roomNumber, photoData);
    res.json({ success: true, id: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cleaning/:id', async (req, res) => {
  try {
    const cleaning = await db.getCleaning(req.params.id);
    if (!cleaning) {
      return res.status(404).json({ error: 'Cleaning not found' });
    }
    res.json(cleaning);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/gallery', async (req, res) => {
  try {
    const cleanings = await db.getAllCleanings();
    res.render('gallery', { cleanings });
  } catch (error) {
    res.render('gallery', { cleanings: [] });
  }
});

app.delete('/api/cleaning/:id', async (req, res) => {
  try {
    await db.deleteCleaning(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cleaning/:id', async (req, res) => {
  try {
    const { cleanerName, property, roomNumber } = req.body;
    
    if (!cleanerName || !property || !roomNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await db.updateCleaning(req.params.id, cleanerName, property, roomNumber);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Panel
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
let adminSessions = {};

app.get('/admin-panel', (req, res) => {
  const sessionToken = req.query.token;
  if (sessionToken && adminSessions[sessionToken]) {
    // Authenticated
    db.getAllCleaningsAdmin().then(cleanings => {
      res.render('admin-panel', { cleanings, authenticated: true, token: sessionToken, error: null });
    }).catch(err => {
      res.render('admin-panel', { cleanings: [], authenticated: true, token: sessionToken, error: err.message });
    });
  } else {
    // Not authenticated, show login
    res.render('admin-panel', { authenticated: false, error: null });
  }
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15);
    adminSessions[token] = Date.now();
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/admin/toggle-visibility/:id', (req, res) => {
  const sessionToken = req.query.token;
  if (!sessionToken || !adminSessions[sessionToken]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.toggleVisibility(req.params.id).then(newVisibility => {
    res.json({ success: true, visibility: newVisibility });
  }).catch(error => {
    res.status(500).json({ error: error.message });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`External access: http://YOUR_MAC_IP:${PORT}`);
});
