# Azurro Hotel - Cleaner Management App

A phone-friendly web application for logging hotel cleaner activities with photo capture using the device's rear camera.

## Features

- ✅ **Cleaner Name Input** - Simple text field for cleaner identification
- ✅ **Property Selection** - Choose from 5 hotel properties:
  - Surry Hills
  - Central Sydney
  - Potts Point
  - Darling Harbour
  - Pyrmont Budget Hotel
- ✅ **Rear Camera Photo Capture** - Uses device rear camera for photos (no file uploads)
- ✅ **Mobile Responsive** - Fully optimized for phone browsers
- ✅ **Photo Gallery** - View all submitted cleaning logs with photos
- ✅ **SQLite Database** - Local database for storing cleaning records

## Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Database**: SQLite3 (better-sqlite3)
- **Template Engine**: EJS

## Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Mobile Deployment

On a smartphone:
1. Navigate to your VPS IP address and port: `http://your-vps-ip:3000`
2. Fill in the cleaner name
3. Select the property
4. Tap "Start Camera" to activate the rear camera
5. Tap "Capture" to take a photo
6. Review the photo and retake if needed
7. Submit the cleaning log
8. View all logs in the gallery

### Desktop Testing

- Use Chrome DevTools to simulate mobile devices
- Test camera functionality on actual mobile devices

## Project Structure

```
azurro-hotel/
├── app.js                 # Main Express application
├── package.json           # Dependencies configuration
├── public/               # Static files (CSS, images)
├── views/               # EJS templates
│   ├── index.ejs        # Main form page
│   └── gallery.ejs      # Gallery view
└── database/
    ├── db.js            # Database module
    └── cleanings.db     # SQLite database (auto-created)
```

## API Endpoints

- `GET /` - Main form page
- `GET /gallery` - View all cleaning logs
- `POST /api/cleanings` - Submit a new cleaning log
- `GET /api/cleanings` - Get all cleaning logs (JSON)
- `GET /api/cleaning/:id` - Get specific cleaning log (JSON)

## Deployment on VPS

1. SSH into your VPS
2. Install Node.js if not already installed
3. Clone or upload the project files
4. Install dependencies: `npm install`
5. Start the application: `npm start`
6. For production use PM2:
   ```bash
   npm install -g pm2
   pm2 start app.js --name "azurro-hotel"
   pm2 startup
   pm2 save
   ```

## Browser Compatibility

- Chrome/Edge (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Safari (iOS & Mac)
- Mobile browsers with camera access support

## Requirements Met

✅ Cleaner Name input  
✅ Property selection (5 options)  
✅ Rear camera photo capture (no file uploads)  
✅ Phone-compatible responsive design  
✅ Node.js + Express + SQLite stack  
✅ Deployable on VPS (standard Node.js)  

## Notes

- Photos are stored as base64 data URLs in the SQLite database
- Camera access requires HTTPS on production deployments (or localhost/127.0.0.1)
- Rear camera availability depends on device support
- The app gracefully falls back if camera is unavailable
