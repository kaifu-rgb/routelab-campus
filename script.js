const canvas = document.getElementById("lightCanvas");
const lightColors = ["#5de6f4", "#ffd56b", "#ff87b5", "#a4f5c8"];
let lights = [];

if (canvas) {
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = hero.clientWidth;
    const height = hero.clientHeight;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.max(38, Math.floor(width / 30));
    lights = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.4 + Math.random() * 4.4,
      speed: 0.2 + Math.random() * 0.6,
      wave: Math.random() * 120,
      color: lightColors[index % lightColors.length],
    }));
  }

  function drawLights() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const width = hero.clientWidth;
    const height = hero.clientHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    lights.forEach((light) => {
      light.x += light.speed;
      light.y += Math.sin((light.x + light.wave) * 0.014) * 0.14;

      if (light.x > width + 20) {
        light.x = -20;
        light.y = Math.random() * height;
      }

      const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius * 8);
      gradient.addColorStop(0, light.color);
      gradient.addColorStop(0.35, `${light.color}88`);
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius * 8, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(drawLights);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  drawLights();
}

document
  .querySelectorAll(
    ".promise-strip, .message-strip, .consult-band, .visual-story-card, .subject-card, .marquee-card, .service-grid article, .method-cards article, .route-visual-section, .program-main, .program-list article, .route-board article, .hybrid-grid article, .exam-points article, .results-group, .course, .offer-strip, .bundle-panel, .catalog-group, .mini-course, .flow-list li, .faq-list details, .ai-chat-section, .contact",
  )
  .forEach((element) => element.classList.add("reveal-on-scroll"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 },
);

document.querySelectorAll(".reveal-on-scroll").forEach((element) => revealObserver.observe(element));

function collectContactPayload(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const subjects = formData.getAll("subjects");

  return {
    name: (data.name || "").trim(),
    email: (data.email || "").trim(),
    phone: (data.phone || "").trim(),
    grade: data.grade || "",
    interest: data.interest || "",
    subjects,
    message: (data.message || "").trim(),
    source: "RouteLab Campus HP",
    pageUrl: window.location.href,
    submittedAt: new Date().toISOString(),
  };
}

async function submitToEndpoint(payload, config) {
  if (!config.endpoint) {
    return { skipped: true };
  }

  if (config.mode === "no-cors") {
    await fetch(config.endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { ok: true, opaque: true };
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`送信に失敗しました (${response.status})`);
  }

  return { ok: true };
}

function getContactConfig() {
  return {
    endpoint: "",
    mode: "json",
    ...(window.CONTACT_FORM_CONFIG || {}),
  };
}

const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const config = getContactConfig();
    const payload = collectContactPayload(event.currentTarget);
    const status = document.getElementById("formStatus");
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');

    if (!payload.name) {
      status.textContent = "お名前を入力してください。";
      status.classList.add("is-error");
      return;
    }

    if (!payload.email && !payload.phone) {
      status.textContent = "メールアドレスまたは電話番号のどちらかを入力してください。";
      status.classList.add("is-error");
      return;
    }

    if (!payload.message) {
      status.textContent = "相談したい内容を入力してください。";
      status.classList.add("is-error");
      return;
    }

    status.classList.remove("is-error");
    status.textContent = "送信しています...";
    submitButton.disabled = true;

    localStorage.setItem("saitama-route-lab-contact", JSON.stringify(payload));

    try {
      const result = await submitToEndpoint(payload, config);
      status.textContent = result.skipped
        ? "送信先URLが未設定です。設定後、このフォームから直接問い合わせを送信できます。"
        : "送信しました。確認後、入力いただいた連絡先へご連絡します。";
    } catch (error) {
      status.textContent = "自動送信に失敗しました。時間をおいて再度お試しください。";
      status.classList.add("is-error");
      console.error(error);
    } finally {
      submitButton.disabled = false;
    }
  });
}

const courseDetailTemplates = {
  国語: [
    "基礎: 語彙、文章構造、指示語、接続語、本文根拠の拾い方",
    "標準: 説明文・小説の設問別解法、選択肢の消去、記述の要素整理",
    "応用: 初見長文、条件付き記述、作文・資料読解の得点化",
    "仕上げ: 時間配分、答案添削、失点パターンの修正",
  ],
  現代文: [
    "基礎: 語彙、対比、因果、指示語、筆者の主張の取り方",
    "標準: 設問要求の読み分け、本文根拠の圧縮、記述答案の骨格作成",
    "応用: 抽象度の高い評論、複数箇所根拠、短時間処理",
    "仕上げ: 過去問形式での時間配分と答案添削",
  ],
  数学: [
    "基礎: 計算、方程式、関数、図形、確率の典型解法",
    "標準: 文章題、関数と図形、証明、場合分けの手順化",
    "応用: 融合問題、難問の切り口、途中式で点を残す答案作成",
    "仕上げ: 大問別演習、時間配分、解き直しルートの作成",
  ],
  英語: [
    "基礎: 単語、文法、英文構造、短文精読、音読の型",
    "標準: 長文読解、設問先読み、和訳、英作文の基本形",
    "応用: 長文量への対応、要約、自由英作文、リスニング処理",
    "仕上げ: 過去問形式での時間配分と弱点単元への戻し",
  ],
  リスニング: [
    "基礎: 音のつながり、弱化、頻出表現、数字・時刻の聞き取り",
    "標準: 設問先読み、メモの取り方、会話文と説明文の聞き分け",
    "応用: 長めの英文、言い換え表現、選択肢の判断スピード",
    "仕上げ: 本番形式演習と聞き取れなかった音の復習",
  ],
  理科: [
    "基礎: 生物・地学・化学・物理の用語整理と基本公式",
    "標準: 計算問題、実験考察、グラフ・表の読み取り",
    "応用: 複合問題、条件整理、記述説明の作り方",
    "仕上げ: 頻出単元の総点検と過去問演習",
  ],
  社会: [
    "基礎: 地理・歴史・公民の用語、地図、年表、制度理解",
    "標準: 資料問題、並べ替え、理由説明、頻出テーマの整理",
    "応用: 複数資料の読み取り、記述答案、時事との接続",
    "仕上げ: 一問一答から資料・記述への変換練習",
  ],
  世界史: [
    "基礎: 通史、地域史、王朝・制度・宗教・交易の整理",
    "標準: 因果関係、比較、時代横断テーマの理解",
    "応用: 論述の設計、指定語句の使い方、答案の因果接続",
    "仕上げ: 東大形式の大論述・小論述演習と添削",
  ],
  地理: [
    "基礎: 地形、気候、産業、人口、都市、統計の読み方",
    "標準: 地図・グラフ・表の分析、地域比較、背景知識の整理",
    "応用: 論述答案、データから理由を説明する練習",
    "仕上げ: 東大形式の資料読解と答案添削",
  ],
  物理: [
    "基礎: 力学、波、電磁気、熱、原子の基本法則と公式",
    "標準: 現象把握、図示、立式、典型問題の処理",
    "応用: 複合問題、近似、条件整理、答案の論理展開",
    "仕上げ: 東大形式の大問演習と計算ミスの修正",
  ],
  セット: [
    "基礎: 各科目の抜けを確認し、最初に戻る単元を決める",
    "標準: 科目別の映像授業と参考書演習を週単位で進める",
    "応用: 志望校形式の演習に入り、科目ごとの失点原因を潰す",
    "仕上げ: 過去問、確認テスト、解き直し計画で合格点に寄せる",
  ],
  過去問: [
    "基礎: 出題形式、時間配分、採点基準、頻出単元の確認",
    "演習: 年度別過去問を解き、失点を単元別に分類",
    "添削: 国語記述・英作文を中心に答案を具体的に修正",
    "仕上げ: 解き直しルートを作り、次に戻る教材まで決める",
  ],
  個別: [
    "基礎: 現在の答案を確認し、減点される癖を見つける",
    "標準: 型、根拠、表現、語数、条件の満たし方を練習",
    "添削: 1枚ずつ答案を直し、改善点を次の答案に反映",
    "仕上げ: 本番形式で安定して点を取れる書き方に整える",
  ],
};

function detectCourseKind(title) {
  const keys = ["リスニング", "現代文", "世界史", "地理", "物理", "国語", "数学", "英語", "理科", "社会"];
  const found = keys.find((key) => title.includes(key));
  if (found) return found;
  if (title.includes("過去問")) return "過去問";
  if (title.includes("英作文") || title.includes("記述") || title.includes("添削")) return "個別";
  if (title.includes("セット")) return "セット";
  return "セット";
}

function buildCourseDetail(courseCard) {
  const title = courseCard.querySelector("h4, h3")?.textContent.trim() || "講座詳細";
  const summary = courseCard.querySelector("p:not(.badge):not(.price)")?.textContent.trim() || "";
  const price = courseCard.querySelector(".price, strong")?.textContent.trim() || "";
  const kind = detectCourseKind(title);
  const lessons = courseDetailTemplates[kind] || courseDetailTemplates["セット"];
  const isTodai = title.includes("天翔") || title.includes("雷迅") || title.includes("東京大学") || title.includes("東大");
  const isHado = title.includes("覇道");
  const levelText = isTodai
    ? "基礎事項の確認から始め、東大形式の答案作成まで段階的に進めます。"
    : isHado
      ? "基本事項の穴埋めから始め、難関私立で必要な処理速度と応用力まで引き上げます。"
      : "基本事項の確認から始め、標準問題、応用問題、入試形式へ順番に進めます。";

  return { title, summary, price, lessons, levelText };
}

function ensureCourseModal() {
  let modal = document.querySelector(".course-detail-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "course-detail-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="course-detail-backdrop" data-course-close></div>
    <section class="course-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="courseDetailTitle">
      <button class="course-detail-close" type="button" data-course-close aria-label="閉じる">×</button>
      <p class="eyebrow">授業内容</p>
      <h2 id="courseDetailTitle"></h2>
      <p class="course-detail-summary"></p>
      <p class="course-detail-level"></p>
      <ol class="course-detail-list"></ol>
      <div class="course-detail-footer">
        <span class="course-detail-price"></span>
        <a class="button primary" href="#contact">この講座を相談する</a>
      </div>
    </section>`;
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-course-close]").forEach((button) => {
    button.addEventListener("click", closeCourseModal);
  });
  modal.querySelector(".course-detail-footer a").addEventListener("click", closeCourseModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeCourseModal();
  });

  return modal;
}

function openCourseModal(courseCard) {
  const modal = ensureCourseModal();
  const detail = buildCourseDetail(courseCard);
  modal.querySelector("#courseDetailTitle").textContent = detail.title;
  modal.querySelector(".course-detail-summary").textContent = detail.summary;
  modal.querySelector(".course-detail-level").textContent = detail.levelText;
  modal.querySelector(".course-detail-price").textContent = detail.price;
  modal.querySelector(".course-detail-list").innerHTML = detail.lessons.map((lesson) => `<li>${lesson}</li>`).join("");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-course-modal-open");
  modal.querySelector(".course-detail-close").focus();
}

function closeCourseModal() {
  const modal = document.querySelector(".course-detail-modal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-course-modal-open");
}

document.querySelectorAll(".mini-course .course-thumb, .product-card .course-thumb").forEach((thumb) => {
  thumb.setAttribute("role", "button");
  thumb.setAttribute("tabindex", "0");
  thumb.setAttribute("aria-label", "講座の詳しい授業内容を見る");

  const open = () => openCourseModal(thumb.closest(".mini-course, .product-card"));
  thumb.addEventListener("click", open);
  thumb.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
});
