const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI env var not set");
  process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(console.error);

// User schema (for demo, password plain text — improve with hashing)
const UserSchema = new mongoose.Schema({
  username: String,
  password: String
});
const User = mongoose.model('User', UserSchema);

// Track schema
const TrackSchema = new mongoose.Schema({
  userId: String,
  filename: String,
  url: String,
  metadata: Object,
});
const Track = mongoose.model('Track', TrackSchema);

// Multer config to store files in uploads folder
const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, 'uploads/') },
  filename(req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage });

// Static serve for uploaded audio
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) return res.json({ success: true, userId: user._id });
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Upload music files endpoint
app.post('/api/upload', upload.array('files'), async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const savedTracks = [];
    for (const file of req.files) {
      const track = new Track({
        userId,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
        metadata: {}
      });
      await track.save();
      savedTracks.push(track);
    }
    res.json(savedTracks);
  } catch(err) {
    res.status(500).json({ error: "Failed to save tracks" });
  }
});

// Get user's uploaded tracks
app.get('/api/tracks/:userId', async (req, res) => {
  const tracks = await Track.find({ userId: req.params.userId });
  res.json(tracks);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
