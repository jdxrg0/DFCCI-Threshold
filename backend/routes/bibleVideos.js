const express = require('express');
const router = express.Router();
const BibleVideo = require('../models/BibleVideo');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../utils/cloudinary');

// GET all videos (sorted newest first)
router.get('/', requireAuth, async (req, res) => {
  try {
    const videos = await BibleVideo.find()
      .sort({ createdAt: -1 })
      .populate('postedBy', 'displayName email');
    res.json(videos);
  } catch (error) {
    console.error('Error fetching Bible videos:', error);
    res.status(500).json({ message: 'Server error fetching videos' });
  }
});

// POST upload new video (Admin only)
router.post('/', requireAuth, requireRole(['ADMIN']), upload.single('video'), async (req, res) => {
  try {
    const { title, caption } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const newVideo = new BibleVideo({
      title,
      caption: caption || '',
      videoUrl: file.path,
      cloudinaryId: file.filename,
      postedBy: req.user._id,
      likes: []
    });

    await newVideo.save();
    await newVideo.populate('postedBy', 'displayName email');

    res.status(201).json(newVideo);
  } catch (error) {
    console.error('Error uploading Bible video:', error);
    res.status(500).json({ message: 'Server error uploading video' });
  }
});

// DELETE video (Admin only)
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const video = await BibleVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Delete from Cloudinary
    if (video.cloudinaryId) {
      // Cloudinary video assets must specify resource_type: 'video'
      await cloudinary.uploader.destroy(video.cloudinaryId, { resource_type: 'video' });
    }

    await video.deleteOne();
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting Bible video:', error);
    res.status(500).json({ message: 'Server error deleting video' });
  }
});

// POST toggle like video
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const video = await BibleVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const userId = req.user._id;
    const index = video.likes.indexOf(userId);

    if (index === -1) {
      // Like
      video.likes.push(userId);
    } else {
      // Unlike
      video.likes.splice(index, 1);
    }

    await video.save();
    res.json({
      _id: video._id,
      likes: video.likes,
      likesCount: video.likes.length,
      isLiked: video.likes.includes(userId)
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error liking video' });
  }
});

module.exports = router;
