/**************************************
 * sheetOps.gs
 * スプレッドシートへの書き込み・新規シート作成など
 **************************************/

/**
 * セル値の数式インジェクション無害化
 *
 * Google Sheets は = + - @ で始まる文字列を数式として評価する。
 * LLM応答由来のデータにこれらが含まれると、=IMPORTDATA() 等で
 * 外部へHTTPリクエストが飛び、同シート内の他の取引データが漏洩しうる。
 * タブ(0x09)・CR(0x0D)・LF(0x0A) も先頭に来るとセル解釈が変わるため対象。
 *
 * @param {*} value - セルに書き込む値
 * @returns {*} - 無害化済みの値（文字列以外はそのまま返す）
 */
function sanitizeCellValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  if (/^[=+\-@\t\r\n]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * ロック取得のタイムアウト時間（ミリ秒）
 * 短縮して次回リトライに委ねる設計
 */
const LOCK_TIMEOUT_MS = 10000;

/**
 * 指定されたスプレッドシートにデータを追記する関数
 * @param {Spreadsheet} spreadsheet  - SpreadsheetApp.openById() で取得したスプレッドシートオブジェクト
 * @param {Object} data - { store, date, amount }
 */
function writeToSheet(spreadsheet, data) {
  // スクリプトロックを取得（スタンドアロンスクリプト対応）
  // Note: getDocumentLock()はContainer-boundスクリプト専用でnullを返す場合がある
  const lock = LockService.getScriptLock();

  try {
    // ロック取得を試行（タイムアウト付き）
    lock.waitLock(LOCK_TIMEOUT_MS);

    logDebug('Script lock acquired for writeToSheet');

    // ロック取得後の実際の書き込み処理
    writeToSheetInternal(spreadsheet, data);

  } catch (lockError) {
    logError('Failed to acquire script lock', {
      error: lockError.toString(),
      timeout: LOCK_TIMEOUT_MS
    });
    // タイムアウト時はthrowせずreturnで次回リトライに委ねる
    return;

  } finally {
    // ロック解放
    lock.releaseLock();
    logDebug('Script lock released');
  }
}

/**
 * 実際のシート書き込み処理（ロック保護下で実行）
 * @param {Spreadsheet} spreadsheet - SpreadsheetApp.openById() で取得したスプレッドシートオブジェクト
 * @param {Object} data - { store, date, amount }
 */
function writeToSheetInternal(spreadsheet, data) {
  // 1. 日付から "YYYY/MM" を作ってシート名にする想定
  const yearMonthMatch = data.date.match(YEAR_MONTH_PATTERN);
  if (!yearMonthMatch) {
    logError('Date format not recognized for sheet name', {
      date: data.date
    });
    return;
  }
  const year = yearMonthMatch[1];
  const month = String(yearMonthMatch[2]).padStart(2, '0');
  const sheetName = `${year}/${month}`;

  // 2. シートの存在確認 → なければ作成
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    // ヘッダーを入れる
    sheet.appendRow(['利用店舗', '利用日時', '支払金額']);

    // ヘッダーの書式設定
    const headerRange = sheet.getRange(HEADER_RANGE);
    headerRange.setBackground(HEADER_BACKGROUND_COLOR);
    headerRange.setFontWeight('bold');

    // 列幅設定
    sheet.setColumnWidth(SHEET_COLUMNS.STORE + 1, COLUMN_WIDTHS.STORE);
    sheet.setColumnWidth(SHEET_COLUMNS.DATE + 1, COLUMN_WIDTHS.DATE);
    sheet.setColumnWidth(SHEET_COLUMNS.AMOUNT + 1, COLUMN_WIDTHS.AMOUNT);

    // 3. D1セルに合計金額の式を入れる
    const formulaRange = `C${AMOUNT_CALCULATION_RANGE.START_ROW}:C${AMOUNT_CALCULATION_RANGE.END_ROW}`;
    sheet.getRange('D1').setValue(
      `="合計金額："&TEXT(SUM(ARRAYFORMULA(IFERROR(IF(ISBLANK(${formulaRange}), 0, VALUE(SUBSTITUTE(REGEXEXTRACT(${formulaRange}, "[0-9,]+"), ",", ""))), 0))), "#,##0")&"円"`
    );
  }

  // 4. 重複チェック
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existingData = sheet.getRange(
      AMOUNT_CALCULATION_RANGE.START_ROW,
      SHEET_COLUMNS.STORE + 1,
      lastRow - 1,
      SHEET_COLUMNS.AMOUNT + 1
    ).getValues();

    const isDuplicate = existingData.some(row => {
      return row[SHEET_COLUMNS.STORE] === data.store
        && row[SHEET_COLUMNS.DATE] === data.date
        && row[SHEET_COLUMNS.AMOUNT] === data.amount;
    });

    if (isDuplicate) {
      // Privacy Note: Log date only for debugging; store/amount are PII
      logWarn('Duplicate entry found, skipping write', {
        date: data.date,
        sheetName: sheetName
      });
      return;
    }
  }

  // 5. 重複がなければ書き込み（数式インジェクション対策）
  sheet.appendRow([
    sanitizeCellValue(data.store),
    sanitizeCellValue(data.date),
    sanitizeCellValue(data.amount)
  ]);
  logDebug('Data written to sheet', {
    sheetName: sheetName
  });

  // 6. 金額セルの表示形式を数値扱いにしたい場合は、こんな設定を追加してもいい
  //    ただし今は文字列で"xxxx円"として書き込んでるから無理に変換する必要は無い
  // const newRow = sheet.getLastRow();
  // sheet.getRange(newRow, 3).setNumberFormat('#,##0"円"');
}

