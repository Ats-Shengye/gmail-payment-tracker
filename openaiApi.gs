/**************************************
 * openaiApi.gs
 * OpenAI API (Chat Completion) を使って
 * メール本文から情報を抽出する処理
 **************************************/

/**
 * メール本文を解析し、店名・日付・金額を抽出するメイン関数
 * @param {string} emailBody - メール本文
 * @returns {Object|null} - 例: { store: '○○', date: 'YYYY年MM月DD日 HH:MM:SS', amount: 'XXXX円' }
 */
function extractTransactionData(emailBody) {
  // 1. 空チェック
  if (!emailBody || !emailBody.trim()) {
    Logger.log("WARN: Email body is empty, null, or only whitespace.");
    return null;
  }

  // 2. プロンプト作成
  //    ★日時は必ず "YYYY年MM月DD日 HH:MM:SS" 形式で返すように指示
  const prompt = `
以下のメール本文から利用店舗(store)、利用日付(date)、利用金額(amount)を抽出し、
必ず下記のJSON形式のみで回答してください。
残高不足通知は除外します。
日付は "YYYY年MM月DD日 HH:MM:SS" の形式に揃えてください（秒が不明な場合は "00" で構いません）。
もし情報が抽出できない場合は、空のJSONオブジェクト {} を返してください。
日付の形式に乱れが確認できた場合ペナルティが発生します。

メール本文:
${emailBody}

出力例:
{ 
  "store": "店舗名",
  "date": "YYYY年MM月DD日 HH:MM:SS",
  "amount": "1200円"
}
  `;

  // 3. OpenAI APIに投げて結果(文字列)を取得
  const responseText = callOpenAIApi(prompt);
  if (!responseText) {
    return null;
  }

  // 4. JSONパース
  try {
    // 不要な```などを取り除きつつ
    const cleanedText = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // 5. 必須フィールドチェック
    if (!parsed.store || !parsed.date || !parsed.amount) {
      Logger.log("WARN: Missing fields in parsed data - " + JSON.stringify(parsed));
      return null;
    }

    return parsed;

  } catch (err) {
    Logger.log(`ERROR: Failed to parse JSON from OpenAI: ${err} - Response text: ${responseText}`);
    return null;
  }
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

  // ここで使うモデルを指定 (例: gpt-4o-mini, gpt-4o, gpt-3.5-turboなど)
  const data = {
    model: 'gpt-4o-mini', // 好みに応じて変更
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
    temperature: 0.2,
    max_tokens: 1000
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
      Logger.log(`ERROR: OpenAI API returned code ${response.getResponseCode()} - ${response.getContentText()}`);
      return null;
    }

    const json = JSON.parse(response.getContentText());
    if (!json.choices || json.choices.length === 0) {
      Logger.log('WARN: No choices in OpenAI response - ' + JSON.stringify(json));
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
