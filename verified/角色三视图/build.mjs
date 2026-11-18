/**
 * Qwen Image 2.1 文生图 · 都市美女 · 白底三视图三栏 · 四张候选
 *
 * 接线来源：跑在生产环境里的 rh1（workflowId 2112845992205840385）实测图
 *   UNETLoader qwen_image_2.1_int8_convrot → QwenImage21Cache → KSampler(cfg1/euler/simple/25)
 *   CLIPLoader qwen3vl_8b_int8_convrot (type=qwen_image)
 *   TextEncodeQwenImage21（正负条件一起出）
 *
 * 相对生产图做了两处简化（行为不变，只为让人看得懂）：
 *   1. 去掉 String→StringToInt 链，宽高/批次直接写成控件；
 *   2. 去掉 CR Prompt Text / PreviewAny，提示词直接写在文本编码节点上。
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（给网页导入）、workflow.api.json（给 rhx run 实测）
 */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const WIDTH = 1728;
const HEIGHT = 768;
const BATCH = 4;
const SEED = 20261119;
const STEPS = 25;
const CFG = 1;
const OUT_PREFIX = 'beauty_threeview';

// ---------------- 提示词 ----------------
// 人物设定按行拆开，改一行就换一个人设；负面里不含任何越线词。
const PROMPT = [
  '真实摄影，影棚白底，纯白背景 #FFFFFF。整张画布横向三等分，从左到右依次三格，三格等宽，格与格之间没有分隔线、没有文字、没有编号、没有水印。三格是同一位人物、同一套服装、同一双鞋、同一站姿、同一脚底线，人物高度一致，各自在本格内居中。',
  '主体：约 24 岁的中国女性，白净皮肤，鹅蛋脸，杏眼，黑色长直发及胸，发丝顺滑，裸妆，裸粉唇。',
  '服装：白色圆领针织打底衫，外披米色长风衣且不系扣，浅灰直筒长裤，白色平底乐福鞋。',
  '左格：正面胸部以上特写，五官清晰，正视镜头，神情平静微带笑意；头发与肩颈完整入画，头顶与左右两侧留足白边，任何部位都不碰画面边缘。',
  '中格：正面全身，服装展示专用的无头人台，从白色针织衫的圆领开始向下，只有衣身、袖子、长裤和鞋；圆领以上是干净的纯白背景，没有任何头部、没有头发、没有脖颈、没有断口，肩线平顺收口；双脚踩地，裤脚与鞋完整入画。',
  '右格：同一套服装的背面全身，完整带头与黑色长直发，头发自然垂到背部，看不到面部五官；背面与头顶自然衔接，无接缝、无镂空，风衣背面下摆、裤脚与鞋完整入画。',
  '镜头：50mm 平视，三格同一机位高度，人物全身与特写都清晰。',
  '光线：正面柔和均匀的棚拍光，白色背景干净平整，无渐变、无投影、无地面阴影。',
  '质感：真实皮肤纹理，服装面料细节清晰，无描边、无插画感。',
].join('\n');

// cfg=1 时负向分支不参与计算，写什么都无效 —— 留空，别留假参数
const NEGATIVE = '';

// ---------------- 节点表 ----------------
// widgets 数组的顺序 = inputs 里带 widget 标记的输入顺序（含 seed 后的 control_after_generate）
const nodes = [
  { key: 'unet', type: 'UNETLoader', title: '底座 · Qwen Image 2.1 bf16',
    pos: [0, 0], size: [400, 100],
    inputs: [
      { name: 'unet_name', type: 'COMBO', widget: 'unet_name' },
      { name: 'weight_dtype', type: 'COMBO', widget: 'weight_dtype' },
    ],
    outputs: [{ name: 'MODEL', type: 'MODEL' }],
    widgets: ['qwen_image_2.1_bf16_Raw.safetensors', 'default'] },

  { key: 'clip', type: 'CLIPLoader', title: '文本编码器 · Qwen3-VL 8B',
    pos: [0, 320], size: [400, 130],
    inputs: [
      { name: 'clip_name', type: 'COMBO', widget: 'clip_name' },
      { name: 'type', type: 'COMBO', widget: 'type' },
      { name: 'device', type: 'COMBO', widget: 'device' },
    ],
    outputs: [{ name: 'CLIP', type: 'CLIP' }],
    widgets: ['qwen3vl_8b_int8_convrot.safetensors', 'qwen_image', 'default'] },

  { key: 'vae', type: 'VAELoader', title: 'VAE',
    pos: [0, 510], size: [400, 80],
    inputs: [{ name: 'vae_name', type: 'COMBO', widget: 'vae_name' }],
    outputs: [{ name: 'VAE', type: 'VAE' }],
    widgets: ['qwen_image_2.1_vae_bf16.safetensors'] },

  { key: 'latent', type: 'EmptyLatentImage', title: '★ 改这里 · 画幅与候选张数（三格各 576×768）',
    red: true, pos: [0, 650], size: [400, 130],
    inputs: [
      { name: 'width', type: 'INT', widget: 'width' },
      { name: 'height', type: 'INT', widget: 'height' },
      { name: 'batch_size', type: 'INT', widget: 'batch_size' },
    ],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    widgets: [WIDTH, HEIGHT, BATCH] },

  { key: 'text', type: 'TextEncodeQwenImage21', title: '★ 改这里 · 提示词（三栏三视图）',
    red: true, pos: [460, 0], size: [720, 620],
    inputs: [
      { name: 'clip', type: 'CLIP' },
      { name: 'prompt', type: 'STRING', widget: 'prompt' },
      { name: 'negative_prompt', type: 'STRING', widget: 'negative_prompt' },
      { name: 'resolution', type: 'INT', widget: 'resolution' },
    ],
    outputs: [
      { name: 'positive', type: 'CONDITIONING' },
      { name: 'negative', type: 'CONDITIONING' },
      { name: 'latent', type: 'LATENT' },
    ],
    widgets: [PROMPT, NEGATIVE, 1024] },

  { key: 'ks', type: 'KSampler', title: '★ 改这里 · 种子（换一张就改它）',
    red: true, pos: [460, 680], size: [420, 260],
    inputs: [
      { name: 'model', type: 'MODEL' },
      { name: 'seed', type: 'INT', widget: 'seed' },
      { name: 'steps', type: 'INT', widget: 'steps' },
      { name: 'cfg', type: 'FLOAT', widget: 'cfg' },
      { name: 'sampler_name', type: 'COMBO', widget: 'sampler_name' },
      { name: 'scheduler', type: 'COMBO', widget: 'scheduler' },
      { name: 'positive', type: 'CONDITIONING' },
      { name: 'negative', type: 'CONDITIONING' },
      { name: 'latent_image', type: 'LATENT' },
      { name: 'denoise', type: 'FLOAT', widget: 'denoise' },
    ],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    widgets: [SEED, 'randomize', STEPS, CFG, 'euler', 'simple', 1.0] },

  { key: 'vdec', type: 'VAEDecode', title: 'VAE 解码',
    pos: [1240, 0], size: [240, 60],
    inputs: [
      { name: 'samples', type: 'LATENT' },
      { name: 'vae', type: 'VAE' },
    ],
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }] },

  { key: 'save', type: 'SaveImage', title: '输出（四张候选）',
    orange: true, pos: [1240, 120], size: [340, 300],
    inputs: [
      { name: 'images', type: 'IMAGE' },
      { name: 'filename_prefix', type: 'STRING', widget: 'filename_prefix' },
    ],
    outputs: [
      { name: 'image_urls', type: 'STRING' },
      { name: 'images', type: 'IMAGE' },
    ],
    widgets: [OUT_PREFIX] },

  { key: 'note', type: 'MarkdownNote', title: '说明',
    pos: [1240, 480], size: [560, 620],
    inputs: [],
    outputs: [],
    widgets: [''] },
];

const wires = [
  ['unet', 0, 'ks', 'model'],
  ['clip', 0, 'text', 'clip'],
  ['text', 0, 'ks', 'positive'],
  ['text', 1, 'ks', 'negative'],
  ['latent', 0, 'ks', 'latent_image'],
  ['ks', 0, 'vdec', 'samples'],
  ['vae', 0, 'vdec', 'vae'],
  ['vdec', 0, 'save', 'images'],
];

const note = `## 都市美女 · 白底三视图（Qwen Image 2.1 bf16 · 三栏一排）

**红块 = 你要改的三处**：提示词、画幅/张数、种子。
**橙块 = 输出**：点运行后按张落盘。

### 三栏契约
- 左：正面胸部以上特写，头部完整、四边留白；
- 中：正面全身的**无头人台**，圆领以上纯白，不许补头、不许画脖子断面；
- 右：背面全身，完整带头与发型，看不到脸。

### 怎么用
1. 提示词节点里是**写好的完整三栏描述**，直接跑就出图；换人只改「主体 / 服装」两行。
2. 一次出 **${BATCH} 张同提示词不同种子**，挑一张留下；不满意改种子再跑。
3. 画幅 ${WIDTH}×${HEIGHT}，三格各 576×768（每格 3:4，比例对齐参考图）；改比例时两边一起改。

### 常见返工
- 中格长出人头/头发：只改提示词压不住，改写「服装展示专用无头人台」这类正向句，或换种子重跑。
- 中格少穿外套：服装行要写全，且三格分别点名「风衣」。
- 头被画框裁断：左格加「四周留足白边」。

### 参数含义
- 底座 \`qwen_image_2.1_bf16_Raw\`：整精度，皮肤与发丝更细；代价是更慢、更吃显存。
- 步数 ${STEPS}、cfg ${CFG}、euler + simple：**cfg=1 时负向分支不参与计算，负向提示词框已清空**，写了也是死参数。
- 种子固定 ${SEED}；节点上选 randomize 可每跑一次换一张。
- 图里**没有 QwenImage21Cache 节点**：平台上每次任务可能落到不同机器，少一个可选节点就多一分「任何机器都能跑」的稳妥。`;

nodes.find((n) => n.key === 'note').widgets = [note];

// ---------------- 生成 UI ----------------
const byKey = new Map();
const uiNodes = [];
let id = 0;
for (const spec of nodes) {
  id += 1;
  const n = {
    id,
    type: spec.type,
    pos: spec.pos,
    size: spec.size,
    flags: {},
    order: 0,
    mode: 0,
    inputs: spec.inputs.map((i) => (i.widget
      ? { name: i.name, type: i.type, widget: { name: i.widget }, link: null }
      : { name: i.name, type: i.type, link: null })),
    outputs: spec.outputs.map((o) => ({ name: o.name, type: o.type, links: [] })),
    properties: { 'Node name for S&R': spec.type },
  };
  if (spec.title) n.title = spec.title;
  if (spec.red) { n.color = '#c0392b'; n.bgcolor = '#5b1f1f'; }
  if (spec.orange) { n.color = '#d35400'; n.bgcolor = '#5a3208'; }
  if (spec.widgets !== undefined) n.widgets_values = spec.widgets;
  byKey.set(spec.key, { spec, node: n });
  uiNodes.push({ key: spec.key, node: n });
}

const links = [];
let lid = 0;
for (const [srcKey, srcSlot, dstKey, dstName] of wires) {
  const s = byKey.get(srcKey).node;
  const d = byKey.get(dstKey).node;
  const so = s.outputs[srcSlot];
  if (!so) throw new Error(`${srcKey} 没有输出槽 ${srcSlot}`);
  const di = d.inputs.findIndex((i) => i.name === dstName);
  if (di < 0) throw new Error(`${dstKey}(${s.type}) 没有输入 ${dstName}`);
  lid += 1;
  links.push([lid, s.id, srcSlot, d.id, di, so.type]);
  so.links.push(lid);
  d.inputs[di].link = lid;
}

// 拓扑排序写 order
const indeg = new Map(uiNodes.map((o) => [o.node.id, 0]));
const adj = new Map(uiNodes.map((o) => [o.node.id, []]));
for (const l of links) { adj.get(l[1]).push(l[3]); indeg.set(l[3], indeg.get(l[3]) + 1); }
const q = uiNodes.filter((o) => indeg.get(o.node.id) === 0).map((o) => o.node.id);
const order = [];
while (q.length) {
  const nid = q.shift();
  order.push(nid);
  for (const nx of adj.get(nid)) {
    indeg.set(nx, indeg.get(nx) - 1);
    if (indeg.get(nx) === 0) q.push(nx);
  }
}
if (order.length !== uiNodes.length) throw new Error('接线有环');
const orderMap = new Map(order.map((nid, i) => [nid, i]));
for (const o of uiNodes) o.node.order = orderMap.get(o.node.id);

const ui = {
  id: randomUUID(),
  revision: 0,
  last_node_id: id,
  last_link_id: lid,
  nodes: uiNodes.map((o) => o.node),
  links,
  groups: [],
  config: {},
  extra: { ds: { scale: 0.72, offset: [80, 60] } },
  version: 0.4,
};

// ---------------- 生成 API（同一张图，给 rhx 实测） ----------------
const api = {};
for (const { spec } of byKey.values()) {
  const inputs = {};
  let wi = 0;
  for (const i of spec.inputs) {
    const w = wires.find((x) => x[2] === spec.key && x[3] === i.name);
    if (w) {
      const srcId = byKey.get(w[0]).node.id;
      inputs[i.name] = [String(srcId), w[1]];
    } else if (i.widget) {
      const val = spec.widgets[wi];
      wi += 1;
      inputs[i.name] = val;
    }
  }
  // KSampler 的 control_after_generate 不是真实控件，跳过
  if (spec.type === 'KSampler') {
    // widgets 顺序: seed, control, steps, cfg, sampler, scheduler, denoise
    inputs.seed = spec.widgets[0];
    inputs.steps = spec.widgets[2];
    inputs.cfg = spec.widgets[3];
    inputs.sampler_name = spec.widgets[4];
    inputs.scheduler = spec.widgets[5];
    inputs.denoise = spec.widgets[6];
  }
  if (spec.type === 'MarkdownNote') continue;
  api[String(byKey.get(spec.key).node.id)] = { class_type: spec.type, inputs, _meta: { title: spec.title } };
}

// ---------------- 自检 ----------------
const errs = [];
for (const n of ui.nodes) {
  const wi = n.inputs.filter((i) => i.widget);
  if (n.widgets_values !== undefined) {
    const want = wi.length + (n.type === 'KSampler' ? 1 : 0);
    if (wi.length && !(n.type === 'MarkdownNote') && n.widgets_values.length !== want) {
      errs.push(`${n.type}: widgets_values=${n.widgets_values.length} 期望 ${want}`);
    }
  }
  for (const i of n.inputs) {
    if (i.link !== null && !links.some((l) => l[0] === i.link && l[3] === n.id)) {
      errs.push(`${n.type}.${i.name} 的 link ${i.link} 在 links 里找不到`);
    }
  }
  if (n.type === 'SaveImage' && n.inputs.every((i) => i.link === null)) errs.push('SaveImage 没接线');
}
const reds = ui.nodes.filter((n) => n.color === '#c0392b').length;
const oranges = ui.nodes.filter((n) => n.color === '#d35400').length;
if (!reds) errs.push('没有红块');
if (!oranges) errs.push('没有橙块');
if (ui.nodes.some((n) => n.color === '#c0392b' && n.bgcolor === '#5a3208')) errs.push('节点同时是红橙');
if (errs.length) { console.error('[build] 自检失败:\n' + errs.join('\n')); process.exit(1); }

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(ui, null, 1));
writeFileSync(join(HERE, 'workflow.api.json'), JSON.stringify(api, null, 1));
console.log(`[build] ok  nodes=${ui.nodes.length} links=${links.length} red=${reds} orange=${oranges}`);
console.log(`[build] ${WIDTH}x${HEIGHT} batch=${BATCH} steps=${STEPS} cfg=${CFG} seed=${SEED}`);
