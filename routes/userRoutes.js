const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware'); // Middleware xác thực JWT
const verifyToken = require('../middleware/authMiddleware');

// Định nghĩa route lấy profile
// authMiddleware giúp đảm bảo chỉ người đã đăng nhập mới lấy được ảnh của họ
router.get('/profile', authMiddleware, userController.getUserProfile);

router.put('/update-profile', verifyToken, userController.updateProfile);

module.exports = router;