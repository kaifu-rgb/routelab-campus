const SPREADSHEET_ID = "1Kbi1pY6ryx2QkNWELk5JbnBZxVvm-yAC09onAHi7Owo";
const SHEET_NAME = "問い合わせ";
const NOTIFY_EMAIL = "maofushilu@gmail.com";

function doPost(e) {
  const payload = parsePayload_(e);
  const sheet = getSheet_();
  const values = [
    new Date(),
    payload.name || "",
    payload.email || "",
    payload.phone || "",
    payload.grade || "",
    payload.interest || "",
    Array.isArray(payload.subjects) ? payload.subjects.join(", ") : payload.subjects || "",
    payload.message || "",
    payload.pageUrl || "",
  ];

  sheet.appendRow(values);
  sendNotification_(payload);

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return e.parameter || {};
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "受信日時",
      "お名前",
      "メール",
      "電話番号",
      "学年",
      "相談メニュー",
      "気になる科目",
      "相談内容",
      "送信ページ",
    ]);
  }

  return sheet;
}

function sendNotification_(payload) {
  if (!NOTIFY_EMAIL) {
    return;
  }

  const body = [
    "HPから問い合わせが届きました。",
    "",
    `お名前: ${payload.name || ""}`,
    `メール: ${payload.email || ""}`,
    `電話番号: ${payload.phone || ""}`,
    `学年: ${payload.grade || ""}`,
    `相談メニュー: ${payload.interest || ""}`,
    `気になる科目: ${Array.isArray(payload.subjects) ? payload.subjects.join("、") : payload.subjects || ""}`,
    "",
    "相談内容:",
    payload.message || "",
    "",
    `送信ページ: ${payload.pageUrl || ""}`,
  ].join("\n");

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: "【埼玉高校受験ラボ】HP問い合わせ",
    body,
  });
}
