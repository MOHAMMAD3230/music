const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

app.use(cors());
app.use(express.json());

// Rate limiter: max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." }
});

// Mock user DB (replace with real DB in production)
const users = [
  { id: '1', username: 'user', passwordHash: bcrypt.hashSync('password', 10) }
];

// User playlists storage
const playlists = {};

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, userId: user.id });
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get current user's playlist
app.get('/api/playlists', apiLimiter, authenticate, (req, res) => {
  res.json(playlists[req.userId] || []);
});

// Add song to playlist
app.post('/api/playlists', apiLimiter, authenticate, (req, res) => {
  playlists[req.userId] = playlists[req.userId] || [];
  playlists[req.userId].push(req.body);
  res.status(201).json({ message: 'Song added' });
});

// Clear user's playlist
app.delete('/api/playlists', apiLimiter, authenticate, (req, res) => {
  playlists[req.userId] = [];
  res.json({ message: 'Playlist cleared' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
