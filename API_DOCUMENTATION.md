# Azurro Hotel Cleaner Management API Documentation

## Overview
RESTful API for managing hotel cleaning logs with photo capture, role-based access control, and admin visibility management.

## Base URL
```
http://localhost:3000
```

## Authentication
- **Admin operations**: Requires valid admin session via HTTP-only cookie `adminToken`
- **Public operations**: No authentication required

## Rate Limiting
- **Login endpoint**: 5 requests per 15 minutes per IP
- **API endpoints**: 100 requests per minute per IP
- **General endpoints**: 300 requests per minute per IP

Response headers include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: ISO timestamp when limit resets

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "message": "Error description",
    "status": 400,
    "timestamp": "2026-03-22T10:30:00.000Z",
    "requestId": "optional-request-id"
  }
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized
- `404`: Not found
- `429`: Too many requests (rate limit exceeded)
- `500`: Server error

---

## Endpoints

### Public Endpoints

#### GET /
Returns the form page to submit cleaning logs

#### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-22T10:30:00.000Z",
  "uptime": 3600.5
}
```

#### GET /gallery
View all public cleaning logs (paginated)

**Query Parameters:**
- `page` (optional): Page number (default: 1)

**Response:**
```json
{
  "currentPage": 1,
  "totalPages": 5,
  "total": 45
}
```

#### GET /api/cleanings
Get all public cleaning logs (JSON format)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (max: 50, default: 10)

**Response:**
```json
{
  "cleanings": [
    {
      "id": 1,
      "cleanerName": "John",
      "property": "Surry Hills",
      "roomNumber": "101",
      "photoData": "/uploads/photo_1234567890.jpg",
      "timestamp": "2026-03-22T10:30:00.000Z",
      "visibility": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

#### POST /api/cleanings
Submit a new cleaning log

**Request Body:**
```json
{
  "cleanerName": "John",
  "property": "Surry Hills",
  "roomNumber": "101",
  "photoData": "data:image/jpeg;base64,..."
}
```

**Validation:**
- `cleanerName`: Required, 1-100 characters
- `property`: Required, must be one of: Surry Hills, Central Sydney, Potts Point, Darling Harbour, Pyrmont Budget Hotel
- `roomNumber`: Required, 1-20 characters
- `photoData`: Required, base64 encoded JPEG image

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

#### GET /api/cleaning/:id
Get a specific cleaning log

**Response:**
```json
{
  "id": 1,
  "cleanerName": "John",
  "property": "Surry Hills",
  "roomNumber": "101",
  "photoData": "/uploads/photo_1234567890.jpg",
  "timestamp": "2026-03-22T10:30:00.000Z",
  "visibility": 1
}
```

---

### Admin Endpoints

#### POST /admin-login
Authenticate as admin

**Request Body:**
```json
{
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true
}
```

Sets HTTP-only cookie `adminToken` in response

#### GET /admin-panel
Admin dashboard (requires authentication)

**Query Parameters:**
- `page` (optional): Page number (default: 1)

Returns HTML admin interface

#### PUT /api/cleaning/:id
Update a cleaning log (admin only)

**Headers:**
- Cookie: `adminToken=<token>` (automatically sent by browser)

**Request Body:**
```json
{
  "cleanerName": "John Updated",
  "property": "Central Sydney",
  "roomNumber": "102"
}
```

**Response:**
```json
{
  "success": true
}
```

#### DELETE /api/cleaning/:id
Soft delete a cleaning log (admin only)

**Headers:**
- Cookie: `adminToken=<token>`

**Response:**
```json
{
  "success": true
}
```

#### POST /api/admin/toggle-visibility/:id
Toggle visibility of cleaning log (admin only)

**Headers:**
- Cookie: `adminToken=<token>`

**Response:**
```json
{
  "success": true,
  "visibility": 0
}
```

#### POST /logout
Logout and invalidate session

**Response:**
```json
{
  "success": true
}
```

---

## Properties
Valid property values:
- Surry Hills
- Central Sydney
- Potts Point
- Darling Harbour
- Pyrmont Budget Hotel

---

## Examples

### Submit a cleaning log
```bash
curl -X POST http://localhost:3000/api/cleanings \
  -H "Content-Type: application/json" \
  -d '{
    "cleanerName": "John",
    "property": "Surry Hills",
    "roomNumber": "101",
    "photoData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
  }'
```

### Get cleaning logs
```bash
curl http://localhost:3000/api/cleanings?page=1&limit=10
```

### Login as admin
```bash
curl -X POST http://localhost:3000/admin-login \
  -H "Content-Type: application/json" \
  -d '{"password": "admin123"}' \
  -c cookies.txt
```

### Update cleaning log
```bash
curl -X PUT http://localhost:3000/api/cleaning/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "cleanerName": "Jane",
    "property": "Central Sydney",
    "roomNumber": "102"
  }'
```

---

## Security Features
- XSS prevention via data attributes and HTML escaping
- CSRF protection via SameSite cookies
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- Secure password hashing with bcriptjs
- HTTP-only secure cookies for sessions
- CSP and security headers
- Soft delete protection (data never truly deleted)

---

## Performance Features
- Response compression (gzip)
- Database query optimization with indexes
- Pagination support
- Session persistence in database
- Efficient photo storage as files (not base64 in DB)

---

## Monitoring
- Access logs via Winston
- Error logs in `./logs/error.log`
- Combined logs in `./logs/combined.log`
- Request timing in logs
- Health check endpoint for monitoring systems
