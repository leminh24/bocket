require('dotenv').config();
const express = require('express');
const path = require('path'); // Thêm thư viện path có sẵn của Node.js

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const friendRoutes = require('./routes/friendRoutes');
const errorHandler = require('./middleware/errorMiddleware');
const messageRoutes = require('./routes/messageRoutes');
const userExternalRoutes = require('./routes/userRoutes');

const app = express();

// --- PHẦN CẤU HÌNH CƠ BẢN (Nên đặt trên cùng) ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- CÁC ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/user', userExternalRoutes);


// --- MIDDLEWARE XỬ LÝ LỖI (Luôn đặt cuối cùng) ---
app.use(errorHandler); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});