/**
 * H3 七人换人 · 董事会宽景 · 二采版 UI 工作流生成器
 *
 * 底座：verified/H3-双人换人-近景对话-二采（同一支源片 842×720）
 * 改动：参考图 4 → 7；帧数 141 → 56（源片只有 59 帧）；提示词按七个人重写
 *
 * 用法：node build.mjs
 * 产物：dist/H3_board7_replace_twopass.ui.json
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
const FRAMES = 56;                  // 17*3+5，24fps → 2.333s（源片 59 帧，取最大网格）
const WIDTH = 832;                  // 源片 842 宽，向下取 32 的倍数
const HEIGHT = 704;                 // 源片 720 高，向下取 32 的倍数
const UPSCALE = 2;
const SEED = 20261114;
const OUT_PREFIX = 'h3_board7_twopass';

// 平台 fileName（上传后回填；约 24 小时过期，重传见 note）
const ASSETS = {
  video: 'openapi/995547afd314f1ab780de940cae53bf78441fc41d98601ff3fd690c5d7dc1491.mp4',
  gaogong: 'openapi/04eca517dcf9a3152ec1511c8ddbe3f2a43b23f6d3012803869d449c66ffe224.png',
  zhangjuzheng: 'openapi/9a7f61b3ef9c2d32bbe2856c4efcd5646997be2ed20e9c7d76dbb4f43f804d73.png',
  yanshifan: 'openapi/fd97b654899729e1acf0c39ca4d253f31d4c502293a37134d3a6a30aab517889.png',
  yuwang: 'openapi/c8a5fb11528e7afa62f0aa9538908d51c3a6263221f8f22ee1cca70a1c82e7a9.png',
  lifei: 'openapi/9ad6736784fa9cc0e0624c4b22fd95e34715c2b799328bf5732cd2e45f7f172b.png',
  hairui: 'openapi/6530348497c3b303b59d8eef64c45de41321f7590ec831d2933df65fa91ba51c.png',
  chenhong: 'openapi/85e0848257eaa3c4936b46f2ccbb4926150e21ea842572a61210fe5ec3405faf.png',
};

const P = `subject_definitions:
<Video 1> is the source video for the target video edit: a 2.33-second single locked-off shot of seven people seated around a long glossy black boardroom table in a modern American corporate office, filmed wide from the near end of the table, with pale grey walls, dark wood panelling on the right and a row of white teacups and saucers along the tabletop.
<Audio 1> is the synchronized audio track of <Video 1> and is reused unchanged as the target video's complete final audio track.
<Subject 1> is Gao Gong, taken from <Picture 1>: an elderly Chinese official with grey hair, a short grey moustache and beard, a black Ming official's hat with two straight side wings, and a deep red robe with a round embroidered rank badge on the chest. He sits nearest the camera at the extreme left, facing along the table with both forearms resting on the table edge.
<Subject 2> is Zhang Juzheng, taken from <Picture 2>: a middle-aged Chinese official with a long black beard reaching his chest, a black hat with side wings, and a red robe with a round rank badge. He sits second from the left, leaning slightly toward the camera, his hands resting on a black leather folder.
<Subject 3> is Yan Shifan, taken from <Picture 3>: a thin-faced Chinese official with a narrow pointed goatee, a black hat with side wings and a red robe with a round rank badge. He sits third from the left, angled slightly toward the head of the table, his hands clasped in front of him.
<Subject 4> is Yu Wang, taken from <Picture 4>: a Chinese nobleman in a black robe embroidered in gold with a small gold crown, seated at the head of the table in the background centre-right, holding a small white teacup near his chest with one hand.
<Subject 5> is Li Fei, taken from <Picture 5>: the only woman in the room, wearing a tall ornate gold phoenix headdress with hanging pearls and a dark purple robe embroidered with gold phoenixes, seated on the right side of the table with her right hand resting on a black leather folder.
<Subject 6> is Hai Rui, taken from <Picture 6>: a Chinese official with a thin face, a narrow beard, a black hat with side wings and a blue robe with a square rank badge. In <Video 1> only his left shoulder, upper arm and clenched fist are inside the frame at the extreme right edge, cropped by the frame border; his head and face are never inside the frame.
<Subject 7> is Chen Hong, taken from <Picture 7>: a eunuch wearing a red robe and a tall red hood. In <Video 1> only his right hand is inside the frame in the bottom-right corner, fingers resting on a burgundy leather folder; his face and body stay outside the frame.

summary:
[video editing + audio reuse] The target video is an edited version of <Video 1>: the seven people in the source frame are replaced one for one, in the same seats and the same order, by <Subject 1> to <Subject 7>, each wearing the costume, headwear and hairstyle shown in their reference picture, while the locked-off wide framing, the black table, the teacups, the room background and every head angle, gaze, blink and lip movement stay identical, and <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (framing and staging): fully_preserved - the single continuous shot, the wide view from the near end of the table, the reflective black tabletop, the seven seating positions from left to right, the white teacups, the pale grey wall, the dark wood panelling on the right, the faint handheld drift and the absence of any cut, zoom or reframing.
<Subject 1> (extreme left seat): fully_preserved - grey hair, short grey beard, black hat with straight side wings, red robe with a round chest badge, and both forearms resting on the table edge.
<Subject 2> (second from left): fully_preserved - long black beard reaching the chest, black hat, red robe, and the slight forward lean with hands on a black leather folder.
<Subject 3> (third from left): fully_preserved - thin face, narrow pointed goatee, black hat, red robe, and the body angled toward the head of the table with hands clasped.
<Subject 4> (head of the table, background centre-right): fully_preserved - black and gold robe, small gold crown, and the white teacup held near the chest.
<Subject 5> (right side): fully_preserved - tall gold phoenix headdress with hanging pearls, dark purple phoenix robe, and the right hand resting on the black leather folder.
<Subject 6> (right edge, cropped): fully_preserved - only the blue-robed left shoulder, upper arm and clenched fist remain inside the frame; the face stays outside the frame exactly as in <Video 1>.
<Subject 7> (bottom-right corner, cropped): fully_preserved - only the hand resting on the burgundy leather folder remains inside the frame; no face or torso is invented.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage, wide static shot from the near end of a long boardroom table, shallow ambient reflections on the glossy black surface, soft overhead office lighting from above and slightly screen left, fine film grain, pale grey walls behind the left row and dark wood panelling behind the right row.
[Shot 1] The frame holds steady with only the faint handheld drift of <Video 1>. Across the far side of the table, from left to right, sit <Subject 1>, <Subject 2>, <Subject 3>, then <Subject 4> at the head of the table in the background, then <Subject 5> on the right side. <Subject 6> appears only as a shoulder, upper arm and clenched fist at the extreme right edge, cut by the frame border. <Subject 7> appears only as a hand on a burgundy leather folder in the bottom-right corner.
Every person keeps the exact performance of their counterpart in <Video 1>: <Subject 1> holds his head level and looks across the table with his forearms still; <Subject 2> keeps leaning forward with his eyes moving between the head of the table and screen left, lips parting slightly as he listens; <Subject 3> keeps his body angled toward the head of the table and his hands clasped; <Subject 4> raises the white teacup toward his mouth and lowers it again with his eyes on the speaker; <Subject 5> sits still, blinks, and turns her eyes slightly toward screen left; the fist of <Subject 6> stays clenched and motionless; the hand of <Subject 7> does not move.
The seven are seven different individuals and must stay visibly distinct: only <Subject 1> has grey hair and a short grey beard; only <Subject 2> has a long black beard reaching the chest; <Subject 3> is the only thin-faced man with a narrow pointed goatee; <Subject 4> is the only man in a black robe with a gold crown; <Subject 5> is the only woman; <Subject 7> is the only one wearing a tall red hood. Never swap two faces, never merge two people into one, never duplicate a face, and never give any of them a western suit, necktie, glasses or short modern haircut.
The camera never moves closer, never tilts, never pans, never cuts, and nobody stands up, enters or leaves the frame.

overall_soundscape:
Quiet boardroom room tone with a faint ventilation hum and a few distant footstep echoes, all carried by <Audio 1>, which also holds the English dialogue; the sound stays unchanged from the first to the last frame.

non_diegetic_music:
N/A`;

// ---------------- 节点表 ----------------
const refs = [
  ['img1', '★ 改这里 · 高拱（左一）', ASSETS.gaogong],
  ['img2', '★ 改这里 · 张居正（左二）', ASSETS.zhangjuzheng],
  ['img3', '★ 改这里 · 严世蕃（左三）', ASSETS.yanshifan],
  ['img4', '★ 改这里 · 裕王（长桌尽头）', ASSETS.yuwang],
  ['img5', '★ 改这里 · 李妃（右侧）', ASSETS.lifei],
  ['img6', '★ 改这里 · 海瑞（右边缘仅肩与拳）', ASSETS.hairui],
  ['img7', '★ 改这里 · 陈洪（右下角仅一只手）', ASSETS.chenhong],
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

  // 输入（左列：原片 + 提示词；右列：七张人物图）
  { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 参考视频（要换人的原片）', red: true,
    x: 460, y: 0, size: [420, 500],
    widgets: { video: ASSETS.video, frame_load_cap: FRAMES } },
  ...refs.map(([key, title, file], i) => ({
    key, type: 'LoadImage', title, red: true,
    x: 460 + (i % 2) * 330, y: 520 + Math.floor(i / 2) * 340, size: [300, 320],
    widgets: [file, 'image'],
  })),
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
    x: 460, y: 2000, size: [620, 420], widgets: [P] },

  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1140, y: 520, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1140, y: 660, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1140, y: 800, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1140, y: 940, size: [300, 110], widgets: ['a'] },

  // 生成
  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
    x: 1500, y: 0, size: [340, 520], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

  // 二采
  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1900, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1900, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分：一采 4 步 / 二采 2 步', x: 1900, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子（两采共用）', x: 1900, y: 480, size: [300, 90], widgets: [SEED, 'randomize'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1900, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器（两采共用）', x: 1900, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（低清跑表演与站位）', x: 2260, y: 0, size: [260, 160] },
  { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 2260, y: 220, size: [260, 60] },
  { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 2260, y: 320, size: [440, 280],
    widgets: ['minimax_h3_latent_upscaler_3d_fp16_V2.safetensors', 'scale by multiplier', UPSCALE, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 2260, y: 640, size: [260, 60] },
  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（高清补细节）', x: 2760, y: 0, size: [260, 160] },

  // 输出
  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 3100, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 3100, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（原声）', orange: true, x: 3100, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 3520, y: 0, size: [520, 720], widgets: [''] },
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

const note = `## H3 七人换人 · 董事会宽景 · 二采

**红块 = 你要改的**：原片、七张人物图、提示词。**橙块 = 输出**。
种子默认 randomize，想复现同一版就切 fixed。

### 链路
1. \`一采\`：${WIDTH}×${HEIGHT} 跑 4 步，把七个站位、每人的视线与口型定下来。
2. \`分离 AV → 潜空间 2× 放大\`：只放视频潜空间，音频潜空间原样带走。
3. \`二采\`：同种子续采 2 步，在 ${WIDTH * UPSCALE}×${HEIGHT * UPSCALE} 上补皮肤与官服纹样。
4. 输出：24fps mp4，**音轨用原片原声**，H3 自编声轨丢弃。

### 参考图顺序（不能错，改一张就改一个人）
- \`Picture 1\` 高拱 → 左一 · \`Picture 2\` 张居正 → 左二 · \`Picture 3\` 严世蕃 → 左三
- \`Picture 4\` 裕王 → 长桌尽头 · \`Picture 5\` 李妃 → 右侧
- \`Picture 6\` 海瑞 → 右边缘（只露肩与拳，脸在画外）
- \`Picture 7\` 陈洪 → 右下角（只露一只手，人在画外）

### 换片时改哪里
1. \`frame_load_cap\` 与 \`length\` 必须一致，且落在 **17k+5** 网格（5/22/39/56/73…）。
   本片源 59 帧 → 取 56（2.33s，尾 3 帧舍弃）。
2. 宽高填 **32 的倍数**，经两个 \`→ INT\` 节点送进模型。
3. 加人：在 \`MiniMaxH3 参考生视频\` 上新增 \`ref_images.ref_image_8…\` 输入，接新图，提示词补 \`<Subject N>\` 并写清座位。

### 本片两个特殊位
海瑞与陈洪在原片里**只有局部入画**。提示词已写死「脸在画外，不许补全身」；
若成片给他们凭空补了头或上半身，先改提示词这两段，不要改接线。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图」不是接线错，重传换名字即可：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\`

### 验收看什么
抽 0.2 / 1.0 / 1.8 / 2.3 秒四帧：① 七个人各对各的参考图，五个红袍不串脸 ② 裕王端茶杯的手势保住 ③ 海瑞只有肩膀与拳头、陈洪只有一只手 ④ 没有现代西装残留、没有多余的人。`;

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

// 模板只声明了 ref_image_0..3，补到 7 个（插在 ref_videos 之前，顺序即 Picture 序号）
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
  extra: { ds: { scale: 0.55, offset: [700, 500] } },
  version: 0.4,
};

mkdirSync(OUT_DIR, { recursive: true });
const p = join(OUT_DIR, 'H3_board7_replace_twopass.ui.json');
writeFileSync(p, JSON.stringify(doc, null, 1));
console.log(`${p}  nodes=${doc.nodes.length} links=${links.length} frames=${FRAMES} size=${WIDTH}x${HEIGHT} -> ${WIDTH * UPSCALE}x${HEIGHT * UPSCALE}`);
