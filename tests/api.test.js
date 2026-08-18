const request = require('supertest');
const app = require('../app');
const db = require('../database/db');

describe('Housekeeping Log API', () => {
  let server;

  beforeAll((done) => {
    db.init();
    // Don't start our own server - supertest will handle it
    done();
  });

  afterAll((done) => {
    // Close the database
    setTimeout(() => {
      try {
        db.close();
      } catch (e) {
        // Ignore
      }
      done();
    }, 100);
  });

  // Test health endpoint
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  // Test home page
  describe('GET /', () => {
    it('should return 200 and render home page', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('Housekeeping Log');
    });
  });

  // Test gallery page
  describe('GET /gallery', () => {
    it('should return 200 and render gallery', async () => {
      const response = await request(app)
        .get('/gallery')
        .expect(200);

      expect(response.text).toContain('Cleaning Logs');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/gallery?page=1')
        .expect(200);

      expect(response.text).toContain('Cleaning Logs');
    });
  });

  // Test POST /api/cleanings
  describe('POST /api/cleanings', () => {
    it('should reject request without required fields', async () => {
      const response = await request(app)
        .post('/api/cleanings')
        .send({
          cleanerName: 'John'
          // missing property and roomNumber
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid property', async () => {
      const response = await request(app)
        .post('/api/cleanings')
        .send({
          cleanerName: 'John',
          property: 'Invalid Property',
          roomNumber: '101',
          photoData: 'data:image/jpeg;base64,test'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid property');
    });

    it('should reject cleaner name that is too long', async () => {
      const longName = 'a'.repeat(101);
      const response = await request(app)
        .post('/api/cleanings')
        .send({
          cleanerName: longName,
          property: 'Riverside',
          roomNumber: '101',
          photoData: 'data:image/jpeg;base64,test'
        })
        .expect(400);

      expect(response.body.error).toContain('1-100 characters');
    });

    it('should reject room number that is too long', async () => {
      const longRoomNumber = 'a'.repeat(21);
      const response = await request(app)
        .post('/api/cleanings')
        .send({
          cleanerName: 'John',
          property: 'Riverside',
          roomNumber: longRoomNumber,
          photoData: 'data:image/jpeg;base64,test'
        })
        .expect(400);

      expect(response.body.error).toContain('1-20 characters');
    });
  });

  // Test GET /api/cleanings
  describe('GET /api/cleanings', () => {
    it('should return paginated cleanings', async () => {
      const response = await request(app)
        .get('/api/cleanings')
        .expect(200);

      expect(response.body).toHaveProperty('cleanings');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should support custom page and limit', async () => {
      const response = await request(app)
        .get('/api/cleanings?page=1&limit=5')
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  // Test admin login
  describe('POST /admin-login', () => {
    it('should reject empty password', async () => {
      const response = await request(app)
        .post('/admin-login')
        .send({});
      
      expect([400, 401]).toContain(response.status);
    });

    it('should accept valid password', async () => {
      const response = await request(app)
        .post('/admin-login')
        .send({ password: process.env.ADMIN_PASSWORD || 'admin123' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/admin-login')
        .send({ password: 'wrongpassword' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  // Test admin panel
  describe('GET /admin-panel', () => {
    it('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/admin-panel')
        .expect(200);

      expect(response.text).toContain('Admin Login');
    });
  });

  // Test 404 handler
  describe('404 Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/nonexistent-route')
        .expect(404);
    });
  });
});
