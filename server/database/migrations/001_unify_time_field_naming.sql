-- Migration: 統一時間欄位命名規範
-- Version: 001
-- Date: 2025-11-18
-- Description: 將所有時間欄位統一使用 _at 後綴

-- ============================================================
-- 1. qr_codes 表: last_scanned → last_scanned_at
-- ============================================================

-- 添加新欄位
ALTER TABLE qr_codes ADD COLUMN last_scanned_at TIMESTAMP;

-- 複製數據
UPDATE qr_codes SET last_scanned_at = last_scanned WHERE last_scanned IS NOT NULL;

-- 刪除舊索引（如果存在）
DROP INDEX IF EXISTS idx_qr_codes_last_scanned;

-- 創建新索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_last_scanned_at ON qr_codes(last_scanned_at);

-- ============================================================
-- 2. checkin_records 表: checkin_time → checked_in_at
-- ============================================================

-- 添加新欄位
ALTER TABLE checkin_records ADD COLUMN checked_in_at_new TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 複製數據
UPDATE checkin_records SET checked_in_at_new = checkin_time WHERE checkin_time IS NOT NULL;

-- 刪除舊索引
DROP INDEX IF EXISTS idx_checkin_records_checkin_time;

-- 創建新索引
CREATE INDEX IF NOT EXISTS idx_checkin_records_checked_in_at ON checkin_records(checked_in_at_new);

-- ============================================================
-- 3. questionnaire_responses 表: completion_time → completion_duration
-- ============================================================
-- 注意：這個欄位是秒數，不是時間戳，所以改名為 completion_duration

-- 添加新欄位
ALTER TABLE questionnaire_responses ADD COLUMN completion_duration INTEGER;

-- 複製數據
UPDATE questionnaire_responses SET completion_duration = completion_time WHERE completion_time IS NOT NULL;

-- ============================================================
-- 4. questionnaire_views 表: view_time → viewed_at
-- ============================================================

-- 添加新欄位
ALTER TABLE questionnaire_views ADD COLUMN viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 複製數據
UPDATE questionnaire_views SET viewed_at = view_time WHERE view_time IS NOT NULL;

-- ============================================================
-- 5. scan_history 表: scan_time → scanned_at
-- ============================================================

-- 添加新欄位
ALTER TABLE scan_history ADD COLUMN scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 複製數據
UPDATE scan_history SET scanned_at = scan_time WHERE scan_time IS NOT NULL;

-- 刪除舊索引
DROP INDEX IF EXISTS idx_scan_history_scan_time;

-- 創建新索引
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at);

-- ============================================================
-- 注意事項
-- ============================================================
-- 
-- 此 Migration 採用「添加新欄位」策略，保留舊欄位以確保向後兼容性。
-- 
-- 下一步：
-- 1. 更新所有使用舊欄位的代碼
-- 2. 測試確認所有功能正常
-- 3. 執行 002_remove_old_time_fields.sql 刪除舊欄位
-- 
-- 回滾方法：
-- 如果需要回滾，執行以下 SQL：
-- 
-- ALTER TABLE qr_codes DROP COLUMN last_scanned_at;
-- ALTER TABLE checkin_records DROP COLUMN checked_in_at_new;
-- ALTER TABLE questionnaire_responses DROP COLUMN completion_duration;
-- ALTER TABLE questionnaire_views DROP COLUMN viewed_at;
-- ALTER TABLE scan_history DROP COLUMN scanned_at;
-- 
-- DROP INDEX IF EXISTS idx_qr_codes_last_scanned_at;
-- DROP INDEX IF EXISTS idx_checkin_records_checked_in_at;
-- DROP INDEX IF EXISTS idx_scan_history_scanned_at;
-- 
-- CREATE INDEX IF NOT EXISTS idx_qr_codes_last_scanned ON qr_codes(last_scanned);
-- CREATE INDEX IF NOT EXISTS idx_checkin_records_checkin_time ON checkin_records(checkin_time);
-- CREATE INDEX IF NOT EXISTS idx_scan_history_scan_time ON scan_history(scan_time);
-- 
-- ============================================================

