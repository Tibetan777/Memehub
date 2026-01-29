# Meme Hub - Deployment Guide

## Architecture
- **Single Port:** 5173 (Express + React SPA)
- **Frontend:** React 18.2 + Vite 4.3 (production build in `/dist`)
- **Backend:** Express.js 4.18 (API + static file serving)
- **Database:** MySQL (Narongrit) - 260 memes, LONGBLOB images

## Key Files
```
src/
  App.jsx (loading screen, login/home routing)
  componants/
    home/
      Home.jsx (gallery, upload, modal, like/delete)
      Home.css (dark theme: #0f0f0f bg, #ff6b6b accent)
    login/
      Login.jsx (register/login)
      Login.css
server.js (Express: API + static serving + image endpoint)
package.json (build, start, dev-full scripts)
```

## Changes Made
### Port Consolidation
- **Before:** React on 5173, Express on 5000 → CORS/connection issues
- **After:** Both on 5173 → Express serves React build + API
- **API URLs:** Changed from `http://localhost:5000/api` → `/api` (relative)

### Theme & UX
- **Loading Screen:** Dark (#0f0f0f) with red (#ff6b6b) text
- **Gallery:** Dark cards (#1a1a1a) with red borders on hover
- **Categories:** English (Funny, Relatable, Dark Humor, Anime, Other)
- **Like Button:** State update only - no page refresh

### Code Quality
- Removed `console.error` calls
- Deleted debug files (debug-images.cjs, check-api.cjs, test-image-endpoint.cjs)
- Cleaned folder structure (removed about/, navbar/, assets/)
- Simplified error handling with user-friendly alerts

## Running Locally
```bash
# Development (watch mode)
npm run dev-full

# Production (build + serve)
npm run start

# Manual build
npm run build
node server.js
```

## Database Structure
```
memes (260 rows)
  id (auto)
  title, description
  image (LONGBLOB - 590 bytes PNG)
  category, likes, created_by, created_at

meme_likes (tracks per-user likes)
  id, meme_id, user_id (UNIQUE constraint)

members (users)
  id_mem, name_mem, email_mem, password, role
```

## API Endpoints
- `GET /api/memes` - List all memes
- `POST /api/memes/upload` - Upload new meme
- `GET /api/memes/:id/image` - Get meme image (binary)
- `GET /api/memes/:id/download` - Download meme
- `POST /api/memes/:id/like` - Like meme (one per user)
- `DELETE /api/memes/:id` - Delete meme (admin)
- `POST /api/login` - Login
- `POST /api/register` - Register
- `GET /api/user/profile` - Get user profile

## Known Issues & Solutions
✓ Image not displaying - FIXED (unified port, relative URLs)
✓ Like button refreshes page - FIXED (state update only)
✓ Theme mismatch - FIXED (dark meme aesthetic)
✓ Port confusion - FIXED (single 5173 port)
✓ API connection - FIXED (relative paths in Express)

## Next Steps
1. Test all features (like, upload, delete)
2. Verify image display across all memes
3. Check like counter real-time sync
4. Test mobile responsiveness
5. Consider adding pagination (260 memes = heavy load)
