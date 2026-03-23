const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const upload = require('../middleware/uploadMiddleware');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, postController.getAllPosts);
// Đường dẫn: GET http://localhost:3000/api/posts
// router.get('/', postController.getAllPosts);

// Đường dẫn: GET http://localhost:3000/api/posts/friends/1
router.get('/friends/:userId', postController.getFriendPosts);

// API Đăng bài: Kiểm tra Token trước -> Thu nhận ảnh 'image' -> Lưu vào DB
router.post('/upload', verifyToken, upload.single('image'), postController.createPost);

module.exports = router;