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
 * 指数バックオフでの待機時間を計算
 * @param {number} attempt - 試行回数（0始まり）
 * @returns {number} - 待機時間（ミリ秒）
 */
function calculateBackoffDelay(attempt) {
  // 指数バックオフ: baseDelay * 2^attempt + ジッター
  const exponentialDelay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // 0〜1000msのランダムジッター
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.MAX_DELAY_MS);
}

/**
 * Gemini API に実際にリクエストし、
 * AIが生成したテキストを返すサブ関数（指数バックオフリトライ対応）
 * @param {string} prompt - AIに投げる指示
 * @returns {string|null} - 生成テキスト
 */
function callGeminiApi(prompt) {
  // スクリプトプロパティからGeminiのAPIキーを取得
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    logError('Gemini API key not set in Script Properties', {
      property: 'GEMINI_API_KEY'
    });
    return null;
  }

  // Gemini API エンドポイント (API KeyはHeaderに移動)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

  // リトライループ
  for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logInfo(`Gemini API retry attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES}`);
      } else {
        logInfo('Calling Gemini API');
      }

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      // 成功
      if (responseCode === 200) {
        const json = JSON.parse(response.getContentText());

        // Gemini APIのレスポンス形式チェック
        if (!json.candidates || json.candidates.length === 0) {
          logWarn('No candidates in Gemini response', {
            hasError: !!json.error
          });
          return null;
        }

        if (!json.candidates[0].content || !json.candidates[0].content.parts || json.candidates[0].content.parts.length === 0) {
          logWarn('Invalid response structure from Gemini');
          return null;
        }

        // Geminiの応答は candidates[0].content.parts[0].text に入っている
        const content = json.candidates[0].content.parts[0].text.trim();
        logInfo('Gemini response received', {
          contentLength: content.length,
          attempt: attempt
        });

        return content;
      }

      // エラーハンドリング
      const errorBody = response.getContentText();

      // 429: リトライ可能
      if (responseCode === 429) {
        if (attempt < RETRY_CONFIG.MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          logWarn('Gemini API: Rate Limit Exceeded, retrying with backoff', {
            statusCode: responseCode,
            attempt: attempt + 1,
            maxRetries: RETRY_CONFIG.MAX_RETRIES,
            delayMs: Math.round(delay)
          });
          Utilities.sleep(delay);
          continue; // 次の試行へ
        } else {
          logError('Gemini API: Rate Limit Exceeded, max retries reached', {
            statusCode: responseCode,
            totalAttempts: attempt + 1
          });
          return null;
        }
      }

      // 5xx: サーバーエラーもリトライ
      if (responseCode >= 500 && responseCode < 600) {
        if (attempt < RETRY_CONFIG.MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          logWarn('Gemini API: Server Error, retrying with backoff', {
            statusCode: responseCode,
            attempt: attempt + 1,
            delayMs: Math.round(delay)
          });
          Utilities.sleep(delay);
          continue;
        } else {
          logError('Gemini API: Server Error, max retries reached', {
            statusCode: responseCode,
            totalAttempts: attempt + 1
          });
          return null;
        }
      }

      // その他のエラー（リトライ不可）
      switch (responseCode) {
        case 400:
          logError('Gemini API: Bad Request', {
            statusCode: responseCode,
            message: 'Invalid request format or parameters'
          });
          break;

        case 401:
          logError('Gemini API: Unauthorized', {
            statusCode: responseCode,
            message: 'Invalid or missing API key'
          });
          break;

        case 403:
          logError('Gemini API: Forbidden', {
            statusCode: responseCode,
            message: 'API key lacks necessary permissions'
          });
          break;

        default:
          logError('Gemini API: Unexpected Error', {
            statusCode: responseCode,
            errorPreview: errorBody.substring(0, 200)
          });
      }

      return null;

    } catch (error) {
      // ネットワークエラーやタイムアウト
      const isRetryable = error.message &&
        (error.message.includes('timeout') || error.message.includes('DNS') || error.message.includes('connect'));

      if (isRetryable && attempt < RETRY_CONFIG.MAX_RETRIES) {
        const delay = calculateBackoffDelay(attempt);
        logWarn('Gemini API: Network error, retrying with backoff', {
          error: error.toString(),
          attempt: attempt + 1,
          delayMs: Math.round(delay)
        });
        Utilities.sleep(delay);
        continue;
      }

      if (error.message && error.message.includes('timeout')) {
        logError('Gemini API: Request Timeout', {
          error: error.toString(),
          totalAttempts: attempt + 1
        });
      } else if (error.message && error.message.includes('DNS')) {
        logError('Gemini API: Network Error (DNS)', {
          error: error.toString(),
          totalAttempts: attempt + 1
        });
      } else {
        logError('Gemini API: Unexpected Exception', {
          error: error.toString(),
          totalAttempts: attempt + 1
        });
      }
      return null;
    }
  }

  return null;
}

/**
 * Gemini API接続テスト用関数
 */
function testGeminiConnection() {
  logInfo('=== Gemini API Connection Test ===');

  const testPrompt = 'Hello, Gemini! Please respond with a simple JSON: {"status": "ok", "message": "API working"}';
  const result = callGeminiApi(testPrompt);

  if (result) {
    logSuccess('Gemini API connection successful', {
      responsePreview: result.substring(0, 100)
    });
  } else {
    logError('Gemini API connection failed');
  }
}
