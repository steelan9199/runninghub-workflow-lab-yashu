/**
 * H3 双人换人 · 二采版 UI 工作流生成器
 *
 * 底座：老板从 RunningHub 导出的「视频编辑 双人替换 MiniMaxH3」单采 4 步图
 * 采样段：替换为 runninghub-workflow-lab-yashu/verified/H3-two-pass-ref2va 的二采结构
 *        （一采低清 → 只放大视频潜空间 2× → 二采收尾）
 *
 * 用法：node build.mjs
 * 产物：dist/H3_duet_replace_twopass.ui.json（可直接导入 RunningHub）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_duet_replace.ui.json');
const SUPP = join(HERE, 'templates/twopass_source.ui.json');
const OUT_DIR = join(HERE, 'dist');

const TPL = new Map();
for (const f of [BASE, SUPP]) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  for (const n of j.nodes) if (!TPL.has(n.type)) TPL.set(n.type, n);
}

// ---------------- 可调常量 ----------------
const FRAMES = 141;                 // 17*8+5，24fps → 5.875s
const WIDTH = 832;                  // 源片 842 宽，向下取 32 的倍数
const HEIGHT = 704;                 // 源片 720 高，向下取 32 的倍数
const UPSCALE = 2;
const SEED = 20261113;
const OUT_PREFIX = 'h3_duet_twopass';

// 平台 fileName（上传后回填；约 24 小时过期，重传见 note）
const ASSETS = {
  video: 'openapi/ecf10e3080d819372f33f8de0448a35d8cf62d33edd909d22c1b41da802491aa.mp4',
  ref1Full: 'openapi/5bade78c180a6c7bff3e9f7293fdd9b7f29515a918bce8bca544b907673dd105.png',
  ref2Body: 'openapi/6338b1a140792fd3f3e8ade473246c0cb01b88ec45f0cb15ae23d0f501f6c045.png',
  ref1Face: 'openapi/9145ba203c9b711826224ce8f37fe2584e822d9af9f656562da5ea59ceb624e9.png',
  ref2Face: 'openapi/3daceebc09d0e10e8fbab86de5106cdca8f275dfab04d1aaaf8fdbf78ce2acf3.png',
};

const P = `subject_definitions:
<Video 1> is the source video for the target video edit: a 5.88-second office conversation built from three hard cuts of tight close-ups on two men in dark suits, shot on a long lens with a mostly locked-off handheld camera against a plain grey office wall.
<Subject 1> is the elderly Chinese official whose appearance comes from <Picture 1> (full body) and <Picture 2> (face close-up): a thin white beard, deep wrinkles, a black and gold Ming-style hat, a gold-trimmed collar and a deep red robe with a gold dragon and cloud pattern across the chest. He appears in [Shot 1] and [Shot 3].
<Subject 2> is the middle-aged Chinese man whose appearance comes from <Picture 3> (front view) and <Picture 4> (face close-up): long black hair, a small gold crown, a moustache and a goatee, and a pale blue robe with blue embroidered lapels. He appears in [Shot 2].
<Audio 1> is the synchronized audio track of <Video 1> and is reused unchanged in the target video, containing both men's English dialogue.

summary:
[video editing + audio reuse] The target video is an edited version of <Video 1>: both men in the source are replaced by <Subject 1> and <Subject 2>, while the three-shot edit, the close-up framing, the facial performance, the lip-sync and the rise out of the chair stay identical, and <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (cut and performance structure): fully_preserved - the cut points at 0.00, 0.458 and 4.00 seconds, the tight close-up framing, the slight handheld drift, the grey office background, every facial action (brow raises, eye direction, blink timing, jaw and lip shapes while speaking), and the body lift at the end of [Shot 3] are reproduced.
<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - the white beard, the black and gold hat, the gold-trimmed collar and the red dragon robe stay identical to <Picture 1> and <Picture 2>.
<Subject 2> (appears in [Shot 2]): fully_preserved - the long black hair, the gold crown, the moustache and the pale blue robe with embroidered lapels stay identical to <Picture 3> and <Picture 4>.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage shot on a long lens in tight close-up, shallow depth of field, soft overhead office light from slightly screen left, visible skin pores and beard strands, fine film grain, and a flat grey-green wall behind both men.
[Shot 1] A tight close-up frames <Subject 1> at a slight three-quarter angle, his eyes turned to screen left and away from the lens, mouth slightly open as he listens. The black hat, the red robe collar and the top of a dark leather chair back sit behind his neck inside the frame. His head stays nearly still and only his eyes move; this shot lasts only eleven frames.
[Shot 2] At 00:00.458, the shot cuts to a tight close-up of <Subject 2> (S1), who begins speaking with his eyes turned to screen right. Around one second he brings his gaze back to screen left while his lips keep moving, and around three seconds he turns his eyes to screen right again, without stopping the sentence. His brows lift on the stressed words and his jaw works through each phrase, while the pale blue robe and embroidered lapels stay steady on his shoulders.
[Shot 3] At 00:04.000, the shot cuts back to <Subject 1>, now with his eyes wide, brows raised and mouth open, holding a stunned expression for about a second. He then pushes himself up out of the chair: his shoulders and head rise toward the lens while the camera stays locked on his face and does not tilt or pull back, so the dark chair back behind his neck slides down and out of the bottom of the frame. By the middle of the shot the chair is no longer visible behind him, and he keeps rising with his mouth open and his gaze fixed off the lens until the final frame.
Throughout all three shots the camera keeps only the slight handheld drift of <Video 1>, with no zoom, no reframing, no cutaway, and no other person entering the frame.

overall_soundscape:
Quiet office room tone with a faint ventilation hum, carried by <Audio 1> and continuing unchanged through all three shots.

non_diegetic_music:
N/A`;

// ---------------- 节点表 ----------------
const nodes = [
  // 模型链
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
  { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 参考视频（要换人的原片）', red: true,
    x: 460, y: 0, size: [420, 500],
    widgets: { video: ASSETS.video, frame_load_cap: FRAMES } },
  { key: 'img1', type: 'LoadImage', title: '★ 改这里 · 人物1 全身（红袍老者）', red: true,
    x: 460, y: 540, size: [300, 300], widgets: [ASSETS.ref1Full, 'image'] },
  { key: 'img2', type: 'LoadImage', title: '★ 改这里 · 人物1 脸部特写', red: true,
    x: 780, y: 540, size: [300, 300], widgets: [ASSETS.ref1Face, 'image'] },
  { key: 'img3', type: 'LoadImage', title: '★ 改这里 · 人物2 全身（蓝袍男子）', red: true,
    x: 460, y: 880, size: [300, 300], widgets: [ASSETS.ref2Body, 'image'] },
  { key: 'img4', type: 'LoadImage', title: '★ 改这里 · 人物2 脸部特写', red: true,
    x: 780, y: 880, size: [300, 300], widgets: [ASSETS.ref2Face, 'image'] },
  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 460, y: 1220, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 780, y: 1220, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 460, y: 1360, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 780, y: 1360, size: [300, 110], widgets: ['a'] },
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
    x: 460, y: 1500, size: [620, 420], widgets: [P] },

  // 生成
  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
    x: 1140, y: 0, size: [340, 520], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

  // 二采
  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1540, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1540, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分：一采 4 步 / 二采 2 步', x: 1540, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子（两采共用）', x: 1540, y: 480, size: [300, 90], widgets: [SEED, 'randomize'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1540, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器（两采共用）', x: 1540, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（低清跑表情与动作）', x: 1900, y: 0, size: [260, 160] },
  { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 1900, y: 220, size: [260, 60] },
  { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 1900, y: 320, size: [440, 280],
    widgets: ['minimax_h3_latent_upscaler_3d_fp16_V2.safetensors', 'scale by multiplier', UPSCALE, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 1900, y: 640, size: [260, 60] },
  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（高清补细节）', x: 2420, y: 0, size: [260, 160] },

  // 输出
  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 2760, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 2760, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（原声）', orange: true, x: 2760, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 3180, y: 0, size: [520, 720], widgets: [''] },
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
  ['img1', 0, 'r2v', 'ref_images.ref_image_0'],
  ['img2', 0, 'r2v', 'ref_images.ref_image_1'],
  ['img3', 0, 'r2v', 'ref_images.ref_image_2'],
  ['img4', 0, 'r2v', 'ref_images.ref_image_3'],
  ['video', 0, 'r2v', 'ref_videos.ref_video_0'],
  ['video', 2, 'r2v', 'ref_video_audios.ref_video_audio_0'],
  ['clip', 0, 'r2v', 'clip'],
  ['vaeV', 0, 'r2v', 'vae'],
  ['vaeA', 0, 'r2v', 'audio_vae'],

  ['sched', 0, 'refiner', 'sigmas'],
  ['refiner', 0, 'split', 'sigmas'],
  ['split', 0, 'pass1', 'sigmas'],
  ['split', 1, 'pass2', 'sigmas'],
  ['noise', 0, 'pass1', 'noise'],
  ['noise', 0, 'pass2', 'noise'],
  ['ksel', 0, 'pass1', 'sampler'],
  ['ksel', 0, 'pass2', 'sampler'],
  ['r2v', 0, 'guider', 'conditioning'],
  ['guider', 0, 'pass1', 'guider'],
  ['guider', 0, 'pass2', 'guider'],
  ['r2v', 1, 'pass1', 'latent_image'],

  ['pass1', 1, 'sep', 'av_latent'],
  ['sep', 0, 'up', 'latent'],
  ['up', 0, 'cat', 'video_latent'],
  ['sep', 1, 'cat', 'audio_latent'],
  ['cat', 0, 'pass2', 'latent_image'],

  ['pass2', 1, 'vdec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vdec', 0, 'vdbg', 'any_input'],
  ['vdbg', 0, 'out', 'images'],
  ['video', 2, 'out', 'audio'],
];

const note = `## H3 双人换人 · 二采（低清跑表演 → 2× 放大 → 高清补细节）

**红块 = 你要改的**：参考视频、4 张人物参考图、提示词。**橙块 = 输出**。
种子默认 randomize，想复现同一版就切成 fixed。

### 链路
1. \`一采\`：${WIDTH}×${HEIGHT} 低清跑 4 步，把镜头、表情、口型定下来。
2. \`分离 AV → 潜空间 2× 放大\`：只放大视频潜空间，音频潜空间原样带走（做错会音画错位）。
3. \`二采\`：同一个种子续采 2 步，在 ${WIDTH * UPSCALE}×${HEIGHT * UPSCALE} 上补皮肤纹理与官服细节。
4. 输出：24fps mp4，**音轨用原片原声**，H3 自编声轨丢弃。

### 参考图对应（顺序不能错）
- \`Picture 1\` 人物1 全身 = 红袍老者 → 出镜于 Shot 1 / Shot 3
- \`Picture 2\` 人物1 脸部特写
- \`Picture 3\` 人物2 全身 = 蓝袍男子 → 出镜于 Shot 2
- \`Picture 4\` 人物2 脸部特写

### 换片时改哪里
1. 参考视频：填新片；同时改 \`frame_load_cap\` 与 \`MiniMaxH3 参考生视频\` 的 \`length\` 为同一帧数，且必须落在 **17k+5** 网格（5、22、39…141、158、260），否则报错。
2. 尺寸：\`出片宽 / 出片高\` 两个数值节点填**32 的倍数**，按源片宽高比取最接近的一组（宽高各由一个 \`→ INT\` 数学节点转成整数后送进模型）。
3. 提示词：六段式必须照 H3 规则写；Shot 时间点要与剪点对齐。
4. 加人：每多一人加 2 张参考图（全身 + 脸特写），接 \`ref_image_4/5…\`，在提示词里补一段 \`<Subject N>\` 并写清他出现在哪个 Shot。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报"找不到图"不是接线错，重传换名字即可：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\`

本地原图在包的 \`assets/\` 目录。

### 验收看什么
抽 0.2 / 1.5 / 3.0 / 5.0 / 5.8 秒五帧：① 每镜人物对上各自参考图 ② 原片该帧的表情/口型在新脸上成立 ③ 官服领口不闪 ④ 没有第三人脸、没有西装残留。
**表情是本工作流的第一指标**：脸像但面瘫 = 不算过。`;

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
  extra: { ds: { scale: 0.55, offset: [700, 500] } },
  version: 0.4,
};

mkdirSync(OUT_DIR, { recursive: true });
const p = join(OUT_DIR, 'H3_duet_replace_twopass.ui.json');
writeFileSync(p, JSON.stringify(doc, null, 1));
console.log(`${p}  nodes=${doc.nodes.length} links=${links.length} frames=${FRAMES} size=${WIDTH}x${HEIGHT} -> ${WIDTH * UPSCALE}x${HEIGHT * UPSCALE}`);
