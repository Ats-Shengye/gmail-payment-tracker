/**************************************
 * openaiApi.gs
 * OpenAI API (Chat Completion) を使って
 * メール本文から情報を抽出する処理
 **************************************/

/**
 * OpenAI APIを使ってメール本文を解析（ラッパー関数）
 * @param {string} emailBody - メール本文
 * @returns {Object|null} - 例: { store: '○○', date: 'YYYY年MM月DD日 HH:MM:SS', amount: 'XXXX円' }
 */
function extractTransactionDataWithOpenAI(emailBody) {
  return extractTransactionData(emailBody, callOpenAIApi);
}

/**
 * OpenAI API (Chat Completion) に実際にリクエストし、
 * LLMが生成したテキストを返すサブ関数
 * @param {string} prompt - LLMに投げる指示
 * @returns {string|null} - 生成テキスト
 */
function callOpenAIApi(prompt) {
  // スクリプトプロパティからOpenAIのAPIキーを取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    Logger.log('ERROR: OpenAI API key not set in Script Properties (OPENAI_API_KEY)');
    return null;
  }

  // Chat Completionsエンドポイント
  const url = 'https://api.openai.com/v1/chat/completions';

  const data = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that extracts transaction details from emails.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: OPENAI_API_PARAMS.TEMPERATURE,
    max_tokens: OPENAI_API_PARAMS.MAX_TOKENS
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      const errorPreview = response.getContentText().substring(0, 100);
      Logger.log(`ERROR: OpenAI API returned code ${response.getResponseCode()} - ${errorPreview}...`);
      return null;
    }

    const json = JSON.parse(response.getContentText());
    if (!json.choices || json.choices.length === 0) {
      Logger.log('WARN: No choices in OpenAI response');
      return null;
    }

    // ChatGPTの応答は choices[0].message.content に入っている
    const content = json.choices[0].message.content.trim();
    return content;

  } catch (error) {
    Logger.log('ERROR: OpenAI API Error - ' + error);
    return null;
  }
}

