// Set your Dify app token here after publishing the app in Dify.
// Official Dify flow: Publish -> Embed -> copy the app token.
const DIFY_APP_TOKEN = "";
const DIFY_BASE_URL = "https://udify.app";

function loadDifyChat() {
  if (!DIFY_APP_TOKEN || window.__kokugoDifyLoaded) {
    return;
  }

  window.__kokugoDifyLoaded = true;
  window.difyChatbotConfig = {
    token: DIFY_APP_TOKEN,
    baseUrl: DIFY_BASE_URL,
    containerProps: {
      style: {
        right: "22px",
        bottom: "22px",
      },
    },
    inputs: {
      site: "埼玉高校受験ラボ",
      purpose: "問い合わせ前の高校受験ルート相談",
    },
  };

  const script = document.createElement("script");
  script.src = `${DIFY_BASE_URL}/embed.min.js`;
  script.defer = true;
  document.body.appendChild(script);
}

const contactSection = document.getElementById("contact");
if (contactSection) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadDifyChat();
        observer.disconnect();
      }
    },
    { rootMargin: "120px" },
  );

  observer.observe(contactSection);
  document.querySelectorAll('a[href="#contact"], a[href$="#contact"]').forEach((link) => {
    link.addEventListener("click", loadDifyChat, { once: true });
  });
}
