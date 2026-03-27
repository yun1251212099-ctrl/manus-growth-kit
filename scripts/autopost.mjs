#!/usr/bin/env node

const BASE_URL =
  process.env.BASE_URL ||
  "https://yun1251212099-ctrl.github.io/manus-growth-kit/";

const CONV = (process.env.CONV || "1") === "1";
const UTM_MEDIUM = process.env.UTM_MEDIUM || "social";
const UTM_CAMPAIGN = process.env.UTM_CAMPAIGN || "autopost";
const MESSAGE_TEMPLATE = process.env.MESSAGE_TEMPLATE || "Manus 邀请注册：{url}";
const DRY_RUN =
  (process.env.DRY_RUN || "").toLowerCase() === "1" ||
  (process.env.DRY_RUN || "").toLowerCase() === "true";

const splitList = (value) =>
  String(value || "")
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

const buildGoUrl = ({ src }) => {
  const u = new URL("go/", BASE_URL);
  u.searchParams.set("src", src);
  if (CONV) u.searchParams.set("conv", "1");
  u.searchParams.set("utm_source", src);
  u.searchParams.set("utm_medium", UTM_MEDIUM);
  u.searchParams.set("utm_campaign", UTM_CAMPAIGN);
  return u.toString();
};

const renderMessage = ({ src, url }) =>
  MESSAGE_TEMPLATE.replaceAll("{url}", url).replaceAll("{src}", src);

const postJson = async ({ url, body, headers = {} }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return true;
};

const postForm = async ({ url, body, headers = {} }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return true;
};

const tryPostTelegram = async ({ src, text }) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = splitList(process.env.TELEGRAM_CHAT_ID);
  if (!token || chatIds.length === 0) return { skipped: true };
  if (DRY_RUN) {
    console.log(`[DRY_RUN] telegram src=${src} chats=${chatIds.join(",")}`);
    console.log(text);
    return { ok: true, dryRun: true };
  }

  const api = `https://api.telegram.org/bot${token}/sendMessage`;
  for (const chatId of chatIds) {
    await postJson({
      url: api,
      body: {
        chat_id: chatId,
        text,
        disable_web_page_preview: false,
      },
    });
  }
  return { ok: true, posted: chatIds.length };
};

const tryPostDiscord = async ({ src, text }) => {
  const webhooks = splitList(process.env.DISCORD_WEBHOOK_URL);
  if (webhooks.length === 0) return { skipped: true };
  if (DRY_RUN) {
    console.log(`[DRY_RUN] discord src=${src} hooks=${webhooks.length}`);
    console.log(text);
    return { ok: true, dryRun: true };
  }
  for (const webhook of webhooks) {
    await postJson({ url: webhook, body: { content: text } });
  }
  return { ok: true, posted: webhooks.length };
};

const tryPostSlack = async ({ src, text }) => {
  const webhooks = splitList(process.env.SLACK_WEBHOOK_URL);
  if (webhooks.length === 0) return { skipped: true };
  if (DRY_RUN) {
    console.log(`[DRY_RUN] slack src=${src} hooks=${webhooks.length}`);
    console.log(text);
    return { ok: true, dryRun: true };
  }
  for (const webhook of webhooks) {
    await postJson({ url: webhook, body: { text } });
  }
  return { ok: true, posted: webhooks.length };
};

const tryPostMastodon = async ({ src, text }) => {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) return { skipped: true };
  if (DRY_RUN) {
    console.log(`[DRY_RUN] mastodon src=${src} instance=${instance}`);
    console.log(text);
    return { ok: true, dryRun: true };
  }
  const api = new URL("/api/v1/statuses", instance).toString();
  const form = new URLSearchParams();
  form.set("status", text);
  form.set("visibility", process.env.MASTODON_VISIBILITY || "public");
  await postForm({
    url: api,
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: true, posted: 1 };
};

const tryPostBluesky = async ({ src, text }) => {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const pds = process.env.BLUESKY_PDS || "https://bsky.social";
  if (!identifier || !password) return { skipped: true };
  if (DRY_RUN) {
    console.log(`[DRY_RUN] bluesky src=${src} pds=${pds}`);
    console.log(text);
    return { ok: true, dryRun: true };
  }

  const sessionRes = await fetch(
    new URL("/xrpc/com.atproto.server.createSession", pds),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    }
  );
  if (!sessionRes.ok) {
    const t = await sessionRes.text().catch(() => "");
    throw new Error(`Bluesky session HTTP ${sessionRes.status}: ${t.slice(0, 300)}`);
  }
  const session = await sessionRes.json();
  const { accessJwt, did } = session || {};
  if (!accessJwt || !did) throw new Error("Bluesky session missing accessJwt/did");

  const record = {
    text,
    createdAt: new Date().toISOString(),
  };

  const createRes = await fetch(
    new URL("/xrpc/com.atproto.repo.createRecord", pds),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record,
      }),
    }
  );
  if (!createRes.ok) {
    const t = await createRes.text().catch(() => "");
    throw new Error(`Bluesky createRecord HTTP ${createRes.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true, posted: 1 };
};

const main = async () => {
  const targets = [
    { name: "telegram", src: process.env.TELEGRAM_SRC || "telegram", fn: tryPostTelegram },
    { name: "discord", src: process.env.DISCORD_SRC || "discord", fn: tryPostDiscord },
    { name: "slack", src: process.env.SLACK_SRC || "slack", fn: tryPostSlack },
    { name: "mastodon", src: process.env.MASTODON_SRC || "mastodon", fn: tryPostMastodon },
    { name: "bluesky", src: process.env.BLUESKY_SRC || "bluesky", fn: tryPostBluesky },
  ];

  let anyConfigured = false;
  for (const t of targets) {
    if (
      (t.name === "telegram" &&
        process.env.TELEGRAM_BOT_TOKEN &&
        splitList(process.env.TELEGRAM_CHAT_ID).length > 0) ||
      (t.name === "discord" && splitList(process.env.DISCORD_WEBHOOK_URL).length > 0) ||
      (t.name === "slack" && splitList(process.env.SLACK_WEBHOOK_URL).length > 0) ||
      (t.name === "mastodon" &&
        process.env.MASTODON_INSTANCE &&
        process.env.MASTODON_ACCESS_TOKEN) ||
      (t.name === "bluesky" &&
        process.env.BLUESKY_IDENTIFIER &&
        process.env.BLUESKY_APP_PASSWORD)
    ) {
      anyConfigured = true;
    }
  }

  if (!anyConfigured) {
    console.log("No targets configured. Add Secrets (Telegram/Discord/Slack/etc.) then rerun.");
    return;
  }

  console.log(
    `Auto post start. base=${BASE_URL} conv=${CONV ? "1" : "0"} dry_run=${
      DRY_RUN ? "1" : "0"
    }`
  );

  for (const t of targets) {
    const url = buildGoUrl({ src: t.src });
    const text = renderMessage({ src: t.src, url });
    try {
      const res = await t.fn({ src: t.src, text });
      if (res && res.skipped) continue;
      console.log(`[ok] ${t.name}: ${JSON.stringify(res)}`);
    } catch (err) {
      console.error(`[fail] ${t.name}: ${err && err.message ? err.message : String(err)}`);
    }
  }
};

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exitCode = 1;
});

