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
    // 設定値の検証
    validateConfig();

    // SPREADSHEET_ID検証を先に実施
    if (!SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID not set in Script Properties');
    }

    const newMsgs = getNewMessages();

    // レート制限適用（MAX_MESSAGES_PER_RUN）
    const msgsToProcess = newMsgs.slice(0, MAX_MESSAGES_PER_RUN);

    if (newMsgs.length > MAX_MESSAGES_PER_RUN) {
      logWarn('Message count exceeds limit, processing subset only', {
        totalMessages: newMsgs.length,
        processLimit: MAX_MESSAGES_PER_RUN,
        processingCount: msgsToProcess.length
      });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // API抽出関数を選択
    const extractFunc = AI_PROVIDER === 'openai'
      ? extractTransactionDataWithOpenAI
      : extractTransactionDataWithGemini;

    // プロバイダーに応じたAPI呼び出し間隔を取得
    const apiCallInterval = API_RATE_LIMITS[AI_PROVIDER] || 1000;

    logInfo(`Processing ${msgsToProcess.length} messages with ${AI_PROVIDER} API`, {
      totalAvailable: newMsgs.length,
      apiCallInterval: apiCallInterval
    });

    for (let i = 0; i < msgsToProcess.length; i++) {
      const msg = msgsToProcess[i];

      try {
        const body = msg.getPlainBody();
        const data = extractFunc(body);

        if (data) {
          writeToSheet(spreadsheet, data);
          markMessageAsProcessed(msg.getId());
          logSuccess(`Processed message ${i + 1}/${msgsToProcess.length}`);
        } else {
          errors.push({ msgId: msg.getId(), error: 'Failed to extract data' });
        }

        // レート制限: プロバイダー別API呼び出し間隔を確保（最後のメッセージは不要）
        if (i < msgsToProcess.length - 1) {
          Utilities.sleep(apiCallInterval);
        }

      } catch (msgErr) {
        errors.push({ msgId: msg.getId(), error: msgErr.toString() });
        logError(`Failed to process message ${i + 1}/${msgsToProcess.length}`, {
          error: msgErr.toString()
        });
      }
    }

    // エラーサマリー出力
    if (errors.length > 0) {
      logWarn(`${errors.length} messages failed out of ${msgsToProcess.length}`, {
        failedCount: errors.length,
        totalProcessed: msgsToProcess.length
      });
    } else {
      logSuccess(`All ${msgsToProcess.length} messages processed successfully`);
    }

  } catch (err) {
    logCritical('main() execution failed', {
      error: err.toString()
    });
    throw err;
  }
}

