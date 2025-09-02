const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists (required for multer storage)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log("'uploads' directory created");
}

// MongoDB connection URI from environment variable
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI env var not set");
  process.exit(1);
}

// Connect to MongoDB with error handling
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// User schema (Note: store hashed passwords in production!)
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

// Multer config to save files in 'uploads' folder
const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadsDir) },
  filename(req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// User login route with try-catch error handling
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) return res.json({ success: true, userId: user._id });
    res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload music files route with error handling
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

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
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to save tracks" });
  }
});

// Get user's uploaded tracks route with error handling
app.get('/api/tracks/:userId', async (req, res) => {
  try {
    const tracks = await Track.find({ userId: req.params.userId });
    res.json(tracks);
  } catch (err) {
    console.error("Fetch tracks error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Global error handling middleware (for uncaught errors)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Listen on the port Railway sets (or default 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
