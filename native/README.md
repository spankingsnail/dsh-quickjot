# 本机手动录音 helper（macOS 15+）

仅在 Host 明确启动子进程后采集；无网络、ASR、LLM、后台自动启动、驱动安装或系统音频路由修改。构建与离线测试不会启动设备、调用权限 API 或播放声音。

## 构建、离线验证

从插件根目录执行：

```sh
sh native/build-helper.sh
node --test test/native-recording.test.mjs
# 单独离线自测，目录必须已经存在、为空且由当前用户拥有：
OUT=$(mktemp -d "$PWD/native/.build/offline-XXXXXX")
native/recorder --self-test --output "$OUT"
```

构建使用系统 `xcrun swiftc` 与 macOS SDK；无第三方依赖。当前验证工具链 Swift 6.1.2 / SDK 15.5，Swift 5 语言模式，部署目标 macOS 15.0。默认生成本机架构；可通过 `RECORDER_ARCH=arm64` 或 `x86_64` 选择交叉编译目标。仅编译，不自动执行产物。

二进制内嵌 helper 自己的麦克风/音频用途说明（未修改 Electron 应用）。权限实际归属与持久性由 macOS TCC/负责应用及签名决定；构建成功并不证明真实设备授权成功。

打包仅需要可执行产物、Swift 源码、构建脚本、用途 plist 和本说明；**不要打包 `.build` 缓存/合成音频**。源码见 [Recorder.swift](<./Recorder.swift>)，构建脚本见 [build-helper.sh](<./build-helper.sh>)，用途信息见 [Recorder-Info.plist](<./Recorder-Info.plist>)。

## Host 协议

手动启动时的 argv（下面只说明协议，不是离线测试命令）：

```text
native/recorder --output <absolute-existing-empty-owned-dir> --mode mic|system|both
```

- `mic`：AVCaptureSession，默认麦克风。完全不调用 SCShareableContent、不请求屏幕捕获权限。
- `system`：单 SCStream，仅注册 `.audio`。
- `both`：单 SCStream，分别注册 `.audio` / `.microphone`。麦克风保留独立音轨。
- SCK 使用 display filter，但从不注册 `.screen`、从不获取/处理/保存视频 sample、从不添加 SCRecordingOutput。系统声音/双源模式可能需要屏幕与系统音频录制授权。
- stdin UTF-8 逐行发送 `pause` / `resume` / `stop`。必须等 `ready` 再 pause/resume。空行忽略，非法命令报错并停止。最后一行可以没有 LF。
- stdin EOF、SIGTERM、SIGINT、SIGHUP 均停止并尽量 finalize；OS stop/start 回调无响应时最多等待 3 秒后 finalize/退出，并将结果标记失败。SIGKILL/断电不能 finalize，Host 需 repair。
- stdout 仅 JSONL（stderr 留给运行库诊断），事件名为 `event`。

事件：

```json
{"event":"ready","durationMs":0,"paused":false,"tracks":{"microphone":{"bytes":0,"frames":0,"sampleRate":16000,"channels":1,"peak":0,"sourceFrames":0,"sampleBuffers":0,"nonSilentFrames":0,"noSamples":true,"silent":true,"secondsSinceLastSample":0}}}
{"event":"stats","durationMs":1000,"paused":false,"tracks":{"microphone":{"bytes":32000,"frames":16000,"sampleRate":16000,"channels":1,"peak":0.25,"sourceFrames":48000,"sampleBuffers":100,"nonSilentFrames":15000,"noSamples":false,"silent":false,"secondsSinceLastSample":0.01}}}
{"event":"paused","durationMs":1000,"paused":true,"tracks":{}}
{"event":"resumed","durationMs":1000,"paused":false,"tracks":{}}
{"event":"error","message":"具体失败原因"}
{"event":"stopped","ok":false,"error":"没有收到某轨真实样本","warning":"静音并不代表有语音","tracks":{}}
```

上述空 `tracks` 仅为缩略：只要 session 已创建，ready/stats/paused/resumed/stopped 都包含当前模式选中各轨完整数据。key 固定为 `microphone` / `system`，未选中的轨不存在。创建 session 前失败时 stopped 的 tracks 为空。

字段语义：

- `bytes`：**PCM payload** 字节数，不含 44 字节 WAV 头；物理文件字节数是 `44 + bytes`。
- `frames`：已写入的输出时间轴帧数，含对齐补零；`sampleRate=16000`、`channels=1`、每帧 2 字节。
- `sourceFrames`：暂停范围之外实际收到并交给转换器的原生源帧数，采样率可能不同，不可用它除以 16000 计算时长。
- `sampleBuffers`：真实输入回调数量，含暂停时丢弃的回调；不能仅依赖此字段判断已录到有效音轨。
- `noSamples`：没有收到任何输入回调；`silent`：已写音频峰值为 0；`peak`：会话累计绝对振幅峰值，归一化到 0..1；`nonSilentFrames` 为累计非零写入帧，不是语音识别。
- `durationMs`：共同 host clock 时间轴去掉所有显式暂停后的时长。
- `secondsSinceLastSample`：最后输入样本至当前 host clock 的间隔，未收过样本时为 0（须结合 noSamples）。
- `ready` 只表示采集 API 启动完成，**不证明两轨都已经有样本**。每秒 stats 会明确 noSamples/silent/sourceFrames。
- 无样本、权限拒绝、设备中断、转换/磁盘/停止失败均 error + 非 0 退出；stopped 包含 `ok=false,error`。结束时任一必需轨 sourceFrames 为 0 必须失败，不能把补零 WAV 当作录成双源。
- 收到真实的全零输入不等同权限拒绝；停止时输出 silent warning，不能据此声称录到语音。

## 音频与恢复

- 输出仅选中模式对应的 `microphone.wav`、`system.wav`，无 sidecar。
- 统一转换为 little-endian PCM16 / mono / 16000 Hz，准确 44 字节标准 RIFF 头（无扩展 chunk）。AVAudioConverter 处理不同原生采样率、交错/非交错布局并 downmix；无混音、AEC 或音量增强。
- 两轨使用采集同步时钟转换到相同 host clock；按 timestamp 写入共同起点。迟到/缺失声源位置补零，显式暂停边界裁切，恢复时合并时间轴。finalize 对齐两轨长度，不会将补零计入 sourceFrames。
- 每秒、暂停和停止时 patch WAV header + fsync；持续写入时首次创建即有完整 44 字节头。崩溃后 Host 可按物理文件长取完整偶数字节 payload，重写 44 字节 PCM 头。最后不足一帧应截断；文件超过 RIFF 4 GiB 上限时主动失败，不使用 RF64。
- 输出目录必须存在、绝对路径、为空、归当前用户；拒绝最终路径符号链接。固定文件通过已验证目录 fd + openat(O_EXCL|O_NOFOLLOW) 创建，权限 0600，不覆盖已有文件。

## 已验证与边界

离线 fixture 使用与真实音频相同的 Track / AVAudioConverter / PCMWriter：44.1k stereo planar 与 48k stereo interleaved float，440/880 Hz 两个独立正弦波。1.5 秒源时间中排除 0.5 秒暂停；系统轨模拟晚到 30ms，输出两轨仍严格各 16000 帧 / 32000 payload bytes，并验证前 30ms 补零、周期头修补、非零幅度、频率、finalize 幂等。Node 测试额外独立解析头/样本、检查暂停、非空目录/符号链接/非法参数拒绝。

**没有运行真实录音或弹出权限提示。** 因而实际 TCC 弹窗/归属、设备可用性、SCStream 在当前 macOS 的真实双源回调、EOF/SIGTERM 在真实采集中的 teardown 都尚未实机验证。需要用户明确点击开始后人工验收。受保护/DRM 音频可能静音或不提供样本。双源不自动消回声，扬声器声音可能再次进入麦克风，应优先使用耳机。暂停只排除保存的音频，采集 session 仍保持运行，系统隐私指示器可能继续显示。
