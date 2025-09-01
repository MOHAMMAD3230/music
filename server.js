const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI environment variable not set");
  process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Define schemas
const trackSchema = new mongoose.Schema({
  userId: String,
  filename: String, // Stored filename
  originalname: String, // User's file name
  url: String,         // For streaming URL
  metadata: Object,
});

const Track = mongoose.model('Track', trackSchema);

// Dummy user for demo login
const USER = { username: 'user', password: 'password', id: 'demo-user-id' };

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USER.username && password === USER.password) {
    return res.json({ authenticated: true, userId: USER.id });
  }
  res.status(401).json({ authenticated: false, error: 'Invalid credentials' });
});

// Upload offline music files
app.post('/api/upload-offline', upload.array('files'), async (req, res) => {
  const userId = req.body.userId;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const tracks = [];
    for (const file of req.files) {
      const track = new Track({
        userId,
        filename: file.filename,
        originalname: file.originalname,
        url: `/uploads/${file.filename}`,
        metadata: {},
      });
      await track.save();
      tracks.push(track);
    }
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save tracks' });
  }
});

// Get user offline tracks
app.get('/api/user-offline-tracks/:userId', async (req, res) => {
  const { userId } = req.params;
  const tracks = await Track.find({ userId });
  res.json(tracks);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
