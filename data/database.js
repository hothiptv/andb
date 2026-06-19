const axios = require('axios');

// Lấy biến cấu hình an toàn từ Render Environment
const GITHUB_USER = process.env.NAME_ANDB;
const REPO_NAME = process.env.REPO_ANDB;
const GITHUB_TOKEN = process.env.TOKEN_ANDB;
const FILE_PATH = "andb_master.json"; // File database tổng sẽ tự tạo trên GitHub

const githubApi = axios.create({
    baseURL: `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/`,
    headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }
});

module.exports = {
    // Hàm đọc dữ liệu từ GitHub về
    readMasterDB: async () => {
        try {
            const res = await githubApi.get(FILE_PATH);
            const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
            return { data: JSON.parse(content), sha: res.data.sha };
        } catch (err) {
            // Nếu file chưa tồn tại trên GitHub, trả về db trống để tự tạo
            return { data: { users: {}, storage: {} }, sha: null };
        }
    },

    // Hàm ghi đè dữ liệu mới lên GitHub
    writeMasterDB: async (newData, sha) => {
        const contentBase64 = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
        const body = {
            message: "🔄 ANDB System: Auto Sync Database v2",
            content: contentBase64
        };
        if (sha) body.sha = sha; // Nếu có file cũ thì truyền SHA để ghi đè

        await githubApi.put(FILE_PATH, body);
    }
};
