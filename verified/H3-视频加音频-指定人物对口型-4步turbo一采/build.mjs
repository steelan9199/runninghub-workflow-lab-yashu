/**
 * H3 视频 + 指定音频 → 左边人物对口型（shot2 胡宗宪·内阁通过）
 *
 * 底座：诺曼/02/templates/base_onepass.ui.json（H3 Ref2VA 一采 864×736，已验证同尺寸）
 * 新增：LoadAudio + VRGDG_MiniMaxH3AudioDrive（来自 corpus/wf_2084814218431385601）
 *        + VHS_LoadVideo → ref_video_0（原片作表演参考）
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');
const DRIVE = join(HERE, 'templates/drive.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 90;                  // 17*5+5，24fps → 3.750s（音频 3.336s，尾部多出的静音后期裁掉）
const WIDTH = 864;
const HEIGHT = 736;
const SEED = 20261117;
const OUT_PREFIX = 'shot2_h3_voice';

// 平台 fileName（约 24 小时过期，重传只换这里）
const ASSETS = {
  video: 'openapi/5898c4d367c0dbc9984a7d12b17750cb33143f83b6dbfa6af1dde9bf80d808ce.mp4',
  image: 'openapi/a7da64637f71e43260f24ea789f4a71564c2fce2c96b6830e74d69953fc7123c.png',
  audio: 'openapi/6a0e58a8496315bc05e08376f5e771ae2e08c357f15f5651d8e1f43788151480.mp3',
};

const TPL = new Map();
for (const n of JSON.parse(readFileSync(BASE, 'utf8')).nodes) {
  if (!TPL.has(n.type)) TPL.set(n.type, n);
}
for (const n of JSON.parse(readFileSync(DRIVE, 'utf8')).nodes) {
  TPL.set(n.type, n);
}

const PROMPT = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();

// ---------------- 节点表 ----------------
const nodes = [
  { key: 'unet', type: 'UNETLoader', title: 'UNET · ref2va int8', x: 0, y: 0, size: [380, 90],
    widgets: ['minimax_h3_ref2va_int8_convrot.safetensors', 'default'] },
  { key: 'lora', type: 'LoraLoaderModelOnly', title: 'LoRA · 4 步 turbo', x: 0, y: 140, size: [380, 90],
    widgets: ['minimax_h3_turbo_4step_ckpt500.safetensors', 1.0] },
  { key: 'sage', type: 'PathchSageAttentionKJ', title: 'SageAttention', x: 0, y: 280, size: [380, 90],
    widgets: ['auto', false] },
  { key: 'patch', type: 'MiniMaxH3MemoryEfficientSageAttentionPatch', title: '显存优化补丁', x: 0, y: 420, size: [380, 70] },
  { key: 'clip', type: 'CLIPLoader', title: 'CLIP', x: 0, y: 540, size: [380, 110],
    widgets: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors', 'minimax', 'default'] },
  { key: 'vaeV', type: 'VAELoader', title: '视频 VAE', x: 0, y: 700, size: [380, 60],
    widgets: ['minimax_h3_video_vae_fp16.safetensors'] },
  { key: 'vaeA', type: 'VAELoader', title: '音频 VAE', x: 0, y: 800, size: [380, 60],
    widgets: ['minimax_h3_audio_vae_fp32.safetensors'] },

  // 输入
  { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 原片（要给它换口型的那条视频）', red: true,
    x: 460, y: 0, size: [420, 500],
    widgets: { video: ASSETS.video, frame_load_cap: FRAMES } },
  { key: 'img', type: 'LoadImage', title: '★ 改这里 · 首帧（锁身份用）', red: true,
    x: 460, y: 540, size: [300, 320], widgets: [ASSETS.image, 'image'] },
  { key: 'audio', type: 'LoadAudio', title: '★ 改这里 · 配音音频（谁说话就用谁的音轨）', red: true,
    x: 460, y: 900, size: [420, 140], widgets: [ASSETS.audio, null] },
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
    x: 460, y: 1100, size: [620, 420], widgets: [PROMPT] },

  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1140, y: 520, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1140, y: 660, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1140, y: 800, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1140, y: 940, size: [300, 110], widgets: ['a'] },

  // 生成
  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
    x: 1500, y: 0, size: [340, 560], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },
  { key: 'ad', type: 'VRGDG_MiniMaxH3AudioDrive', title: '音频写进潜空间 → 口型跟着这条音轨',
    x: 1500, y: 620, size: [340, 160] },

  // 一采
  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1900, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1900, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分 4：全部给一采', x: 1900, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子', x: 1900, y: 480, size: [300, 90], widgets: [SEED, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1900, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器', x: 1900, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（4 步 @864×736，直出）', x: 2260, y: 0, size: [260, 160] },

  // 输出
  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 2560, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 2560, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（配音音轨）', orange: true, x: 2560, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 2980, y: 0, size: [520, 760], widgets: [''] },
];

const wires = [
  ['unet', 0, 'lora', 'model'],
  ['lora', 0, 'sage', 'model'],
  ['sage', 0, 'patch', 'model'],
  ['patch', 0, 'sched', 'model'],
  ['patch', 0, 'guider', 'model'],

  ['wv', 0, 'w', 'values.a'],
  ['hv', 0, 'h', 'values.a'],
  ['w', 1, 'r2v', 'width'],
  ['h', 1, 'r2v', 'height'],
  ['prompt', 0, 'r2v', 'prompt'],
  ['img', 0, 'r2v', 'ref_images.ref_image_0'],
  ['video', 0, 'r2v', 'ref_videos.ref_video_0'],
  ['clip', 0, 'r2v', 'clip'],
  ['vaeV', 0, 'r2v', 'vae'],
  ['vaeA', 0, 'r2v', 'audio_vae'],

  ['sched', 0, 'refiner', 'sigmas'],
  ['refiner', 0, 'split', 'sigmas'],
  ['split', 0, 'pass1', 'sigmas'],
  ['noise', 0, 'pass1', 'noise'],
  ['ksel', 0, 'pass1', 'sampler'],
  ['r2v', 0, 'guider', 'conditioning'],
  ['guider', 0, 'pass1', 'guider'],

  // 音频驱动：潜空间换成带音轨的那一版
  ['r2v', 1, 'ad', 'av_latent'],
  ['audio', 0, 'ad', 'source_audio'],
  ['vaeA', 0, 'ad', 'audio_vae'],
  ['ad', 0, 'pass1', 'latent_image'],

  ['pass1', 1, 'vdec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vdec', 0, 'vdbg', 'any_input'],
  ['vdbg', 0, 'out', 'images'],
  ['ad', 1, 'out', 'audio'],
];

const note = `## H3 视频 + 指定音频 → 左边人物对口型

**红块 = 你要换的**：原片、首帧、配音、提示词。**橙块 = 输出**。

### 链路
1. 原片 \`VHS_LoadVideo\` 截 ${FRAMES} 帧 → H3 的 \`ref_video_0\`，提供构图、坐姿、光影、镜头。
2. 首帧 → \`ref_image_0\`，锁住两个人的身份与服饰。
3. 配音 → \`VRGDG_MiniMaxH3AudioDrive\`，**音频直接写进潜空间**，口型跟着这条音轨走（不靠提示词编台词）。
4. 一采 4 步 ${WIDTH}×${HEIGHT} → 24fps mp4，**音轨就是第 3 步这条配音**。

### 换片时改 build.mjs 顶部
- \`FRAMES\` 必须落在 **17k+5**（56/73/90/107…），且与 \`frame_load_cap\` 一致。
- \`WIDTH/HEIGHT\` 填 **32 的倍数**，且与源片同比例，否则画面会被拉变形。
- 音频比画面短时，尾部会补静音；成品要等长就在后期裁掉尾巴（本片 3.75s 裁到 3.375s）。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图」不是接线错，重传后改 \`ASSETS\`：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地文件>"
\`\`\`

### 验收看什么
抽 0 / 1.5 / 3.0 秒三帧：① 左边那位嘴在动、口型跟句子对得上 ② 右边那位嘴形不变、不抢戏
③ 两顶官帽、龙纹补子、胡须不变形 ④ 镜头没推拉、构图没跳 ⑤ 画面里没有多出第三个人。`;

nodes.find((n) => n.key === 'note').widgets = [note];

// ---------------- 生成 ----------------
const byKey = new Map();
const outNodes = [];
let id = 0;
for (const spec of nodes) {
  const t = TPL.get(spec.type);
  if (!t) throw new Error(`模板里没有 ${spec.type}`);
  id += 1;
  const n = JSON.parse(JSON.stringify(t));
  n.id = id;
  n.type = spec.type;
  n.order = 0;
  n.mode = 0;
  n.flags = {};
  n.pos = [spec.x, spec.y];
  if (spec.size) n.size = spec.size;
  if (spec.title) n.title = spec.title; else delete n.title;
  delete n.color;
  delete n.bgcolor;
  if (spec.red) { n.color = '#c0392b'; n.bgcolor = '#5b1f1f'; }
  if (spec.orange) { n.color = '#d35400'; n.bgcolor = '#5a3208'; }
  delete n.widgets_values_named;
  if (n.properties) {
    delete n.properties.ttNbgOverride;
    delete n.properties['Node name for S&R'];
    delete n.properties.widget_ue_connectable;
    if (!Object.keys(n.properties).length) delete n.properties;
  }
  for (const i of n.inputs || []) i.link = null;
  for (const o of n.outputs || []) o.links = [];
  if (!n.inputs) n.inputs = [];
  if (!n.outputs) n.outputs = [];
  if (spec.widgets !== undefined) {
    const base = n.widgets_values;
    if (spec.widgets && typeof spec.widgets === 'object' && !Array.isArray(spec.widgets)
      && base && typeof base === 'object' && !Array.isArray(base)) {
      n.widgets_values = { ...base, ...spec.widgets };
    } else {
      n.widgets_values = spec.widgets;
    }
  }
  if (n.widgets_values && typeof n.widgets_values === 'object' && !Array.isArray(n.widgets_values)) {
    delete n.widgets_values.videopreview;
  }
  const wi = (n.inputs || []).filter((i) => i.widget && i.widget.name);
  if (Array.isArray(n.widgets_values) && wi.length) {
    if (wi.length === n.widgets_values.length) {
      n.widgets_values_named = Object.fromEntries(wi.map((i, k) => [i.widget.name, n.widgets_values[k]]));
    } else if (n.widgets_values.length === wi.length + 1) {
      const named = Object.fromEntries(wi.map((i, k) => [i.widget.name, n.widgets_values[k]]));
      named['control_after_generate'] = n.widgets_values[wi.length];
      n.widgets_values_named = named;
    }
  }
  byKey.set(spec.key, n);
  outNodes.push({ key: spec.key, node: n });
}

// 模板只声明了部分 ref_video 槽，缺的补在 ref_videos 段末尾
const r2vNode = byKey.get('r2v');
for (const name of ['ref_videos.ref_video_0']) {
  if (!r2vNode.inputs.some((i) => i.name === name)) {
    const at = r2vNode.inputs.findIndex((i) => i.name.startsWith('ref_videos'));
    r2vNode.inputs.splice(at < 0 ? r2vNode.inputs.length : at, 0, { name, type: 'IMAGE', link: null });
  }
}

const links = [];
let lid = 0;
for (const [srcKey, srcSlot, dstKey, dstName] of wires) {
  const s = byKey.get(srcKey);
  const d = byKey.get(dstKey);
  if (!s) throw new Error(`没有节点 ${srcKey}`);
  if (!d) throw new Error(`没有节点 ${dstKey}`);
  const so = s.outputs[srcSlot];
  if (!so) throw new Error(`${srcKey} 没有输出槽 ${srcSlot}`);
  const di = d.inputs.findIndex((i) => i.name === dstName);
  if (di < 0) throw new Error(`${dstKey}(${d.type}) 没有输入 ${dstName}；现有：${d.inputs.map((i) => i.name).join(',')}`);
  lid += 1;
  links.push([lid, s.id, srcSlot, d.id, di, so.type]);
  so.links.push(lid);
  d.inputs[di].link = lid;
}

const indeg = new Map(outNodes.map((o) => [o.node.id, 0]));
const adj = new Map(outNodes.map((o) => [o.node.id, []]));
for (const l of links) {
  adj.get(l[1]).push(l[3]);
  indeg.set(l[3], indeg.get(l[3]) + 1);
}
const q = outNodes.filter((o) => indeg.get(o.node.id) === 0).map((o) => o.node.id);
const order = [];
while (q.length) {
  const nid = q.shift();
  order.push(nid);
  for (const nx of adj.get(nid)) {
    indeg.set(nx, indeg.get(nx) - 1);
    if (indeg.get(nx) === 0) q.push(nx);
  }
}
if (order.length !== outNodes.length) throw new Error('接线有环');
const orderMap = new Map(order.map((nid, i) => [nid, i]));
for (const o of outNodes) o.node.order = orderMap.get(o.node.id);

const doc = {
  id: randomUUID(),
  revision: 0,
  last_node_id: id,
  last_link_id: lid,
  nodes: outNodes.map((o) => o.node),
  links,
  groups: [],
  config: {},
  extra: { ds: { scale: 0.5, offset: [600, 500] } },
  version: 0.4,
};

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(doc, null, 1));
console.log(`workflow.ui.json  nodes=${doc.nodes.length} links=${links.length} ${WIDTH}x${HEIGHT} / ${FRAMES} 帧`);
