# RouteLab Campus 公開手順

## 無料ドメイン

GitHub Student Developer Packから無料ドメインを取得できます。

- Name.com: 対象TLDの1年無料ドメイン
- Namecheap: `.me` ドメイン1年無料
- `.TECH`: standard `.tech` ドメイン1年無料

おすすめは `Name.com` です。`.dev`, `.app`, `.page` などサイト名に合わせやすい候補があります。

## 公開先

このサイトはNode.js/Expressでログインと動画配信をしているため、GitHub Pagesでは動きません。無料で始めるならRenderのWeb Serviceが扱いやすいです。

1. GitHubにこのフォルダをプライベートリポジトリとしてpushします。
2. Renderで「New Web Service」を作成します。
3. GitHubリポジトリを選びます。
4. `render.yaml` があるので、基本設定は自動で入ります。
5. 環境変数 `ADMIN_EMAIL` と `ADMIN_PASSWORD` を設定します。
6. Deployします。

## ドメイン接続

Render側でCustom Domainを追加し、表示されたDNSレコードをドメイン管理画面に設定します。

- apex/root domainの場合: Renderが指定するA/ALIAS/ANAME系レコード
- `www` の場合: CNAME

DNS反映後、Render側でHTTPSが有効になります。

## 注意

Render無料枠はローカルファイルの永続保存ができません。管理画面からアップロードした動画は、再デプロイや再起動で消える可能性があります。

本運用で動画を増やす場合は、動画保存先をS3/Cloudinary等に変えるか、永続ディスク付きのホスティングに移すのがおすすめです。
