const { poolPromise, sql } = require('../config/db');
const bcrypt = require('bcrypt'); // 1. Khai báo bcrypt
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
    try {
        let username     = req.body.Username;
        let password     = req.body.password;
        let email        = req.body.email;
        let display_name = req.body.DisplayName || username;
        let avatar       = req.body.AvatarURL || "";

        if (!username || !password || !email) {
            return res.status(400).json({ error: "Thiếu thông tin đăng ký!" });
        }

        const pool = await poolPromise;

        // --- BƯỚC KIỂM TRA EMAIL TỒN TẠI ---
        const checkEmail = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @email');

        if (checkEmail.recordset.length > 0) {
            // Trả về mã lỗi 400 và thông báo cụ thể
            return res.status(400).json({ message: "Email đã tồn tại trên hệ thống!" });
        }
        // ------------------------------------

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.request()
            .input('user', sql.NVarChar, username)
            .input('pass', sql.NVarChar, hashedPassword)
            .input('name', sql.NVarChar, display_name)
            .input('email', sql.NVarChar, email)
            .input('avatar', sql.NVarChar(sql.MAX), avatar)
            .query(`INSERT INTO Users (Username, Password, DisplayName, Email, AvatarURL) 
                    VALUES (@user, @pass, @name, @email, @avatar)`);

        res.status(201).json({ message: "Đăng ký thành công!" });

    } catch (err) {
        console.error("Lỗi Server:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const login = async (req, res) => {
    try {
        // Nhận thêm email từ body
        const { username, password, email } = req.body; 
        const pool = await poolPromise;

        // Tìm User thỏa mãn cả Username VÀ Email
        const result = await pool.request()
            .input('user', sql.NVarChar, username)
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID, Username, Password, Email, DisplayName FROM Users WHERE Username = @user AND Email = @email');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const isMatch = await bcrypt.compare(password, user.Password);

            if (isMatch) {
                delete user.Password;
                const token = jwt.sign(
                    { userId: user.UserID, username: user.Username },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.json({ 
                    message: "Đăng nhập thành công", 
                    user: user,
                    token: token 
                });
            } else {
                res.status(401).json({ message: "Sai mật khẩu!" });
            }
        } else {
            // Thông báo chung để bảo mật hoặc thông báo cụ thể tùy bạn
            res.status(401).json({ message: "Tài khoản hoặc Email không chính xác!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const nodemailer = require('nodemailer');

const sendEmailOTP = async (email, otp) => {
    // Ép kiểu email về string nếu lỡ truyền nhầm object, 
    // nhưng tốt nhất là sửa ở nơi gọi hàm (bước 2)
    
    console.log("Đang gửi OTP đến địa chỉ:", email); 

    if (!email || typeof email !== 'string') {
        console.error("LỖI: Email không hợp lệ hoặc bị trống!", email);
        return;
    }

    try {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"BOCKET Admin" <no-reply@bocket.com>',
            to: email, // Ở đây phải là một chuỗi 'abc@gmail.com'
            subject: "Mã xác thực OTP của bạn",
            text: `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`,
        });
        
        console.log("Đã gửi email thành công!");
    } catch (error) {
        console.error("Lỗi Nodemailer:", error.message);
    }
};

// Giả sử đây là hàm xử lý khi người dùng bấm gửi OTP
const handleRegister = async (req, res) => {
    try {
        console.log("Dữ liệu nhận được từ Android:", req.body);
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

        const pool = await poolPromise;

        // --- 1. KIỂM TRA EMAIL ĐÃ TỒN TẠI TRONG BẢNG USERS CHƯA ---
        const checkEmail = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @email');

        if (checkEmail.recordset.length > 0) {
            // Nếu email đã tồn tại, dừng lại và báo lỗi luôn, KHÔNG tạo OTP
            return res.status(400).json({ message: "Email này đã được đăng ký tài khoản!" });
        }
        // -----------------------------------------------------------

        // 2. NẾU CHƯA TỒN TẠI THÌ TIẾP TỤC TẠO OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Lưu OTP vào Database (Vô hiệu hóa các mã cũ của email này trước khi lưu mã mới)
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('otp', sql.Char, otp)
            .query(`
                UPDATE OtpCodes SET IsUsed = 1 WHERE Email = @email;
                INSERT INTO OtpCodes (Email, OtpCode) VALUES (@email, @otp)
            `);

        // Gọi hàm gửi email
        await sendEmailOTP(email, otp);

        res.status(200).json({ message: "OTP đã được gửi đến email của bạn!" });
    } catch (error) {
        console.error("Lỗi handleRegister:", error);
        res.status(500).json({ error: error.message });
    }
};
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const pool = await poolPromise;

        // Kiểm tra mã OTP trong 5 phút gần nhất
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('otp', sql.Char, otp)
            .query(`
                SELECT TOP 1 * FROM OtpCodes 
                WHERE Email = @email 
                AND OtpCode = @otp 
                AND IsUsed = 0 
                AND CreatedAt > DATEADD(MINUTE, -5, GETDATE())
                ORDER BY CreatedAt DESC
            `);

        if (result.recordset.length > 0) {
            // Đánh dấu mã này đã được sử dụng thành công
            await pool.request()
                .input('id', sql.Int, result.recordset[0].Id)
                .query('UPDATE OtpCodes SET IsUsed = 1 WHERE Id = @id');

            res.status(200).json({ message: "Xác thực OTP thành công!" });
        } else {
            res.status(400).json({ message: "Mã OTP không đúng hoặc đã hết hạn!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getProfile = async (req, res) => {
    try {
        // userId này lấy từ middleware verifyToken (req.user.userId)
        const userId = req.user.userId; 
        const pool = await poolPromise;

        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT UserID, Username, DisplayName, Email as email, AvatarURL 
                FROM Users 
                WHERE UserID = @id
            `);

        if (result.recordset.length > 0) {
            // Trả về Object đầu tiên (rất quan trọng để Android không bị lỗi)
            res.json(result.recordset[0]); 
        } else {
            res.status(404).json({ message: "Không tìm thấy người dùng" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const resetPassword = async (req, res) => {
    try {
        // Lấy dữ liệu từ Body gửi lên
        // Dùng dấu || để lấy trường nào có dữ liệu (đề phòng Android gửi Password hoặc password)
        const email = req.body.email || req.body.Email;
        const newPassword = req.body.password || req.body.Password;

        console.log("Email nhận được:", email);
        console.log("Pass mới nhận được:", newPassword ? "Đã có" : "Trống");

        if (!email || !newPassword) {
            return res.status(400).json({ error: "Thiếu Email hoặc Mật khẩu mới!" });
        }

        const pool = await poolPromise;

        // 1. Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 2. Chạy lệnh SQL
        // Lưu ý: Kiểm tra chính xác tên cột trong DB của bạn là 'Password' hay 'password'
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('pass', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET Password = @pass WHERE Email = @email');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Email không tồn tại trong hệ thống!" });
        }

        res.status(200).json({ message: "Cập nhật mật khẩu thành công!" });

    } catch (err) {
        console.error("Lỗi Server:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
};

// API xử lý gửi OTP dành riêng cho việc Cập nhật Profile 
const sendOtpUpdate = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

        const pool = await poolPromise;

        // BƯỚC KHÁC BIỆT SO VỚI ĐĂNG KÝ: Email PHẢI tồn tại mới cho gửi OTP
        const checkEmail = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @email');

        if (checkEmail.recordset.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy tài khoản với email này!" });
        }

        // Tạo OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Lưu OTP vào Database
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('otp', sql.Char, otp)
            .query(`
                UPDATE OtpCodes SET IsUsed = 1 WHERE Email = @email;
                INSERT INTO OtpCodes (Email, OtpCode) VALUES (@email, @otp)
            `);

        
        await sendEmailOTP(email, otp);

        res.status(200).json({ message: "OTP xác thực đã được gửi đến email của bạn!" });
    } catch (error) {
        console.error("Lỗi sendOtpUpdate:", error);
        res.status(500).json({ error: error.message });
    }
};
module.exports = { register, login, sendEmailOTP, handleRegister, verifyOTP, getProfile, resetPassword, sendOtpUpdate };