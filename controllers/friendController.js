const { poolPromise, sql } = require('../config/db');

const sendFriendRequest = async (req, res) => {
    try {
        const { friendId } = req.body; // ID người muốn kết bạn
        const userId = req.user.userId; // ID của mình (từ Token)

        if (userId == friendId) return res.status(400).json({ message: "Không thể kết bạn với chính mình!" });

        const pool = await poolPromise;
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('friendId', sql.Int, friendId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Friends WHERE UserID = @userId AND FriendID = @friendId)
                INSERT INTO Friends (UserID, FriendID, Status) VALUES (@userId, @friendId, 'Accepted')
            `); 
            // Lưu ý: Ở bản đơn giản này, mình cho 'Accepted' luôn. 
            // Nếu làm chuyên nghiệp thì để 'Pending' và viết thêm hàm Accept.

        res.json({ message: "Đã kết bạn thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getMyFriends = async (req, res) => {
    try {
        const userId = req.user.userId;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.UserID, u.DisplayName, u.AvatarURL 
                FROM Users u
                JOIN Friends f ON u.UserID = f.FriendID
                WHERE f.UserID = @userId
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { sendFriendRequest, getMyFriends };