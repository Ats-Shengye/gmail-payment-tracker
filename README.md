# Gmail Payment Tracker

Google Apps Script を使ってGmailの決済通知を自動的にスプレッドシートに記録するツール

## 機能
- Gmail検索で決済通知メールを自動取得
- OpenAI APIでメール本文から店舗名・日付・金額を抽出
- 月別シートに自動分類・記録
- 重複処理の回避

## 必要な設定

### Script Properties
GASのスクリプトプロパティで以下を設定:

- `SPREADSHEET_ID`: 記録先スプレッドシートのID
- `OPENAI_API_KEY`: OpenAI APIキー
- `SEARCH_QUERIES`: Gmail検索クエリ（改行区切り）

### SEARCH_QUERIES設定例
>(subject:"ご利用のお知らせ" from:"info(@)example.jp")

>(subject:"決済完了" from:"payment(@)example.com")

## 使い方
1. GASで新プロジェクト作成
2. 4つのファイルをアップロード
3. Script Propertiesを設定
4. `main()` 関数を実行

## 運用実績
1年半継続稼働中
