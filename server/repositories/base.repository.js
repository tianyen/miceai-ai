/**
 * Base Repository - 資料存取層基類
 *
 * 職責：
 * - 封裝所有 SQL 查詢
 * - 提供通用 CRUD 操作
 * - 統一資料庫錯誤處理
 *
 * @description Repository Pattern 實作
 * @see @refactor/ARCHITECTURE.md
 */

const database = require('../config/database');

class BaseRepository {
    /**
     * @param {string} tableName - 資料表名稱
     * @param {string} primaryKey - 主鍵欄位名稱
     */
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.db = database;
    }

    // ============================================================================
    // 基本 CRUD 操作
    // ============================================================================

    /**
     * 依主鍵查詢單筆記錄
     * @param {number|string} id - 主鍵值
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        return this.db.get(sql, [id]);
    }

    /**
     * 查詢所有記錄
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findAll({ limit = 100, offset = 0, orderBy = this.primaryKey, order = 'DESC' } = {}) {
        const sql = `
            SELECT * FROM ${this.tableName}
            ORDER BY ${orderBy} ${order}
            LIMIT ? OFFSET ?
        `;
        return this.db.all(sql, [limit, offset]);
    }

    /**
     * 依條件查詢單筆記錄
     * @param {Object} conditions - 查詢條件 { column: value }
     * @returns {Promise<Object|null>}
     */
    async findOne(conditions) {
        const { whereClause, params } = this._buildWhereClause(conditions);
        const sql = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
        return this.db.get(sql, params);
    }

    /**
     * 依條件查詢多筆記錄
     * @param {Object} conditions - 查詢條件
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findBy(conditions, { limit = 100, offset = 0, orderBy = this.primaryKey, order = 'DESC' } = {}) {
        const { whereClause, params } = this._buildWhereClause(conditions);
        const sql = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY ${orderBy} ${order}
            LIMIT ? OFFSET ?
        `;
        return this.db.all(sql, [...params, limit, offset]);
    }

    /**
     * 新增記錄
     * @param {Object} data - 要插入的資料
     * @returns {Promise<Object>} - 包含 lastID
     */
    async create(data) {
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(data);

        const sql = `
            INSERT INTO ${this.tableName} (${columns.join(', ')})
            VALUES (${placeholders})
        `;
        return this.db.run(sql, values);
    }

    /**
     * 更新記錄
     * @param {number|string} id - 主鍵值
     * @param {Object} data - 要更新的資料
     * @returns {Promise<Object>} - 包含 changes
     */
    async update(id, data) {
        const columns = Object.keys(data);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(data), id];

        const sql = `
            UPDATE ${this.tableName}
            SET ${setClause}
            WHERE ${this.primaryKey} = ?
        `;
        return this.db.run(sql, values);
    }

    /**
     * 依條件更新記錄
     * @param {Object} conditions - 更新條件
     * @param {Object} data - 要更新的資料
     * @returns {Promise<Object>}
     */
    async updateBy(conditions, data) {
        const columns = Object.keys(data);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const { whereClause, params: whereParams } = this._buildWhereClause(conditions);

        const sql = `
            UPDATE ${this.tableName}
            SET ${setClause}
            ${whereClause}
        `;
        return this.db.run(sql, [...Object.values(data), ...whereParams]);
    }

    /**
     * 刪除記錄
     * @param {number|string} id - 主鍵值
     * @returns {Promise<Object>}
     */
    async delete(id) {
        const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        return this.db.run(sql, [id]);
    }

    /**
     * 依條件刪除記錄
     * @param {Object} conditions - 刪除條件
     * @returns {Promise<Object>}
     */
    async deleteBy(conditions) {
        const { whereClause, params } = this._buildWhereClause(conditions);
        const sql = `DELETE FROM ${this.tableName} ${whereClause}`;
        return this.db.run(sql, params);
    }

    // ============================================================================
    // 計數與分頁
    // ============================================================================

    /**
     * 計算總記錄數
     * @param {Object} conditions - 查詢條件（可選）
     * @returns {Promise<number>}
     */
    async count(conditions = null) {
        let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let params = [];

        if (conditions) {
            const { whereClause, params: whereParams } = this._buildWhereClause(conditions);
            sql += ` ${whereClause}`;
            params = whereParams;
        }

        const result = await this.db.get(sql, params);
        return result.count;
    }

    /**
     * 取得分頁資料
     * @param {number} page - 頁碼（從 1 開始）
     * @param {number} limit - 每頁筆數
     * @param {Object} conditions - 查詢條件（可選）
     * @returns {Promise<Object>} - { data, pagination }
     */
    async paginate(page = 1, limit = 20, conditions = null) {
        const offset = (page - 1) * limit;
        const total = await this.count(conditions);
        const pages = Math.ceil(total / limit);

        let data;
        if (conditions) {
            data = await this.findBy(conditions, { limit, offset });
        } else {
            data = await this.findAll({ limit, offset });
        }

        return {
            data,
            pagination: {
                total,
                currentPage: page,
                pages,
                limit,
                hasPrev: page > 1,
                hasNext: page < pages
            }
        };
    }

    // ============================================================================
    // 進階查詢
    // ============================================================================

    /**
     * 檢查記錄是否存在
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<boolean>}
     */
    async exists(conditions) {
        const result = await this.findOne(conditions);
        return result !== null && result !== undefined;
    }

    /**
     * 執行原生 SQL 查詢（單筆）
     * @param {string} sql - SQL 語句
     * @param {Array} params - 參數
     * @returns {Promise<Object|null>}
     */
    async rawGet(sql, params = []) {
        return this.db.get(sql, params);
    }

    /**
     * 執行原生 SQL 查詢（多筆）
     * @param {string} sql - SQL 語句
     * @param {Array} params - 參數
     * @returns {Promise<Array>}
     */
    async rawAll(sql, params = []) {
        return this.db.all(sql, params);
    }

    /**
     * 執行原生 SQL 操作
     * @param {string} sql - SQL 語句
     * @param {Array} params - 參數
     * @returns {Promise<Object>}
     */
    async rawRun(sql, params = []) {
        return this.db.run(sql, params);
    }

    // ============================================================================
    // 私有方法
    // ============================================================================

    /**
     * 建構 WHERE 子句
     * @private
     * @param {Object} conditions - 查詢條件
     * @returns {Object} - { whereClause, params }
     */
    _buildWhereClause(conditions) {
        if (!conditions || Object.keys(conditions).length === 0) {
            return { whereClause: '', params: [] };
        }

        const clauses = [];
        const params = [];

        for (const [column, value] of Object.entries(conditions)) {
            if (value === null) {
                clauses.push(`${column} IS NULL`);
            } else if (Array.isArray(value)) {
                // IN 查詢
                const placeholders = value.map(() => '?').join(', ');
                clauses.push(`${column} IN (${placeholders})`);
                params.push(...value);
            } else if (typeof value === 'object' && value.operator) {
                // 自定義操作符 { operator: '>=', value: 10 }
                clauses.push(`${column} ${value.operator} ?`);
                params.push(value.value);
            } else {
                clauses.push(`${column} = ?`);
                params.push(value);
            }
        }

        return {
            whereClause: `WHERE ${clauses.join(' AND ')}`,
            params
        };
    }
}

module.exports = BaseRepository;
