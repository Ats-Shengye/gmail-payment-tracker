/**************************************
 * main.gs
 * メイン処理一式
 **************************************/

// ① スプレッドシートID — PropertiesServiceから取得
// 初回設定: PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', 'あなたのシートID');
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

// ② 使用するAPI — 'openai' または 'gemini' を指定
// 初回設定: PropertiesService.getScriptProperties().setProperty('AI_PROVIDER', 'gemini');
const AI_PROVIDER = PropertiesService.getScriptProperties().getProperty('AI_PROVIDER') || 'gemini';

/**
 * エントリーポイント
 * - 未処理の「メッセージ」を取得
 * - LLM で店名/日付/金額を抽出
 * - 月別シートに追記
 * - メッセージIDを処理済みに登録
 */
function main() {
  const errors = [];

  try {
    const newMsgs = getNewMessages();
    if (!SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID not set in Script Properties');
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // API抽出関数を選択
    const extractFunc = AI_PROVIDER === 'openai'
      ? extractTransactionDataWithOpenAI
      : extractTransactionDataWithGemini;

    Logger.log(`INFO: Processing ${newMsgs.length} new messages with ${AI_PROVIDER} API`);

    for (const msg of newMsgs) {
      try {
        const body = msg.getPlainBody();
        const data = extractFunc(body);

        if (data) {
          writeToSheet(spreadsheet, data);
          markMessageAsProcessed(msg.getId());
          Logger.log(`SUCCESS: Processed message ${msg.getId()}`);
        } else {
          errors.push({ msgId: msg.getId(), error: 'Failed to extract data' });
        }
      } catch (msgErr) {
        errors.push({ msgId: msg.getId(), error: msgErr.toString() });
        Logger.log(`ERROR: Failed to process message ${msg.getId()}: ${msgErr}`);
      }
    }

    // エラーサマリー出力
    if (errors.length > 0) {
      Logger.log(`WARN: ${errors.length} messages failed out of ${newMsgs.length}`);
      Logger.log('Failed messages: ' + JSON.stringify(errors));
    } else {
      Logger.log(`SUCCESS: All ${newMsgs.length} messages processed successfully`);
    }

  } catch (err) {
    Logger.log(`CRITICAL ERROR: main() failed - ${err}`);
    throw err;
  }
}

