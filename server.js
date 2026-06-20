const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiLogic = require('./data/api.js');
const dbLogic = require('./data/database.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Mở giao diện index.html mặc định
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// -------------------------------------------------------------
// [POST] - ĐỒNG BỘ VÀ KHỞI TẠO TÀI KHOẢN TỪ FIREBASE SANG GITHUB
// -------------------------------------------------------------
app.post('/api/andb/sync-user', async (req, res) => {
    const { uid, email, username, emailVerified } = req.body;

    try {
        // Đọc Database hiện tại từ GitHub về
        const { data: db, sha } = await dbLogic.readMasterDB();

        let userApiKey = "";

        // Kiểm tra xem UID Firebase này đã từng có trên GitHub chưa
        if (db.users[uid]) {
            // Nếu có rồi thì lấy lại API Key cũ ra xài
            userApiKey = db.users[uid].apiKey;
            // Cập nhật trạng thái kích hoạt mới nhất từ Firebase
            db.users[uid].emailVerified = emailVerified;
        } else {
            // Nếu chưa có (User mới tinh đăng nhập lần đầu bằng Google/Thủ công)
            // Tiến hành sinh mã API Key độc quyền KHÔNG TRÙNG LẶP
            userApiKey = apiLogic.generateUniqueApiKey(db.users);

            db.users[uid] = {
                uid,
                username,
                email,
                apiKey: userApiKey,
                emailVerified: emailVerified
            };
            db.storage[userApiKey] = {}; // Tạo kho dữ liệu trống cho API này
        }

        // Ghi dữ liệu đồng bộ ngược lại lên GitHub đám mây
        await dbLogic.writeMasterDB(db, sha);

        res.json({ success: true, apiKey: userApiKey });
    } catch (err) {
        res.status(500).json({ error: "Lỗi đồng bộ đám mây GitHub: " + err.message });
    }
});

// -------------------------------------------------------------
// [POST] - CỔNG KẾT NỐI API DATA CHO CÁC SẢN PHẨM KHÁC (ANDB CORE)
// -------------------------------------------------------------
app.post('/api/andb/data-connect', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "Thiếu mã khóa API Key!" });
    const apiKey = authHeader.split(' ')[1];

    const { action, type, node_name, node_value } = req.body;

    try {
        const { data: db, sha } = await dbLogic.readMasterDB();
        
        // Xác thực API Key kiểm tra chủ sở hữu
        const user = Object.values(db.users).find(u => u.apiKey === apiKey);
        if (!user) return res.status(403).json({ error: "API Key không hợp lệ!" });
        if (!user.emailVerified) return res.status(403).json({ error: "Tài khoản chưa được kích hoạt hoàn toàn!" });

        // Tạo cấu trúc kho chứa nếu chưa có
        if (!db.storage[apiKey]) db.storage[apiKey] = {};

        if (action === 'delete') {
            delete db.storage[apiKey][node_name];
        } else if (action === 'set') {
            let valueToSave = node_value;
            if (type === 'file_currency') valueToSave = Number(node_value) || 0; // Ép kiểu số
            if (type === 'folder') valueToSave = { is_folder: true, contents: {} };

            db.storage[apiKey][node_name] = valueToSave;
        }

        // Lưu bản cập nhật mới nhất lên GitHub
        await dbLogic.writeMasterDB(db, sha);
        res.json({ success: true, message: "Dữ liệu ANDB đã được cập nhật vĩnh viễn trên GitHub!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ANDB Engine đang chạy trên port ${PORT}`));
