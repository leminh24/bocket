const { poolPromise, sql } = require('../config/db');

const commentToChat = async (req, res) => {
    const { postId, content } = req.body;
    const senderId = req.user.userId; // Lấy từ Token người đang bình luận

    const pool = await poolPromise;

    // 1. Tìm xem ai là chủ sở hữu của bài viết này
    const postOwner = await pool.request()
        .input('postId', sql.Int, postId)
        .query('SELECT UserID FROM Posts WHERE PostID = @postId');

    if (postOwner.recordset.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy bài viết!" });
    }

    const receiverId = postOwner.recordset[0].UserID;

    // 2. Không cho tự bình luận nhắn tin cho chính mình (Tùy chọn)
    if (senderId === receiverId) {
        return res.status(400).json({ message: "Bạn không thể gửi bình luận chat cho chính mình." });
    }

    // 3. Lưu nội dung bình luận vào bảng Messages như một tin nhắn
    await pool.request()
        .input('sender', sql.Int, senderId)
        .input('receiver', sql.Int, receiverId)
        .input('postId', sql.Int, postId)
        .input('content', sql.NVarChar, content)
        .query(`
            INSERT INTO Messages (SenderID, ReceiverID, PostID, MessageText)
            VALUES (@sender, @receiver, @postId, @content)
        `);

    res.status(201).json({ 
        success: true,
        message: "Bình luận của bạn đã được chuyển thành tin nhắn đến chủ bài viết!" 
    });
};

module.exports = { commentToChat };