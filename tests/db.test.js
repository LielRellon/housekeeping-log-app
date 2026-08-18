const db = require('../database/db');

describe('Database Functions', () => {
  beforeAll((done) => {
    db.init();
    // Give the database time to initialize
    setTimeout(done, 100);
  });

  afterAll((done) => {
    // Cleanup and close the database
    setTimeout(() => {
      try {
        db.close();
      } catch (e) {
        // Ignore
      }
      done();
    }, 100);
  });

  // Test property validation
  describe('getProperties', () => {
    it('should return array of properties', () => {
      const properties = db.getProperties();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBeGreaterThan(0);
    });

    it('should include Riverside', () => {
      const properties = db.getProperties();
      expect(properties).toContain('Riverside');
    });
  });

  // Test insertion
  describe('insertCleaning', () => {
    it('should insert a cleaning record', async () => {
      const result = await db.insertCleaning(
        'Test Cleaner',
        'Riverside',
        '101',
        '/test/photo.jpg'
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
    });
  });

  // Test retrieval
  describe('getCleaning', () => {
    let testId;

    beforeAll(async () => {
      testId = await db.insertCleaning(
        'John Doe',
        'City Central',
        '202',
        '/test/photo.jpg'
      );
    });

    it('should retrieve a cleaning record by ID', async () => {
      const cleaning = await db.getCleaning(testId);
      expect(cleaning).toBeDefined();
      expect(cleaning.cleanerName).toBe('John Doe');
      expect(cleaning.roomNumber).toBe('202');
    });

    it('should return null for non-existent ID', async () => {
      const cleaning = await db.getCleaning(99999);
      expect(cleaning).toBeUndefined();
    });
  });

  // Test update
  describe('updateCleaning', () => {
    let testId;

    beforeAll(async () => {
      testId = await db.insertCleaning(
        'Original Name',
        'Harbourview',
        '303',
        '/test/photo.jpg'
      );
    });

    it('should update a cleaning record', async () => {
      await db.updateCleaning(testId, 'Updated Name', 'Harbourview', '304');
      const cleaning = await db.getCleaning(testId);
      expect(cleaning.cleanerName).toBe('Updated Name');
      expect(cleaning.roomNumber).toBe('304');
    });
  });

  // Test soft delete
  describe('deleteCleaning', () => {
    let testId;

    beforeAll(async () => {
      testId = await db.insertCleaning(
        'To Delete',
        'Marina Quay',
        '405',
        '/test/photo.jpg'
      );
    });

    it('should soft delete a cleaning record', async () => {
      await db.deleteCleaning(testId);
      const cleaning = await db.getCleaning(testId);
      expect(cleaning).toBeUndefined(); // Should be filtered out by soft delete
    });
  });

  // Test visibility toggle
  describe('toggleVisibility', () => {
    let testId;

    beforeAll(async () => {
      testId = await db.insertCleaning(
        'Visibility Test',
        'Parkside Budget Hotel',
        '505',
        '/test/photo.jpg'
      );
    });

    it('should toggle visibility', async () => {
      const initial = await db.getCleaning(testId);
      expect(initial.visibility).toBe(1); // Default visibility

      const newVis = await db.toggleVisibility(testId);
      expect(newVis).toBe(0);

      const updated = await db.getCleaning(testId);
      expect(updated.visibility).toBe(0);
    });
  });

  // Test pagination
  describe('getCleaningsPaginated', () => {
    it('should return paginated results', async () => {
      const cleanings = await db.getCleaningsPaginated(10, 0);
      expect(Array.isArray(cleanings)).toBe(true);
    });

    it('should respect offset', async () => {
      const first = await db.getCleaningsPaginated(5, 0);
      const second = await db.getCleaningsPaginated(5, 5);
      
      // Results should be different if there are enough records
      if (first.length > 0 && second.length > 0) {
        expect(first[0].id).not.toEqual(second[0].id);
      }
    });
  });

  // Test counts
  describe('getCleaningsCount', () => {
    it('should return a number', async () => {
      const count = await db.getCleaningsCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCleaningsCountAdmin', () => {
    it('should return a number', async () => {
      const count = await db.getCleaningsCountAdmin();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Test session management
  describe('Session Management', () => {
    beforeEach(async () => {
      // Clean up old sessions before each test
      await db.cleanupExpiredSessions();
    });

    it('should create a session', async () => {
      const token = 'test-token-' + Date.now() + Math.random();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      const result = await db.createSession(token, expiresAt, '127.0.0.1');
      expect(result).toBe(true);
    });

    it('should retrieve a valid session', async () => {
      const token = 'test-token-' + Date.now() + Math.random();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      await db.createSession(token, expiresAt, '127.0.0.1');
      const session = await db.getSession(token);
      
      expect(session).toBeDefined();
      expect(session.token).toBe(token);
    });

    it('should not retrieve expired sessions', async () => {
      const token = 'expired-token-' + Date.now() + Math.random();
      // Create session that expired 2 seconds ago
      const expiresAt = new Date(Date.now() - 2000).toISOString();
      
      await db.createSession(token, expiresAt, '127.0.0.1');
      
      // Wait a moment to ensure comparison happens after expiry
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const session = await db.getSession(token);
      
      expect(session).toBeNull();
    });

    it('should delete a session', async () => {
      const token = 'delete-token-' + Date.now() + Math.random();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      await db.createSession(token, expiresAt, '127.0.0.1');
      await db.deleteSession(token);
      
      const session = await db.getSession(token);
      expect(session).toBeNull();
    });
  });
});
