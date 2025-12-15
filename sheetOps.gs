/**************************************
 * sheetOps.gs
 * スプレッドシートへの書き込み・新規シート作成など
 **************************************/

/**
 * 指定されたスプレッドシートにデータを追記する関数
 * @param {Spreadsheet} spreadsheet  - SpreadsheetApp.openById() で取得したスプレッドシートオブジェクト
 * @param {Object} data - { store, date, amount }
 */
function writeToSheet(spreadsheet, data) {
  // 1. 日付から "YYYY/MM" を作ってシート名にする想定
  const yearMonthMatch = data.date.match(YEAR_MONTH_PATTERN);
  if (!yearMonthMatch) {
    Logger.log('Date format not recognized:', data.date);
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
      Logger.log('Duplicate entry found. Skipping write:', data);
      return;
    }
  }

  // 5. 重複がなければ書き込み
  sheet.appendRow([data.store, data.date, data.amount]);

  // 6. 金額セルの表示形式を数値扱いにしたい場合は、こんな設定を追加してもいい
  //    ただし今は文字列で"xxxx円"として書き込んでるから無理に変換する必要は無い
  // const newRow = sheet.getLastRow();
  // sheet.getRange(newRow, 3).setNumberFormat('#,##0"円"');
}

