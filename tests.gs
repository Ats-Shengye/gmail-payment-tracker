/**************************************
 * tests.gs
 * テストスイート
 * GASエディタのメニューから実行してログを確認
 **************************************/

/**
 * 全テストを実行
 */
function runAllTests() {
  Logger.log('=== Starting Test Suite ===');

  const tests = [
    testBuildExtractionPrompt,
    testParseAndValidateResponse_ValidData,
    testParseAndValidateResponse_MissingFields,
    testParseAndValidateResponse_InvalidDateFormat,
    testParseAndValidateResponse_InvalidJson,
    testExtractTransactionData_EmptyBody,
    testExtractTransactionData_WithMockApi,
    testGeminiApiConnection,
    testOpenAIApiConnection
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      Logger.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (err) {
      Logger.log(`❌ FAIL: ${test.name} - ${err}`);
      failed++;
    }
  }

  Logger.log(`\n=== Test Results ===`);
  Logger.log(`Passed: ${passed}/${tests.length}`);
  Logger.log(`Failed: ${failed}/${tests.length}`);

  if (failed === 0) {
    Logger.log('🎉 All tests passed!');
  }
}

// ===== transactionExtractor.gs のテスト =====

function testBuildExtractionPrompt() {
  const emailBody = 'テストメール本文';
  const prompt = buildExtractionPrompt(emailBody);

  if (!prompt.includes(emailBody)) {
    throw new Error('Prompt should contain email body');
  }
  if (!prompt.includes('YYYY年MM月DD日 HH:MM:SS')) {
    throw new Error('Prompt should specify date format');
  }
}

function testParseAndValidateResponse_ValidData() {
  const validResponse = `{
    "store": "セブンイレブン",
    "date": "2025年10月07日 14:30:00",
    "amount": "500円"
  }`;

  const result = parseAndValidateResponse(validResponse);

  if (!result) {
    throw new Error('Valid data should be parsed successfully');
  }
  if (result.store !== 'セブンイレブン') {
    throw new Error('Store name mismatch');
  }
  if (result.date !== '2025年10月07日 14:30:00') {
    throw new Error('Date mismatch');
  }
  if (result.amount !== '500円') {
    throw new Error('Amount mismatch');
  }
}

function testParseAndValidateResponse_MissingFields() {
  const invalidResponse = `{
    "store": "セブンイレブン",
    "date": "2025年10月07日 14:30:00"
  }`;

  const result = parseAndValidateResponse(invalidResponse);

  if (result !== null) {
    throw new Error('Missing fields should return null');
  }
}

function testParseAndValidateResponse_InvalidDateFormat() {
  const invalidResponse = `{
    "store": "セブンイレブン",
    "date": "2025-10-07 14:30:00",
    "amount": "500円"
  }`;

  const result = parseAndValidateResponse(invalidResponse);

  if (result !== null) {
    throw new Error('Invalid date format should return null');
  }
}

function testParseAndValidateResponse_InvalidJson() {
  const invalidResponse = 'This is not JSON';

  const result = parseAndValidateResponse(invalidResponse);

  if (result !== null) {
    throw new Error('Invalid JSON should return null');
  }
}

function testExtractTransactionData_EmptyBody() {
  const mockApi = function(prompt) {
    return '{"store": "test", "date": "2025年10月07日 00:00:00", "amount": "100円"}';
  };

  const result = extractTransactionData('', mockApi);

  if (result !== null) {
    throw new Error('Empty body should return null');
  }
}

function testExtractTransactionData_WithMockApi() {
  const mockApi = function(prompt) {
    return `{
      "store": "ローソン",
      "date": "2025年10月07日 10:15:30",
      "amount": "1200円"
    }`;
  };

  const emailBody = 'ローソンで1200円の支払いがありました。';
  const result = extractTransactionData(emailBody, mockApi);

  if (!result) {
    throw new Error('Valid extraction should return data');
  }
  if (result.store !== 'ローソン') {
    throw new Error('Store mismatch');
  }
  if (result.amount !== '1200円') {
    throw new Error('Amount mismatch');
  }
}

// ===== API接続テスト =====

function testGeminiApiConnection() {
  Logger.log('--- Testing Gemini API Connection ---');

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log('⚠️ SKIP: GEMINI_API_KEY not configured');
    return;
  }

  const testPrompt = 'Return this JSON exactly: {"test": "ok"}';
  const result = callGeminiApi(testPrompt);

  if (!result) {
    throw new Error('Gemini API connection failed');
  }

  Logger.log(`Gemini response: ${result.substring(0, 100)}...`);
}

function testOpenAIApiConnection() {
  Logger.log('--- Testing OpenAI API Connection ---');

  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    Logger.log('⚠️ SKIP: OPENAI_API_KEY not configured');
    return;
  }

  const testPrompt = 'Return this JSON exactly: {"test": "ok"}';
  const result = callOpenAIApi(testPrompt);

  if (!result) {
    throw new Error('OpenAI API connection failed');
  }

  Logger.log(`OpenAI response: ${result.substring(0, 100)}...`);
}

// ===== 統合テスト =====

/**
 * E2Eテスト（実際のメール取得・処理はしない）
 * 手動で特定のメールを処理するテスト用関数
 */
function testProcessSingleEmail() {
  Logger.log('=== Manual E2E Test ===');
  Logger.log('ℹ️ This test requires manual setup:');
  Logger.log('1. Update TEST_EMAIL_BODY below with real email content');
  Logger.log('2. Run this function');

  const TEST_EMAIL_BODY = `
【楽天カード】ご利用のお知らせ
利用店舗: Amazon.co.jp
利用日時: 2025年10月07日 15:30:00
利用金額: 3,500円
  `.trim();

  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured');
  }

  const provider = AI_PROVIDER || 'gemini';
  Logger.log(`Using ${provider} API`);

  const extractFunc = provider === 'openai'
    ? extractTransactionDataWithOpenAI
    : extractTransactionDataWithGemini;

  const result = extractFunc(TEST_EMAIL_BODY);

  if (!result) {
    throw new Error('Failed to extract transaction data');
  }

  Logger.log('✅ Extraction successful:');
  Logger.log(JSON.stringify(result, null, 2));

  // 実際にシートへ書き込むかはコメントアウトで制御
  // const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  // writeToSheet(spreadsheet, result);
  // Logger.log('✅ Written to sheet');
}

/**
 * プロパティ設定確認テスト
 */
function testPropertiesConfiguration() {
  Logger.log('=== Properties Configuration Test ===');

  const props = PropertiesService.getScriptProperties();
  const required = ['SPREADSHEET_ID', 'AI_PROVIDER'];
  const optional = ['GEMINI_API_KEY', 'OPENAI_API_KEY'];

  let allValid = true;

  for (const key of required) {
    const value = props.getProperty(key);
    if (!value) {
      Logger.log(`❌ MISSING: ${key}`);
      allValid = false;
    } else {
      Logger.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    }
  }

  for (const key of optional) {
    const value = props.getProperty(key);
    if (value) {
      Logger.log(`✅ ${key}: Configured (length ${value.length})`);
    } else {
      Logger.log(`⚠️ NOT SET: ${key}`);
    }
  }

  if (!allValid) {
    throw new Error('Required properties are missing');
  }

  Logger.log('✅ All required properties configured');
}
