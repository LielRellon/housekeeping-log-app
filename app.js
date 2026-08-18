const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./database/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const winston = require('winston');
const compression = require('compression');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

// Import middleware and utilities
const { validateEnvironment } = require('./config/environment');
const { sanitizeRequest } = require('./middleware/sanitizer');
const { errorHandler, notFoundHandler, asyncHandler, setErrorLogger } = require('./middleware/errorHandler');
const { loginRateLimiter, apiRateLimiter, generalRateLimiter } = require('./middleware/rateLimiter');

// Validate environment before starting
const config = validateEnvironment();

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'housekeeping-log' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Set error logger for middleware
setErrorLogger(logger);

// Create logs directory if it doesn't exist
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = './public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    cb(null, `photo_${timestamp}_${random}.jpg`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Middleware
app.use(compression()); // Enable compression
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Apply sanitization middleware to all requests
app.use(sanitizeRequest);

// Apply rate limiting to all requests
app.use(generalRateLimiter);

// Disable cache for uploaded files to prevent 304 responses
app.use('/uploads', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.removeHeader('ETag');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Capture response time
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} completed`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
  next();
});

// Properties validation
const VALID_PROPERTIES = ['Riverside', 'City Central', 'Harbourview', 'Marina Quay', 'Parkside Budget Hotel'];
function isValidProperty(prop) {
  return VALID_PROPERTIES.includes(prop);
}

// Input validation
function validateInput(cleanerName, property, roomNumber) {
  if (!cleanerName || cleanerName.trim().length === 0 || cleanerName.length > 100) {
    return 'Cleaner name must be 1-100 characters';
  }
  if (!isValidProperty(property)) {
    return 'Invalid property selected';
  }
  if (!roomNumber || roomNumber.trim().length === 0 || roomNumber.length > 20) {
    return 'Room number must be 1-20 characters';
  }
  return null;
}

// Initialize database
db.init();

// Routes
app.get('/', (req, res) => {
  res.render('index', { properties: db.getProperties() });
});

app.get('/api/cleanings', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    
    const cleanings = await db.getCleaningsPaginated(limit, offset);
    const total = await db.getCleaningsCount();
    
    res.json({
      cleanings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cleanings', upload.single('photo'), async (req, res) => {
  try {
    const { cleanerName, property, roomNumber } = req.body;
    
    // Validate form fields
    if (!cleanerName || !property || !roomNumber) {
      return res.status(400).json({ error: 'Missing required fields: cleanerName, property, roomNumber' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file uploaded' });
    }

    // Validate all inputs
    const validationError = validateInput(cleanerName, property, roomNumber);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Verify file was saved and get file stats
    const fileStats = fs.statSync(req.file.path);
    const fileSizeKB = fileStats.size / 1024;
    
    logger.info(`Photo uploaded: ${req.file.filename}, size: ${req.file.size} bytes (${fileSizeKB.toFixed(2)} KB)`);

    // Store file path in database
    const photoPath = `/uploads/${req.file.filename}`;
    const result = await db.insertCleaning(cleanerName, property, roomNumber, photoPath);
    
    logger.info(`Cleaning record created with ID: ${result}, photo: ${photoPath}`);
    res.json({ success: true, id: result, photoPath: photoPath, fileSize: req.file.size });
  } catch (error) {
    logger.error('Error in POST /api/cleanings:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;
    
    const cleanings = await db.getCleaningsPaginated(limit, offset);
    const total = await db.getCleaningsCount();
    const totalPages = Math.ceil(total / limit);
    
    res.render('gallery', { 
      cleanings, 
      currentPage: page,
      totalPages,
      total
    });
  } catch (error) {
    res.render('gallery', { 
      cleanings: [], 
      currentPage: 1,
      totalPages: 0,
      total: 0
    });
  }
});

app.delete('/api/cleaning/:id', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'] || req.cookies?.adminToken;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const session = await db.getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await db.deleteCleaning(req.params.id);
    logger.info(`Cleaning deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete cleaning error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/cleaning/:id', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'] || req.cookies?.adminToken;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const session = await db.getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { cleanerName, property, roomNumber } = req.body;
    
    if (!cleanerName || !property || !roomNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate all inputs
    const validationError = validateInput(cleanerName, property, roomNumber);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.updateCleaning(req.params.id, cleanerName, property, roomNumber);
    logger.info(`Cleaning updated: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Update cleaning error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Panel - Session Management
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
const SESSION_TTL_MS = (process.env.SESSION_TTL_MINUTES || 15) * 60 * 1000; // 15 minutes default

// Cleanup expired sessions from database every 5 minutes
const cleanupInterval = setInterval(async () => {
  try {
    await db.cleanupExpiredSessions();
    logger.info('Cleaned up expired sessions');
  } catch (error) {
    logger.error('Error cleaning up sessions:', error);
  }
}, 5 * 60 * 1000);
cleanupInterval.unref(); // Don't keep process alive for this timer

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Prevent caching of admin-panel
app.get('/admin-panel', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.get('/admin-panel', async (req, res) => {
  const token = req.cookies?.adminToken;
  if (!token) {
    return res.render('admin-panel', { authenticated: false, error: null });
  }

  try {
    const session = await db.getSession(token);
    if (!session) {
      return res.render('admin-panel', { authenticated: false, error: null });
    }
    
    // Update session expiry
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await db.updateSessionExpiry(token, expiresAt);
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;
    
    const [cleanings, total] = await Promise.all([
      db.getCleaningsAdminPaginated(limit, offset),
      db.getCleaningsCountAdmin()
    ]);
    
    const totalPages = Math.ceil(total / limit);
    res.render('admin-panel', { 
      cleanings, 
      authenticated: true, 
      error: null,
      currentPage: page,
      totalPages,
      total
    });
  } catch (err) {
    logger.error('Admin panel error:', err);
    res.render('admin-panel', { 
      cleanings: [], 
      authenticated: false, 
      error: 'Error loading admin panel'
    });
  }
});

app.post('/admin-login', loginRateLimiter, async (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    logger.warn(`Invalid password format from IP: ${ip}`);
    return res.status(400).json({ error: 'Password required' });
  }
  
  if (bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    try {
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      
      await db.createSession(token, expiresAt, ip);
      
      logger.info(`Admin login successful from IP: ${ip}`);
      
      res.cookie('adminToken', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: SESSION_TTL_MS
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error creating session:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  } else {
    logger.warn(`Failed login attempt from IP: ${ip}`);
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/admin/toggle-visibility/:id', async (req, res) => {
  const token = req.cookies?.adminToken;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const session = await db.getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Update session expiry
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await db.updateSessionExpiry(token, expiresAt);

    const newVisibility = await db.toggleVisibility(req.params.id);
    logger.info(`Visibility toggled for cleaning: ${req.params.id}`);
    res.json({ success: true, visibility: newVisibility });
  } catch (error) {
    logger.error('Toggle visibility error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/logout', async (req, res) => {
  const token = req.cookies?.adminToken;
  if (token) {
    try {
      await db.deleteSession(token);
      logger.info('Admin logged out');
    } catch (error) {
      logger.error('Logout error:', error);
    }
  }
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 and error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server only if this module is run directly (not in tests)
let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📝 External access: http://YOUR_MAC_IP:${PORT}`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

function gracefulShutdown() {
  logger.info('Received shutdown signal, closing gracefully...');
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Cleanup expired sessions before closing
        await db.cleanupExpiredSessions();
        
        // Close database connection
        if (db.close) {
          db.close();
        }
        
        logger.info('Database closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Force shutdown: could not close connections in time');
    process.exit(1);
  }, 10000);
}

module.exports = app;
