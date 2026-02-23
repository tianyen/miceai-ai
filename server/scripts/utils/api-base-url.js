/**
 * 測試腳本共用 API 目標解析工具
 *
 * 優先順序：
 * 1. BASE_URL / API_BASE_URL（根 URL，例如 http://localhost:9999）
 * 2. API_URL（完整 v1 前綴，例如 http://localhost:9999/api/v1）
 * 3. PORT（fallback，預設 3000）
 */

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveBaseUrl() {
  const envBase = process.env.BASE_URL || process.env.API_BASE_URL;
  if (envBase && String(envBase).trim()) {
    return stripTrailingSlash(envBase);
  }

  const apiUrl = process.env.API_URL;
  if (apiUrl && String(apiUrl).trim()) {
    return stripTrailingSlash(apiUrl).replace(/\/api\/v1$/, '');
  }

  const port = Number(process.env.PORT) || 3000;
  return `http://localhost:${port}`;
}

function resolveApiV1BaseUrl() {
  const apiUrl = process.env.API_URL;
  if (apiUrl && String(apiUrl).trim()) {
    return stripTrailingSlash(apiUrl);
  }

  return `${resolveBaseUrl()}/api/v1`;
}

module.exports = {
  resolveBaseUrl,
  resolveApiV1BaseUrl
};
