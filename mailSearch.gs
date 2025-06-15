/**************************************
 * mailSearch.gs
 * Gmail検索 & メッセージID管理（スプレッドシート保存版）
 **************************************/

/**
 * 環境変数から検索クエリを取得
 * @returns {string[]}
 */
function getSearchQueries() {
  const props = PropertiesService.getScriptProperties();
  const queriesText = props.getProperty('SEARCH_QUERIES');
  
  if (!queriesText) {
    throw new Error('SEARCH_QUERIES environment variable is not set. Please configure it in Script Properties.');
  }
  
  return queriesText.split('\n').filter(q => q.trim());
}

/**
 * 処理済みメッセージIDの Set を取得
 * @returns {Set<string>}
 */
function getProcessedIdsSheet() {
  const props = PropertiesService.getScriptProperties();
  const SPREADSHEET_ID = props.getProperty('SPREADSHEET_ID');
  
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID environment variable is not set. Please configure it in Script Properties.');
  }

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('ProcessedMsgs') || ss.insertSheet('ProcessedMsgs');

  const last  = sheet.getLastRow();
  if (last === 0) return new Set();

  const ids = sheet.getRange(1, 1, last).getValues().flat().filter(String);
  return new Set(ids);
}

/**
 * メッセージID をシートに追記
 * @param {string} msgId
 */
function markMessageAsProcessed(msgId) {
  const props = PropertiesService.getScriptProperties();
  const SPREADSHEET_ID = props.getProperty('SPREADSHEET_ID');
  
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID environment variable is not set. Please configure it in Script Properties.');
  }

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('ProcessedMsgs') || ss.insertSheet('ProcessedMsgs');
  sheet.appendRow([msgId]);
}

/**
 * 未処理メッセージ一覧を返す
 * @returns {GmailMessage[]}
 */
function getNewMessages() {
  const processed = getProcessedIdsSheet();
  const queries = getSearchQueries();
  const combinedQ = queries.join(' OR ');
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
