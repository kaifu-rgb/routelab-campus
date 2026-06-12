# 問い合わせフォーム連携メモ

現在のHPは、`contact-config.js` に送信先URLを入れると問い合わせフォームから直接送信できます。

## おすすめ: Google Apps Script + Googleスプレッドシート

1. Googleスプレッドシートを作成する
2. スプレッドシートIDを控える
3. Apps Scriptを開き、`google-apps-script-contact.gs` の内容を貼る
4. `SPREADSHEET_ID` と `NOTIFY_EMAIL` を自分の値に変更する
5. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
6. 実行ユーザーは自分、アクセス権は用途に合わせて設定
7. 発行されたウェブアプリURLを `contact-config.js` の `endpoint` に貼る
8. `mode` を `"no-cors"` にする

```js
window.CONTACT_FORM_CONFIG = {
  endpoint: "https://script.google.com/macros/s/xxxxx/exec",
  mode: "no-cors",
  fallbackEmail: "your-email@example.com",
};
```

## 他サービスを使う場合

FormspreeなどJSON POSTを受けられるサービスを使う場合は、`mode` を `"json"` のままにします。

```js
window.CONTACT_FORM_CONFIG = {
  endpoint: "https://example.com/your-form-endpoint",
  mode: "json",
  fallbackEmail: "your-email@example.com",
};
```
