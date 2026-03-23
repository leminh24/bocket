const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// Tự động làm sạch biến môi trường
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// cloudinary.config({ cloud_name, api_key, api_secret });

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'bocket_posts',
        allowed_formats: ['jpg', 'png', 'jpeg'],
    }
});

// Thêm bộ lọc lỗi cho Multer
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log("--- Multer bắt đầu nhận file ---");
        console.log("Tên file gốc:", file.originalname);
        cb(null, true);
    }
});

module.exports = upload;