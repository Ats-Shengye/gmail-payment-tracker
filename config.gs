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

/** 検索対象の件名・送信元パターン */
const SEARCH_QUERIES = [
  '(subject:"【決済サービス】ご利用のお知らせ" from:"notification@example-payment.jp")',
  '(subject:"デビットカードご利用のお知らせ" from:"info@example-card.jp")'
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
const GEMINI_MODEL = 'gemini-pro';

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

/** 日付フォーマット検証用正規表現 */
const DATE_FORMAT_PATTERN = /^\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}:\d{2}$/;

/** 年月抽出用正規表現 */
const YEAR_MONTH_PATTERN = /(\d{4})年(\d{1,2})月/;
