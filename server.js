const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const userLogic = require('./data/user.js');
const apiLogic = require('./data/api.js');
const dbLogic = require('./data/database.js');

const app = express();
app.use(cors());
app.use(express.json());

// 💥 Đã cấu hình thêm: Biến thư mục này thành thư mục tĩnh để truy cập được index.html
app.use(express.static(__dirname));

// Định tuyến mặc định khi vào link gốc sẽ tự động mở file index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// -------------------------------------------------------------
// [POST] - ĐĂNG KÝ (LƯU THẲNG LÊN GITHUB QUA RENDER)
// -------------------------------------------------------------
app.post('/api/andb/register', async (req, res) => {
    const { username, email, password } = req.body;

    // 1. Kiểm tra định dạng thủ công của ông An
    const errorMsg = userLogic.validateRegister(username, password, email);
    if (errorMsg) return res.status(400).json({ error: errorMsg });

    try {
        // 2. Đọc DB hiện tại từ GitHub về
        const { data: db, sha } = await dbLogic.readMasterDB();

        // 3. Kiểm tra xem tên hoặc email đã tồn tại chưa
        if (db.users[username]) return res.status(400).json({ error: "Tên tài khoản này đã tồn tại rồi bro!" });
        const emailExists = Object.values(db.users).some(u => u.email === email);
        if (emailExists) return res.status(400).json({ error: "Email này đã được sử dụng rồi!" });

        // 4. Tạo API Key độc quyền KHÔNG TRÙNG LẶP
        const newApiKey = apiLogic.generateUniqueApiKey(db.users);

        // 5. Cập nhật dữ liệu mới vào cấu trúc dữ liệu
        db.users[username] = { username, email, password, apiKey: newApiKey, emailVerified: false };
        db.storage[newApiKey] = {}; // Kho chứa data, tiền tệ riêng của key này

        // 6. Đồng bộ ngược lại lên GitHub bảo mật
        await dbLogic.writeMasterDB(db, sha);

        res.json({ success: true, message: "Đăng ký thành công! Đang gửi tín hiệu kích hoạt về Email...", username });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống đồng bộ GitHub: " + err.message });
    }
});

// -------------------------------------------------------------
// [POST] - ĐĂNG NHẬP THỦ CÔNG
// -------------------------------------------------------------
app.post('/api/andb/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: db } = await dbLogic.readMasterDB();
        const user = Object.values(db.users).find(u => u.email === email && u.password === password);

        if (!user) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu rồi ông bạn!" });

        res.json({
            success: true,
            username: user.username,
            apiKey: user.apiKey,
            emailVerified: user.emailVerified
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// [POST] - KÍCH HOẠT TÀI KHOẢN (CONFIRM XÁC NHẬN)
// -------------------------------------------------------------
app.post('/api/andb/verify', async (req, res) => {
    const { username, accept } = req.body;

    try {
        const { data: db, sha } = await dbLogic.readMasterDB();
        if (!db.users[username]) return res.status(404).json({ error: "Không tìm thấy user!" });

        if (accept) {
            db.users[username].emailVerified = true;
            await dbLogic.writeMasterDB(db, sha);
            res.json({ success: true, message: "Tài khoản ANDB đã được kích hoạt hoàn toàn!" });
        } else {
            res.json({ success: false, message: "Từ chối kích hoạt!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// [POST] - THỰC THI MỤC, FILE, TIỀN TỆ (CHO CÁC HTML/GAME KHÁC KẾT NỐI)
// -------------------------------------------------------------
app.post('/api/andb/data-connect', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "Thiếu mã API Key!" });
    const apiKey = authHeader.split(' ')[1];

    const { action, type, node_name, node_value } = req.body;

    try {
        const { data: db, sha } = await dbLogic.readMasterDB();
        
        // Tìm chủ nhân API Key
        const user = Object.values(db.users).find(u => u.apiKey === apiKey);
        if (!user) return res.status(403).json({ error: "API Key không hợp lệ!" });
        if (!user.emailVerified) return res.status(403).json({ error: "Tài khoản chưa kích hoạt từ Email!" });

        if (action === 'delete') {
            delete db.storage[apiKey][node_name];
        } else if (action === 'set') {
            let valueToSave = node_value;
            if (type === 'file_currency') valueToSave = Number(node_value) || 0;
            if (type === 'folder') valueToSave = { is_folder: true, contents: {} };

            db.storage[apiKey][node_name] = valueToSave;
        }

        // Lưu ngược lên ổ cứng GitHub
        await dbLogic.writeMasterDB(db, sha);
        res.json({ success: true, message: "Đồng bộ đám mây ANDB (GitHub Core) thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lắng nghe cổng từ môi trường Render (Mặc định thường là 10000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ANDB Engine đang chạy trên port ${PORT}`));
