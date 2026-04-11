const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const verifyToken = require('../middleware/authMiddleware');

// --- CÁC ROUTE CỤ THỂ PHẢI ĐƯA LÊN TRÊN ---
router.get('/my-friends', verifyToken, friendController.getMyFriends);
router.get('/pending', verifyToken, friendController.getPendingRequests);
router.get('/sent', verifyToken, friendController.getSentRequests);

// --- CÁC ROUTE CÓ THAM SỐ (/:id) PHẢI ĐƯA XUỐNG DƯỚI CÙNG ---
router.get('/:id', verifyToken, friendController.getUserById); 

router.post('/cancel', verifyToken, friendController.cancelRequest); 

// Các Route POST thường không bị tranh chấp nhưng nên để gọn gàng
router.post('/request', verifyToken, friendController.sendFriendRequest);
router.post('/accept', verifyToken, friendController.acceptFriend);

module.exports = router;