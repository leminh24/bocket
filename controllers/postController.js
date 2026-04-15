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
            WHERE p.IsDeleted = 0
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
                WHERE p.IsDeleted = 0 AND ( 
                    p.UserID IN (
                        SELECT FriendID FROM Friends WHERE UserID = @myId AND Status = 'Accepted'
                        UNION
                        SELECT UserID FROM Friends WHERE FriendID = @myId AND Status = 'Accepted'
                    ) 
                    OR p.UserID = @myId
                )
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
            WHERE p.UserID = @targetId AND p.IsDeleted = 0
            ORDER BY p.CreatedAt DESC
        `);
    res.json({ data: result.recordset });
};
// 5. Xóa bài đăng (Cập nhật IsDeleted = 1)
const deletePost = async (req, res) => {
    try {
        const { postId } = req.params; // Lấy ID bài post từ URL
        const myId = req.user.userId;   // ID người dùng từ Token

        const pool = await poolPromise;
        
        // Thực hiện cập nhật IsDeleted = 1
        const result = await pool.request()
            .input('pId', sql.Int, postId)
            .input('uId', sql.Int, myId)
            .query(`
                UPDATE Posts 
                SET IsDeleted = 1 
                WHERE PostID = @pId AND UserID = @uId
            `);

        // Kiểm tra xem có dòng nào bị ảnh hưởng không (tránh trường hợp xóa nhầm bài của người khác)
        if (result.rowsAffected[0] === 0) {
            return res.status(403).json({ message: "Không tìm thấy bài viết hoặc bạn không có quyền xóa bài này!" });
        }

        res.json({ message: "Xóa bài viết thành công!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi Server", error: err.message });
    }
};
module.exports = { getAllPosts, getFriendPosts, createPost, getPostsByUser, deletePost };