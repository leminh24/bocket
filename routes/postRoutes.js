const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

// Đường dẫn: GET http://localhost:3000/api/posts
router.get('/', postController.getAllPosts);

// Đường dẫn: GET http://localhost:3000/api/posts/friends/1
router.get('/friends/:userId', postController.getFriendPosts);

module.exports = router;