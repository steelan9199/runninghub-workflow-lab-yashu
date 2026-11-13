/**
 * H3 动作对齐（Motion Retarget）· 二采工作流生成器
 *
 * 输入两条视频，零张图片：
 *   <Video 1> = 03-2.mp4  所有人已换好的成片 → 提供「长相」：脸、胡须、帽子、袍子、机位、场景
 *   <Video 2> = 03.mp4    原始电影片段     → 提供「动作」：转头、眨眼、口型、手势与时序
 * 输出：长相取自 <Video 1>，表演逐帧照抄 <Video 2>。
 *
 * 与换人工作流的区别：不接 LoadImage，r2v 同时吃 ref_video_0 / ref_video_1。
 * 帧数、种子、分辨率与换人三轮保持一致，可直接对比。
 *
 * 用法：node build_motion.mjs
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

const FRAMES = 73;
const WIDTH = 832;
const HEIGHT = 704;
const UPSCALE = 2;
const SEED = 20261114;

// <Video 1> 长相来源：03-2.mp4（全部替换完）
const VIDEO_LOOK = 'openapi/611f19a2500ff239b1dce622df358930d44501f387b2cd5c4f7552e3cddee108.mp4';
// <Video 2> 动作来源：03.mp4（原片）
const VIDEO_MOTION = 'openapi/1bec77dbcc1b96ab8fed1b479f0c2634d9fe3d7c1be5ee21e0f0352122b3f717.mp4';

const SCENE = `corporate boardroom seen from the near end of a long glossy black conference table that runs away from the camera, a large raised "OSCORP" wall sign on the far wall, two rows of white recessed ceiling spots, pale grey walls, a dark sideboard holding bottles and glasses, and white teacups and saucers set along both sides of the table`;

const LOCK_COUNT = `FRAME COUNT LOCK: the target video contains exactly the same nine bodies as <Video 1> and not one more - one man standing at the head of the table, two men in the left row, four men in the right row, one large figure seated in the foreground with his back to the camera, and one cropped forearm and hand at the bottom-left corner. Do not add, duplicate, extend, clone or invent any person, head, face, shoulder, hand or background figure anywhere in the frame, and keep any seat that is empty in <Video 1> empty.`;
const LOCK_CAMERA = `FRAME GEOMETRY LOCK: the camera lens, distance, height, tilt and field of view stay identical to <Video 1>, the table keeps its exact length and perspective, the OSCORP sign stays in the same place and the same size, and every person keeps the same size in the frame as in <Video 1>.`;
const LOCK_DIVISION = `DIVISION OF LABOUR: appearance comes only from <Video 1>; motion comes only from <Video 2>. Never take a face, beard, hat or robe from <Video 2>, and never take a gesture, head turn or timing from <Video 1>.`;

const PROMPT = `subject_definitions:
<Video 1> is the appearance source for the target video: a three-second single locked-off wide shot of a ${SCENE}, in which every person at the table has already been replaced by a Ming-dynasty figure. At the head of the table stands a young nobleman in a pale blue robe with an indigo cloud collar, a thin dark beard and a black topknot held by a small gold crown. In the left row sit a clean-shaven eunuch in a tall red hood with gold stripes and long red ear flaps, and beside him a man with a short black beard in a gold-striped black hat and a red robe with a large square chest badge. In the right row sit, from the far seat to the near edge, a very old man with a long white beard and a black hat with two very long straight horizontal side wings, an older man with a grey beard in a gold-striped hat, an elderly man with a short grey moustache under a black gold-striped hat, and a middle-aged man with a long black beard in a black hat, cropped by the right border. In the foreground a large figure sits with his back to the camera, and at the bottom-left corner a red-sleeved forearm and hand rest on the table edge.
<Video 2> is the motion source and the original film of this shot: the same boardroom, the same locked-off wide framing and the same nine bodies, but every person is a modern businessman in a dark western suit and necktie. <Video 2> is used only for performance - head angles, head turns, nods, blinks, lip movements, hand gestures and their exact timing. Its faces, hairstyles, clothing and colours are ignored.
<Audio 1> is the synchronized dialogue track of <Video 2>, reused unchanged as the target video's complete final audio track.

summary:
[video editing + motion retargeting + audio reuse] The target video keeps the complete appearance of <Video 1> - the nine Ming-dynasty figures with their faces, beards, hats, robes, the black table, the white teacups, the OSCORP wall sign and the locked-off wide framing - and copies the physical performance of the nine counterparts in <Video 2> frame for frame: the same head angles at every moment, the same head turns, the same nods, the same blinks, the same lip movements for the English dialogue and the same hand gestures, at the same speed and the same amplitude. <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (appearance): fully_preserved - the pale blue robe and gold crown at the head of the table, the tall red hood and the gold-striped hat in the left row, the four red-robed officials with their white, grey and black beards in the right row, the figure in the foreground seen only from behind, the cropped forearm, the room, the table and the framing.
<Video 2> (performance): fully_copied - the head angle of every person at every moment, the direction and timing of every head turn, the nods, the blinks, the lip movements synchronized to the English dialogue, the hand and forearm gestures, and the exact frame on which each movement starts and ends.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage, wide static shot from the near end of a long boardroom table, glossy black reflections on the tabletop, soft overhead office lighting from the white ceiling spots, fine film grain, pale grey walls and a large raised metal "OSCORP" sign on the far wall.
[Shot 1] The frame holds exactly the framing of <Video 1> for the whole three seconds, with only the faint handheld drift of <Video 2>. Every person in the frame performs exactly what his counterpart in <Video 2> performs on the same frame number: when the man in <Video 2> turns his head toward the head of the table, his Ming-dynasty counterpart in the same seat turns his head by the same amount, in the same direction, at the same speed and at the same moment; when the speaker at the head of the table lowers his arms, the nobleman in the pale blue robe lowers his arms identically; when a seated man gestures with one hand, the corresponding red-robed official makes the same gesture with the same hand; when a man blinks or speaks, his counterpart blinks and his mouth forms the same shapes at the same time.
Nobody performs a movement that does not happen in <Video 2> on the same frame, and nobody stays frozen while his counterpart in <Video 2> moves. In particular, all heads do not turn in unison: each person follows only his own counterpart in <Video 2>, one by one, at that person's own moment and in that person's own direction. If the men in <Video 2> keep their heads still, the Ming-dynasty figures keep their heads still as well.
${LOCK_DIVISION} ${LOCK_COUNT} ${LOCK_CAMERA}
The camera never moves closer, never tilts, never pans, never cuts, and nobody stands up, walks, enters or leaves the frame.
The dialogue is English and is carried entirely by <Audio 1>; the lip movements match it but no new voice is generated.

overall_soundscape:
Quiet boardroom room tone with a faint ventilation hum and a few distant footstep echoes, all carried by <Audio 1>, which also holds the English dialogue; the sound stays unchanged from the first to the last frame.

non_diegetic_music:
N/A`;

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

  { key: 'look', type: 'VHS_LoadVideo', title: '★ 改这里 · 长相来源（03-2 全部换好）', red: true,
    x: 460, y: 0, size: [420, 480],
    widgets: { video: VIDEO_LOOK, frame_load_cap: FRAMES } },
  { key: 'motion', type: 'VHS_LoadVideo', title: '★ 改这里 · 动作来源（03 原片）', red: true,
    x: 460, y: 540, size: [420, 480],
    widgets: { video: VIDEO_MOTION, frame_load_cap: FRAMES } },
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（长相 1 + 动作 2）', red: true,
    x: 460, y: 1080, size: [700, 520], widgets: [PROMPT] },

  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1240, y: 540, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1240, y: 680, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1240, y: 820, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1240, y: 960, size: [300, 110], widgets: ['a'] },

  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（长相对齐动作）',
    x: 1600, y: 0, size: [340, 560], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 2000, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 2000, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分：一采 4 步 / 二采 2 步', x: 2000, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子', red: true, x: 2000, y: 480, size: [300, 90], widgets: [SEED, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 2000, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器（两采共用）', x: 2000, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（低清对齐动作）', x: 2360, y: 0, size: [260, 160] },
  { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 2360, y: 220, size: [260, 60] },
  { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 2360, y: 320, size: [440, 280],
    widgets: ['minimax_h3_latent_upscaler_3d_fp16_V2.safetensors', 'scale by multiplier', UPSCALE, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 2360, y: 640, size: [260, 60] },
  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（高清补细节）', x: 2860, y: 0, size: [260, 160] },

  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 3200, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 3200, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（动作对齐 · 原声）', orange: true, x: 3200, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: 'H3_board03_motion', format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 3620, y: 0, size: [520, 760], widgets: [`## 动作对齐 · 二采 · 零张图片

**这一版干什么**：不换人，只让 03-2 里的人**动得像原片**。

### 两个视频槽
- \`长相来源\`：03-2.mp4（全部换好的成片）→ \`ref_video_0\`，决定脸、胡须、帽子、袍子、场景
- \`动作来源\`：03.mp4（原片）→ \`ref_video_1\`，决定转头、眨眼、口型、手势与时序
- 音频只接一条（03-2 自带原声，两条音轨本来就是同一条），避免双音轨叠音

### 硬约束
- 帧数 ${FRAMES}、种子 ${SEED}，与换人三轮一致，方便逐帧对比。
- 提示词里写死「长相只取 <Video 1>、动作只取 <Video 2>」，并逐个说明谁跟谁的表演。
- 特别写了「不许全体同步转头」：每个人只跟原片里**自己那一位**的表演。

### 验收
抽 0.2 / 1.5 / 3.0 秒三帧，与 03.mp4 同帧对比头角：每个人的头朝向应与原片对得上，且**不再出现整齐划一的转头**。
再看长相：蓝袍金冠、红帽、四顶帽、长须白须都不能变。

### 素材有效期
video 槽填平台 \`fileName\`，约 24 小时失效；报找不到文件就重传：
\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地视频>"
\`\`\`
`] },
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

  ['look', 0, 'r2v', 'ref_videos.ref_video_0'],
  ['motion', 0, 'r2v', 'ref_videos.ref_video_1'],
  ['look', 2, 'r2v', 'ref_video_audios.ref_video_audio_0'],
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
  ['look', 2, 'out', 'audio'],
];

const byKey = new Map();
const outNodes = [];
let id = 0;
for (const spec of nodes) {
  const t = TPL.get(spec.type);
  if (!t) throw new Error(`模板里没有 ${spec.type}`);
  id += 1;
  const n = JSON.parse(JSON.stringify(t));
  Object.assign(n, { id, type: spec.type, order: 0, mode: 0, flags: {}, pos: [spec.x, spec.y] });
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
      named.control_after_generate = n.widgets_values[wi.length];
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
  extra: { ds: { scale: 0.62, offset: [700, 500] } },
  version: 0.4,
};

mkdirSync(OUT_DIR, { recursive: true });
const p = join(OUT_DIR, 'H3_board03_motion.ui.json');
writeFileSync(p, JSON.stringify(doc, null, 1));
console.log(`${p}  nodes=${doc.nodes.length} links=${links.length} frames=${FRAMES} seed=${SEED}`);
