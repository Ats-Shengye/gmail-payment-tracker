/**************************************
 * main.gs
 * メイン処理一式
 **************************************/

/**
 * エントリーポイント
 * - 未処理の「メッセージ」を取得
 * - LLM で店名/日付/金額を抽出
 * - 月別シートに追記
 * - メッセージIDを処理済みに登録
 */
function main() {
  // 環境変数からスプレッドシートIDを取得
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID environment variable is not set. Please configure it in Script Properties.');
  }

  const newMsgs     = getNewMessages();                     // ← mailSearch.gs
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  for (const msg of newMsgs) {
    const body  = msg.getPlainBody();
    const data  = extractTransactionData(body);             // ← openaiApi.js

    if (data) {
      writeToSheet(spreadsheet, data);                      // ← sheetOps.gs
      markMessageAsProcessed(msg.getId());                  // ← mailSearch.gs
    }
  }
}
