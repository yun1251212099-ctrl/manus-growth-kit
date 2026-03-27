# Manus Growth Kit（免费引流 + 实时数据面板）

你现在有一套“零后端、可追踪”的引流链路：

- 入口（带统计、自动跳转到 Manus）：`/go/?src=xxx`
- 可选回流（尝试把“注册完成/到达”也记一笔）：`/go/?src=xxx&conv=1`
- 数据面板：`/dashboard/`

线上地址（GitHub Pages）：

- 面板：https://yun1251212099-ctrl.github.io/manus-growth-kit/dashboard/
- 投放链接生成：https://yun1251212099-ctrl.github.io/manus-growth-kit/links/

## 重要说明（先把预期说清楚）

- 我**不能**帮你做“全平台无差别群发/刷屏”这种投放（会触发平台风控、封号，也属于垃圾信息行为）。
- “免费 + 立刻看到 ≥15 个真实注册/天”通常**无法保证**，除非你本身有流量/社群/内容输出能力，或使用付费广告。
- 我可以做到的是：把“你自己的渠道”做成**自动发布**（无需你每天手动发），并且在面板里实时看到点击/回流数据。

## 自动发布（不需要你每天手动发）

本仓库自带 GitHub Actions：定时把链接发到你**自己拥有/管理**的渠道（例如 Telegram 频道、Discord 频道、Slack）。

### 1) 在仓库里配置 Secrets（一次性）

进入 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret，按需添加：

- `TELEGRAM_BOT_TOKEN`：Telegram Bot token
- `TELEGRAM_CHAT_ID`：频道/群的 chat_id（也可以是 `@channelusername`）
- `DISCORD_WEBHOOK_URL`：Discord Incoming Webhook URL
- `SLACK_WEBHOOK_URL`：Slack Incoming Webhook URL

可选（不填也能跑）：

- `BASE_URL`：默认是本项目 Pages 根目录
- `MESSAGE_TEMPLATE`：消息模板，默认 `Manus 邀请注册：{url}`（支持 `{url}`、`{src}`）
- `UTM_MEDIUM` / `UTM_CAMPAIGN`：UTM 参数
- `CONV`：`1`（默认）或 `0`，控制是否带 `conv=1`

### 2) 触发方式

- 自动定时：每天多次（见 `.github/workflows/autopost.yml`）
- 手动触发：仓库 Actions → `Auto Post Invite Link` → Run workflow

### 3) 数据在哪里看

- 点击：面板里的“今日点击（总）/渠道明细（今日）”
- 回流：需要使用 `conv=1` 的链接，并且 Manus 允许 `redirectUrl` 回跳；面板里对应“今日完成（总）”

