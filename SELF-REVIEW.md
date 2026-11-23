# v2 Builder 自验报告（当前续跑检查点）

## 状态与提交

- 当前候选：**v2 纯 JavaScript**；根 `main.ts` 与 kit house driver 相同。参赛仓库只含 JS/TS、MIT LICENSE、上游 NOTICE 和本报告，无 `.wasm`、native addon、`node_modules` 或构建工具链。
- 最近已提交的实现：`67560e7`（tag slug 复用）。其前是 `55a57d9`（单遍解析 front matter）、`17ec3e6`（避免对 Markdown 文档先整体 split 再解析 front matter）、`9cfb208`（Markdown 输出 parts/join、template include 预链接）、`fc2412a`（已验证的 v1 纯 JS 正确性基线）。当前代码工作树干净；本报告稍后与记录一同提交。
- 上述提交逐步完成，无提交到 make.fun、无 `git push`。每个可运行实现阶段均及时 commit；有显著变更时先写到 `../hidden_files/` 并通过 cmp/SHA-256 核验。
- `makefun bundle --dry-run` 在早期实际运行，确认为本次 `sg-builder-2` Pi session 可被发现。本赛 transcript/thinking 检查在 requirements 中均为 `applies=false`，没有伪造、编辑或上传 session/transcript。

## 资格边界与 G0

- 写前及写后复核 kit `RULES.txt` 和 `competition.yaml`。原文明确规定 **JavaScript/TypeScript only、no WebAssembly/native/prebuilt binary**。`competition.yaml` 未声明能覆盖禁令的 source-only 例外；公开 dev 榜/WASM 参赛标签也不构成本赛许可。因此 WASM 只在仓库外透明离线研究，未进入 `v2/`，不提交。
- 机器没有 Docker、clang 或 wasm-ld；本轮未安装工具链。G0 做了真实 renderer + 完整输出树物化的 ABI 成本切片：oracle 与本地 JS renderer 对照，WASM memory memcpy round-trip 与移除 guest copy 的对照均零差分，三者输出树编码哈希一致、728,012 bytes。9 轮 process 测量 net trimmed mean：JS **207,479 µs**，往返版 **220,753 µs**，不 memcpy 版 **216,701 µs**。
- **证据范围限制：**此受限切片只在 JS renderer 后额外模拟 ABI/memory copy、decode 和物化，并非 freestanding C 完整处理 Markdown/template 的 guest 引擎；它不是完整 G0 推进门的通过证据，也不能证明真实融合 WASM 全站一定输给 JS。由于没有实际 guest 算法相对 JS 的可测收益与获准/可复现工具链，本轮没有扩写 WASM、没有 SIMD/PGO；仅据此不做成绩声明。未通过比赛服务器探测规则许可。

## 正确性证据

- 官方 kit 本地 grader：Node **22.23.4**、`grade-local --driver process --worktree`，practice **3/3，`passed=1`，L1 regrade byte-for-byte reproduced**。grader 明确运行两次。最近证据在 `../v2-work/tag-slug-grade.log`；在当前代码提交前已针对相同候选工作树通过。
- kit vendor oracle 差分：21 个完整生成 case **0 diff / 60,112,129 output bytes**；30 个额外独立生成 case **0 diff**；21 个 Unicode、NUL、CRLF、静态文件、模板顺序/文件顺序 stress case **0 diff / 60,115,146 output bytes**。包括 reversed case 顺序/模板键与跨 `run()` 调用的确定性检查。
- 定向差分：inline **30,012** 个输入 0 diff；front matter **50,014** 个固定/生成输入 0 diff；slug **50,015** 个输入 0 diff；模板变量/作用域、循环 `loop` shadowing、缺失 include 和 include depth 0/7/8/9 对照通过。
- 最终 practice house、v1、v2 答卷各 **7,446,432 bytes**，SHA-256 均为 `25980928b145f54712027939364a64c277098bc4528a2d524e0bc27a0275fb03`。无 case ID、时钟、随机数、网络或跨 case 状态依赖。

## 性能（仅同机 process 代理，非官方分数）

测法：Node 22.23.4，kit practice，同一 core (`taskset -c 2`)。对完整 house、冻结 v1 和当前 v2 串行子进程逐轮交替；先 warm-up，再 9 轮，含每轮 null Node process。Python `wait4` 取 user+sys CPU，扣 null raw CPU 中位数，2 低 2 高截尾求 trimmed mean。wall/RSS、各轮原始 CPU、哈希保存在 `../v2-work/full-tag-slug-current.json`。

| 路线 | Net trimmed mean | Net 中位数 | MAD | Wall 中位数 | peak RSS |
|---|---:|---:|---:|---:|---:|
| House | 1,248,359.6 µs | 1,253,419 µs | 24,797 µs | 1,301.506 ms | 194,132 KiB |
| 冻结 v1 JS | 910,676.6 µs | 907,599 µs | 22,564 µs | 960.684 ms | 202,492 KiB |
| 当前 v2 JS | **659,955.0 µs** | **660,031 µs** | **9,189 µs** | **708.080 ms** | **183,884 KiB** |

- 这组同机配对数据中 v2 比 house 快约 **47.1%**、比 v1 快约 **27.5%**；9/9 轮 v2 比两者更快。数字不是官方沙箱 cpu_us，不可换算成榜单档位或宣称入围/获奖。
- G0 和初期优化期间的同机实验中曾观测到 housekeeping/系统抖动（null raw CPU MAD 可见）；正式表采用最后完整串行同核批次，保存 raw samples，而非挑最好的一轮。
- Docker 不可用；本地 Node 是 22.23.4，而 kit 表示服务器 harness 为 Node 26.13.1，且本地 process 没有隔离/image digest。故没有 pinned Docker 或正式 sandbox 预演；上述成绩仅支持同机工程选项比较。
- 2026-11-23 22:12 CST 最新 live snapshot：submission phase、7,006 entries；前四显示 0，第 6 显示 10,000，第 10 显示 30,000，WASM 标签条目在 #10 为 30,000。brief 冻结的原底线 40,000/小目标 30,000 并未由本 builder 自行改写；N 应独立决定竞争目标是否更新。当前本地 proxy 不是达标成绩。

## 选中/拒绝的纯 JS 改动

- 保留并提交：Markdown 逃逸/特殊符号融合扫描，Markdown 渲染用 parts/join 避免逐块累积长字符串；template include 在每个 case 预链接；front matter 无 CR 的快路及单遍分隔符/键值解析；report 计数去除额外 filter；tag 每来源只做一次 slugify、复用 name→slug 记录。
- 选择 tag slug 复用的证据：在 `../v2-work/full-tag-slug-once.json` 的配对 9 轮中，新版每轮 raw CPU 均快，差值中位 **7,145 µs**，输出哈希一致；并在 kit practice、21/30 个 generated、stress、slug/inline/front matter/template fuzz 后提交 `67560e7`。
- 记录但不采纳：ASCII slug 分支、tag/front matter/inline HTML 的缓存、重复 for-scope 对象复用、dir cache、prototype scope、front matter 两次扫描、template interpreter 组合/编译等试验没有持续配对收益或负收益；删除它们，未拼接入候选。

## 体积、剩余门与事项

- 当前已提交 entry code 在约 **42.9 KB** 量级（见 commit 文件）。加入 README/owner/其他必交物后仍须重算完整 repo 字节数；上限 4,194,304 bytes。
- 尚未完成提交前资格全套复核：duplicate snapshot/source bundle、license/readme/live badge、GitHub About/owner 条件、entry signature、quota、最终完整 bundle/check 和用户确认。没有 push、没有 submit。
- 若继续优化：开工前重新看 live 榜；只选择有 profile 证据、独立上下文可检验的纯 JS 更少工作方案；改后跑受影响的 fuzz/differential 和完整 kit grade，再做串行同核重复测量。若未达到经 N 确认的目标或官方可比性缺失，如实记录阻碍；不为了截止凑交。
