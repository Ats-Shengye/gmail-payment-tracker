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
  //    "YYYY年MM月DD日" のような文字列が入っている前提
  const yearMonthMatch = data.date.match(/(\d{4})年(\d{1,2})月/);
  if (!yearMonthMatch) {
    console.log('Date format not recognized:', data.date);
    return;
  }
  const year = yearMonthMatch[1];
  // パッド付き月 (例: 1→01)
  const month = String(yearMonthMatch[2]).padStart(2, '0');
  const sheetName = `${year}/${month}`;

  // 2. シートの存在確認 → なければ作成
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    // ヘッダーを入れる
    sheet.appendRow(['利用店舗', '利用日時', '支払金額']);

    // ヘッダーの書式設定 (オプショナル)
    const headerRange = sheet.getRange('A1:C1');
    headerRange.setBackground('#f3f3f3');
    headerRange.setFontWeight('bold');

    // 列幅設定 (オプショナル)
    sheet.setColumnWidth(1, 200); // 店舗名
    sheet.setColumnWidth(2, 150); // 日時
    sheet.setColumnWidth(3, 100); // 金額

    // 3. D1セルに合計金額の式を入れる(現行のやり方を維持)
    //    "C2:C100"の範囲内を合計し、"合計金額: XXX円"の形式で表示
    sheet.getRange('D1').setValue(
      '="合計金額："&TEXT(SUM(ARRAYFORMULA(IFERROR(IF(ISBLANK(C2:C96), 0, VALUE(SUBSTITUTE(REGEXEXTRACT(C2:C96, "[0-9,]+"), ",", ""))), 0))), "#,##0")&"円"'
    );
  }

  // 4. 重複チェック (既に同じデータがあるかどうか)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    // 既に書き込み済みの範囲を取得
    const existingData = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    // store/date/amount 全て一致する行があるかチェック
    const isDuplicate = existingData.some(row => {
      return row[0] === data.store && row[1] === data.date && row[2] === data.amount;
    });
    if (isDuplicate) {
      console.log('Duplicate entry found. Skipping write:', data);
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
