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
