/**************************************
 * logger.gs
 * 統一ログ出力＆機密情報マスキング
 **************************************/

/**
 * 機密情報をマスキングするパターン定義
 */
const SENSITIVE_PATTERNS = [
  // APIキー系（大文字小文字問わず）
  { pattern: /(api[_-]?key|apikey|token|secret|password|bearer)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{8,})["']?/gi, replacement: '$1: ***MASKED***' },

  // Authorization ヘッダー
  { pattern: /(authorization\s*[:=]\s*["']?)(Bearer\s+)?([a-zA-Z0-9_\-\.]{8,})["']?/gi, replacement: '$1***MASKED***' },

  // x-goog-api-key ヘッダー
  { pattern: /(x-goog-api-key\s*[:=]\s*["']?)([a-zA-Z0-9_\-]{8,})["']?/gi, replacement: '$1***MASKED***' },

  // SPREADSHEET_ID（形式: 長い英数字_-の組み合わせ）
  { pattern: /SPREADSHEET_ID['":\s]*([a-zA-Z0-9_\-]{20,})/gi, replacement: 'SPREADSHEET_ID: ***MASKED***' },

  // メールアドレス
  { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '***EMAIL_MASKED***' },

  // メッセージID（GmailのメッセージID形式）
  { pattern: /message\s+id\s*[:=]?\s*["']?([a-f0-9]{16,})["']?/gi, replacement: 'message id: ***MSG_ID***' },

  // 長いJSON本文（100文字以上）を省略 - 関数型replacement使用
  { pattern: /(Response text|Email body|メール本文)[:：]\s*(.{100,})/gi,
    replacement: (match, p1, p2) => `${p1}: [TRUNCATED - length: ${p2.length} chars]` },

  // Base64エンコードされたトークン（20文字以上）
  { pattern: /(token|key|secret|bearer)["']?\s*[:=]\s*["']?([A-Za-z0-9+/]{20,}={0,2})["']?/gi,
    replacement: '$1: ***MASKED***' },

  // ネストされたJSONオブジェクト内のトークン
  { pattern: /("(?:token|key|secret|password|bearer)"\s*:\s*")([^"]{8,})"/gi,
    replacement: '$1***MASKED***"' }
];

/**
 * テキストから機密情報をマスキング
 * @param {string} text - マスキング対象テキスト
 * @returns {string} - マスキング済みテキスト
 */
function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') {
    return String(text);
  }

  try {
    let masked = text;

    // 各パターンを適用
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }

    return masked;

  } catch (err) {
    // エラー時は安全側に倒す（全文マスク）
    Logger.log(`[ERROR] maskSensitiveData failed: ${err.toString()}`);
    return '[MASKING_ERROR - CONTENT_FULLY_MASKED]';
  }
}

/**
 * ログレベル定義
 */
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
  SUCCESS: 'SUCCESS'
};

/**
 * 統一ログ出力関数
 * @param {string} level - ログレベル（LOG_LEVELS の値）
 * @param {string} message - ログメッセージ
 * @param {Object} context - 追加コンテキスト（オプション）
 */
function log(level, message, context = null) {
  // フォーマット: [LEVEL] message
  let logMessage = `[${level}] ${message}`;

  // コンテキストがあれば追加（機密情報をマスキング）
  if (context) {
    const maskedContext = maskSensitiveData(JSON.stringify(context));
    logMessage += ` | Context: ${maskedContext}`;
  }

  // 機密情報マスキング
  const maskedMessage = maskSensitiveData(logMessage);

  // Google Apps Script のネイティブLogger に出力
  Logger.log(maskedMessage);
}

/**
 * ショートハンド関数群
 */
function logDebug(message, context = null) {
  log(LOG_LEVELS.DEBUG, message, context);
}

function logInfo(message, context = null) {
  log(LOG_LEVELS.INFO, message, context);
}

function logWarn(message, context = null) {
  log(LOG_LEVELS.WARN, message, context);
}

function logError(message, context = null) {
  log(LOG_LEVELS.ERROR, message, context);
}

function logCritical(message, context = null) {
  log(LOG_LEVELS.CRITICAL, message, context);
}

function logSuccess(message, context = null) {
  log(LOG_LEVELS.SUCCESS, message, context);
}

/**
 * マスキング機能のテスト
 */
function testLogger() {
  logInfo('=== Logger Test Start ===');

  // APIキーテスト
  logInfo('Testing API key masking', {
    api_key: 'sk-1234567890abcdef',
    GEMINI_API_KEY: 'AIzaSyABCDEF1234567890',
    token: 'ghp_abcdefg12345'
  });

  // メールアドレステスト
  logInfo('Testing email masking: user@example.com');

  // SPREADSHEET_IDテスト
  logInfo('SPREADSHEET_ID: 1a2b3c4d5e6f7g8h9i0j_AbCdEfGhIjKl');

  // 長い本文テスト
  const longText = 'A'.repeat(150);
  logInfo('Testing truncation', { emailBody: longText });

  // エラーログテスト
  logError('API call failed', {
    responseCode: 429,
    error: 'Rate limit exceeded'
  });

  logInfo('=== Logger Test Complete ===');
}
