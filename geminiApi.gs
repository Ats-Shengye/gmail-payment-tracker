/**************************************
 * geminiApi.gs
 * Gemini API を使って
 * メール本文から情報を抽出する処理
 **************************************/

/**
 * Gemini APIを使ってメール本文を解析（ラッパー関数）
 * @param {string} emailBody - メール本文
 * @returns {Object|null} - 例: { store: '○○', date: 'YYYY年MM月DD日 HH:MM:SS', amount: 'XXXX円' }
 */
function extractTransactionDataWithGemini(emailBody) {
  return extractTransactionData(emailBody, callGeminiApi);
}

/**
 * Gemini API に実際にリクエストし、
 * AIが生成したテキストを返すサブ関数
 * @param {string} prompt - AIに投げる指示
 * @returns {string|null} - 生成テキスト
 */
function callGeminiApi(prompt) {
  // スクリプトプロパティからGeminiのAPIキーを取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log('ERROR: Gemini API key not set in Script Properties (GEMINI_API_KEY)');
    return null;
  }

  // Gemini API エンドポイント (API KeyはHeaderに移動)
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  // Gemini API のリクエスト形式
  const data = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: GEMINI_API_PARAMS.TEMPERATURE,
      topK: GEMINI_API_PARAMS.TOP_K,
      topP: GEMINI_API_PARAMS.TOP_P,
      maxOutputTokens: GEMINI_API_PARAMS.MAX_OUTPUT_TOKENS
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  try {
    Logger.log('INFO: Calling Gemini API...');
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const errorPreview = response.getContentText().substring(0, 100);
      Logger.log(`ERROR: Gemini API returned code ${responseCode} - ${errorPreview}...`);
      return null;
    }

    const json = JSON.parse(response.getContentText());
    
    // Gemini APIのレスポンス形式チェック
    if (!json.candidates || json.candidates.length === 0) {
      Logger.log('WARN: No candidates in Gemini response');
      return null;
    }

    if (!json.candidates[0].content || !json.candidates[0].content.parts || json.candidates[0].content.parts.length === 0) {
      Logger.log('WARN: Invalid response structure from Gemini');
      return null;
    }

    // Geminiの応答は candidates[0].content.parts[0].text に入っている
    const content = json.candidates[0].content.parts[0].text.trim();
    Logger.log(`INFO: Gemini response received (${content.length} chars)`);
    
    return content;

  } catch (error) {
    Logger.log('ERROR: Gemini API Error - ' + error);
    return null;
  }
}

/**
 * Gemini API接続テスト用関数
 */
function testGeminiConnection() {
  Logger.log('=== Gemini API Connection Test ===');
  
  const testPrompt = 'Hello, Gemini! Please respond with a simple JSON: {"status": "ok", "message": "API working"}';
  const result = callGeminiApi(testPrompt);
  
  if (result) {
    Logger.log('✅ Gemini API connection successful');
    Logger.log(`Response: ${result}`);
  } else {
    Logger.log('❌ Gemini API connection failed');
  }
}
