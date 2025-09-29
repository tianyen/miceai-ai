-- 創建 QR Code 名片表
CREATE TABLE IF NOT EXISTS business_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL,
    
    -- 基本資訊
    name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    company VARCHAR(200),
    
    -- 聯絡資訊
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    website VARCHAR(255),
    
    -- 社群媒體
    linkedin VARCHAR(255),
    wechat VARCHAR(100),
    facebook VARCHAR(255),
    twitter VARCHAR(255),
    instagram VARCHAR(255),
    
    -- QR Code 資訊
    qr_code_base64 TEXT NOT NULL,
    qr_code_data TEXT NOT NULL,
    
    -- 統計資訊
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP,
    
    -- 狀態和設定
    is_active BOOLEAN DEFAULT 1,
    is_public BOOLEAN DEFAULT 1,
    
    -- 時間戳記
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 外鍵約束
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id)
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_business_cards_card_id ON business_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_business_cards_project_id ON business_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_business_cards_email ON business_cards(email);
CREATE INDEX IF NOT EXISTS idx_business_cards_created_at ON business_cards(created_at);

-- 創建觸發器自動更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_business_cards_updated_at
    AFTER UPDATE ON business_cards
    FOR EACH ROW
BEGIN
    UPDATE business_cards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
