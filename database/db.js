const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cleanings.db');
let db;

const properties = [
  'Surry Hills',
  'Central Sydney',
  'Potts Point',
  'Darling Harbour',
  'Pyrmont Budget Hotel'
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
      if (err) reject(err);
      else resolve(this.lastID);
    });
    stmt.finalize();
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
    // Get current visibility
    db.get('SELECT visibility FROM cleanings WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else if (!row) reject(new Error('Record not found'));
      else {
        // Toggle visibility
        const newVisibility = row.visibility === 1 ? 0 : 1;
        db.run(
          'UPDATE cleanings SET visibility = ? WHERE id = ?',
          [newVisibility, id],
          (err) => {
            if (err) reject(err);
            else resolve(newVisibility);
          }
        );
      }
    });
  });
}

function close() {
  if (db) {
    db.close();
  }
}

module.exports = {
  init,
  getProperties,
  insertCleaning,
  getAllCleanings,
  getAllCleaningsAdmin,
  getCleaning,
  deleteCleaning,
  updateCleaning,
  toggleVisibility,
  close
};
