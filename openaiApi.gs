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
    logError('OpenAI API key not set in Script Properties', {
      property: 'OPENAI_API_KEY'
    });
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
    logInfo('Calling OpenAI API');
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    // HTTPステータスコード別のエラーハンドリング
    if (responseCode !== 200) {
      const errorBody = response.getContentText();

      switch (responseCode) {
        case 400:
          logError('OpenAI API: Bad Request', {
            statusCode: responseCode,
            message: 'Invalid request format or parameters'
          });
          break;

        case 401:
          logError('OpenAI API: Unauthorized', {
            statusCode: responseCode,
            message: 'Invalid or missing API key'
          });
          break;

        case 403:
          logError('OpenAI API: Forbidden', {
            statusCode: responseCode,
            message: 'API key lacks necessary permissions'
          });
          break;

        case 429:
          logWarn('OpenAI API: Rate Limit Exceeded', {
            statusCode: responseCode,
            message: 'Too many requests, retry later'
          });
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          logError('OpenAI API: Server Error', {
            statusCode: responseCode,
            message: 'Service temporarily unavailable'
          });
          break;

        default:
          logError('OpenAI API: Unexpected Error', {
            statusCode: responseCode,
            errorPreview: errorBody.substring(0, 200)
          });
      }

      return null;
    }

    const json = JSON.parse(response.getContentText());

    if (!json.choices || json.choices.length === 0) {
      logWarn('No choices in OpenAI response', {
        hasError: !!json.error
      });
      return null;
    }

    // ChatGPTの応答は choices[0].message.content に入っている
    const content = json.choices[0].message.content.trim();
    logInfo('OpenAI response received', {
      contentLength: content.length
    });

    return content;

  } catch (error) {
    // ネットワークエラーやタイムアウト
    if (error.message && error.message.includes('timeout')) {
      logError('OpenAI API: Request Timeout', {
        error: error.toString()
      });
    } else if (error.message && error.message.includes('DNS')) {
      logError('OpenAI API: Network Error (DNS)', {
        error: error.toString()
      });
    } else {
      logError('OpenAI API: Unexpected Exception', {
        error: error.toString()
      });
    }
    return null;
  }
}

