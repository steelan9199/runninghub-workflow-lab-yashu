/**
 * H3 单人换人 · 楼梯跳舞三镜（小丑 02）· 一采 · 无声 UI 工作流生成器
 *
 * 底座：06 同款一采链路（864×736 单采，无放大支路）
 * 改动：参考图 1 张；328 帧（17×19+5）三镜两切；**音轨不接输出（成片无声）**
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');
const BASE2 = join(HERE, 'templates/twopass.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 328;                 // 17*19+5，24fps → 13.667s（源片整段，三镜两切）
const WIDTH = 640;                  // 一采宽（32 的倍数）：328 帧先压到 0.35MP 给二采留显存
const HEIGHT = 544;                 // 一采高；二采 = 2× → 1280×1088
const SEED = 20261115;
const OUT_PREFIX = 'joker02_inline_pose_twopass';

// 平台 fileName（约 24 小时过期，重传只换这里）
const ASSETS = {
  video: 'openapi/6ccbc766c8186c9bfcd459a8c522d0206154234353da62294120f1793ecdf4a8.mp4',
  renwu2_face: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const TPL = new Map();
for (const f of [BASE, BASE2]) {
  for (const n of JSON.parse(readFileSync(f, 'utf8')).nodes) {
    if (!TPL.has(n.type)) TPL.set(n.type, n);
  }
}

// 提示词唯一真相源：改 prompt.txt，再跑本脚本
const PROMPT = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();

// ---------------- 节点表 ----------------
const refs = [
  ['img1', '★ 改这里 · 人物2 三视图（正脸+正面全身+背面全身）', ASSETS.renwu2_face],
];

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
  { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 原片（主 · 表演/构图/镜头）', red: true,
    x: 460, y: 0, size: [420, 500],
    widgets: { video: ASSETS.video, frame_load_cap: FRAMES } },
  ...refs.map(([key, title, file], i) => ({
    key, type: 'LoadImage', title, red: true,
    x: 460 + (i % 2) * 330, y: 520 + Math.floor(i / 2) * 340, size: [300, 320],
    widgets: [file, 'image'],
  })),
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
    x: 460, y: 2000, size: [620, 420], widgets: [PROMPT] },

  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1140, y: 520, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1140, y: 660, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1140, y: 800, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1140, y: 940, size: [300, 110], widgets: ['a'] },

  // 生成
  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
    x: 1500, y: 0, size: [340, 520], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

  // 一采
  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1900, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1900, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分 4：全部给一采', x: 1900, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子', x: 1900, y: 480, size: [300, 90], widgets: [SEED, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1900, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器', x: 1900, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（4 步 @640×544，定结构）', x: 2260, y: 0, size: [260, 160] },

  // 二采：只放大视频潜空间 2×，音频潜空间原样拼回
  { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 2260, y: 200, size: [260, 60] },
  { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 2260, y: 300, size: [440, 280],
    widgets: ['minimax_h3_latent_upscaler_3d_fp16_V2.safetensors', 'scale by multiplier', 2, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 2260, y: 620, size: [260, 60] },
  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（2 步，1280×1088 补细节）', x: 2560, y: 0, size: [260, 160] },

  // 输出
  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 2880, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 2880, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（无声）', orange: true, x: 2880, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 3300, y: 0, size: [520, 720], widgets: [''] },
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
  ...refs.map(([key], i) => [key, 0, 'r2v', `ref_images.ref_image_${i}`]),
  ['video', 0, 'r2v', 'ref_videos.ref_video_0'],
  ['video', 0, 'dwp', 'image'],
  ['dwp', 0, 'skelscale', 'image'],
  ['skelscale', 0, 'r2v', 'ref_videos.ref_video_1'],
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

  // 二采：只放大视频潜空间
  ['pass1', 1, 'sep', 'av_latent'],
  ['sep', 0, 'up', 'latent'],
  ['up', 0, 'cat', 'video_latent'],
  ['sep', 1, 'cat', 'audio_latent'],
  ['cat', 0, 'pass2', 'latent_image'],

  ['pass2', 1, 'vdec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vdec', 0, 'vdbg', 'any_input'],
  ['vdbg', 0, 'out', 'images'],
  // 无声版：源片音轨只喂模型当参考（ref_video_audio_0），不接输出
];

const note = `## H3 骨架内置 · 楼梯跳舞三镜 · 二采 · 无声

**红块 = 你要改的**：原片、DWPose 参数、人物图、提示词。**橙块 = 输出**。
种子默认 fixed=${SEED}，两采共用同一个噪声，换一版改 build.mjs 顶部 SEED。

### 两条参考视频的分工（骨架在图内生成，不需要外部文件）
- \`ref_video_0\` = **原片（主）**：表演、构图、景别、镜头运动、三镜两切、抽烟那一段全看它。
- \`ref_video_1\` = **骨架（辅）**：由本图内的 \`DWPreprocessor\` 从**同一条原片**逐帧提出，再 \`ImageScale\` 拉回 ${WIDTH}×${HEIGHT} 后送入。
  帧数、时长天然与原片 1:1，不会错位；提示词里已写死「骨架只作动作参考，画面里不得出现线条人/线框/黑底」。
- 想退回单视频版：删掉 \`dwp\` → \`skelscale\` → \`ref_video_1\` 这两根线即可。

### 链路（二采：一采定结构，二采补细节）
1. \`一采\`：${WIDTH}×${HEIGHT} 跑 4 步（beta + 尾部加密 2 步，切分 4 给一采）。
2. \`LTXVSeparateAVLatent\` → \`MinimaxH3LatentUpscaler3D\`（**只放视频潜空间 2×**，音频潜空间不动）→ \`LTXVConcatAVLatent\`。
3. \`二采\`：${WIDTH * 2}×${HEIGHT * 2} 跑 2 步，补细节。
4. \`VAEDecode\` → \`VHS_VideoCombine\`：24fps mp4，**音轨不接输出 → 成片无声**。
   原片音轨仍喂进 \`ref_video_audio_0\` 当参考；骨架支路不产生音轨。

### 为什么一采只跑 ${WIDTH}×${HEIGHT}
328 帧是已验证二采包（56–73 帧）的 4.5 倍，显存吃帧数 × 像素。一采压到 0.35MP 给二采留余量，
二采 2× 出来 ${WIDTH * 2}×${HEIGHT * 2}（${(WIDTH * 2)}×${(HEIGHT * 2)} ≈ 1.39MP）仍高于原片 864×736。
显存富余时可以把一采改成 864×736（二采 1728×1472），但 328 帧下风险高。

### 源片结构（三镜两切，不能改）
- **0 – 4.958s**：极宽低角度仰拍楼梯峡谷（消防梯 / 路灯 / 过曝白天），人从台阶上往下走+舞，越走越大，画面下中部有橙色镜头光斑。
- **4.958 – 9.792s**：手持中近景，跳舞的头部与上半身撑满画面，背后绿墙 + 虚焦白色招牌，镜头随动作抖。
- **9.792 – 13.667s**：低角度 3/4 中景，左边蓝色路灯杆、前景金属扶手、头顶消防梯、墙上涂鸦，他踢腿甩臂，镜头跟着横摇。

### 必须整身换掉的（本片第一验收点）
深红西装 + 亮黄橙马甲 + 墨绿衬衫 + 白脸油彩 + **画出来的红嘴角** + 蓝眼三角 + 墨绿卷发 → 全部换成
冰蓝云纹袍 + 白交领 + 白裤 + 黑布鞋 + 金冠（横穿长簪）+ 黑长发 + 细髭长须 + 素颜。

### v5 相对 v4 的改动
1. **改二采**：一采 4 步 @640×544 → 潜空间 2× → 二采 2 步 @1280×1088，音频潜空间不参与放大。
2. 骨架支路、双视频分工、香烟可入画、不许微笑全部保持不变。

### 已知风险（别当成接线错）
1. **328 帧 = 13.667s**，在 H3 的 4–15 秒区间内，但平台显存/时长上限未实测；
   若 OOM 或超时，退路：降到 640×544，或按镜拆三段（107 / 124 / 90 帧）分别跑再拼。
2. **两处硬切 H3 只做语义级约束**，切点可能漂（历史上 3.417s 被跑到 1.875s）。切点对不上就拆段单独生成。
3. 宽景里人物只有几十像素，脸不可辨，只看身形/服装/头冠；近景那镜才考验身份。
4. 参考图是正面半身 → 全身、走路、跳舞都要外推，腿脚与袍摆可能出现奇怪形状。

### 换片时改哪里
1. \`frame_load_cap\` 与 \`length\` 必须一致，且落在 **17k+5** 网格（90/107/124/328…）。本段 = **328**。
2. 宽高填 **32 的倍数**，经两个 \`→ INT\` 节点送进模型。
3. 该节点最多 9 个 \`ref_images\` 槽，本段只用 1 个，空槽不接就行。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图/视频」不是接线错，重传后改 build.mjs 的 ASSETS：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地文件>"
\`\`\`

### 验收看什么
抽 1 / 60 / 110 / 160 / 260 / 327 六帧：① 红衣黄马甲绿衬衫白脸是否全部消失 ② 三镜构图是否还原（仰拍峡谷 / 手持近景 / 低角度 3/4）③ 两处硬切是否还在合理位置 ④ 舞蹈动作幅度是否照抄 ⑤ 成片是否**没有音轨** ⑥ 有没有第二个人或多余物件入画`;

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
  // 底座里带的旧预览信息会指向别的片，清掉
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

// ---- 图内骨架支路（DWPose → 拉回出片宽高）：底座模板里没有这两个节点，手写 ----
// 控件顺序已按平台回传的真实定义核对：image → detect_hand → detect_body → detect_face → resolution → bbox_detector → pose_estimator → scale_stick
function addNode(spec) {
  id += 1;
  const n = {
    id, type: spec.type, order: 0, mode: 0, flags: {},
    pos: [spec.x, spec.y], size: spec.size, title: spec.title,
    color: spec.red ? '#c0392b' : undefined,
    bgcolor: spec.red ? '#5b1f1f' : undefined,
    inputs: spec.inputs.map((i) => ({ ...i, link: null })),
    outputs: spec.outputs.map((o) => ({ ...o, links: [] })),
    properties: { 'Node name for S&R': spec.type },
    widgets_values: spec.widgets,
  };
  if (!n.color) { delete n.color; delete n.bgcolor; }
  byKey.set(spec.key, n);
  outNodes.push({ key: spec.key, node: n });
}

addNode({
  key: 'dwp', type: 'DWPreprocessor', title: '★ 改这里 · DWPose 提骨骼（手开 / 脸关）',
  x: 460, y: 1080, size: [340, 400], red: true,
  inputs: [
    { name: 'image', type: 'IMAGE' },
    { name: 'detect_hand', type: 'COMBO', widget: { name: 'detect_hand' } },
    { name: 'detect_body', type: 'COMBO', widget: { name: 'detect_body' } },
    { name: 'detect_face', type: 'COMBO', widget: { name: 'detect_face' } },
    { name: 'resolution', type: 'INT', widget: { name: 'resolution' } },
    { name: 'bbox_detector', type: 'COMBO', widget: { name: 'bbox_detector' } },
    { name: 'pose_estimator', type: 'COMBO', widget: { name: 'pose_estimator' } },
    { name: 'scale_stick_for_xinsr_cn', type: 'COMBO', widget: { name: 'scale_stick_for_xinsr_cn' } },
  ],
  outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  widgets: ['enable', 'enable', 'disable', 1024, 'yolox_l.onnx', 'dw-ll_ucoco_384.onnx', 'disable'],
});

addNode({
  key: 'skelscale', type: 'ImageScale', title: '骨架 → 拉回出片宽高',
  x: 860, y: 1080, size: [340, 180],
  inputs: [
    { name: 'image', type: 'IMAGE' },
    { name: 'upscale_method', type: 'COMBO', widget: { name: 'upscale_method' } },
    { name: 'width', type: 'INT', widget: { name: 'width' } },
    { name: 'height', type: 'INT', widget: { name: 'height' } },
    { name: 'crop', type: 'COMBO', widget: { name: 'crop' } },
  ],
  outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  widgets: ['lanczos', WIDTH, HEIGHT, 'disabled'],
});

// 模板只声明了 ref_image_0..3，按 refs 数量补齐（插在 ref_videos 之前，顺序即 Picture 序号）
const r2vNode = byKey.get('r2v');
for (let k = 0; k < refs.length; k += 1) {
  const name = `ref_images.ref_image_${k}`;
  if (!r2vNode.inputs.some((i) => i.name === name)) {
    const at = r2vNode.inputs.findIndex((i) => i.name.startsWith('ref_videos'));
    r2vNode.inputs.splice(at, 0, { name, type: 'IMAGE', link: null });
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
console.log(`workflow.ui.json  nodes=${doc.nodes.length} links=${links.length} ${WIDTH}x${HEIGHT} / ${FRAMES} 帧 / 参考图 ${refs.length} 张`);
