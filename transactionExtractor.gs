/**************************************
 * transactionExtractor.gs
 * メール本文から取引情報を抽出する共通ロジック
 * OpenAI/Gemini両方で使える抽象化層
 **************************************/

/**
 * 危険なプロンプトインジェクションパターン
 */
// Security Note: The 'g' (global) flag is intentionally omitted.
// RegExp.test() with 'g' advances lastIndex on each call, causing
// alternating match/miss when the same object is reused across loop
// iterations (module-level const is shared across all invocations).
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/i,
  /disregard\s+(previous|above|all)\s+(instructions?|rules?)/i,
  /forget\s+(everything|all|previous|above)/i,
  /new\s+instructions?:/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /you\s+are\s+now/i,
  /act\s+as/i,
  /pretend\s+you\s+are/i,
  /role\s*:\s*(admin|system|root)/i
];

/**
 * メール本文の最大長（プロンプトインジェクション対策）
 */
const MAX_EMAIL_BODY_LENGTH = 5000;

/**
 * メール本文をサニタイズ（プロンプトインジェクション対策）
 * @param {string} emailBody - 元のメール本文
 * @returns {string|null} - サニタイズ済み本文、または不正検出時はnull
 */
function sanitizeEmailBody(emailBody) {
  if (!emailBody || !emailBody.trim()) {
    return null;
  }

  // 1. 制御文字を除去（改行・タブ以外）
  let sanitized = emailBody.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Unicode正規化（プロンプトインジェクション対策強化）
  sanitized = sanitized.normalize('NFKC');

  // 3. ゼロ幅文字除去
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 4. 長さ制限
  if (sanitized.length > MAX_EMAIL_BODY_LENGTH) {
    logWarn('Email body exceeds max length, truncating', {
      originalLength: sanitized.length,
      maxLength: MAX_EMAIL_BODY_LENGTH
    });
    sanitized = sanitized.substring(0, MAX_EMAIL_BODY_LENGTH);
  }

  // 5. 危険なパターン検出
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      logError('Potential prompt injection detected in email body', {
        pattern: pattern.toString()
      });
      return null; // 不正な入力として拒否
    }
  }

  return sanitized;
}

/**
 * メール本文から取引情報を抽出（API非依存の共通ロジック）
 * @param {string} emailBody - メール本文
 * @param {Function} apiCaller - API呼び出し関数 (prompt) => responseText
 * @returns {Object|null} - 例: { store: '○○', date: 'YYYY年MM月DD日 HH:MM:SS', amount: 'XXXX円' }
 */
function extractTransactionData(emailBody, apiCaller) {
  // 1. 空チェック
  if (!emailBody || !emailBody.trim()) {
    logWarn('Email body is empty, null, or only whitespace');
    return null;
  }

  // 2. サニタイズ（プロンプトインジェクション対策）
  const sanitizedBody = sanitizeEmailBody(emailBody);
  if (!sanitizedBody) {
    logError('Email body sanitization failed or potential attack detected');
    return null;
  }

  // 3. プロンプト作成
  const prompt = buildExtractionPrompt(sanitizedBody);

  // 4. API呼び出し（抽象化）
  const responseText = apiCaller(prompt);
  if (!responseText) {
    return null;
  }

  // 5. JSON解析 & バリデーション
  return parseAndValidateResponse(responseText);
}

/**
 * 抽出用プロンプトを構築
 * @param {string} emailBody - メール本文
 * @returns {string} - プロンプト文字列
 */
function buildExtractionPrompt(emailBody) {
  return `
以下のメール本文から利用店舗(store)、利用日付(date)、利用金額(amount)を抽出し、
必ず下記のJSON形式のみで回答してください。
残高不足通知は除外します。
特に日付は "YYYY年MM月DD日 HH:MM:SS" の形式に揃えてください（秒が不明な場合は "00" で構いません）。
もし情報が抽出できない場合は、空のJSONオブジェクト {} を返してください。
日付の形式に乱れが確認できた場合ペナルティが発生します。

メール本文:
${emailBody}

出力例:
{
  "store": "店舗名",
  "date": "YYYY年MM月DD日 HH:MM:SS",
  "amount": "1200円"
}
  `.trim();
}

/**
 * 許可されたフィールド名（プロトタイプ汚染対策）
 */
const ALLOWED_FIELDS = ['store', 'date', 'amount'];

/**
 * 危険なプロパティ名（プロトタイプ汚染対策）
 */
const DANGEROUS_PROPS = ['__proto__', 'constructor', 'prototype'];

/**
 * 日付の実値を検証
 * @param {string} dateStr - 日付文字列（例: "2025年12月20日 15:30:00"）
 * @returns {boolean} - 有効な日付かどうか
 */
function isValidDateValue(dateStr) {
  if (!DATE_FORMAT_PATTERN.test(dateStr)) {
    return false;
  }

  // 年月日時分秒を抽出
  const match = dateStr.match(/^(\d{4})年(\d{2})月(\d{2})日 (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  // 範囲チェック
  if (month < 1 || month > 12) {
    logWarn('Invalid month value', { month, dateStr });
    return false;
  }

  if (day < 1 || day > 31) {
    logWarn('Invalid day value', { day, dateStr });
    return false;
  }

  if (hour < 0 || hour > 23) {
    logWarn('Invalid hour value', { hour, dateStr });
    return false;
  }

  if (minute < 0 || minute > 59) {
    logWarn('Invalid minute value', { minute, dateStr });
    return false;
  }

  if (second < 0 || second > 59) {
    logWarn('Invalid second value', { second, dateStr });
    return false;
  }

  // JavaScriptのDate オブジェクトで実際の有効性をチェック（UTC基準）
  // （例: 2月30日などを検出）
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    logWarn('Invalid date detected (e.g., Feb 30, Apr 31)', { dateStr });
    return false;
  }

  return true;
}

/**
 * 金額文字列のバリデーション
 * 「数字（カンマ区切り可）+ 円」の形式を許可
 * @param {string} amount - 金額文字列（例: "1,200円", "500円"）
 * @returns {boolean} - 有効な金額形式かどうか
 */
function isValidAmount(amount) {
  if (typeof amount !== 'string') {
    return false;
  }
  // Digits with optional comma grouping, followed by 円
  return /^[0-9]{1,3}(,[0-9]{3})*円$|^[0-9]+円$/.test(amount);
}

/** Maximum allowed store name length */
const MAX_STORE_NAME_LENGTH = 200;

/**
 * 店舗名のバリデーション
 * 長さ上限と制御文字の拒否
 * @param {string} store - 店舗名
 * @returns {boolean} - 有効な店舗名かどうか
 */
function isValidStore(store) {
  if (typeof store !== 'string') {
    return false;
  }
  if (store.length > MAX_STORE_NAME_LENGTH) {
    return false;
  }
  // Reject control characters (U+0000-U+001F, U+007F)
  if (/[\x00-\x1F\x7F]/.test(store)) {
    return false;
  }
  return true;
}

/**
 * API応答をパース＆バリデーション
 * @param {string} responseText - API応答テキスト
 * @returns {Object|null} - パース済みオブジェクト
 */
function parseAndValidateResponse(responseText) {
  try {
    // Markdown形式のコードブロックを除去
    const cleanedText = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // プロトタイプ汚染チェック（hasOwnPropertyでオブジェクト自身のプロパティのみ検査）
    for (const dangerousProp of DANGEROUS_PROPS) {
      if (Object.prototype.hasOwnProperty.call(parsed, dangerousProp)) {
        logError('Prototype pollution attempt detected', {
          property: dangerousProp
        });
        return null;
      }
    }

    // ホワイトリスト方式でフィールド抽出
    const safeData = {};
    for (const field of ALLOWED_FIELDS) {
      if (parsed[field]) {
        safeData[field] = parsed[field];
      }
    }

    // 必須フィールドチェック
    if (!safeData.store || !safeData.date || !safeData.amount) {
      logWarn('Missing required fields in parsed data', {
        receivedFields: Object.keys(safeData)
      });
      return null;
    }

    // 日付の形式＆実値検証
    if (!isValidDateValue(safeData.date)) {
      logWarn('Date validation failed', {
        fieldLength: safeData.date.length
      });
      return null;
    }

    // 金額の形式検証（数字+カンマ+円）
    if (!isValidAmount(safeData.amount)) {
      logWarn('Amount validation failed', {
        fieldLength: safeData.amount.length
      });
      return null;
    }

    // 店舗名の検証（長さ上限・制御文字拒否）
    if (!isValidStore(safeData.store)) {
      logWarn('Store name validation failed', {
        fieldLength: safeData.store.length,
        exceedsLimit: safeData.store.length > MAX_STORE_NAME_LENGTH
      });
      return null;
    }

    // Privacy Note: Log field existence and lengths only, never PII values
    logSuccess('Successfully extracted and validated data', {
      hasStore: true,
      hasDate: true,
      hasAmount: true,
      storeLength: safeData.store.length,
      amountLength: safeData.amount.length
    });

    return safeData;

  } catch (err) {
    // Privacy Note: Do not log responsePreview — it may contain PII (store names, etc.)
    logError('Failed to parse JSON response', {
      error: err.toString(),
      responseLength: responseText.length
    });
    return null;
  }
}
