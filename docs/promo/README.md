# 宣传视频素材

`dsh-quickjot-promo.mp4` 是仓库 README 顶部那段 45 秒演示：**无声**、中文硬字幕、片尾一行英文 tagline。

## 重要：画面里没有真实数据

视频不是录屏，是**合成演示**：用插件自己的 CSS（`plugin.css` 从 `src/client.mjs` 与 `src/reminder-client.mjs` 里抽取）拼出一份 HTML，喂进虚构的中性数据，再逐帧确定性渲染。真实的本机事项、会话列表、微信目标昵称一个都没进画面。

这么做是因为真正录屏无法保证不泄露——一个侧栏角标、一条会话标题就够了，而泄露不可逆。

## 文件

| 文件 | 说明 |
| --- | --- |
| `dsh-quickjot-promo.mp4` | 成片。1920×1080 / 30fps / H.264 / 45.5s / 约 2.8MB |
| `poster.png` | README 里的封面帧（取自 18.4s 的日程列表） |
| `demo.html` | 演示页本体：6 幕 + 时间轴引擎，`window.renderAt(t)` 渲染任意时刻 |
| `plugin.css` | 从插件源码抽出的样式，保证演示长相与真实界面一致 |
| `extract-css.mjs` | 重新抽取 `plugin.css` 的脚本 |
| `render.mjs` | 抓帧并编码的脚本（headless Chrome + CDP + ffmpeg） |
| `poster.mjs` | 单独导出封面帧（顺手把字幕条隐掉） |

## 重新生成

需要 Google Chrome 与 ffmpeg。

```bash
node extract-css.mjs            # 插件改了样式后，先重新抽取
open demo.html                  # 想让窗口在浏览器里拖时间轴看效果
node render.mjs                 # 输出 dsh-quickjot-promo.mp4
```

`render.mjs` 用 CDP 把 `renderAt(t)` 逐帧喂给页面再截图，通过管道直接写给 ffmpeg，不落中间帧文件。整片在本机约 2.5 分钟出片。

封面用 `node poster.mjs 18.4 poster.png` 单独出——它把字幕条关掉，因为封面是静态缩略图，压着一行会读的字幕反而显得吵。

## 六幕结构

| 时间 | 内容 | 字幕 |
| --- | --- | --- |
| 0–6s | 一句话打出来 | 你和 AI 聊出来的事，大多没被记住。 |
| 6–14s | 仿对话窗口：两问两答 + 工具调用 | 现在，说一句就够了。 |
| 14–24s | 侧栏切到随手记，日程列表 / 收起的月历 / 待办页签 | 它落在本机的账本里：日程、待办、便签，共用一本。 |
| 24–32s | 背景压暗，未读提醒面板 + 标为已读 | 到点了，应用里提醒你 —— 不需要任何额外配置。 |
| 32–39s | 微信气泡 + 三态（已发送 / 渠道已接受 / 等你核对） | 也可以推到微信。通道来自 DSH-IM，发送状态可核对。 |
| 39–45.5s | 片名 + tagline + 仓库/MIT/插件 | github.com/spankingsnail/dsh-quickjot |

第 5 幕那句「通道来自 DSH-IM」是有意放在片中的：微信推送不是这个插件自己实现的，成片里不该把这个功劳算在自己头上。
