module.exports = {
    generateUniqueApiKey: (existingUsers) => {
        let isUnique = false;
        let newKey = "";
        
        // Vòng lặp đảm bảo KHÔNG BAO GIỜ trùng với các API khác đã làm
        while (!isUnique) {
            newKey = "andb_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
            
            // Check xem trong danh sách user đã ai sở hữu key này chưa
            const duplicate = Object.values(existingUsers).find(u => u.apiKey === newKey);
            if (!duplicate) {
                isUnique = true;
            }
        }
        return newKey;
    }
};
