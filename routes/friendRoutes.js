const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/add', verifyToken, friendController.sendFriendRequest);
router.get('/my-friends', verifyToken, friendController.getMyFriends);

module.exports = router;