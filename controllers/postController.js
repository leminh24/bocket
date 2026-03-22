const { poolPromise, sql } = require('../config/db');

// Lấy tất cả bài đăng (Timeline)
const getAllPosts = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT p.PostID, u.DisplayName, u.AvatarURL, p.ImageURL, p.Content, p.CreatedAt 
            FROM Posts p 
            JOIN Users u ON p.UserID = u.UserID
            ORDER BY p.CreatedAt DESC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy bài đăng của bạn bè (Dành cho bản cập nhật sau)
const getFriendPosts = async (req, res) => {
    const { userId } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('myId', sql.Int, userId)
            .query(`
                SELECT p.PostID, u.DisplayName, p.ImageURL, p.Content, p.CreatedAt
                FROM Posts p
                JOIN Users u ON p.UserID = u.UserID
                WHERE p.UserID IN (
                    SELECT FriendID FROM Friends WHERE UserID = @myId
                )
                ORDER BY p.CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllPosts, getFriendPosts };