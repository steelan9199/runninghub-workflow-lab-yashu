/**
 * H3 单人换人 · 小丑04 楼梯舞全片（243 帧 / 10.083s）· LoRA bypass + 20 步 · 一采 · 无声
 *
 * 做法：源片当 ref_video_0 当运动/构图参考，人物三视图当 ref_image_0，
 * 采样走 `beta / 20 步 / denoise 1`，LoRA 4 步 turbo **bypass**（mode=4）不参与，
 * 一采直出 864×736，无放大、无二采。
 *
 * 为什么不开 turbo：4 步 turbo（strength 1.0）在长序列（300+ 帧）上会把冷色放大成
 * 浅蓝自发光，长袍、楼梯、扶手全裹青焰；同片关 LoRA 改 20 步即干净。
 * 详见 runninghub-workflow-lab-yashu/references/pitfalls.md「LoRA / 采样」。
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
const FRAMES = 243;        // 17×14+5；24fps → 10.083s
const WIDTH = 864;         // 32 的倍数
const HEIGHT = 736;        // 32 的倍数
const SEED = 20261115;
const OUT_PREFIX = 'joker04_all_243f_20step';

// ---------------- 采样档（本包唯一变量）----------------
const STEPS = 20;          // BasicScheduler.steps
const LORA_MODE = 4;       // 4 = bypass；恢复 4 步 turbo 时改 0 并把 STEPS 写 4
const LORA_STRENGTH = 1;   // LoraLoaderModelOnly.strength_model
const REFINER_EXTRA = 0;   // H3SigmaRefiner.extra_steps：关
const SPLIT_STEP = 999;    // SplitSigmas.step：不切，全部给一采

// 平台 fileName（约 1 天过期，重传 assets/ 后只换这里）
const ASSETS = {
  video: 'openapi/2f776886884cbefc0a2c3ded698d5ed7932912158102e236592f4dec906ec6f2.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const NOTE = `## 小丑04 · 楼梯舞全片 243 帧 · 单人换人 · 20 步（LoRA 已 bypass）· 无声

**唯一目的：把这条 10.083s 楼梯舞素材里的人换成同一个参考角色。**
243 帧 = 17×14+5；24fps / 864×736 / 源片带原声（本工作流输出无声，原声另合）。

### 素材事实（已抽帧核对，勿照旧描述写）
| 项 | 值 |
|---|---|
| 源片 | \`小丑04_243f.mp4\`，243 帧 / 10.083s / 864×736 / 24fps |
| 镜头 | 五镜硬切：0–2.42s 楼上平台近景/金属扶手斜穿右半幅；2.42–4.46s 台阶底部固定低机位广角仰视，长阶夹在两墙之间、顶部苍白天空；4.46–6.33s 高机位近俯视湿石阶，人仰面下滑再翻成跪爬；6.33–8.50s 低机位中近景，双臂高举后仰大笑；8.50–10.08s 高机位俯视近景，人面朝下横在台阶上滑出画面左下 |
| 收尾 | 不是站定：末帧只剩浅蓝袖子与一只裸手在左下角，其余是空台阶 |
| 注意 | 镜 1 机位在人物侧前方、约半身高度；镜 2 人物只占画面右下约 1/3 高；镜 4 才放大到腰以上 |

### 本版参数
- 节点 2：LoRA **bypass（mode=4）**，strength 留 1.0；恢复 4 步时改回 mode=0 并把节点 16 改 4 步
- 节点 16：beta / **20 步** / denoise 1
- 节点 15：length=243，864×736，ref_image_size=match；节点 8：frame_load_cap=243、skip_first_frames=0
- 节点 19：seed 20261115（fixed）
- 节点 17：refiner extra=0（关）；节点 18：split 999（不切）
- 节点 20：euler；无音轨

### 提示词要点
- 六段式，按五镜逐个写机位、景别、人物大小与动作；每镜开头先钉死「与源片同机位同大小」
- 身份锚点每段重复：金冠横簪 / 黑发髻 + 长直黑发 / 粗平黑眉 / 短黑须 / 长尖黑山羊胡 / 素颜 / 浅蓝棉袍 / 白交领 / 深蓝绣花门襟袖口 / 白裤黑鞋
- 材质句固定：\`plain woven cotton\`、\`flat matte\`、\`dull surface, natural creases\`
- 全程不写 ice / cool teal / rim / flare / bright / catching the light / silver

### 判读标准
- **通过**：无浅蓝自发光；身份不崩；五镜机位/景别/人物大小跟随源片；末帧是俯视只剩袖与手，不是站定
- **半通过**：镜 3/5 俯视身份漂 → 同 seed 重跑一次；仍漂 → 步数 20 → 24
- **不通过**：退回小丑红西装 → 检查 ref_image_0 是否只剩一张图

### 跑之前
- 平台左上会烧「RunningHub AI生成」水印
- 源片 / 参考图的 openapi/ fileName 约 1 天过期，过期重传后填回节点 8 / 9
- 输出无声，原声回贴：
  \`ffmpeg -i 出片.mp4 -i 小丑04_243f.mp4 -map 0:v -map 1:a -c:v copy -c:a copy out.mp4\``;

const j = JSON.parse(readFileSync(BASE, 'utf8'));
const byId = new Map(j.nodes.map((n) => [n.id, n]));
const N = (id) => {
  const n = byId.get(id);
  if (!n) throw new Error(`模板里没有节点 #${id}`);
  return n;
};

// ---- 素材 ----
N(8).widgets_values.video = ASSETS.video;
N(8).widgets_values.frame_load_cap = FRAMES;
N(8).widgets_values.skip_first_frames = 0;
N(8).title = '★ 源片 · 小丑04 全片 243f（10.083s）';
N(9).widgets_values[0] = ASSETS.renwu2_sheet;
N(10).widgets_values[0] = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
N(11).widgets_values[0] = WIDTH;
N(13).widgets_values[0] = HEIGHT;
N(15).widgets_values[1] = WIDTH;
N(15).widgets_values[2] = HEIGHT;
N(15).widgets_values[3] = FRAMES;
N(15).title = 'MiniMax H3 参考生视频（243 帧 / 864×736）';
N(19).widgets_values[0] = SEED;
N(25).widgets_values.filename_prefix = OUT_PREFIX;

// ---- 采样档 ----
N(2).mode = LORA_MODE;
N(2).widgets_values[1] = LORA_STRENGTH;
N(16).widgets_values[1] = STEPS;
N(16).widgets_values[2] = 1;
N(17).widgets_values[0] = REFINER_EXTRA;
N(18).widgets_values[0] = SPLIT_STEP;

// ---- 说明卡 ----
N(26).widgets_values[0] = NOTE;

// ---- 配色：红 = 要改的，橙 = 输出 ----
N(11).color = '#c0392b';
N(11).bgcolor = '#5b1f1f';
N(11).title = '★ 改这里 · 出片宽（32 的倍数）';
N(13).color = '#c0392b';
N(13).bgcolor = '#5b1f1f';
N(13).title = '★ 改这里 · 出片高（32 的倍数）';

// ---- 导出工具留下的冗余缓存：丢弃 ----
for (const n of j.nodes) delete n.widgets_values_named;

// ---- 帧数必须落在 17k+5 网格 ----
if ((FRAMES - 5) % 17 !== 0) throw new Error(`FRAMES=${FRAMES} 不在 17k+5 网格`);

j.nodes.forEach((n, i) => { n.order = i; });

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 1));
console.log(`workflow.ui.json：${j.nodes.length} 节点 / ${j.links.length} 连线`);
