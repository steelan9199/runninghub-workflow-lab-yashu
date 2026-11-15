/**
 * H3 单人换人 · 远景楼梯舞 · 4 步 turbo · 一采 · 无声
 *
 * 做法：原片当 ref_video_0 给 H3 当运动参考，人物三视图当 ref_image_0，
 * 打开 `minimax_h3_turbo_4step_ckpt500`（strength 1.0）+ beta 4 步、denoise 1，
 * 一采直出 864×736，不做二采、不做放大。
 *
 * **4 步 turbo 是本包的默认档。** 同种子/同提示词/同参考图的 20 步版成本约 5 倍，
 * 身份与动作没有明显提升（实测数据见 record.md），只在细节救援时才把 LoRA 关掉改 20 步。
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 124;        // 17k+5；24fps → 5.1667s
const WIDTH = 864;         // 32 的倍数
const HEIGHT = 736;        // 32 的倍数
const SEED = 20261115;
const OUT_PREFIX = 'joker02_shot1_124f_turbo4';

// ---------------- 4 步 turbo 契约（本包的唯一变量，别随手改）----------------
const STEPS = 4;           // BasicScheduler.steps
const LORA_STRENGTH = 1;   // LoraLoaderModelOnly.strength_model（节点必须有 mode 0，不是 bypass）
const REFINER_EXTRA = 0;   // H3SigmaRefiner.extra_steps：关掉，保证正好 4 步
const SPLIT_STEP = 999;    // SplitSigmas.step：不切，全部给一采

// 平台 fileName（约 1 天过期，重传只换这里）
const ASSETS = {
  video: 'openapi/e2770006a186f04e43b919bcec241c3a4912e1a07bca065026d52aba29b34c65.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const NOTE = `## 镜1 · 远景楼梯舞 · 124 帧 · 单人换人 · 4 步 turbo · 无声

> **这是把人物替换成功的那条工作流**（2026-11-16 入库，平台 taskId 2122038682545520641）。

### ① 这个包干什么
把原片里的人整身换成参考图人物：**动作、镜头、楼梯与砖墙背景保持原样**，只换人。
默认参数就是跑通的那一版，导入后不用改，直接运行。

### ② 唯一变量：LoRA 开 + 4 步
| 项 | 本包（成功版） | 对照版 |
|---|---|---|
| LoRA · 4 步 turbo | **启用（strength 1.0）** | bypass |
| 调度器 | **beta / 4 步** | beta / 20 步 |
| H3SigmaRefiner | extra=0（关） | extra=0 |
| SplitSigmas | 999（不切） | 同 |
| 提示词 / 参考图 / seed / 帧长 | 一字不改、同图、同 seed | 同 |

20 步版成本约 5 倍，身份与动作没有明显提升 → **4 步为默认档，20 步留作细节救援档**。

### ③ 默认参数（跑通那一版）
- 源片：\`shot1_124f.mp4\`，864×736，\`frame_load_cap=124\`，\`skip_first_frames=0\`
- 生成尺寸：864×736（一采直出，无放大、无二采）
- 采样：euler + beta 4 步 + denoise 1；refiner 关、split 999
- 噪声：fixed \`20261115\`
- 参考图：人物三视图 → \`ref_image_0\`
- 输出：24fps、\`video/h264-mp4\`、\`yuv420p\`、crf 19、**无音轨**

### ④ 已知限制
- 尾 5 帧是克隆补帧（17k+5 网格补齐，无新画面）
- 平台左上会烧「RunningHub AI生成」水印
- 远景人物占比小，金冠等细部需要放大肉眼确认
- 背景细节（蓝灯柱、消防梯）相对原片有轻微漂移
- **无声**：原声要从源片音轨另取再合

### 跑之前
- 红块 = 你要改的（源片 / 参考图 / 提示词 / 宽 / 高）；橙块 = 输出节点
- 平台 fileName 约 1 天过期，过期从本包 \`assets/\` 重传后把新名字填回节点
- 想更清晰：把宽高改大（32 的倍数）或改用二采包；想更省：保持 4 步不要动`;

const j = JSON.parse(readFileSync(BASE, 'utf8'));
const byId = new Map(j.nodes.map((n) => [n.id, n]));
const N = (id) => {
  const n = byId.get(id);
  if (!n) throw new Error(`模板里没有节点 #${id}`);
  return n;
};

// ---- 素材与图内参数 ----
N(8).widgets_values.video = ASSETS.video;
N(8).widgets_values.frame_load_cap = FRAMES;
N(8).widgets_values.skip_first_frames = 0;
N(9).widgets_values[0] = ASSETS.renwu2_sheet;
N(10).widgets_values[0] = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
N(11).widgets_values[0] = WIDTH;
N(13).widgets_values[0] = HEIGHT;
N(15).widgets_values[1] = WIDTH;
N(15).widgets_values[2] = HEIGHT;
N(15).widgets_values[3] = FRAMES;
N(19).widgets_values[0] = SEED;
N(25).widgets_values.filename_prefix = OUT_PREFIX;

// ---- 4 步 turbo 契约 ----
N(2).mode = 0;                                       // LoRA 启用（4 = bypass）
N(2).widgets_values[1] = LORA_STRENGTH;
N(16).widgets_values[1] = STEPS;
N(16).widgets_values[2] = 1;                         // denoise 1：整段重绘，换人更彻底
N(17).widgets_values[0] = REFINER_EXTRA;
N(18).widgets_values[0] = SPLIT_STEP;

// ---- 说明卡 ----
N(26).widgets_values[0] = NOTE;

// ---- 配色 / 标题：红 = 要改的，橙 = 输出（见 SKILL.md §4.1）----
N(11).color = '#c0392b';
N(11).bgcolor = '#5b1f1f';
N(11).title = '★ 改这里 · 出片宽（32 的倍数）';
N(13).color = '#c0392b';
N(13).bgcolor = '#5b1f1f';
N(13).title = '★ 改这里 · 出片高（32 的倍数）';

// ---- 导出工具留下的冗余缓存：源文件里已与 widgets_values 脱节（旧片名 / 107 帧 / 20 步），丢弃 ----
for (const n of j.nodes) delete n.widgets_values_named;

// ---- 帧数必须落在 17k+5 网格 ----
if ((FRAMES - 5) % 17 !== 0) throw new Error(`FRAMES=${FRAMES} 不在 17k+5 网格`);

j.nodes.forEach((n, i) => { n.order = i; });

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 1));
console.log(`workflow.ui.json：${j.nodes.length} 节点 / ${j.links.length} 连线`);
