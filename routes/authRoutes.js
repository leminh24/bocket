const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Định nghĩa các đường dẫn
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/sendOTP', authController.handleRegister);

module.exports = router;