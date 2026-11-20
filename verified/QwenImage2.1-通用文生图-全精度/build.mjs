/**
 * Qwen Image 2.1 文生图 · 都市御姐网红 · 竖屏 9:16 四张候选
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

const WIDTH = 832;
const HEIGHT = 1472;
const BATCH = 4;
const SEED = 20261120;
const STEPS = 25;
const CFG = 1;
const OUT_PREFIX = 'qwen_t2i_yujie';

// ---------------- 提示词 ----------------
// 人物设定按行拆开，改一行就换一个人设；负面里不含任何越线词。
const PROMPT = [
  '真实摄影，现代都市人像。',
  '主体：约 24 岁的中国女性，白净皮肤，圆脸，杏眼，空气刘海，发尾微卷的齐肩发，身形娇小。',
  '身材：肩窄腰细，胸部小巧饱满挺立，腰线清晰，腿型匀称。',
  '姿态：靠墙单脚点地，一只手插在高腰牛仔裤口袋，另一只手拎小包垂在身侧，一侧肩膀放松下沉。',
  '妆造：水光底妆，裸粉唇，淡粉腮红，卧蚕明显，裸色甲油。',
  '服装：白色罗纹针织短背心，方领，下摆刚到腰线；浅蓝丹宁短外套敞开穿着、不系扣；高腰直筒牛仔裤，腰头收线；银色细带凉鞋；一只酒红漆皮小包。',
  '场景：便利店门口街角，霓虹灯牌在身后虚化成色块，门内白光从正面打来。',
  '镜头：35mm，大腿以上的中景，略微仰视，浅景深。',
  '神情：嘴角微扬，眼神带一点挑衅的松弛，直视镜头。',
  '光线：门内白光作正面主光，霓虹只作彩色边缘光，面部不背光。',
  '质感：轻微颗粒，肤色通透，夜街地面有湿亮反光。',
].join('\n');

// cfg=1 时负向分支不参与计算，写什么都无效 —— 留空，别留假参数
const NEGATIVE = '';

// ---------------- 节点表 ----------------
// widgets 数组的顺序 = inputs 里带 widget 标记的输入顺序（含 seed 后的 control_after_generate）
const nodes = [
  { key: 'unet', type: 'UNETLoader', title: '底座 · Qwen Image 2.1 int8',
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

  { key: 'latent', type: 'EmptyLatentImage', title: '★ 改这里 · 画幅与候选张数',
    red: true, pos: [0, 650], size: [400, 130],
    inputs: [
      { name: 'width', type: 'INT', widget: 'width' },
      { name: 'height', type: 'INT', widget: 'height' },
      { name: 'batch_size', type: 'INT', widget: 'batch_size' },
    ],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    widgets: [WIDTH, HEIGHT, BATCH] },

  { key: 'text', type: 'TextEncodeQwenImage21', title: '★ 改这里 · 提示词（中文直接写）',
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

const note = `## 都市美女 · 网红人像（Qwen Image 2.1 bf16 · 竖屏 9:16）

**红块 = 你要改的三处**：提示词、画幅/张数、种子。
**橙块 = 输出**：点运行后按张落盘。

### 怎么用
1. 提示词节点里是**写好的完整人设**，直接跑就出图；改哪一行就换哪一块（脸型 / 发型 / 服装 / 场景 / 光线各一行）。
2. 一次出 **${BATCH} 张同提示词不同种子**，挑一张留下；不满意改种子再跑。
3. 画幅 ${WIDTH}×${HEIGHT}（约 9:16），宽高都取 16 的倍数；改比例时两边一起改，别只改一边。

### 当前人设
甜酷纯欲 · 街角便利店。想换人只改「主体 / 身材 / 妆造 / 服装 / 场景」五行。

### 尺度口径
只到「高级性感」：露一处，靠材质垂坠、收腰线与正面光造氛围，不靠露。
露点、暗示性姿势一律不写——平台会拦，拦了不是参数问题。

### 参数含义
- 底座 \`qwen_image_2.1_bf16_Raw\`：整精度，皮肤与发丝比 int8 版更细；代价是更慢、更吃显存。
- 步数 ${STEPS}、cfg ${CFG}、euler + simple：**cfg=1 时负向分支不参与计算，负向提示词框已清空**，写了也是死参数。
- 种子固定 ${SEED}；节点上选 randomize 可每跑一次换一张。
- 图里**没有 QwenImage21Cache 节点**：平台上每次任务可能落到不同机器，少一个可选节点就多一分「任何机器都能跑」的稳妥。

### 想更清晰
bf16 底座本身细节已足；真要更大图，把画幅提到 1024×1792 再跑，或另接放大二采。`;

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
