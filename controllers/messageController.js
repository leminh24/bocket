const { poolPromise, sql } = require('../config/db');
// Hàm xử lý bình luận ảnh chuyển thành chat
const commentToChat = async (req, res) => {
    const { postId, content } = req.body;
    const senderId = req.user.userId;

    try {
        const pool = await poolPromise;

        // 1. Lấy UserID, ImageUrl và Content (nội dung bài viết)
        const postData = await pool.request()
            .input('postId', sql.Int, postId)
            .query('SELECT UserID, ImageUrl, Content FROM Posts WHERE PostID = @postId');

        if (postData.recordset.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy bài viết!" });
        }

        const receiverId = postData.recordset[0].UserID;
        const postImage = postData.recordset[0].ImageUrl;
        const postContent = postData.recordset[0].Content; // Lấy content ở đây

        if (senderId === receiverId) {
            return res.status(400).json({ message: "Bạn không thể gửi bình luận chat cho chính mình." });
        }

        // 2. Lưu vào bảng Messages (Giữ nguyên)
        await pool.request()
            .input('sender', sql.Int, senderId)
            .input('receiver', sql.Int, receiverId)
            .input('postId', sql.Int, postId)
            .input('content', sql.NVarChar, content)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, PostID, MessageText)
                VALUES (@sender, @receiver, @postId, @content)
            `);

        // 3. GỬI REAL-TIME QUA SOCKET
        const receiverSocketId = global.onlineUsers.get(String(receiverId));
        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit('receive_message', {
                senderId: senderId,
                messageText: content, // Để đồng bộ với key trong Model Android
                postId: postId,
                postImageURL: postImage,
                postTitle: postContent, // Gửi nội dung bài viết sang
                sentAt: new Date()
            });
        }

        return res.status(201).json({ success: true, message: "Bình luận thành công!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
// Hàm lấy tin nhắn giữa tôi và bạn bè
const getMessages = async (req, res) => {
    try {
        const { friendId } = req.params;
        const myId = req.user.userId;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('myId', sql.Int, myId)
            .input('friendId', sql.Int, friendId)
            .query(`
                SELECT 
                    m.MessageID, 
                    m.SenderID, 
                    m.ReceiverID, 
                    m.MessageText, 
                    m.SentAt, 
                    m.PostID,
                    p.ImageURL AS PostImageURL, 
                    p.Content AS PostContent -- THÊM DÒNG NÀY: Lấy nội dung bài viết
                FROM Messages m
                LEFT JOIN Posts p ON m.PostID = p.PostID
                WHERE (m.SenderID = @myId AND m.ReceiverID = @friendId)
                    OR (m.SenderID = @friendId AND m.ReceiverID = @myId)
                ORDER BY m.SentAt ASC
            `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Hàm lấy danh sách bạn bè đã từng nhắn tin
const getChatPartners = async (req, res) => {
    try {
        const myId = req.user.userId;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('myId', sql.Int, myId)
            .query(`
                SELECT 
                    U.UserID, 
                    U.DisplayName, 
                    U.AvatarURL,
                    M.MessageText AS LastMessage,
                    M.SentAt,
                    M.SenderID AS LastSenderID,
                    M.IsRead,
                    -- IsUnread: Trả về 1 nếu mình là người nhận VÀ chưa đọc
                    CASE 
                        WHEN M.ReceiverID = @myId AND M.IsRead = 0 THEN 1 
                        ELSE 0 
                    END AS IsUnread
                FROM Users U
                INNER JOIN (
                    SELECT DISTINCT 
                        CASE WHEN UserID = @myId THEN FriendID ELSE UserID END AS FriendUserId
                    FROM Friends
                    WHERE (UserID = @myId OR FriendID = @myId) 
                        AND Status = 'Accepted'
                ) F ON U.UserID = F.FriendUserId
                OUTER APPLY (
                    -- Lấy 1 tin nhắn duy nhất mới nhất giữa MyId và FriendUserId
                    SELECT TOP 1 m1.*
                    FROM Messages m1
                    WHERE (m1.SenderID = @myId AND m1.ReceiverID = U.UserID)
                        OR (m1.SenderID = U.UserID AND m1.ReceiverID = @myId)
                    ORDER BY m1.SentAt DESC
                ) M
                WHERE U.UserID != @myId
                ORDER BY M.SentAt DESC -- Người mới nhắn tin sẽ hiện lên đầu
            `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Dùng khi chat trực tiếp trong màn hình chat riêng tư (không thông qua bài post).
const sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.userId;
        const pool = await poolPromise;

        // 1. Lưu vào database
        await pool.request()
            .input('sender', sql.Int, senderId)
            .input('receiver', sql.Int, receiverId)
            .input('content', sql.NVarChar, content)
            .query(`
                INSERT INTO Messages (SenderID, ReceiverID, MessageText)
                VALUES (@sender, @receiver, @content)
            `);

        // 2. Gửi Real-time qua Socket (Đưa vào TRONG try)
        const receiverSocketId = global.onlineUsers.get(String(receiverId));
        
        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit('receive_message', {
                senderId: senderId,
                messageText: content, // Đổi tên cho khớp với phía Android (messageText)
                sentAt: new Date()
            });
            console.log(`Đã đẩy tin nhắn tới socket: ${receiverSocketId}`);
        }

        // 3. Phản hồi cho người gửi (Chỉ gọi 1 lần ở cuối cùng của try)
        return res.status(201).json({ success: true });

    } catch (err) {
        console.error("Lỗi sendMessage:", err.message);
        // Nếu lỗi xảy ra, controller sẽ chuyển sang middleware xử lý lỗi
        if (!res.headersSent) {
            return res.status(500).json({ error: err.message });
        }
    }
};


module.exports = { commentToChat, getMessages, getChatPartners, sendMessage };