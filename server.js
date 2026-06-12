require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const session = require("express-session");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, "uploads", "videos");
const SEED_VIDEO_DIR = path.join(ROOT, "seed-videos");
const SEED_VIDEOS_FILE = path.join(SEED_VIDEO_DIR, "videos.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const VIDEOS_FILE = path.join(DATA_DIR, "videos.json");
const SERVICE_NAME = "RouteLab Campus";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

function slugFileName(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
}

function users() {
  return normalizeList(readJson(USERS_FILE, []));
}

function videos() {
  const savedVideos = normalizeList(readJson(VIDEOS_FILE, []));
  const seedVideos = normalizeList(readJson(SEED_VIDEOS_FILE, []));
  const seen = new Set();
  return [...savedVideos, ...seedVideos].filter((video) => {
    const key = video.filename || video.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function saveUsers(nextUsers) {
  writeJson(USERS_FILE, normalizeList(nextUsers));
}

function saveVideos(nextVideos) {
  writeJson(VIDEOS_FILE, normalizeList(nextVideos));
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
      `Login URL: http://localhost:${PORT}/login\nEmail: ${email}\nPassword: ${password}\n\nAfter logging in, set ADMIN_EMAIL and ADMIN_PASSWORD in .env before using this in production.\n`,
      "utf8",
    );
  }
  console.log(`Admin account created: ${email}`);
}

seedAdmin();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, slugFileName(file.originalname)),
  }),
  limits: { fileSize: 1024 * 1024 * 1500 },
  fileFilter: (_req, file, callback) => {
    const allowed = [".mp4", ".mov", ".m4v", ".webm"];
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowed.includes(extension));
  },
});

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
app.use(express.static(ROOT, { extensions: ["html"], index: "index.html" }));

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
      res.status(403).send(page("権限がありません", `<p class="alert">管理者のみアクセスできます。</p>`, req));
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
    <link rel="stylesheet" href="/member.css" />
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

function flash(req) {
  const message = req.session.flash;
  delete req.session.flash;
  return message ? `<p class="alert success">${escapeHtml(message)}</p>` : "";
}

app.get("/login", (req, res) => {
  const next = req.query.next || "/library";
  const message = req.query.error ? `<p class="alert">メールアドレスかパスワードが違います。</p>` : "";
  res.send(
    page(
      "ログイン",
      `<section class="auth-card">
        <p class="eyebrow">Members</p>
        <h1>学習動画にログイン</h1>
        <p class="lead">管理者から発行されたメールアドレスとパスワードで、会員専用の動画ルームに入れます。</p>
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
  const visibleVideos = videos().filter((video) => video.published);
  const cards = visibleVideos.length
    ? visibleVideos
        .map(
          (video) => `<article class="video-card">
            <video controls preload="metadata" src="/media/${escapeHtml(video.filename)}"></video>
            <div>
              <p class="meta">${escapeHtml(video.course || "動画講座")}</p>
              <h3>${escapeHtml(video.title)}</h3>
              <p class="muted">${escapeHtml(video.description)}</p>
            </div>
          </article>`,
        )
        .join("")
    : `<p class="alert">まだ公開中の動画がありません。管理画面からアップロードするとここに表示されます。</p>`;

  res.send(
    page(
      "会員動画",
      `<section class="library-hero">
        <div>
          <p class="eyebrow">Video Library</p>
          <h1>今日見る動画が、すぐ見つかる。</h1>
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
          <p>ログイン中: ${escapeHtml(req.user.name)}</p>
        </div>
        <div class="video-grid">${cards}</div>
      </section>`,
      req,
      "library-page",
    ),
  );
});

app.get("/media/:filename", requireLogin, (req, res) => {
  const video = videos().find((candidate) => candidate.filename === req.params.filename && candidate.published);
  if (!video) {
    res.status(404).send("Not found");
    return;
  }
  const uploadedPath = path.join(UPLOAD_DIR, video.filename);
  const seedPath = path.join(SEED_VIDEO_DIR, video.filename);
  res.sendFile(fs.existsSync(uploadedPath) ? uploadedPath : seedPath);
});

app.get("/admin", requireAdmin, (req, res) => {
  const allUsers = users();
  const allVideos = videos();
  const userRows = allUsers
    .map(
      (user) => `<tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${user.active ? "有効" : "停止"}</td>
      </tr>`,
    )
    .join("");
  const videoRows = allVideos
    .map(
      (video) => `<tr>
        <td>${escapeHtml(video.title)}</td>
        <td>${escapeHtml(video.course)}</td>
        <td>${video.published ? "公開" : "非公開"}</td>
        <td>${escapeHtml(new Date(video.createdAt).toLocaleString("ja-JP"))}</td>
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
          <p class="lead">会員発行と動画アップロードをここで行います。</p>
        </div>
        ${flash(req)}
        <div class="grid">
          <article class="panel">
            <h2>動画をアップロード</h2>
            <form class="form-grid" action="/admin/videos" method="post" enctype="multipart/form-data">
              <label>タイトル<input name="title" required placeholder="例: 数学 関数の基礎" /></label>
              <label>コース・分類<input name="course" placeholder="例: 中3数学 / 確認テスト解説" /></label>
              <label>説明<textarea name="description" placeholder="動画の内容や見るタイミング"></textarea></label>
              <label>動画ファイル<input type="file" name="video" accept="video/mp4,video/webm,video/quicktime,.m4v" required /></label>
              <label>公開状態<select name="published"><option value="true">すぐ公開する</option><option value="false">非公開で保存</option></select></label>
              <button class="button primary" type="submit">アップロード</button>
            </form>
          </article>
          <article class="panel">
            <h2>会員を追加</h2>
            <form class="form-grid" action="/admin/users" method="post">
              <label>名前<input name="name" required placeholder="例: 山田 太郎" /></label>
              <label>メールアドレス<input type="email" name="email" required /></label>
              <label>初期パスワード<input type="text" name="password" required minlength="8" /></label>
              <button class="button primary" type="submit">会員を作成</button>
            </form>
          </article>
        </div>
        <article class="panel table-wrap">
          <h2>動画一覧</h2>
          <table><thead><tr><th>タイトル</th><th>分類</th><th>状態</th><th>登録日時</th></tr></thead><tbody>${videoRows}</tbody></table>
        </article>
        <article class="panel table-wrap">
          <h2>会員一覧</h2>
          <table><thead><tr><th>名前</th><th>メール</th><th>権限</th><th>状態</th></tr></thead><tbody>${userRows}</tbody></table>
        </article>
      </section>`,
      req,
    ),
  );
});

app.post("/admin/videos", requireAdmin, upload.single("video"), (req, res) => {
  if (!req.file) {
    req.session.flash = "動画ファイルを選択してください。";
    res.redirect("/admin");
    return;
  }

  const nextVideos = videos();
  nextVideos.unshift({
    id: crypto.randomUUID(),
    title: String(req.body.title || "").trim(),
    course: String(req.body.course || "").trim(),
    description: String(req.body.description || "").trim(),
    filename: req.file.filename,
    originalName: req.file.originalname,
    published: req.body.published === "true",
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  });
  saveVideos(nextVideos);
  req.session.flash = "動画をアップロードしました。";
  res.redirect("/admin");
});

app.post("/admin/users", requireAdmin, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");
  const nextUsers = users();

  if (nextUsers.some((user) => user.email === email)) {
    req.session.flash = "同じメールアドレスの会員がすでに存在します。";
    res.redirect("/admin");
    return;
  }

  nextUsers.push({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: createPasswordHash(password),
    role: "member",
    active: true,
    createdAt: new Date().toISOString(),
  });
  saveUsers(nextUsers);
  req.session.flash = "会員を作成しました。";
  res.redirect("/admin");
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} running at http://localhost:${PORT}`);
});
