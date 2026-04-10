require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http'); // Thêm thư viện http có sẵn
const { Server } = require('socket.io'); // Thêm socket.io

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const friendRoutes = require('./routes/friendRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userExternalRoutes = require('./routes/userRoutes');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// --- TẠO HTTP SERVER ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Cho phép mọi nguồn kết nối (tránh lỗi CORS trên Android)
});

// Biến lưu trữ danh sách người dùng online
let onlineUsers = new Map();

io.on('connection', (socket) => {

    // Khi Android gửi sự kiện "register" kèm UserID
    socket.on('register', (userId) => {
        socket.userId = userId;
        onlineUsers.set(String(userId), socket.id);
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            onlineUsers.delete(String(socket.userId));
        }
    });
});

// Xuất biến io ra toàn cục để các file Controller có thể sử dụng
global.io = io;
global.onlineUsers = onlineUsers;

// --- CONFIG EXPRESS ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/user', userExternalRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// QUAN TRỌNG: Đổi app.listen thành server.listen
server.listen(PORT, () => {
    console.log(`🚀 Server real-time đang chạy tại cổng ${PORT}`);
});