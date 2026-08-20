const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { cloudinary } = require('./cloudinary');

/**
 * Receipt uploader for fund transactions.
 *
 * Deliberately NOT the shared `upload` from utils/cloudinary.js: that one has
 * no size limit and no format whitelist, and files everything under
 * `resource_center`. This follows the stricter profile-picture uploader in
 * routes/users.js instead.
 *
 * Images only. Cloudinary blocks PDF delivery by default on newer accounts
 * (Settings -> Security -> "Allow delivery of PDF and ZIP files"), so a PDF
 * would upload happily and then 404 when anyone tried to view it. If that
 * setting is enabled on the account, add 'pdf' below and set
 * `resource_type: 'auto'` — note that PDFs land under /raw/upload/ and cannot
 * be rendered in an <img>.
 */
const receiptStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return {
      folder: 'fund_receipts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      // Cap the stored size. Phone photos are routinely 4000px wide and the
      // account is on the free tier.
      transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
      public_id: `receipt-${req.user._id}-${uniqueSuffix}`,
    };
  },
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { uploadReceipt };
