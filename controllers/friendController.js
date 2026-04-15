const { poolPromise, sql } = require('../config/db');
const sendFriendRequest = async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user.userId;

        if (userId == friendId) return res.status(400).json({ message: "Không thể tự kết bạn!" });

        const pool = await poolPromise;
        // Kiểm tra xem đã là bạn hoặc đã gửi yêu cầu chưa
        const check = await pool.request()
            .input('u', sql.Int, userId)
            .input('f', sql.Int, friendId)
            .query(`
                SELECT Status FROM Friends 
                WHERE (UserID = @u AND FriendID = @f) 
                OR (UserID = @f AND FriendID = @u)
            `);

        if (check.recordset.length > 0) {
            return res.status(400).json({ message: "Yêu cầu đã tồn tại hoặc đã là bạn bè" });
        }

        await pool.request()
            .input('u', sql.Int, userId)
            .input('f', sql.Int, friendId)
            .query("INSERT INTO Friends (UserID, FriendID, Status) VALUES (@u, @f, 'Pending')");

        res.json({ message: "Đã gửi lời mời!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getPendingRequests = async (req, res) => {
    try {
        const myId = req.user.userId;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('myId', sql.Int, myId)
            .query(`
                SELECT 
                    u.UserID AS UserID, 
                    u.DisplayName AS DisplayName, 
                    u.Username AS Username, 
                    u.AvatarURL AS avatar  -- ĐỔI AvatarURL THÀNH avatar
                FROM Users u
                JOIN Friends f ON u.UserID = f.UserID
                WHERE f.FriendID = @myId AND f.Status = 'Pending'
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getMyFriends = async (req, res) => {
    try {
        const userId = req.user.userId;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                -- 1. Lấy chính tôi
                SELECT UserID, DisplayName, AvatarURL 
                FROM Users 
                WHERE UserID = @userId

                UNION ALL

                -- 2. Lấy bạn bè (Lọc ID duy nhất trước khi JOIN)
                SELECT u.UserID, u.DisplayName, u.AvatarURL 
                FROM Users u
                WHERE u.UserID IN (
                    -- Lấy FriendID khi tôi là người gửi
                    SELECT FriendID FROM Friends WHERE UserID = @userId AND Status = 'Accepted'
                    UNION
                    -- Lấy UserID khi tôi là người nhận
                    SELECT UserID FROM Friends WHERE FriendID = @userId AND Status = 'Accepted'
                )
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query("SELECT UserID, Username, DisplayName, AvatarURL FROM Users WHERE UserID = @id");

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]); // Trả về 1 đối tượng duy nhất
        } else {
            res.status(404).json({ message: "Không tìm thấy User với ID này" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const acceptFriend = async (req, res) => {
    try {
        const { requesterId } = req.body; // ID người đã gửi lời mời cho mình
        const myId = req.user.userId;     // ID của mình (người bấm đồng ý)

        const pool = await poolPromise;
        // Sửa SQL trong acceptFriend
        await pool.request()
            .input('myId', sql.Int, myId)
            .input('rId', sql.Int, requesterId)
            .query(`
                -- Chỉ update nếu thực sự có lời mời đang ở trạng thái Pending
                UPDATE Friends SET Status = 'Accepted' 
                WHERE UserID = @rId AND FriendID = @myId AND Status = 'Pending';

                -- Nếu update thành công (@@ROWCOUNT > 0) thì mới chèn dòng ngược lại
                IF @@ROWCOUNT > 0 AND NOT EXISTS (SELECT 1 FROM Friends WHERE UserID = @myId AND FriendID = @rId)
                BEGIN
                    INSERT INTO Friends (UserID, FriendID, Status) VALUES (@myId, @rId, 'Accepted');
                END
            `);
        res.json({ message: "Hai bạn đã trở thành bạn bè!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getSentRequests = async (req, res) => {
    try {
        const myId = req.user.userId;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('myId', sql.Int, myId)
            .query(`
                SELECT 
                    u.UserID AS UserID, 
                    u.DisplayName AS DisplayName, 
                    u.Username AS Username, 
                    u.AvatarURL AS avatar  -- ĐỔI AvatarURL THÀNH avatar
                FROM Friends f
                JOIN Users u ON f.FriendID = u.UserID 
                WHERE f.UserID = @myId AND f.Status = 'Pending'
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
//hủy lời mời kết bạn đã gửi (chỉ có thể hủy khi đang ở trạng thái Pending)
const cancelRequest = async (req, res) => {
    try {
        const { friendId } = req.body; // ID người mà mình đã gửi lời mời
        const myId = req.user.userId;

        const pool = await poolPromise;
        await pool.request()
            .input('myId', sql.Int, myId)
            .input('fId', sql.Int, friendId)
            .query(`
                DELETE FROM Friends 
                WHERE UserID = @myId AND FriendID = @fId AND Status = 'Pending'
            `);

        res.json({ message: "Đã hủy lời mời kết bạn" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};
// Hủy kết bạn  (dù đang ở trạng thái nào, chỉ cần có mối quan hệ là xóa hết)
const unfriendOrCancelRequest = async (req, res) => {
    try {
        const { friendId } = req.body; 
        const myId = req.user.userId;

        const pool = await poolPromise;
        await pool.request()
            .input('myId', sql.Int, myId)
            .input('fId', sql.Int, friendId)
            .query(`
                -- Xóa mọi mối quan hệ giữa 2 người này, bất kể ai gửi, 
                -- bất kể trạng thái là 'Pending' hay 'Accepted'
                DELETE FROM Friends 
                WHERE (UserID = @myId AND FriendID = @fId) 
                    OR (UserID = @fId AND FriendID = @myId)
            `);

        res.json({ message: "Đã hủy kết bạn thành công" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};


module.exports = { sendFriendRequest, getMyFriends, getUserById, acceptFriend, getPendingRequests, getSentRequests, cancelRequest, unfriendOrCancelRequest };