# Agents Console

个人用的 [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) 安卓控制台。和 [cursor.com/agents](https://cursor.com/agents)、桌面 Cloud 面板共用同一账号、同一批 `bc-...` 记录。

这不是 cursor.com 套壳，也没有自建同步协议。本机只保存 API Key 和偏好（最近仓库、默认模型、环境名），不存 transcript，不存第二份 Agent 列表。

## 能做什么

- 粘贴 User API Key，启动时用 `GET /v1/me` 校验
- Inbox 分页列出云端 Agent（前台约 18 秒轮询）
- 新建任务：`POST /v1/agents`（文本、仓库 URL 或手填环境名、模型、plan/agent、图片）
- 详情：轮询 Get Agent / Get A Run，未结束时 SSE 看输出
- 追问、取消、归档、用量、产物
- 打开官方 `agent.url` 和 PR

桌面本地 Agent 必须先 Cloud / Move to Cloud 才会出现在本应用。

## 不做

- 用 WebView 套 `cursor.com`
- 复刻 IDE
- 多用户 / 上架商店

## 密钥

1. 打开 Cursor Dashboard → Integrations → User API Keys（或文档里的 API Keys）
2. 创建密钥，只在应用「连接账号」页粘贴
3. Key 只进本机 SecureStore（iOS `WHEN_UNLOCKED_THIS_DEVICE_ONLY`），设置页只显示后 4 位
4. 不要把 Key 写进 Git、EAS 密钥文件或聊天

## 本地开发

```bash
npm ci
npm run typecheck
npx expo start
```

真机用 Expo Go 或 development build 打开。默认请求 `https://api.cursor.com`。

## 打 preview APK

云端环境打不了签过名的包，需要你本机已登录 Expo：

```bash
npm i -g eas-cli
eas login
eas build --platform android --profile preview
```

`eas.json` 里 `preview` 使用 `distribution: internal` + Android APK，侧载或内部分发。包名：`com.kaibairen.agentsconsole`。`android.allowBackup` 为 `false`。

首次还需要 `eas init` 把项目连到你的 Expo 账号。

## 接口约定

- 鉴权：`Authorization: Bearer <key>`
- 不用 `@cursor/sdk`（面向 Node），React Native 里用 `fetch`
- 默认约 20 rpm；`GET /v1/repositories` 为 1/分钟、30/小时，客户端会缓存并允许手输仓库 URL
- 没有「列出 environments」接口：环境名手填并记住
- 客户端创建任务时带 `agentId: bc-<uuid>`，避免重复提交
- 只有 429 / 5xx 会重试；日志只打 method / path / status，不打 Key 和 prompt
