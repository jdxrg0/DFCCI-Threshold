const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../utils/cloudinary');

// GET all resources
router.get('/', requireAuth, async (req, res) => {
  try {
    const resources = await Resource.find().sort({ createdAt: -1 }).populate('uploadedBy', 'displayName email');
    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single resource by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id).populate('uploadedBy', 'displayName email');
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new resource (Admin only)
router.post('/', requireAuth, requireRole(['ADMIN']), upload.fields([{ name: 'file', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, category, tags, description } = req.body;
    
    const file = req.files && req.files['file'] ? req.files['file'][0] : null;
    const coverImage = req.files && req.files['coverImage'] ? req.files['coverImage'][0] : null;

    const newResource = new Resource({
      title,
      author,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      description,
      fileUrl: file ? file.path : undefined,
      cloudinaryId: file ? file.filename : undefined,
      coverImageUrl: coverImage ? coverImage.path : undefined,
      coverCloudinaryId: coverImage ? coverImage.filename : undefined,
      uploadedBy: req.user._id
    });

    await newResource.save();
    
    // Populate uploadedBy before sending response
    await newResource.populate('uploadedBy', 'displayName email');
    
    res.status(201).json(newResource);
  } catch (error) {
    console.error('Error uploading resource:', error);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

// PUT update resource (Admin only)
router.put('/:id', requireAuth, requireRole(['ADMIN']), upload.fields([{ name: 'file', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, category, tags, description } = req.body;
    
    const file = req.files && req.files['file'] ? req.files['file'][0] : null;
    const coverImage = req.files && req.files['coverImage'] ? req.files['coverImage'][0] : null;
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    resource.title = title || resource.title;
    resource.author = author !== undefined ? author : resource.author;
    resource.category = category !== undefined ? category : resource.category;
    if (tags !== undefined) {
      resource.tags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    }
    resource.description = description !== undefined ? description : resource.description;

    if (file) {
      if (resource.cloudinaryId) {
        await cloudinary.uploader.destroy(resource.cloudinaryId);
      }
      resource.fileUrl = file.path;
      resource.cloudinaryId = file.filename;
    }

    if (coverImage) {
      if (resource.coverCloudinaryId) {
        await cloudinary.uploader.destroy(resource.coverCloudinaryId);
      }
      resource.coverImageUrl = coverImage.path;
      resource.coverCloudinaryId = coverImage.filename;
    }

    await resource.save();
    await resource.populate('uploadedBy', 'displayName email');
    
    res.json(resource);
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ message: 'Server error during update' });
  }
});

// DELETE resource (Admin only)
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    // Delete from Cloudinary
    if (resource.cloudinaryId) {
      await cloudinary.uploader.destroy(resource.cloudinaryId);
    }
    
    if (resource.coverCloudinaryId) {
      await cloudinary.uploader.destroy(resource.coverCloudinaryId);
    }

    await resource.deleteOne();
    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
