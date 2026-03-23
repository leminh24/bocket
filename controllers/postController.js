const { poolPromise, sql } = require('../config/db');

// 1. Lấy tất cả bài đăng (Phân trang)
const getAllPosts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    const result = await pool.request()
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit)
        .query(`
            SELECT p.PostID, u.DisplayName, u.AvatarURL, p.ImageURL, p.Content, p.CreatedAt 
            FROM Posts p 
            JOIN Users u ON p.UserID = u.UserID
            ORDER BY p.CreatedAt DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `);

    res.json({ page, limit, data: result.recordset });
};

// 2. Lấy bài đăng của bạn bè
const getFriendPosts = async (req, res) => {
    const { userId } = req.params;
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
};

// 3. Đăng bài
const createPost = async (req, res) => {
    if (!req.file) {
        // Bạn có thể tự ném lỗi (throw error), Express 5 sẽ tự bắt nó
        throw new Error("Không nhận được file ảnh!");
    }

    const { content } = req.body;
    const userId = req.user.userId; 
    const imageUrl = req.file.path; 

    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('img', sql.NVarChar, imageUrl)
        .input('content', sql.NVarChar, content)
        .query('INSERT INTO Posts (UserID, ImageURL, Content, CreatedAt) VALUES (@userId, @img, @content, GETDATE())');

    res.status(201).json({ message: "Đăng bài thành công!", imageUrl });
};

module.exports = { getAllPosts, getFriendPosts, createPost };