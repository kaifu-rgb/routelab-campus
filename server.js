require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const CONTENT_UPLOAD_DIR = path.join(UPLOAD_DIR, "content");
const VIDEO_PDF_DIR = path.join(DATA_DIR, "video-pdfs");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const VIDEOS_FILE = path.join(DATA_DIR, "videos.json");
const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const SERVICE_NAME = "RouteLab Campus";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "video-materials";
const USE_SUPABASE_STORAGE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CONTENT_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(VIDEO_PDF_DIR, { recursive: true });

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

function users() {
  return normalizeList(readJson(USERS_FILE, []));
}

function videos() {
  return normalizeList(readJson(VIDEOS_FILE, []));
}

function defaultContent() {
  return {
    books: {
      heroTitle: "参考書は、増やすより使い切る。",
      heroLead:
        "今の学力、志望校、残り期間に合わせて、必要な参考書だけを選びます。教材を買って終わりにせず、解き直しと確認テストまで含めて運用します。",
      introTitle: "おすすめ参考書は、生徒の現在地で変わります。",
      introText:
        "英語・数学・国語・理科・社会を、基礎固め、演習量、入試形式、添削が必要な領域に分けて扱います。",
      items: [
        {
          id: "book-english",
          title: "英語",
          subtitle: "単語・文法・長文を分けて管理",
          description:
            "単語帳、文法問題集、長文演習を同時に進めます。長文だけ増やしても読めない場合は、文法と語彙に戻します。",
          image: "/assets/study-colorful-student.png",
        },
        {
          id: "book-math",
          title: "数学",
          subtitle: "例題理解から入試演習へ",
          description:
            "計算、関数、図形を単元別に管理。解説を読んで分かった問題を、翌週に自力で解けるか確認します。",
          image: "/assets/route-planning-board.png",
        },
        {
          id: "book-japanese",
          title: "国語",
          subtitle: "読解・記述・作文を別ルートにする",
          description:
            "本文根拠、選択肢の消し方、記述の要素、作文構成を分けて練習します。感覚ではなく再現できる解き方に変えます。",
          image: "/assets/hero-kokugo.png",
        },
      ],
    },
    routes: {
      heroTitle: "やる教材を決める。順番を決める。毎週、進める。",
      heroLead:
        "志望校、内申、模試、部活の忙しさまで見て、週ごとの学習量に落とし込みます。参考書を買って終わりにせず、確認テストと復習指示までセットで管理します。",
      introTitle: "参考書ルートは、教材リストではなく合格までの運用表です。",
      introText:
        "同じ教材でも、始める時期、解き直し回数、確認テストの入れ方で結果は変わります。",
      items: [
        {
          id: "route-01",
          title: "01 現在地を測る",
          subtitle: "内申・模試・教材を確認",
          description:
            "学校成績、模試、志望校、今使っている教材を確認し、最初に伸ばす科目と単元を決めます。",
          image: "/assets/exam-study-photo.png",
        },
        {
          id: "route-02",
          title: "02 基礎を固める",
          subtitle: "戻る単元を明確にする",
          description:
            "英数の土台、国語の語彙と読解、理社の一問一答を短期間で回し、入試演習の前提を作ります。",
          image: "/assets/study-colorful-student.png",
        },
        {
          id: "route-03",
          title: "03 入試型へ移る",
          subtitle: "演習と解き直しを設計",
          description:
            "単元別演習から総合問題へ。間違えた問題は解説を読むだけで終わらせず、次に解ける状態まで戻します。",
          image: "/assets/statement-photo.png",
        },
      ],
    },
  };
}

function contentData() {
  const fallback = defaultContent();
  const saved = readJson(CONTENT_FILE, fallback);
  return {
    books: {
      ...fallback.books,
      ...(saved.books || {}),
      items: normalizeList(saved.books && saved.books.items).length
        ? normalizeList(saved.books.items)
        : fallback.books.items,
    },
    routes: {
      ...fallback.routes,
      ...(saved.routes || {}),
      items: normalizeList(saved.routes && saved.routes.items).length
        ? normalizeList(saved.routes.items)
        : fallback.routes.items,
    },
  };
}

function saveUsers(nextUsers) {
  writeJson(USERS_FILE, normalizeList(nextUsers));
}

function saveVideos(nextVideos) {
  writeJson(VIDEOS_FILE, normalizeList(nextVideos));
}

function saveContent(nextContent) {
  writeJson(CONTENT_FILE, nextContent);
}

function seedAdmin() {
  const existing = users();
  if (existing.some((user) => user.role === "admin")) return;

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const generatedPassword = crypto.randomBytes(12).toString("base64url");
  const password = process.env.ADMIN_PASSWORD || generatedPassword;

  existing.push({
    id: crypto.randomUUID(),
    name: "管理者",
    email: email.toLowerCase(),
    passwordHash: createPasswordHash(password),
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  });
  saveUsers(existing);

  if (!process.env.ADMIN_PASSWORD) {
    fs.writeFileSync(
      path.join(DATA_DIR, "initial-admin-login.txt"),
      `Login URL: http://localhost:${PORT}/login\nEmail: ${email}\nPassword: ${password}\n`,
      "utf8",
    );
  }
}

function extractYouTubeId(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }

  return "";
}

function youtubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function supabaseObjectUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${String(objectPath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function uploadVideoPdf(file) {
  if (!file) return null;
  if (!USE_SUPABASE_STORAGE) {
    return { storage: "local", fileName: file.filename, objectPath: file.filename };
  }

  const objectPath = `pdfs/${file.filename}`;
  const response = await fetch(supabaseObjectUrl(objectPath), {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/pdf",
      "x-upsert": "false",
    }),
    body: fs.readFileSync(file.path),
  });

  fs.rmSync(file.path, { force: true });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PDFの保存に失敗しました。Supabaseの設定を確認してください。${body ? ` (${body.slice(0, 160)})` : ""}`);
  }

  return { storage: "supabase", fileName: file.filename, objectPath };
}

async function deleteVideoPdf(video) {
  if (!video || !video.pdfFileName) return;

  if (video.pdfStorage === "supabase") {
    if (!USE_SUPABASE_STORAGE) return;

    const objectPath = video.pdfObjectPath || `pdfs/${video.pdfFileName}`;
    await fetch(supabaseObjectUrl(objectPath), {
      method: "DELETE",
      headers: supabaseHeaders(),
    }).catch(() => {});
    return;
  }

  fs.rmSync(path.join(VIDEO_PDF_DIR, path.basename(video.pdfFileName)), { force: true });
}

function downloadFileName(name) {
  return String(name || "material.pdf").replace(/[\\/\r\n"]/g, "_");
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, file.fieldname === "pdf" ? VIDEO_PDF_DIR : CONTENT_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const fallback = file.fieldname === "pdf" ? ".pdf" : ".jpg";
      const extension = path.extname(file.originalname || "").toLowerCase() || fallback;
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`);
    },
  }),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "");
    if (file.fieldname === "pdf") {
      if (mime !== "application/pdf" && path.extname(file.originalname || "").toLowerCase() !== ".pdf") {
        cb(new Error("PDFファイルを選んでください。"));
        return;
      }
      cb(null, true);
      return;
    }

    if (!String(file.mimetype || "").startsWith("image/")) {
      cb(new Error("画像ファイルを選んでください。"));
      return;
    }
    cb(null, true);
  },
});

seedAdmin();

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "routelab_campus_session",
    secret: process.env.SESSION_SECRET || "dev-only-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }),
);

app.use("/member.css", express.static(path.join(ROOT, "member.css")));
app.use("/assets", express.static(path.join(ROOT, "assets")));
app.use("/uploads", express.static(UPLOAD_DIR));

function currentUser(req) {
  if (!req.session.userId) return null;
  return users().find((user) => user.id === req.session.userId && user.active);
}

function requireLogin(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireLogin(req, res, () => {
    if (req.user.role !== "admin") {
      res.status(403).send(page("権限がありません", `<p class="alert">管理者だけがアクセスできます。</p>`, req));
      return;
    }
    next();
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTextBlock(value) {
  const escaped = escapeHtml(value).trim();
  return escaped ? escaped.replace(/\r?\n/g, "<br />") : "";
}

function courseName(value) {
  return String(value || "").trim();
}

function allowedCourses(user) {
  return normalizeList(user && user.allowedCourses).map(courseName).filter(Boolean);
}

function canAccessVideo(user, video) {
  if (!user || !video) return false;
  if (user.role === "admin") return true;
  const course = courseName(video.course);
  return Boolean(video.published && course && allowedCourses(user).includes(course));
}

function page(title, content, req = null, bodyClass = "") {
  const user = req ? currentUser(req) : null;
  const adminLink = user && user.role === "admin" ? `<a href="/admin">管理</a>` : "";
  const userNav = user
    ? `${adminLink}<a href="/library">動画</a><form action="/logout" method="post"><button type="submit">ログアウト</button></form>`
    : `<a href="/login">ログイン</a>`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | ${SERVICE_NAME}</title>
    <link rel="stylesheet" href="/member.css?v=20260613-content-admin" />
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <div class="member-shell">
      <header class="member-header">
        <a class="member-brand" href="/">
          <img src="/assets/routelab-campus-logo.svg" alt="${SERVICE_NAME}" />
        </a>
        <nav class="member-nav" aria-label="会員メニュー">
          <a href="/">ホーム</a>
          ${userNav}
        </nav>
      </header>
      <main class="member-main">${content}</main>
    </div>
  </body>
</html>`;
}

function publicSitePage(title, description, content) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)} | RouteLab Campus</title>
    <link rel="stylesheet" href="styles.css?v=20260613-content-admin" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="index.html" aria-label="RouteLab Campus トップへ">
        <img class="brand-logo" src="assets/routelab-campus-logo.svg" alt="RouteLab Campus" />
      </a>
      <nav class="nav" aria-label="主要メニュー">
        <a href="routes.html">参考書ルート</a>
        <a href="books.html">参考書紹介</a>
        <a href="index.html#programs">講座紹介</a>
        <a href="teacher.html">塾長メッセージ</a>
        <a href="index.html#results">合格実績</a>
        <a href="/login">会員ログイン</a>
        <a href="index.html#contact">無料相談</a>
      </nav>
      <a class="header-cta" href="/login">動画ルームへ</a>
    </header>
    <main>${content}</main>
    <footer class="site-footer">
      <p>RouteLab Campus</p>
      <p>授業動画・参考書ルート・進捗管理を組み合わせる高校受験キャンパス</p>
    </footer>
  </body>
</html>`;
}

function flash(req) {
  const message = req.session.flash;
  delete req.session.flash;
  return message ? `<p class="alert success">${escapeHtml(message)}</p>` : "";
}

function renderContentCards(items, type) {
  return normalizeList(items)
    .map(
      (item) => `<article class="managed-content-card ${escapeHtml(type)}">
        <img src="${escapeHtml(item.image || "/assets/study-colorful-student.png")}" alt="${escapeHtml(item.title)}" />
        <div>
          <span>${escapeHtml(item.title)}</span>
          <h3>${escapeHtml(item.subtitle)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </div>
      </article>`,
    )
    .join("");
}

function contentPage(type) {
  const data = contentData()[type];
  const isBooks = type === "books";
  const title = isBooks ? "参考書紹介" : "参考書ルート";
  const description = isBooks
    ? "RouteLab Campusの参考書紹介。高校受験に必要な教材を、写真付きで分かりやすく紹介します。"
    : "RouteLab Campusの参考書ルート。志望校から逆算した学習ルートを、写真付きで分かりやすく紹介します。";

  return publicSitePage(
    title,
    description,
    `<section class="page-hero ${isBooks ? "books-hero" : "route-hero"}">
      <p class="eyebrow">${isBooks ? "Book Guide" : "Study Route"}</p>
      <h1>${escapeHtml(data.heroTitle)}</h1>
      <p class="lead">${escapeHtml(data.heroLead)}</p>
    </section>

    <section class="section managed-content-section">
      <div class="section-heading centered">
        <p class="eyebrow">${isBooks ? "教材設計" : "ルート設計"}</p>
        <h2>${escapeHtml(data.introTitle)}</h2>
        <p>${escapeHtml(data.introText)}</p>
      </div>
      <div class="managed-content-grid">${renderContentCards(data.items, type)}</div>
    </section>

    <section class="section material-note">
      <div>
        <p class="eyebrow">無料学習診断</p>
        <h2>今の教材と志望校から、次の4週間でやることを整理します。</h2>
        <p>参考書を増やす前に、今ある教材をどの順番で使い切るかを一緒に決めます。</p>
      </div>
      <a class="button primary" href="index.html#contact">相談する</a>
    </section>`,
  );
}

function pageEditor(type, data) {
  const label = type === "books" ? "参考書紹介" : "参考書ルート";
  const itemRows = normalizeList(data.items)
    .map(
      (item, index) => `<article class="content-editor-card">
        <div class="content-preview">
          <img src="${escapeHtml(item.image || "/assets/study-colorful-student.png")}" alt="" />
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.subtitle)}</span>
          </div>
        </div>
        <form class="form-grid" action="/admin/content/item" method="post" enctype="multipart/form-data">
          <input type="hidden" name="type" value="${escapeHtml(type)}" />
          <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
          <input type="hidden" name="currentImage" value="${escapeHtml(item.image)}" />
          <label>表示順<input type="number" name="order" value="${index + 1}" min="1" /></label>
          <label>ラベル・科目<input name="title" value="${escapeHtml(item.title)}" required /></label>
          <label>見出し<input name="subtitle" value="${escapeHtml(item.subtitle)}" required /></label>
          <label>説明<textarea name="description" required>${escapeHtml(item.description)}</textarea></label>
          <label>写真<input type="file" name="image" accept="image/*" /></label>
          <div class="editor-actions">
            <button class="button primary" type="submit">更新</button>
            <button class="button danger" type="submit" name="delete" value="true">削除</button>
          </div>
        </form>
      </article>`,
    )
    .join("");

  return `<section class="panel content-editor-panel">
    <div class="section-title">
      <div>
        <p class="eyebrow">${escapeHtml(label)}</p>
        <h2>${escapeHtml(label)}を編集</h2>
      </div>
      <a class="button" href="/${type === "books" ? "books" : "routes"}.html" target="_blank">公開ページを見る</a>
    </div>

    <form class="form-grid page-copy-form" action="/admin/content/page" method="post">
      <input type="hidden" name="type" value="${escapeHtml(type)}" />
      <label>ページ冒頭の大見出し<input name="heroTitle" value="${escapeHtml(data.heroTitle)}" required /></label>
      <label>ページ冒頭の説明<textarea name="heroLead" required>${escapeHtml(data.heroLead)}</textarea></label>
      <label>カード一覧の見出し<input name="introTitle" value="${escapeHtml(data.introTitle)}" required /></label>
      <label>カード一覧の説明<textarea name="introText" required>${escapeHtml(data.introText)}</textarea></label>
      <button class="button primary" type="submit">ページ文章を更新</button>
    </form>

    <div class="content-editor-grid">${itemRows}</div>

    <article class="content-editor-card add-card">
      <h3>新しいカードを追加</h3>
      <form class="form-grid" action="/admin/content/item" method="post" enctype="multipart/form-data">
        <input type="hidden" name="type" value="${escapeHtml(type)}" />
        <label>ラベル・科目<input name="title" required placeholder="例：英語 / 01 現在地を測る" /></label>
        <label>見出し<input name="subtitle" required placeholder="例：単語・文法・長文を分けて管理" /></label>
        <label>説明<textarea name="description" required placeholder="ページに表示する説明文"></textarea></label>
        <label>写真<input type="file" name="image" accept="image/*" /></label>
        <button class="button primary" type="submit">カードを追加</button>
      </form>
    </article>
  </section>`;
}

app.get(["/books", "/books.html"], (req, res) => {
  res.send(contentPage("books"));
});

app.get(["/routes", "/routes.html"], (req, res) => {
  res.send(contentPage("routes"));
});

app.get("/login", (req, res) => {
  const next = req.query.next || "/library";
  const message = req.query.error ? `<p class="alert">メールアドレスかパスワードが違います。</p>` : "";
  res.send(
    page(
      "ログイン",
      `<section class="auth-card">
        <p class="eyebrow">Members</p>
        <h1>動画ルームにログイン</h1>
        <p class="lead">会員専用の授業動画と学習ルートを確認できます。</p>
        ${message}
        <form class="form-grid" action="/login" method="post">
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <label>メールアドレス<input type="email" name="email" autocomplete="email" required /></label>
          <label>パスワード<input type="password" name="password" autocomplete="current-password" required /></label>
          <button class="button primary" type="submit">ログイン</button>
        </form>
      </section>`,
      req,
      "auth-page",
    ),
  );
});

app.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = users().find((candidate) => candidate.email === email && candidate.active);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.redirect("/login?error=1");
    return;
  }
  req.session.userId = user.id;
  res.redirect(req.body.next || "/library");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/library", requireLogin, (req, res) => {
  const visibleVideos = videos().filter((video) => video.youtubeId && canAccessVideo(req.user, video));
  const cards = visibleVideos.length
    ? visibleVideos
        .map(
          (video) => `<article class="video-card">
            <div class="youtube-frame">
              <iframe
                src="${youtubeEmbedUrl(video.youtubeId)}"
                title="${escapeHtml(video.title)}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                loading="lazy"></iframe>
            </div>
            <div class="video-copy">
              <p class="meta">${escapeHtml(video.course || "動画講座")}</p>
              <h3>${escapeHtml(video.title)}</h3>
              <p class="muted">${escapeHtml(video.description)}</p>
              ${
                formatTextBlock(video.lessonText || "") || (video.pdfFileName && video.pdfOriginalName)
                  ? `<div class="video-material">
                    <div>
                      <h4>この動画のテキスト</h4>
                      ${
                        formatTextBlock(video.lessonText || "")
                          ? `<p>${formatTextBlock(video.lessonText || "")}</p>`
                          : `<p class="muted">テキストは準備中です。</p>`
                      }
                    </div>
                    ${
                      video.pdfFileName && video.pdfOriginalName
                        ? `<a class="button material-button" href="/library/materials/${encodeURIComponent(video.pdfFileName)}">PDFをダウンロード</a>`
                        : ""
                    }
                  </div>`
                  : ""
              }
            </div>
          </article>`,
        )
        .join("")
    : `<p class="alert">公開中の動画は準備中です。</p>`;

  res.send(
    page(
      "会員動画",
      `<section class="library-hero">
        <div>
          <p class="eyebrow">Video Library</p>
          <h1>今日の学習に、すぐ入れる。</h1>
          <p class="lead">授業、復習、確認テストの解説を会員専用でまとめています。</p>
        </div>
        <div class="library-stat">
          <span>${visibleVideos.length}</span>
          <p>公開中の動画</p>
        </div>
      </section>
      <section class="video-section">
        <div class="section-title">
          <h2>動画ライブラリ</h2>
          <p>${escapeHtml(req.user.name)} さん</p>
        </div>
        <div class="video-grid">${cards}</div>
      </section>`,
      req,
      "library-page",
    ),
  );
});

app.get("/library/materials/:file", requireLogin, async (req, res, next) => {
  const fileName = path.basename(String(req.params.file || ""));
  const matchedVideo = videos().find((video) => video.pdfFileName === fileName);
  if (!fileName || !matchedVideo || !canAccessVideo(req.user, matchedVideo)) {
    res.status(404).send(page("PDFが見つかりません", `<p class="alert">教材PDFが見つかりません。</p>`, req));
    return;
  }

  if (matchedVideo.pdfStorage === "supabase") {
    try {
      const response = await fetch(supabaseObjectUrl(matchedVideo.pdfObjectPath || `pdfs/${fileName}`), {
        headers: supabaseHeaders(),
      });

      if (!response.ok) {
        res.status(404).send(page("PDF縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ", `<p class="alert">謨呎攝PDF縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲・/p>`, req));
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", response.headers.get("content-type") || "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${downloadFileName(matchedVideo.pdfOriginalName)}"`);
      res.send(buffer);
      return;
    } catch (error) {
      next(error);
      return;
    }
  }

  const filePath = path.join(VIDEO_PDF_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send(page("PDFが見つかりません", `<p class="alert">教材PDFが見つかりません。</p>`, req));
    return;
  }

  res.download(filePath, downloadFileName(matchedVideo.pdfOriginalName || `${matchedVideo.title || "material"}.pdf`));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.send(
    page(
      "管理メニュー",
      `<section class="stack">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>管理メニュー</h1>
          <p class="lead">作業ごとに管理画面を分けました。</p>
        </div>
        ${flash(req)}
        <div class="admin-menu-grid">
          <a class="admin-menu-card" href="/admin/videos">
            <span>Video</span>
            <strong>動画・会員管理</strong>
            <p>動画追加、PDF教材、会員追加、閲覧講座の設定を行います。</p>
          </a>
          <a class="admin-menu-card" href="/admin/content">
            <span>Pages</span>
            <strong>参考書・ルート編集</strong>
            <p>参考書紹介ページと参考書ルートページの文章・写真を編集します。</p>
          </a>
        </div>
      </section>`,
      req,
    ),
  );
});

app.get("/admin/videos", requireAdmin, (req, res) => {
  const allUsers = users();
  const allVideos = videos();
  const courseList = Array.from(new Set(allVideos.map((video) => courseName(video.course)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
  const userRows = allUsers
    .map(
      (user) => `<tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${user.active ? "有効" : "停止"}</td>
        <td>${allowedCourses(user).map(escapeHtml).join("<br />") || "-"}</td>
      </tr>`,
    )
    .join("");
  const accessRows = allUsers
    .filter((user) => user.role !== "admin")
    .map((user) => {
      const currentCourses = allowedCourses(user);
      const checkboxes = courseList.length
        ? courseList
            .map(
              (course) => `<label class="course-check">
                <input type="checkbox" name="courses" value="${escapeHtml(course)}" ${currentCourses.includes(course) ? "checked" : ""} />
                <span>${escapeHtml(course)}</span>
              </label>`,
            )
            .join("")
        : `<p class="muted">先に動画を追加すると、ここに講座名が表示されます。</p>`;

      return `<article class="access-card">
        <div>
          <h3>${escapeHtml(user.name)}</h3>
          <p class="muted">${escapeHtml(user.email)}</p>
        </div>
        <form class="form-grid" action="/admin/users/courses" method="post">
          <input type="hidden" name="userId" value="${escapeHtml(user.id)}" />
          <div class="course-checks">${checkboxes}</div>
          <button class="button primary compact-button" type="submit">閲覧講座を保存</button>
        </form>
      </article>`;
    })
    .join("");
  const videoRows = allVideos
    .map(
      (video) => `<tr>
        <td>${escapeHtml(video.title)}</td>
        <td>${escapeHtml(video.course)}</td>
        <td>${video.published ? "公開" : "非公開"}</td>
        <td>${escapeHtml(new Date(video.createdAt).toLocaleString("ja-JP"))}</td>
        <td>
          <form class="inline-delete-form" action="/admin/videos/delete" method="post">
            <input type="hidden" name="id" value="${escapeHtml(video.id)}" />
            <button class="button danger compact-button" type="submit">削除</button>
          </form>
        </td>
      </tr>`,
    )
    .join("");

  res.send(
    page(
      "管理画面",
      `<section class="stack">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>管理画面</h1>
          <p class="lead">会員、動画、参考書ページを管理できます。</p>
        </div>
        ${flash(req)}
        <div class="admin-shortcuts">
          <a class="button primary" href="/admin/content">参考書ページを編集</a>
          <a class="button" href="/books.html" target="_blank">参考書紹介を見る</a>
          <a class="button" href="/routes.html" target="_blank">参考書ルートを見る</a>
        </div>
        <div class="grid">
          <article class="panel">
            <h2>動画を追加</h2>
            <form class="form-grid" action="/admin/videos" method="post" enctype="multipart/form-data">
              <label>タイトル<input name="title" required placeholder="例：数学 関数の基礎" /></label>
              <label>コース・分類<input name="course" placeholder="例：中3数学 / 復習動画" /></label>
              <label>YouTube URL<input type="url" name="youtubeUrl" required placeholder="https://youtu.be/..." /></label>
              <label>動画横に表示するテキスト<textarea name="lessonText" placeholder="例: 重要語句、板書メモ、解き方の手順など"></textarea></label>
              <label>教材PDF<input type="file" name="pdf" accept="application/pdf" /></label>
              <label>説明<textarea name="description" placeholder="動画の内容を短く入力"></textarea></label>
              <label>公開状態<select name="published"><option value="true">公開する</option><option value="false">非公開で保存</option></select></label>
              <button class="button primary" type="submit">追加する</button>
            </form>
          </article>
          <article class="panel">
            <h2>会員を追加</h2>
            <form class="form-grid" action="/admin/users" method="post">
              <label>名前<input name="name" required placeholder="例：山田 太郎" /></label>
              <label>メールアドレス<input type="email" name="email" required /></label>
              <label>初期パスワード<input type="text" name="password" required minlength="8" /></label>
              <button class="button primary" type="submit">会員を作成</button>
            </form>
          </article>
        </div>
        <article class="panel access-panel">
          <h2>会員ごとの閲覧講座</h2>
          <p class="muted">チェックした講座だけ、その会員の動画ルームに表示されます。</p>
          <div class="access-list">${accessRows || `<p class="alert">会員を追加すると、ここで閲覧講座を設定できます。</p>`}</div>
        </article>
        <article class="panel table-wrap">
          <h2>動画一覧</h2>
          <table><thead><tr><th>タイトル</th><th>分類</th><th>状態</th><th>登録日時</th><th>操作</th></tr></thead><tbody>${videoRows}</tbody></table>
        </article>
        <article class="panel table-wrap">
          <h2>会員一覧</h2>
          <table><thead><tr><th>名前</th><th>メール</th><th>権限</th><th>状態</th><th>閲覧講座</th></tr></thead><tbody>${userRows}</tbody></table>
        </article>
      </section>`,
      req,
    ),
  );
});

app.get("/admin/content", requireAdmin, (req, res) => {
  const content = contentData();
  res.send(
    page(
      "参考書ページ管理",
      `<section class="stack">
        <div>
          <p class="eyebrow">Page Builder</p>
          <h1>参考書ページ管理</h1>
          <p class="lead">写真と文章を入れるだけで、参考書紹介・参考書ルートの公開ページに反映されます。</p>
        </div>
        ${flash(req)}
        <div class="admin-shortcuts">
          <a class="button" href="/admin">管理トップ</a>
          <a class="button" href="/books.html" target="_blank">参考書紹介を見る</a>
          <a class="button" href="/routes.html" target="_blank">参考書ルートを見る</a>
        </div>
        ${pageEditor("books", content.books)}
        ${pageEditor("routes", content.routes)}
      </section>`,
      req,
      "content-admin-page",
    ),
  );
});

app.post("/admin/videos", requireAdmin, upload.single("pdf"), async (req, res, next) => {
  const youtubeUrl = String(req.body.youtubeUrl || "").trim();
  const youtubeId = extractYouTubeId(youtubeUrl);

  if (!youtubeId) {
    if (req.file) {
      fs.rmSync(req.file.path, { force: true });
    }
    req.session.flash = "YouTubeのURLを確認してください。";
    res.redirect("/admin/videos");
    return;
  }

  try {
    const pdf = await uploadVideoPdf(req.file);
    const nextVideos = videos().filter((video) => video.id !== "seed-229850");
  nextVideos.unshift({
    id: crypto.randomUUID(),
    title: String(req.body.title || "").trim(),
    course: String(req.body.course || "").trim(),
    description: String(req.body.description || "").trim(),
    lessonText: String(req.body.lessonText || "").trim(),
    pdfStorage: pdf ? pdf.storage : "",
    pdfFileName: pdf ? pdf.fileName : "",
    pdfObjectPath: pdf ? pdf.objectPath : "",
    pdfOriginalName: req.file ? req.file.originalname : "",
    youtubeUrl,
    youtubeId,
    published: req.body.published === "true",
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  });
    saveVideos(nextVideos);
  } catch (error) {
    if (req.file) {
      fs.rmSync(req.file.path, { force: true });
    }
    next(error);
    return;
  }
  req.session.flash = "動画を追加しました。";
  res.redirect("/admin/videos");
});

app.post("/admin/videos/delete", requireAdmin, async (req, res, next) => {
  const id = String(req.body.id || "").trim();
  const allVideos = videos();
  const target = allVideos.find((video) => video.id === id);

  if (!target) {
    req.session.flash = "削除する動画が見つかりませんでした。";
    res.redirect("/admin/videos");
    return;
  }

  try {
    await deleteVideoPdf(target);
    saveVideos(allVideos.filter((video) => video.id !== id));
    req.session.flash = "動画を削除しました。";
    res.redirect("/admin/videos");
  } catch (error) {
    next(error);
  }
});

app.post("/admin/users/courses", requireAdmin, (req, res) => {
  const userId = String(req.body.userId || "").trim();
  const postedCourses = Array.isArray(req.body.courses) ? req.body.courses : req.body.courses ? [req.body.courses] : [];
  const selectedCourses = postedCourses.map(courseName).filter(Boolean);
  const nextUsers = users();
  const user = nextUsers.find((candidate) => candidate.id === userId && candidate.role !== "admin");

  if (!user) {
    req.session.flash = "講座を設定する会員が見つかりませんでした。";
    res.redirect("/admin/videos");
    return;
  }

  user.allowedCourses = Array.from(new Set(selectedCourses));
  saveUsers(nextUsers);
  req.session.flash = "閲覧できる講座を保存しました。";
  res.redirect("/admin/videos");
});

app.post("/admin/users", requireAdmin, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");
  const nextUsers = users();

  if (nextUsers.some((user) => user.email === email)) {
    req.session.flash = "同じメールアドレスの会員がすでに存在します。";
    res.redirect("/admin/videos");
    return;
  }

  nextUsers.push({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: createPasswordHash(password),
    role: "member",
    active: true,
    allowedCourses: [],
    createdAt: new Date().toISOString(),
  });
  saveUsers(nextUsers);
  req.session.flash = "会員を作成しました。";
  res.redirect("/admin/videos");
});

app.post("/admin/content/page", requireAdmin, (req, res) => {
  const type = req.body.type === "routes" ? "routes" : "books";
  const content = contentData();
  content[type] = {
    ...content[type],
    heroTitle: String(req.body.heroTitle || "").trim(),
    heroLead: String(req.body.heroLead || "").trim(),
    introTitle: String(req.body.introTitle || "").trim(),
    introText: String(req.body.introText || "").trim(),
  };
  saveContent(content);
  req.session.flash = "ページ文章を更新しました。";
  res.redirect("/admin/content");
});

app.post("/admin/content/item", requireAdmin, upload.single("image"), (req, res) => {
  const type = req.body.type === "routes" ? "routes" : "books";
  const content = contentData();
  const items = normalizeList(content[type].items);
  const id = String(req.body.id || "").trim() || crypto.randomUUID();
  const uploadedImage = req.file ? `/uploads/content/${req.file.filename}` : "";

  if (req.body.delete === "true") {
    content[type].items = items.filter((item) => item.id !== id);
    saveContent(content);
    req.session.flash = "カードを削除しました。";
    res.redirect("/admin/content");
    return;
  }

  const nextItem = {
    id,
    title: String(req.body.title || "").trim(),
    subtitle: String(req.body.subtitle || "").trim(),
    description: String(req.body.description || "").trim(),
    image: uploadedImage || String(req.body.currentImage || "").trim() || "/assets/study-colorful-student.png",
  };

  const existingIndex = items.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
  } else {
    items.push(nextItem);
  }

  const requestedOrder = Number(req.body.order || 0);
  if (requestedOrder > 0) {
    const currentIndex = items.findIndex((item) => item.id === id);
    const [moved] = items.splice(currentIndex, 1);
    items.splice(Math.min(requestedOrder - 1, items.length), 0, moved);
  }

  content[type].items = items;
  saveContent(content);
  req.session.flash = "カードを保存しました。";
  res.redirect("/admin/content");
});

app.use((error, req, res, next) => {
  if (req.path.startsWith("/admin/videos")) {
    req.session.flash = error.message || "PDFのアップロードに失敗しました。";
    res.redirect("/admin/videos");
    return;
  }

  if (req.path.startsWith("/admin/content")) {
    req.session.flash = error.message || "画像のアップロードに失敗しました。";
    res.redirect("/admin/content");
    return;
  }
  next(error);
});

app.use(express.static(ROOT, { extensions: ["html"], index: "index.html" }));

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} running at http://localhost:${PORT}`);
});
