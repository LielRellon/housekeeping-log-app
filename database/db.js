const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cleanings.db');
let db;

const properties = [
  'Riverside',
  'City Central',
  'Harbourview',
  'Marina Quay',
  'Parkside Budget Hotel'
];

function init() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Connected to SQLite database');
    }
  });
  
  // Create table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS cleanings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cleanerName TEXT NOT NULL,
      property TEXT NOT NULL,
      roomNumber TEXT NOT NULL,
      photoData LONGTEXT NOT NULL,
      delete_flg INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add visibility column if it doesn't exist (for existing databases)
  db.run(`
    ALTER TABLE cleanings ADD COLUMN visibility INTEGER DEFAULT 1
  `, (err) => {
    // Ignore error if column already exists
    if (err && err.message.includes('duplicate')) {
      console.log('visibility column already exists');
    }
  });

  // Add photoFileName column if it doesn't exist (for file-based storage)
  db.run(`
    ALTER TABLE cleanings ADD COLUMN photoFileName TEXT
  `, (err) => {
    // Ignore error if column already exists
    if (err && err.message.includes('duplicate')) {
      console.log('photoFileName column already exists');
    }
  });

  // Create indexes for frequently queried columns
  db.run(`CREATE INDEX IF NOT EXISTS idx_delete_flg ON cleanings(delete_flg)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_visibility ON cleanings(visibility)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON cleanings(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_delete_visibility ON cleanings(delete_flg, visibility)`);

  // Create sessions table for persistent session storage
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      ip_address TEXT
    )
  `);
  
  // Create index on expires_at for cleanup queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_expires_at ON admin_sessions(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_delete_visibility ON cleanings(delete_flg, visibility)`);
}

function getProperties() {
  return properties;
}

function insertCleaning(cleanerName, property, roomNumber, photoData) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      'INSERT INTO cleanings (cleanerName, property, roomNumber, photoData) VALUES (?, ?, ?, ?)',
      (err) => {
        if (err) reject(err);
      }
    );
    stmt.run(cleanerName, property, roomNumber, photoData, function(err) {
      stmt.finalize();
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function getAllCleanings() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM cleanings WHERE delete_flg = 0 AND visibility = 1 ORDER BY timestamp DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
function getAllCleaningsAdmin() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM cleanings WHERE delete_flg = 0 ORDER BY timestamp DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
function getCleaning(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM cleanings WHERE id = ? AND delete_flg = 0', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function deleteCleaning(id) {
  return new Promise((resolve, reject) => {
    // Soft delete - just set the flag
    db.run('UPDATE cleanings SET delete_flg = 1 WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function updateCleaning(id, cleanerName, property, roomNumber) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE cleanings SET cleanerName = ?, property = ?, roomNumber = ? WHERE id = ?',
      [cleanerName, property, roomNumber, id],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

function toggleVisibility(id) {
  return new Promise((resolve, reject) => {
    // Atomic toggle: SET visibility = 1 - visibility
    // Then read the new value
    db.run('UPDATE cleanings SET visibility = 1 - visibility WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
      } else if (this.changes === 0) {
        reject(new Error('Record not found'));
      } else {
        // Get the new visibility value
        db.get('SELECT visibility FROM cleanings WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row.visibility);
        });
      }
    });
  });
}

function close() {
  if (db) {
    db.close();
  }
}

function getCleaningsPaginated(limit = 10, offset = 0) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM cleanings WHERE delete_flg = 0 AND visibility = 1 ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function getCleaningsAdminPaginated(limit = 10, offset = 0) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM cleanings WHERE delete_flg = 0 ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function getCleaningsCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM cleanings WHERE delete_flg = 0 AND visibility = 1', (err, row) => {
      if (err) reject(err);
      else resolve(row?.count || 0);
    });
  });
}

function getCleaningsCountAdmin() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM cleanings WHERE delete_flg = 0', (err, row) => {
      if (err) reject(err);
      else resolve(row?.count || 0);
    });
  });
}

// Session Management Functions
function createSession(token, expiresAt, ipAddress) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO admin_sessions (token, expires_at, ip_address) VALUES (?, ?, ?)',
      [token, expiresAt, ipAddress],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

function getSession(token) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM admin_sessions WHERE token = ?',
      [token],
      (err, row) => {
        if (err) reject(err);
        else {
          // Check if session is expired (compare ISO strings)
          if (row && row.expires_at > new Date().toISOString()) {
            resolve(row);
          } else {
            resolve(null);
          }
        }
      }
    );
  });
}

function updateSessionExpiry(token, expiresAt) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE admin_sessions SET expires_at = ? WHERE token = ?',
      [expiresAt, token],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

function deleteSession(token) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM admin_sessions WHERE token = ?',
      [token],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

function cleanupExpiredSessions() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      'DELETE FROM admin_sessions WHERE expires_at <= ?',
      [now],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

module.exports = {
  init,
  getProperties,
  insertCleaning,
  getAllCleanings,
  getAllCleaningsAdmin,
  getCleaningsPaginated,
  getCleaningsAdminPaginated,
  getCleaningsCount,
  getCleaningsCountAdmin,
  getCleaning,
  deleteCleaning,
  updateCleaning,
  toggleVisibility,
  createSession,
  getSession,
  updateSessionExpiry,
  deleteSession,
  cleanupExpiredSessions,
  close
};
