const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

// Định nghĩa các đường dẫn
router.get('/profile', verifyToken, authController.getProfile);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/sendOTP', authController.handleRegister);
router.post('/verifyOTP', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);
router.post('/send-otp-update', authController.sendOtpUpdate);

module.exports = router;