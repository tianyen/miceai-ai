-- Migration 003: 創建 booth_games 表
-- 目的: 將遊戲綁定從專案層級改為攤位層級
-- 日期: 2025-11-18
-- 參考: claude/docs/plan.md - 方案 6

-- ============================================================
-- 1. 創建 booth_games 表
-- ============================================================

CREATE TABLE IF NOT EXISTS booth_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booth_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    voucher_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    qr_code_base64 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
    UNIQUE(booth_id, game_id)
);

-- ============================================================
-- 2. 創建索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_booth_games_booth_id ON booth_games(booth_id);
CREATE INDEX IF NOT EXISTS idx_booth_games_game_id ON booth_games(game_id);
CREATE INDEX IF NOT EXISTS idx_booth_games_voucher_id ON booth_games(voucher_id);

-- ============================================================
-- 3. 驗證
-- ============================================================

-- 驗證表是否創建成功
SELECT 'booth_games 表創建成功' as message;

-- ============================================================
-- Rollback 說明
-- ============================================================
-- 如需回滾此 Migration，執行以下 SQL:
-- DROP INDEX IF EXISTS idx_booth_games_voucher_id;
-- DROP INDEX IF EXISTS idx_booth_games_game_id;
-- DROP INDEX IF EXISTS idx_booth_games_booth_id;
-- DROP TABLE IF EXISTS booth_games;

