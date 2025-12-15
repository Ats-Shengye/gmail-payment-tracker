# Gmail Payment Tracker

Google Apps Script を使ってGmailの決済通知メールを自動的にスプレッドシートに記録するツール。

## 機能

- Gmail検索で決済通知メールを自動取得
- AI（Gemini / OpenAI）でメール本文から店舗名・日付・金額を抽出
- 月別シートに自動分類・記録
- 重複処理の回避（処理済みメッセージID管理）

## 技術スタック

- Google Apps Script
- Gemini API / OpenAI API（切り替え可能）
- Gmail API
- Google Sheets API

## ファイル構成

```
GAS-Payment/
├── main.gs                  # メイン処理
├── config.gs                # 定数定義（カスタマイズ推奨）
├── transactionExtractor.gs  # 共通抽出ロジック
├── openaiApi.gs             # OpenAI API連携
├── geminiApi.gs             # Gemini API連携
├── mailSearch.gs            # Gmail検索・処理済み管理
├── sheetOps.gs              # スプレッドシート操作
└── tests.gs                 # テストスイート
```

## セットアップ

### 1. Script Propertiesの設定

GASエディタで以下のスクリプトを実行して、Script Propertiesを設定してください。

```javascript
function setupProperties() {
  const props = PropertiesService.getScriptProperties();

  // 必須: スプレッドシートID（URLから取得）
  // https://docs.google.com/spreadsheets/d/【このID部分】/edit
  props.setProperty('SPREADSHEET_ID', 'あなたのスプレッドシートID');

  // 必須: 使用するAIプロバイダー（'openai' または 'gemini'）
  props.setProperty('AI_PROVIDER', 'gemini');

  // Geminiを使う場合
  props.setProperty('GEMINI_API_KEY', 'あなたのGemini APIキー');

  // OpenAIを使う場合
  // props.setProperty('OPENAI_API_KEY', 'あなたのOpenAI APIキー');

  Logger.log('Properties設定完了');
}
```

### 2. API Keyの取得

#### Gemini API Key
1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. 「Create API Key」をクリック
3. 生成されたKeyをコピーして `GEMINI_API_KEY` に設定

#### OpenAI API Key
1. [OpenAI Platform](https://platform.openai.com/api-keys) にアクセス
2. 「Create new secret key」をクリック
3. 生成されたKeyをコピーして `OPENAI_API_KEY` に設定

### 3. メール検索クエリのカスタマイズ

`config.gs` の `SEARCH_QUERIES` を編集して、検索対象のメールを設定してください。

```javascript
const SEARCH_QUERIES = [
  '(subject:"【決済サービス】ご利用のお知らせ" from:"notification@example-payment.jp")',
  '(subject:"デビットカードご利用のお知らせ" from:"info@example-card.jp")',
  // 必要に応じて追加
];
```

### 4. トリガーの設定

1. GASエディタ左メニューの「トリガー」（時計アイコン）をクリック
2. 「トリガーを追加」をクリック
3. 以下のように設定:
   - 実行する関数: `main`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `時間タイマー` → `1時間おき`（お好みで調整）
4. 「保存」をクリック

## テスト実行

### プロパティ設定の確認

```javascript
testPropertiesConfiguration()
```

### API接続テスト

```javascript
// Geminiの場合
testGeminiConnection()

// OpenAIの場合
testOpenAIConnection()
```

### 全テストの実行

```javascript
runAllTests()
```

## トラブルシューティング

### エラー: "SPREADSHEET_ID not set in Script Properties"
→ `setupProperties()` を実行してプロパティを設定してください。

### エラー: "API key not set"
→ 使用するプロバイダー（OpenAI/Gemini）のAPI Keyを設定してください。

### メールが処理されない
1. `config.gs` の `SEARCH_QUERIES` が正しいか確認
2. Gmailで手動検索して対象メールが存在するか確認
3. `getNewMessages()` を手動実行してログを確認

## セキュリティ上の注意

- API Keyをコードにハードコードしないでください
- Script Propertiesに保存されたKeyはGoogle側で暗号化されます
- スプレッドシートIDも機密情報として扱ってください

## 更新履歴

### v2.0
- SPREADSHEET_IDをPropertiesServiceへ移行
- Gemini API対応（OpenAIと切り替え可能）
- プロンプトインジェクション対策
- 出力検証強化（XSSパターン検出、フォーマット検証）
- テストコード追加

### v1.0
- 初回リリース（OpenAI API版）
