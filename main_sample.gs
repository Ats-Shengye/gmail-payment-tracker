/**************************************
 * main_sample.gs
 * メイン処理一式（サンプル版 - Gemini仕様）
 **************************************/

// テストモード（true: ログ出力のみ、false: 実際に書き込み）
const TEST_MODE = true;

/**
 * 完全分離テスト用エントリーポイント
 * - 未処理の「メッセージ」を取得
 * - Gemini で店名/日付/金額を抽出
 * - ログ出力のみ（書き込み・処理済み登録は一切なし）
 */
function testMailToGeminiFlow() {
  Logger.log('=== 完全分離テスト開始 ===');
  
  const newMsgs = getNewMessages();                     // ← mailSearch.gs
  Logger.log(`INFO: Found ${newMsgs.length} new messages`);

  if (newMsgs.length === 0) {
    Logger.log('INFO: No new messages to process');
    return;
  }

  // 最大5件までテスト（ログ量制限）
  const testMsgs = newMsgs.slice(0, 5);
  Logger.log(`INFO: Testing first ${testMsgs.length} messages`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testMsgs.length; i++) {
    const msg = testMsgs[i];
    Logger.log(`\n--- Message ${i + 1}/${testMsgs.length} (ID: ${msg.getId()}) ---`);
    Logger.log(`Subject: ${msg.getSubject()}`);
    
    const body = msg.getPlainBody();
    Logger.log(`Body length: ${body.length} chars`);
    Logger.log(`Body preview: ${body.slice(0, 200)}...`);
    
    const data = extractTransactionData(body);             // ← geminiApi.gs

    if (data) {
      Logger.log(`✅ SUCCESS: Extracted data: ${JSON.stringify(data)}`);
      successCount++;
    } else {
      Logger.log(`❌ FAILED: No data extracted`);
      failCount++;
    }
  }

  Logger.log(`\n=== テスト結果 ===`);
  Logger.log(`成功: ${successCount}件`);
  Logger.log(`失敗: ${failCount}件`);
  Logger.log(`処理対象外メッセージ: ${newMsgs.length - testMsgs.length}件（未テスト）`);
  Logger.log('=== 完全分離テスト終了 ===');
}

/**
 * 元のmain関数（参考用・非推奨）
 * 実際の書き込みを行うため、テスト時は使用しない
 */
function main_original() {
  // スプレッドシートIDを環境変数から取得
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    Logger.log('ERROR: SPREADSHEET_ID not set in Script Properties');
    return;
  }

  const newMsgs = getNewMessages();                     // ← mailSearch.gs
  
  if (TEST_MODE) {
    Logger.log(`TEST MODE: Found ${newMsgs.length} new messages`);
    Logger.log(`TEST MODE: Using spreadsheet ID: ${spreadsheetId}`);
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  for (const msg of newMsgs) {
    const body = msg.getPlainBody();
    const data = extractTransactionData(body);             // ← geminiApi.gs

    if (data) {
      if (TEST_MODE) {
        Logger.log(`TEST MODE: Extracted data: ${JSON.stringify(data)}`);
        Logger.log(`TEST MODE: Would write to sheet (skipped)`);
      } else {
        writeToSheet(spreadsheet, data);                  // ← sheetOps.gs
        markMessageAsProcessed(msg.getId());              // ← mailSearch.gs
      }
    } else {
      Logger.log(`WARN: No data extracted from message ID: ${msg.getId()}`);
    }
  }
}

/**
 * テスト用：単一メール本文でGemini APIをテスト
 */
function testGeminiExtraction() {
  const testEmailBody = `
【楽天カード】ご利用速報
ご利用店舗：Amazon.co.jp
ご利用日時：2024年12月25日 14:30:12
ご利用金額：3,500円
`;

  Logger.log('=== Gemini API Test ===');
  const result = extractTransactionData(testEmailBody);
  Logger.log(`Test result: ${JSON.stringify(result)}`);
  
  if (result && result.store && result.date && result.amount) {
    Logger.log('✅ Test PASSED: All required fields extracted');
  } else {
    Logger.log('❌ Test FAILED: Missing required fields');
  }
}