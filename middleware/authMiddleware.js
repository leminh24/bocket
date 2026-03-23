const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Lấy token từ header của request
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Định dạng chuẩn: "Bearer <token>"

    // 2. Nếu không có vé -> Đuổi về
    if (!token) {
        return res.status(401).json({ message: "Không tìm thấy Token. Vui lòng đăng nhập!" });
    }

    // 3. Nếu có vé -> Kiểm tra xem vé là thật hay giả/hết hạn
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
        }
        
        // 4. Vé hợp lệ -> Lưu thông tin người dùng vào request để dùng sau này
        req.user = decoded; 
        next(); // Mở cửa cho đi tiếp vào Controller
    });
};

module.exports = verifyToken;