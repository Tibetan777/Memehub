Meme Hub - User Guide

START THE APPLICATION

npm run dev-full

Then go to: http://localhost:5173

---

LOGIN

Test Account:
- Email: std.6666@ubru.ac.th  
- Password: 123456

Other Test Accounts:
- std.6667@ubru.ac.th / 123456
- std.6669@ubru.ac.th / 123456

OR click "Register" to create a new account

---

UPLOAD MEME

1. Enter meme title
2. Add description (optional)
3. Select category
4. Choose image file
5. Click "Upload"

Your meme will appear instantly in the gallery!

---

VIEW MEME DETAILS

1. Click on any meme image
2. View full image and details
3. See who uploaded it and when
4. Download the image
5. Click the X button to close

---

FEATURES

Like Memes
- Click "Like" button to add likes
- Like counter updates immediately

Download Images
- Click "Download" button to save meme
- Saved as PNG file with meme title

Creator Information
- See who uploaded each meme
- View upload date and time
- Check their email address

---

ADMIN FEATURES (If you have admin role)

Admin users can:
- Delete any inappropriate meme
- Ban members who upload inappropriate content
- Unban members
- Manage all platform content

Admin email: std.6666@ubru.ac.th (James)

---

REGISTRATION

To register a new account:
1. Click "Register" at login screen
2. Enter username
3. Enter email address
4. Enter password
5. Optionally add: gender, birthday, phone, address, ZIP code, country
6. Click "Register"

---

CATEGORIES

Available meme categories:
- ตลกๆ (Funny)
- น่ารัก (Cute)
- หลอน (Scary)
- มีจริง (Real)
- อื่นๆ (Other)

---

TROUBLESHOOTING

Images not showing:
- Refresh the page (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
- Check that XAMPP MySQL is running
- Restart the application

Can't upload:
- Make sure you're logged in
- Image file must be valid (JPG, PNG, GIF, etc.)
- File size should not exceed 50MB

Can't login:
- Check email and password are correct
- Make sure CAPS LOCK is off
- Try registering a new account

Server not running:
- Check XAMPP MySQL is ON
- Run: npm run dev-full again
- Make sure port 5000 and 5173 are not in use

---

COMMANDS

Start everything:
npm run dev-full

Backend only:
npm run server

Frontend only:
npm run dev

---

TECHNICAL INFO

Frontend: React + Vite (port 5173)
Backend: Express.js (port 5000)
Database: MySQL Narongrit
Storage: Images stored in database as BLOB

API Base URL: http://localhost:5000/api

---

DATABASE STRUCTURE

Members Table:
- id_mem (user ID)
- name_mem (username)
- email_mem (email)
- password_encrypted (encrypted password)
- role (user or admin)
- is_banned (account ban status)

Memes Table:
- id (meme ID)
- title (meme name)
- description (meme details)
- image (meme image file)
- category (meme type)
- likes (like counter)
- created_by (uploader ID)
- created_at (upload timestamp)

---

NOTES

- All images are stored in the database (not on disk)
- Memes are ordered by newest first
- Download saves as PNG file
- Max 50MB per upload
- Supports all common image formats
- Works on desktop, tablet, and mobile

---

For support or questions, contact: admin@memehub.local
