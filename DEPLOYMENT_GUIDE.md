# Housekeeping Log Deployment Guide

## Prerequisites
- Node.js 16+ installed
- npm 8+ installed
- A VPS or cloud server with internet access
- SSL certificate (recommended for production)

---

## Local Development Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd azurroHotel
npm install
```

### 2. Configure Environment
Create `.env` file in project root:
```env
PORT=3000
NODE_ENV=development
ADMIN_PASSWORD=your-secure-password
DATABASE_PATH=database/cleanings.db
SESSION_TTL_MINUTES=15
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
```

### 3. Run Tests
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```

Access at `http://localhost:3000`

---

## Production Deployment (VPS)

### 1. SSH into VPS
```bash
ssh user@your-vps-ip
```

### 2. Clone Repository
```bash
cd /var/www
git clone <repository-url>
cd azurroHotel
npm install --production
```

### 3. Configure Production Environment
```bash
cp .env.example .env
nano .env
```

Update with production values:
```env
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=very-secure-random-password
DATABASE_PATH=/var/data/azurroHotel/cleanings.db
SESSION_TTL_MINUTES=30
LOG_LEVEL=warn
CORS_ORIGIN=https://your-domain.com
```

### 4. Create Data Directory
```bash
mkdir -p /var/data/azurroHotel
mkdir -p /var/www/azurroHotel/public/uploads
mkdir -p /var/www/azurroHotel/logs
chmod 755 /var/data/azurroHotel
chmod 755 /var/www/azurroHotel/public/uploads
chmod 755 /var/www/azurroHotel/logs
```

### 5. Setup Process Manager (PM2)
```bash
sudo npm install -g pm2

# Start the application
pm2 start app.js --name "azurro-hotel" \
  --env NODE_ENV=production \
  --max-memory-restart 500M \
  --error /var/log/azurro-hotel-error.log \
  --out /var/log/azurro-hotel-access.log

# Make it start on boot
pm2 startup
pm2 save
```

### 6. Setup Nginx Reverse Proxy
```bash
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/azurro-hotel
```

Add configuration:
```nginx
upstream azurro_hotel {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;

    location / {
        proxy_pass http://azurro_hotel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/azurro-hotel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
```

### 8. Database Backup (Optional)
Setup automated backups:
```bash
# Create backup script
echo '#!/bin/bash
cp /var/data/azurroHotel/cleanings.db /var/backups/cleanings-$(date +%Y%m%d-%H%M%S).db
# Keep only last 30 days
find /var/backups/cleanings-*.db -mtime +30 -delete' > /usr/local/bin/backup-azurro.sh

chmod +x /usr/local/bin/backup-azurro.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-azurro.sh
```

---

## Health Monitoring

### Check Application Status
```bash
pm2 status
pm2 logs azurro-hotel
```

### Monitor Endpoint
```bash
curl https://your-domain.com/health
```

### View Logs
```bash
tail -f /var/log/azurro-hotel-access.log
tail -f /var/log/azurro-hotel-error.log
```

---

## Updating Application

### Pull Latest Changes
```bash
cd /var/www/azurroHotel
git pull origin main
npm install --production
pm2 restart azurro-hotel
```

### Rollback (if needed)
```bash
git revert HEAD
npm install --production
pm2 restart azurro-hotel
```

---

## Performance Optimization

### Enable Gzip Compression
Already configured in Nginx above

### Configure Log Rotation
```bash
sudo nano /etc/logrotate.d/azurro-hotel
```

Add:
```
/var/log/azurro-hotel-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

### Monitor Server Resources
```bash
# CPU/Memory usage
pm2 monit

# Disk usage
df -h

# Process details
ps aux | grep node
```

---

## Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs azurro-hotel --err

# Check port is not in use
lsof -i :3000

# Check environment file
cat .env | grep -v "^#"
```

### Database locked error
```bash
# Restart application
pm2 restart azurro-hotel

# If persists, check database permissions
ls -la database/
```

### High memory usage
```bash
# Increase memory limit in pm2
pm2 restart azurro-hotel --max-memory-restart 1000M
```

### Rate limiting issues
Check client IP headers if behind reverse proxy:
```bash
# Verify X-Forwarded-For is being set
curl -H "X-Forwarded-For: 1.2.3.4" https://your-domain.com/health
```

---

## Security Checklist

- [ ] Change default admin password
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure firewall to allow only necessary ports (80, 443)
- [ ] Set NODE_ENV to 'production'
- [ ] Setup automated backups
- [ ] Enable log rotation
- [ ] Setup monitoring/alerting
- [ ] Regular security updates: `npm audit fix`
- [ ] Hide server details in Nginx: `server_tokens off;`
- [ ] Setup rate limiting (already configured in app)
- [ ] Regular database backups (at least daily)
- [ ] Monitor disk space and logs
- [ ] Setup process monitoring (pm2 is already used)

---

## Production Checklist

- [ ] All tests passing: `npm test`
- [ ] Environment variables configured
- [ ] Database directory created with proper permissions
- [ ] Logs directory created with proper permissions
- [ ] Uploads directory created with proper permissions
- [ ] SSL certificate installed
- [ ] Nginx reverse proxy configured
- [ ] PM2 configured and started
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Documentation updated
- [ ] Team trained on deployment/rollback procedures

---

## Support & Monitoring

### Recommended Tools
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry, Rollbar
- **Performance Monitoring**: New Relic, Datadog
- **Log Aggregation**: CloudWatch, ELK Stack

### Health Check Endpoint
Continuously monitor: `https://your-domain.com/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-22T10:30:00.000Z",
  "uptime": 36000
}
```
