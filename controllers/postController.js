const { poolPromise, sql } = require('../config/db');

// 1. Lấy tất cả bài đăng (Phân trang)
const getAllPosts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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

const getFriendPosts = async (req, res) => {
    const myId = req.user.userId; 

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('myId', sql.Int, myId)
            .query(`
                SELECT 
                    p.PostID, 
                    u.DisplayName, 
                    u.AvatarURL,  
                    p.ImageURL, -- Đây là cái Android sẽ gọi qua getImageURL()
                    p.Content, 
                    p.CreatedAt,
                    u.UserID
                FROM Posts p
                JOIN Users u ON p.UserID = u.UserID
                WHERE p.UserID IN (
                    -- Lấy ID những người mình đã gửi kết bạn và họ đã Accept
                    SELECT FriendID FROM Friends WHERE UserID = @myId AND Status = 'Accepted'
                    UNION
                    -- Lấy ID những người gửi kết bạn cho mình và mình đã Accept
                    SELECT UserID FROM Friends WHERE FriendID = @myId AND Status = 'Accepted'
                ) 
                OR p.UserID = @myId -- Bao gồm cả bài viết của chính mình
                ORDER BY p.CreatedAt DESC
            `);
        
        res.json({ data: result.recordset }); 
    } catch (err) {
        res.status(500).json({ message: "Lỗi Server", error: err.message });
    }
};
// 3. Đăng bài
const createPost = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Không nhận được file ảnh!" });

        const { content } = req.body;
        const userId = req.user.userId; 
        const imageUrl = req.file.path; // Cloudinary đã trả về link full rồi, không cần cộng thêm host local

        const pool = await poolPromise;
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('img', sql.NVarChar, imageUrl) 
            .input('content', sql.NVarChar, content)
            .query('INSERT INTO Posts (UserID, ImageURL, Content, CreatedAt) VALUES (@userId, @img, @content, GETDATE())');

        res.status(201).json({ message: "Đăng bài thành công!", imageUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 4. Lấy bài đăng của một người cụ thể
const getPostsByUser = async (req, res) => {
    const { userId } = req.params; // Lấy ID người cần xem từ URL
    const pool = await poolPromise;
    const result = await pool.request()
        .input('targetId', sql.Int, userId)
        .query(`
            SELECT 
                p.PostID, 
                u.DisplayName, 
                u.AvatarURL,  
                p.ImageURL, 
                p.Content, 
                p.CreatedAt
            FROM Posts p
            JOIN Users u ON p.UserID = u.UserID
            WHERE p.UserID = @targetId
            ORDER BY p.CreatedAt DESC
        `);
    res.json({ data: result.recordset });
};

module.exports = { getAllPosts, getFriendPosts, createPost, getPostsByUser };