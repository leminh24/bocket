const errorHandler = (err, req, res, next) => {
    console.error("=== HỆ THỐNG PHÁT HIỆN LỖI ===");
    console.error(err.stack); // In chi tiết dòng bị lỗi để Dev sửa

    // Mặc định là lỗi 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        message: err.message || "Lỗi Server nội bộ",
        // Chỉ hiện chi tiết lỗi khi đang ở môi trường phát triển (development)
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;