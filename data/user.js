// Kiểm tra tính hợp lệ (Ko dấu, ko cách, đúng độ dài)
function validateString(str, min, max) {
    const regex = /^[a-zA-Z0-9]+$/;
    return str.length >= min && str.length <= max && regex.test(str);
}

module.exports = {
    validateRegister: (username, password, email) => {
        if (!validateString(username, 6, 16)) return "Tên tài khoản phải từ 6-16 ký tự, không dấu, không cách!";
        if (!validateString(password, 6, 12)) return "Mật khẩu phải từ 6-12 ký tự, không dấu, không cách!";
        if (username === password) return "Tên tài khoản và mật khẩu không được trùng nhau!";
        if (!email.includes('@')) return "Email không hợp lệ!";
        return null; // Không có lỗi
    }
};
