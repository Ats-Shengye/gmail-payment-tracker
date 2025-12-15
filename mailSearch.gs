/**************************************
 * mailSearch.gs
 * Gmail検索 & メッセージID管理（スプレッドシート保存版）
 **************************************/

/**
 * 処理済みメッセージIDの Set を取得
 * @returns {Set<string>}
 */
function getProcessedIdsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.PROCESSED_MSGS)
    || ss.insertSheet(SHEET_NAMES.PROCESSED_MSGS);

  const last = sheet.getLastRow();
  if (last === 0) return new Set();

  const ids = sheet.getRange(1, 1, last).getValues().flat().filter(String);
  return new Set(ids);
}

/**
 * メッセージID をシートに追記
 * @param {string} msgId
 */
function markMessageAsProcessed(msgId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.PROCESSED_MSGS)
    || ss.insertSheet(SHEET_NAMES.PROCESSED_MSGS);
  sheet.appendRow([msgId]);
}

/**
 * 未処理メッセージ一覧を返す
 * @returns {GmailMessage[]}
 */
function getNewMessages() {
  const processed = getProcessedIdsSheet();
  const combinedQ = SEARCH_QUERIES.join(' OR ');
  const threads   = GmailApp.search(combinedQ);

  const freshMsgs = [];

  for (const th of threads) {
    for (const msg of th.getMessages()) {
      const id = msg.getId();
      if (!processed.has(id)) freshMsgs.push(msg);
    }
  }
  return freshMsgs;
}

