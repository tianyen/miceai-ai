-- Migration 004: 遷移 project_games 資料到 booth_games
-- 目的: 將專案層級的遊戲綁定遷移到攤位層級
-- 日期: 2025-11-18
-- 參考: claude/docs/plan.md - 方案 6

-- ============================================================
-- 前置檢查
-- ============================================================

-- 檢查 booth_games 表是否存在
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='booth_games')
    THEN 'booth_games 表已存在，可以繼續遷移'
    ELSE 'ERROR: booth_games 表不存在，請先執行 003_create_booth_games.sql'
END as check_result;

-- 檢查 project_games 表是否存在
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_games')
    THEN 'project_games 表存在，可以遷移資料'
    ELSE 'WARNING: project_games 表不存在，無需遷移'
END as check_result;

-- ============================================================
-- 1. 備份 project_games 表
-- ============================================================

CREATE TABLE IF NOT EXISTS project_games_backup AS 
SELECT * FROM project_games;

SELECT 'project_games 表已備份到 project_games_backup' as message;

-- ============================================================
-- 2. 資料遷移策略
-- ============================================================

-- 策略說明:
-- 1. 每個專案可能有多個攤位
-- 2. 每個 project_games 記錄需要遷移到該專案的所有攤位
-- 3. 如果專案沒有攤位，則創建一個預設攤位

-- 2.1 為沒有攤位的專案創建預設攤位
INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active, created_at, updated_at)
SELECT 
    ep.id,
    ep.project_name || ' - 預設攤位',
    ep.project_code || '-DEFAULT',
    ep.event_location,
    '系統自動創建的預設攤位（從 project_games 遷移）',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM event_projects ep
WHERE NOT EXISTS (
    SELECT 1 FROM booths b WHERE b.project_id = ep.id
)
AND EXISTS (
    SELECT 1 FROM project_games pg WHERE pg.project_id = ep.id
);

SELECT 'Step 1: 已為沒有攤位的專案創建預設攤位' as message;

-- 2.2 遷移資料到 booth_games
-- 將每個 project_games 記錄遷移到該專案的第一個攤位（通常是預設攤位）
INSERT INTO booth_games (booth_id, game_id, voucher_id, is_active, qr_code_base64, created_at, updated_at)
SELECT 
    b.id as booth_id,
    pg.game_id,
    pg.voucher_id,
    pg.is_active,
    pg.qr_code_base64,
    pg.created_at,
    pg.updated_at
FROM project_games pg
INNER JOIN (
    -- 為每個專案選擇第一個攤位（按 ID 排序）
    SELECT project_id, MIN(id) as id
    FROM booths
    GROUP BY project_id
) b ON b.project_id = pg.project_id
WHERE NOT EXISTS (
    -- 避免重複插入
    SELECT 1 FROM booth_games bg 
    WHERE bg.booth_id = b.id AND bg.game_id = pg.game_id
);

SELECT 'Step 2: 已將 project_games 資料遷移到 booth_games' as message;

-- ============================================================
-- 3. 驗證遷移結果
-- ============================================================

-- 3.1 檢查遷移數量
SELECT 
    (SELECT COUNT(*) FROM project_games) as project_games_count,
    (SELECT COUNT(*) FROM booth_games) as booth_games_count,
    (SELECT COUNT(*) FROM project_games_backup) as backup_count;

-- 3.2 檢查是否有遺漏的遊戲綁定
SELECT 
    pg.id,
    pg.project_id,
    pg.game_id,
    ep.project_name,
    g.game_name_zh
FROM project_games pg
LEFT JOIN event_projects ep ON pg.project_id = ep.id
LEFT JOIN games g ON pg.game_id = g.id
WHERE NOT EXISTS (
    SELECT 1 FROM booth_games bg
    INNER JOIN booths b ON bg.booth_id = b.id
    WHERE b.project_id = pg.project_id AND bg.game_id = pg.game_id
);

SELECT 'Step 3: 遷移驗證完成' as message;

-- ============================================================
-- 4. 重要提示
-- ============================================================

-- ⚠️ 注意事項:
-- 1. 此 Migration 不會刪除 project_games 表
-- 2. project_games 表已備份到 project_games_backup
-- 3. 請先更新所有使用 project_games 的代碼
-- 4. 確認所有功能正常後，再執行刪除 project_games 表的 Migration
-- 5. 如需回滾，請參考下方的 Rollback 說明

-- ============================================================
-- Rollback 說明
-- ============================================================
-- 如需回滾此 Migration，執行以下 SQL:
-- 
-- -- 1. 刪除遷移的資料
-- DELETE FROM booth_games WHERE id IN (
--     SELECT bg.id FROM booth_games bg
--     INNER JOIN booths b ON bg.booth_id = b.id
--     INNER JOIN project_games_backup pg ON b.project_id = pg.project_id AND bg.game_id = pg.game_id
-- );
-- 
-- -- 2. 刪除自動創建的預設攤位
-- DELETE FROM booths WHERE booth_code LIKE '%-DEFAULT' AND description LIKE '%從 project_games 遷移%';
-- 
-- -- 3. 恢復 project_games 表（如果已刪除）
-- -- DROP TABLE IF EXISTS project_games;
-- -- CREATE TABLE project_games AS SELECT * FROM project_games_backup;
-- 
-- -- 4. 刪除備份表
-- -- DROP TABLE IF EXISTS project_games_backup;

