/**************************************
 * config.gs
 * 定数定義・設定値の一元管理
 **************************************/

// ===== シート関連定数 =====

/** 列インデックス（0始まり） */
const SHEET_COLUMNS = {
  STORE: 0,   // A列: 利用店舗
  DATE: 1,    // B列: 利用日時
  AMOUNT: 2   // C列: 支払金額
};

/** 列幅設定 */
const COLUMN_WIDTHS = {
  STORE: 200,   // 店舗名列の幅
  DATE: 150,    // 日時列の幅
  AMOUNT: 100   // 金額列の幅
};

/** シート名 */
const SHEET_NAMES = {
  PROCESSED_MSGS: 'ProcessedMsgs'  // 処理済みメッセージIDを記録するシート
};

/** ヘッダー行の範囲 */
const HEADER_RANGE = 'A1:C1';

/** 合計金額計算の対象範囲（最大行数） */
const AMOUNT_CALCULATION_RANGE = {
  START_ROW: 2,   // データ開始行
  END_ROW: 96     // 最大行（必要に応じて拡大）
};

// ===== メール検索関連定数 =====

/**
 * 検索対象の件名・送信元パターン
 * 利用している決済サービスに合わせて書き換えてください。
 * Gmail の検索演算子（subject: / from:）を使って絞り込みます。
 */
const SEARCH_QUERIES = [
  '(subject:"【決済サービス】ご利用のお知らせ" from:"notification@example-payment.jp")',
  '(subject:"デビットカードご利用のお知らせ" from:"info@example-card.jp")',
  // 必要に応じて追加
];

// ===== スタイル設定 =====

/** ヘッダー行の背景色 */
const HEADER_BACKGROUND_COLOR = '#f3f3f3';

// ===== API設定 =====

/** OpenAI APIモデル名 */
const OPENAI_MODEL = 'gpt-4o-mini';  // 'gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo' など

/** OpenAI APIパラメータ */
const OPENAI_API_PARAMS = {
  TEMPERATURE: 0.2,
  MAX_TOKENS: 1000
};

/** Gemini APIモデル名 */
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

/** Gemini APIパラメータ */
const GEMINI_API_PARAMS = {
  TEMPERATURE: 0.2,
  TOP_K: 40,
  TOP_P: 0.95,
  MAX_OUTPUT_TOKENS: 1024
};

// ===== システム設定 =====

/** バッチ処理の最大件数（実行時間制限対策） */
const MAX_MESSAGES_PER_RUN = 50;

/** API呼び出し間隔（ミリ秒）- プロバイダー別設定 */
const API_RATE_LIMITS = {
  openai: 1000,  // OpenAI: 1秒間隔
  gemini: 2000   // Gemini: 2秒間隔（429エラー対策で増加）
};

/** リトライ設定 */
const RETRY_CONFIG = {
  MAX_RETRIES: 3,           // 最大リトライ回数
  BASE_DELAY_MS: 2000,      // 基本待機時間（ミリ秒）
  MAX_DELAY_MS: 30000       // 最大待機時間（ミリ秒）
};

/** 日付フォーマット検証用正規表現 */
const DATE_FORMAT_PATTERN = /^\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}:\d{2}$/;

/** 年月抽出用正規表現 */
const YEAR_MONTH_PATTERN = /(\d{4})年(\d{1,2})月/;

// ===== 設定値検証 =====

/**
 * 設定値の妥当性を検証
 * @throws {Error} 設定値が不正な場合
 */
function validateConfig() {
  const errors = [];

  // 1. MAX_MESSAGES_PER_RUN の検証
  if (typeof MAX_MESSAGES_PER_RUN !== 'number' || MAX_MESSAGES_PER_RUN < 1 || MAX_MESSAGES_PER_RUN > 500) {
    errors.push('MAX_MESSAGES_PER_RUN must be a number between 1 and 500');
  }

  // 2. OPENAI_MODEL の検証
  const validOpenAIModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4-turbo'];
  if (!validOpenAIModels.includes(OPENAI_MODEL)) {
    errors.push(`OPENAI_MODEL "${OPENAI_MODEL}" is not in the list of valid models: ${validOpenAIModels.join(', ')}`);
  }

  // 3. GEMINI_MODEL の検証（ホワイトリスト方式）
  const validGeminiModels = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  if (!validGeminiModels.includes(GEMINI_MODEL)) {
    errors.push(`GEMINI_MODEL "${GEMINI_MODEL}" is not valid. Allowed: ${validGeminiModels.join(', ')}`);
  }

  // 4. OPENAI_API_PARAMS の検証
  if (typeof OPENAI_API_PARAMS.TEMPERATURE !== 'number' || OPENAI_API_PARAMS.TEMPERATURE < 0 || OPENAI_API_PARAMS.TEMPERATURE > 2) {
    errors.push('OPENAI_API_PARAMS.TEMPERATURE must be between 0 and 2');
  }

  if (typeof OPENAI_API_PARAMS.MAX_TOKENS !== 'number' || OPENAI_API_PARAMS.MAX_TOKENS < 1 || OPENAI_API_PARAMS.MAX_TOKENS > 16000) {
    errors.push('OPENAI_API_PARAMS.MAX_TOKENS must be between 1 and 16000');
  }

  // 5. GEMINI_API_PARAMS の検証
  if (typeof GEMINI_API_PARAMS.TEMPERATURE !== 'number' || GEMINI_API_PARAMS.TEMPERATURE < 0 || GEMINI_API_PARAMS.TEMPERATURE > 2) {
    errors.push('GEMINI_API_PARAMS.TEMPERATURE must be between 0 and 2');
  }

  if (typeof GEMINI_API_PARAMS.TOP_K !== 'number' || GEMINI_API_PARAMS.TOP_K < 1 || GEMINI_API_PARAMS.TOP_K > 100) {
    errors.push('GEMINI_API_PARAMS.TOP_K must be between 1 and 100');
  }

  if (typeof GEMINI_API_PARAMS.TOP_P !== 'number' || GEMINI_API_PARAMS.TOP_P < 0 || GEMINI_API_PARAMS.TOP_P > 1) {
    errors.push('GEMINI_API_PARAMS.TOP_P must be between 0 and 1');
  }

  if (typeof GEMINI_API_PARAMS.MAX_OUTPUT_TOKENS !== 'number' || GEMINI_API_PARAMS.MAX_OUTPUT_TOKENS < 1 || GEMINI_API_PARAMS.MAX_OUTPUT_TOKENS > 8192) {
    errors.push('GEMINI_API_PARAMS.MAX_OUTPUT_TOKENS must be between 1 and 8192');
  }

  // 6. SEARCH_QUERIES の検証
  if (!Array.isArray(SEARCH_QUERIES) || SEARCH_QUERIES.length === 0) {
    errors.push('SEARCH_QUERIES must be a non-empty array');
  }

  // 7. 列定義の検証
  if (typeof SHEET_COLUMNS.STORE !== 'number' || typeof SHEET_COLUMNS.DATE !== 'number' || typeof SHEET_COLUMNS.AMOUNT !== 'number') {
    errors.push('SHEET_COLUMNS must contain numeric values');
  }

  // 8. AI_PROVIDER に応じたAPIキーの存在確認
  const aiProvider = PropertiesService.getScriptProperties().getProperty('AI_PROVIDER') || 'gemini';
  if (aiProvider === 'openai') {
    const openaiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!openaiKey || openaiKey.trim() === '') {
      errors.push('OPENAI_API_KEY is not set in Script Properties but AI_PROVIDER is "openai"');
    }
  } else if (aiProvider === 'gemini') {
    const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!geminiKey || geminiKey.trim() === '') {
      errors.push('GEMINI_API_KEY is not set in Script Properties but AI_PROVIDER is "gemini"');
    }
  }

  // エラーがあれば例外をスロー
  if (errors.length > 0) {
    const errorMessage = 'Configuration validation failed:\n' + errors.join('\n');
    throw new Error(errorMessage);
  }

  logInfo('Configuration validation passed');
}

/**
 * 設定値検証のテスト関数
 */
function testValidateConfig() {
  try {
    validateConfig();
    logSuccess('Configuration is valid');
  } catch (err) {
    logError('Configuration validation failed', {
      error: err.toString()
    });
  }
}
