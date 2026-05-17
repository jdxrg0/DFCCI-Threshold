const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary with env variables
// The user needs to set these in their .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    let baseName = file.fieldname;
    if (req.body && req.body.title) {
      // Slugify the title (e.g. "My Book 123!" -> "my-book-123")
      baseName = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      if (file.fieldname === 'coverImage') {
        baseName += '-cover';
      }
    }
    
    let public_id = baseName + '-' + uniqueSuffix;
    
    // Cloudinary strips extensions for 'raw' documents unless explicitly included in the public_id.
    // We append the extension for non-image files so they download correctly as .docx, .zip, etc.
    if (file.originalname && !file.mimetype.startsWith('image/')) {
      const ext = file.originalname.split('.').pop();
      public_id += `.${ext}`;
    }

    return {
      folder: 'resource_center',
      resource_type: 'auto',
      public_id: public_id,
    };
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
