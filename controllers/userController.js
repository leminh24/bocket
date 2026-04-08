const { sql, poolPromise } = require('../config/db'); 

exports.getUserProfile = async (req, res) => {
    try {
        const pool = await poolPromise;

        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Không tìm thấy thông tin xác thực (userId)" });
        }

        const result = await pool.request()
            .input('userId', sql.Int, req.user.userId) 
            .query(`
                SELECT 
                    Username as username, 
                    AvatarURL as avatar, 
                    DisplayName as display_name 
                FROM Users 
                WHERE UserID = @userId
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng trong hệ thống" });
        }

        res.status(200).json(user);

    } catch (error) {
        console.error("❌ Lỗi getUserProfile:", error.message);
        res.status(500).json({ 
            message: "Lỗi hệ thống", 
            error: error.message 
        });
    }
};

// Hàm cập nhật thông tin cá nhân (DisplayName, Email, Avatar Base64)
exports.updateProfile = async (req, res) => {
    try {

        const pool = await poolPromise;
        const userId = req.user.userId; 
        const { DisplayName, Email, AvatarURL } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Không xác định được người dùng" });
        }

        const request = pool.request()
            .input('uid', sql.Int, userId)
            // Truyền giá trị null nếu chuỗi rỗng để SQL nhận biết
            .input('name', sql.NVarChar, (DisplayName && DisplayName.trim() !== "") ? DisplayName : null)
            .input('mail', sql.NVarChar, (Email && Email.trim() !== "") ? Email : null);

        /**
         * LOGIC SQL: 
         * COALESCE(@name, DisplayName): Nếu @name là NULL, nó sẽ lấy giá trị cũ của cột DisplayName.
         */
        let query = `
            UPDATE Users 
            SET DisplayName = COALESCE(@name, DisplayName), 
                Email = COALESCE(@mail, Email)`;

        // Xử lý riêng cho Avatar vì logic cũ của bạn là chỉ Update khi có ảnh mới
        if (AvatarURL && AvatarURL.trim() !== "") {
            request.input('avt', sql.NVarChar, AvatarURL);
            query += ", AvatarURL = @avt";
        }

        query += " WHERE UserID = @uid";

        await request.query(query);

        res.status(200).json({ message: "Cập nhật hồ sơ thành công!" });

    } catch (error) {
        console.error("❌ Lỗi updateProfile:", error.message);
        res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
};