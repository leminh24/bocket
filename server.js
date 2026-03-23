const express = require('express');
// KHÔNG CẦN express-async-errors ở Express 5.x
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const friendRoutes = require('./routes/friendRoutes');
const errorHandler = require('./middleware/errorMiddleware'); // Dùng file này cho gọn
const messageRoutes = require('./routes/messageRoutes');

const app = express();
app.use(express.json());

// 1. Các Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);

// 2. Middleware xử lý lỗi tập trung (PHẢI ĐẶT SAU CÙNG)
// Sử dụng errorHandler từ file middleware/errorMiddleware.js bạn đã tạo
app.use(errorHandler); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});