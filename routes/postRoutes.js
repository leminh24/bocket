const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const upload = require('../middleware/uploadMiddleware');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, postController.getAllPosts);
// Đường dẫn: GET http://localhost:3000/api/posts
// router.get('/', postController.getAllPosts);

router.get('/friends-feed', verifyToken, postController.getFriendPosts);

// API Đăng bài: Kiểm tra Token trước -> Thu nhận ảnh 'image' -> Lưu vào DB
router.post('/upload', verifyToken, upload.single('image'), postController.createPost);
router.delete('/delete/:postId', verifyToken, postController.deletePost);

// Lấy bài đăng của một người cụ thể (Trang cá nhân)
// URL: GET /api/posts/user/:userId
router.get('/user/:userId', verifyToken, postController.getPostsByUser);

module.exports = router;