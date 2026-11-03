#!/usr/bin/env node
/**
 * Optional notifications: broadcast data updates to groups/channels (off by default; only sent
 * when the matching secret is configured).
 *
 * Supported:
 *   FEISHU_WEBHOOK        Feishu group bot webhook (contains /open-apis/bot/v2/hook/)
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *   SERVERCHAN_KEY        ServerChan SendKey
 *
 * Usage: node scripts/notify.mjs
 * Note: a failed channel only prints a warning and never blocks deployment
 * (workflow step uses continue-on-error: true).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://chengxi-z.github.io/llm-pulse/";

function readJson(name) {
  const p = join(ROOT, "data", `${name}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const meta = readJson("meta");
const news = readJson("news");
if (!meta) {
  console.log("[notify] 无 meta.json，跳过");
  process.exit(0);
}

const top = (news?.items || [])
  .slice(0, 3)
  .map((n, i) => `${i + 1}. ${n.title}`)
  .join("\n");
const text = [
  "✦ AI Pulse · 照胆云 每日更新",
  `模型 ${meta.stats?.models ?? "?"} 个 · 动态 ${meta.stats?.news ?? "?"} 条 · 榜单 ${meta.stats?.boards ?? "?"} 个`,
  "",
  top,
  "",
  `全部内容: ${SITE_BASE_URL}`,
].join("\n");

async function post(name, url, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    console.log(`[notify] ${name}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[notify] ${name} 发送失败（详情已隐去）`);
  }
}

let sent = 0;

if (process.env.FEISHU_WEBHOOK) {
  await post("feishu", process.env.FEISHU_WEBHOOK, {
    msg_type: "interactive",
    card: {
      header: { title: { tag: "plain_text", content: "AI Pulse · 照胆云 每日更新" } },
      elements: [{ tag: "markdown", content: `${top}\n\n[查看全部](${SITE_BASE_URL})` }],
    },
  });
  sent++;
}

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  await post("telegram", `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: false,
  });
  sent++;
}

if (process.env.SERVERCHAN_KEY) {
  await post("serverchan", `https://sctapi.ftqq.com/${process.env.SERVERCHAN_KEY}.send`, {
    title: "AI Pulse · 照胆云 每日更新",
    desp: text.replace(/\n/g, "\n\n"),
  });
  sent++;
}

console.log(sent ? `[notify] 已发送 ${sent} 个渠道` : "[notify] 未配置推送渠道，跳过（可选）");
