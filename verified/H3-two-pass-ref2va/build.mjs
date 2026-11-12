/**
 * H3 二采 / 三采 UI 工作流生成器
 * 模板来自老板从网页导出的两份 UI JSON（保留各节点的真实输入槽与控件顺序）
 * 只做三件事：挑节点、按声明重新接线、重排坐标
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_A = join(HERE, 'templates/wf_2089513420025589761.ui.json');
const SRC_B = join(HERE, 'templates/wf_2114707872927014914.ui.json');
const OUT_DIR = join(HERE, 'dist');

const TPL = new Map();
for (const f of [SRC_A, SRC_B]) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  for (const n of j.nodes) if (!TPL.has(n.type)) TPL.set(n.type, n);
}
const tplTypes = new Set(TPL.keys());

const P_REF = `subject_definitions:
<Subject 1> is the young woman in <Picture 1>: wet black hair combed back from her forehead with loose strands across her face, a dark charcoal knit sweater with a rolled collar, pale skin, and a calm, slightly tired expression. Her face shape, eyebrows, eye color, hairstyle, and clothing stay identical throughout the target video.
<Subject 2> is the rainy night street environment in <Picture 1>: a warm yellow lamp hanging at the upper left, a glowing neon sign with red Chinese characters at the upper right, a dark storefront behind her with a metal awning, wet pavement, and soft bokeh in the background.

summary:
[reference generation] The target video is an eight-second single-take close portrait of <Subject 1> standing in <Subject 2> on a rainy night; she draws the raised hand down through her wet hair, tilts her head slightly to screen left, and settles her gaze back on the lens while the camera pushes in slowly.

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - the same face, wet hairstyle, dark knit sweater, and skin tone are retained in every frame.
<Subject 2> (appears in [Shot 1]): fully_preserved - the warm lamp, the neon sign at the upper right, the storefront, the wet pavement, and the background bokeh keep their positions and colors.

detailed_description:
The target video is live-action and cinematic, shot on a long lens at chest-up framing with shallow depth of field, warm practical light against cool blue rain, fine film grain, and natural skin texture.
[Shot 1] A close shot frames <Subject 1> from the chest up, positioned slightly left of center, her face turned about three-quarters toward the lens. Rain falls continuously in the foreground and behind her; the warm lamp rims the top of her hair while the neon sign glows steadily at the upper right. At the start of the shot her right hand is raised beside her forehead, fingers spread among the wet strands. The camera pushes in with small amplitude at slow speed for the entire shot, keeping her head and shoulders inside the frame.
Over the first two and a half seconds she draws the raised hand down slowly through her hair, letting the strands fall back, and lowers the arm out of frame; her shoulder drops and her breathing becomes visible in the collar of the sweater. Around the third second she turns her head about ten degrees toward screen left and lifts her chin slightly, exposing the line of her jaw; rainwater gathered at the ends of her hair releases and drops onto the shoulder of her sweater. Between the fourth and sixth seconds a faint, almost imperceptible smile changes the corners of her mouth while her eyes stay on the lens. The lamp and the neon sign keep a constant brightness, so the lighting on her face does not change. In the last two seconds she settles her head back toward the lens, exhales once so that her shoulders fall, and holds nearly still, with only falling rain and drifting hair ends moving in the frame. Her lips stay closed and she does not speak.

overall_soundscape:
Steady rain taps on the metal awning and the wet pavement, water drips from the sign overhead, and faint distant traffic passes behind the street wall. Her sweater shifts softly with each breath, and her single exhale is audible near the end.

non_diegetic_music:
A sparse solo piano line at a slow tempo with one sustained low string note underneath, rising slightly in volume as the camera pushes in and thinning out over the final two seconds.`;

const P_FLF = `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the 8.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a chest-up shot begins in the exact framing, pose, and lighting established by Picture 1: the young woman in the wet black hair and dark charcoal knit sweater stands on the rainy night street with her right hand raised beside her forehead, fingers in her hair, the warm lamp glowing at the upper left and the neon sign at the upper right. The camera holds a static shot with only a faint push in at slow speed. Over the first two seconds she draws the raised hand down through the strands, letting them fall back, and lowers the arm out of frame while her shoulder relaxes. Between the second and sixth seconds she turns her upper body about fifteen degrees toward screen right, shifting her weight onto that side; the sweater folds and settles across her shoulders, loose hair swings across her cheek, and rain releases from the ends of her hair and drops onto her collar. Her eyes stay on the lens throughout. In the final two seconds she settles the turn, her shoulder and jaw come to rest, and the pose, head angle, hand position, and composition converge exactly on Picture 2 at the end of the shot, holding still for the last half second except for falling rain and the flicker of the lamp.

overall_soundscape: Steady rain taps on the awning and pavement, water drips from the sign above, faint distant traffic passes, and her knit sweater shifts softly with each breath.

non_diegetic_music: A sparse solo piano line at a slow tempo with a sustained low string note underneath, staying quiet and thinning out over the final two seconds.`;

const FRAMES_EXPR = 'max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17';
const UPSCALER_MODEL = 'minimax_h3_latent_upscaler_3d_fp16_V2.safetensors';

// RH 上传换回来的 fileName（1 天有效）。过期就重跑：
//   node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "D:/software/workBuddyWorkspace/rh-ui/assets/<文件名>.png"
// 然后把新 fileName 填到下面，重新 node build.mjs 即可。
const ASSETS = {
  refTwopass: 'openapi/6393482a46ec13e1eb2d9f16972742ca407f6a68d53be66ab5608120afb29186.png',
  flfFirst: 'openapi/6393482a46ec13e1eb2d9f16972742ca407f6a68d53be66ab5608120afb29186.png',
  flfLast: 'openapi/4fe76e16d3e8778b0d04741c4316d10ec001df5852d53b1b9517dd1900693416.png',
};
const UPLOAD_HINT = '素材的 fileName 1 天有效；过期就重跑 `rh.mjs --upload <本地图>`，把新名字填回 LoadImage，别改接线。';

function build({ file, noteTitle, noteText, nodes, wires }) {
  const byKey = new Map();
  const out = [];
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
    if (spec.red) {
      n.color = '#c0392b';
      n.bgcolor = '#5b1f1f';
    }
    if (spec.orange) {
      n.color = '#d35400';
      n.bgcolor = '#5a3208';
    }
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
    if (spec.widgets) n.widgets_values = spec.widgets;
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
    out.push({ key: spec.key, node: n });
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

  // 拓扑序
  const indeg = new Map(out.map((o) => [o.node.id, 0]));
  const adj = new Map(out.map((o) => [o.node.id, []]));
  for (const l of links) {
    adj.get(l[1]).push(l[3]);
    indeg.set(l[3], indeg.get(l[3]) + 1);
  }
  const q = out.filter((o) => indeg.get(o.node.id) === 0).map((o) => o.node.id);
  const order = [];
  while (q.length) {
    const nid = q.shift();
    order.push(nid);
    for (const nx of adj.get(nid)) {
      indeg.set(nx, indeg.get(nx) - 1);
      if (indeg.get(nx) === 0) q.push(nx);
    }
  }
  if (order.length !== out.length) throw new Error('接线有环');
  const orderMap = new Map(order.map((nid, i) => [nid, i]));
  for (const o of out) o.node.order = orderMap.get(o.node.id);

  const doc = {
    id: randomUUID(),
    revision: 0,
    last_node_id: id,
    last_link_id: lid,
    nodes: out.map((o) => o.node),
    links,
    groups: [],
    config: {},
    extra: { ds: { scale: 0.55, offset: [700, 500] } },
    version: 0.4,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const p = `${OUT_DIR}/${file}`;
  writeFileSync(p, JSON.stringify(doc, null, 1));
  console.log(`${p}  nodes=${doc.nodes.length} links=${links.length}`);
  return doc;
}

/* ---------------- 二采 ---------------- */
const twoNodes = [
  { key: 'unet', type: 'UNETLoader', title: '加载 UNET（fl2va bf16）', x: 0, y: 0, size: [400, 90], widgets: ['minimax_h3_fl2va_bf16.safetensors', 'default'] },
  { key: 'lora', type: 'LoraLoaderModelOnly', title: 'LoRA · 4 步 turbo', x: 0, y: 140, size: [400, 90], widgets: ['minimax_h3_fl2v_lightx2v_turbo_4step_v0.1_comfy.safetensors', 0.65] },
  { key: 'shift', type: 'MiniMaxH3SigmaShift', title: 'Sigma Shift 12 / 3', x: 0, y: 280, size: [400, 90], widgets: [12, 3] },
  { key: 'attn', type: 'ModelAttentionBackend', title: '注意力后端', x: 0, y: 420, size: [400, 70], widgets: ['comfy kitchen attention'] },
  { key: 'clip', type: 'CLIPLoader', title: '加载 CLIP', x: 0, y: 540, size: [400, 110], widgets: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors', 'minimax', 'default'] },
  { key: 'vaeV', type: 'VAELoader', title: '视频 VAE', x: 0, y: 700, size: [400, 60], widgets: ['minimax_h3_video_vae_fp16.safetensors'] },
  { key: 'vaeA', type: 'VAELoader', title: '音频 VAE', x: 0, y: 800, size: [400, 60], widgets: ['minimax_h3_audio_vae_fp32.safetensors'] },

  { key: 'res', type: 'ResolutionSelector', title: '★ 改这里 · 一采分辨率 16:9 / 0.5MP', red: true, x: 520, y: 0, size: [300, 150], widgets: ['16:9 (Widescreen)', 0.5, 32] },
  { key: 'dur', type: 'PrimitiveFloat', title: '★ 改这里 · 时长（秒）', red: true, x: 520, y: 200, size: [300, 80], widgets: [8] },
  { key: 'math', type: 'ComfyMathExpression', title: '换算帧数（24fps，对齐 17k+5）', x: 520, y: 320, size: [300, 120], widgets: [FRAMES_EXPR] },
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 结构化）', red: true, x: 520, y: 480, size: [460, 320], widgets: [P_REF] },
  { key: 'load', type: 'LoadImage', title: '★ 改这里 · 参考图（已预填）', red: true, x: 520, y: 840, size: [300, 330], widgets: [ASSETS.refTwopass, 'image'] },

  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）', x: 1060, y: 0, size: [330, 500], widgets: ['', 1344, 768, 124, 'max'] },

  { key: 'sched', type: 'BasicScheduler', title: '调度器 8 步 / simple', x: 1500, y: 0, size: [280, 120], widgets: ['simple', 8, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +1 步）', x: 1500, y: 160, size: [280, 150], widgets: [1, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分：一采 6 步 / 二采剩余', x: 1500, y: 350, size: [280, 90], widgets: [6] },
  { key: 'noise', type: 'RandomNoise', title: '★ 改这里 · 噪声种子（两采共用）', red: true, x: 1500, y: 480, size: [280, 90], widgets: [999, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1500, y: 610, size: [280, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器（两采共用）', x: 1500, y: 720, size: [280, 60], widgets: [] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（低清）', x: 1900, y: 0, size: [240, 160], widgets: [] },
  { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 1900, y: 220, size: [240, 60], widgets: [] },
  { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 1900, y: 320, size: [420, 280], widgets: [UPSCALER_MODEL, 'scale by multiplier', 2, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 1900, y: 640, size: [240, 60], widgets: [] },

  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（高清收尾）', x: 2400, y: 0, size: [240, 160], widgets: [] },

  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 2760, y: 0, size: [240, 60], widgets: [] },
  { key: 'adec', type: 'VAEDecodeAudio', title: '音频解码', x: 2760, y: 120, size: [240, 60], widgets: [] },
  { key: 'create', type: 'CreateVideo', title: '合成 24fps 视频', x: 2760, y: 240, size: [240, 190], widgets: [24, 8, 'sRGB', 'auto', 'none'] },
  { key: 'save', type: 'SaveVideo', title: '保存视频', orange: true, x: 2760, y: 480, size: [340, 240], widgets: ['video/H3_TWO_PASS', 'auto', 'auto', 'auto'] },

  { key: 'note', type: 'MarkdownNote', title: '说明', x: 3200, y: 0, size: [520, 620], widgets: [''] },
];

const twoWires = [
  ['unet', 0, 'lora', 'model'],
  ['lora', 0, 'shift', 'model'],
  ['shift', 0, 'attn', 'model'],
  ['attn', 0, 'sched', 'model'],
  ['attn', 0, 'guider', 'model'],

  ['res', 0, 'r2v', 'width'],
  ['res', 1, 'r2v', 'height'],
  ['dur', 0, 'math', 'values.a'],
  ['math', 1, 'r2v', 'length'],
  ['prompt', 0, 'r2v', 'prompt'],
  ['load', 0, 'r2v', 'ref_images.ref_image_0'],
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

  ['pass2', 0, 'vdec', 'samples'],
  ['pass2', 0, 'adec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vaeA', 0, 'adec', 'vae'],
  ['vdec', 0, 'create', 'images'],
  ['adec', 0, 'create', 'audio'],
  ['create', 0, 'save', 'video'],
];

const twoNote = `## H3 二采 · 0.5MP → 2× → 高清收尾

**红色方块 = 需要你改的参数**：分辨率 / 时长 / 提示词 / 参考图 / 噪声种子（标题都带 ★ 改这里）。**橙色方块 = 输出**（保存视频）。

**链路（一条直线，四段挑参数）**
1. \`一采\`：0.5MP 低清跑 6 步，把动态、构图、人物一致性定下来。
2. \`分离 AV\` → \`潜空间 2×\`：只放大视频潜空间，音频潜空间原样带走（这一步做错音画会散）。
3. \`二采\`：接剩下的 sigma，同一个噪声种子续采，2~3 步补细节。
4. 解码 → 合视频（24fps，带音轨）。

**改哪里**
- 时长 → \`PrimitiveFloat\`（帧数自动按 24fps 对齐 17k+5，别手改）。
- 清晰度 ↔ 速度 → \`ResolutionSelector\` 的 megapixels（0.4 起手更快，0.6 更稳）。
- 一采 / 二采 步数分配 → \`SplitSigmas\` 的 step（总步数在 \`BasicScheduler\`）。
- 提示词 → 写 H3 结构化的三段（integrated_multimodal_description / overall_soundscape / non_diegetic_music），首帧图在 \`参考图\` 里选。

**注意**
- 参考图已预填（平台 fileName，本地原图在 rh-ui\\assets\\ref_twopass.png）。${UPLOAD_HINT}
- 48G 机器按 8 秒 / 16:9 默认档可直接跑；显存吃紧先把 megapixels 降到 0.4。`;

twoNodes.find((n) => n.key === 'note').widgets = [twoNote];

/* ---------------- 三采 ---------------- */
const threeNote = `## H3 三采 · 首尾帧 · 0.4MP → 1.5× → 1.5×

**红色方块 = 需要你改的参数**（标题带 ★ 改这里）；**橙色方块 = 输出**（保存视频）。

**链路**
1. \`一采\`：0.4MP 跑 3 步，定动态与构图。
2. \`二采\`：视频潜空间 1.5× 后跑 3 步，中清段补结构。
3. \`三采\`：再 1.5× 后跑 3 步；首帧 @0 / 末帧 @-1 挂在最终分辨率的潜空间上，把落点钉死。
4. 解码 → 合视频（24fps，带音轨）。

**改哪里**
- 时长 → \`PrimitiveFloat\`（帧数自动按 24fps 对齐 17k+5，别手改）。
- 清晰度 ↔ 速度 → \`ResolutionSelector\` 的 megapixels，或改两个放大器的倍率。
- 三段步数分配 → 两个 \`SplitSigmas\` 的 step（总步数在 \`BasicScheduler\`，默认 3/3/3）。
- 提示词 → 写 H3 结构化三段；首帧、末帧分别选图。

**注意**
- 首末帧已预填（平台 fileName，本地原图在 rh-ui\\assets\\flf_first.png / flf_last.png）。${UPLOAD_HINT}
- 48G 机器按 8 秒 / 16:9 默认档可直接跑；显存吃紧先把 megapixels 降到 0.3。`;

const threeNodes = [
  { key: 'unet', type: 'UNETLoader', title: '加载 UNET（ref2va-v2 int8）', x: 0, y: 0, size: [420, 90], widgets: ['Minimax-h3_Singularity_ref2va-v2_int8.safetensors', 'default'] },
  { key: 'lora1', type: 'LoraLoaderModelOnly', title: 'LoRA · ref2v 4 步 turbo', x: 0, y: 140, size: [420, 90], widgets: ['minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', 1] },
  { key: 'lora2', type: 'LoraLoaderModelOnly', title: 'LoRA · lms 0.3', x: 0, y: 280, size: [420, 90], widgets: ['minimax_h3_lms_v1.0_r64.safetensors', 0.3] },
  { key: 'attn', type: 'ModelAttentionBackend', title: '注意力后端', x: 0, y: 420, size: [420, 70], widgets: ['comfy kitchen attention'] },
  { key: 'shift', type: 'MiniMaxH3SigmaShift', title: 'Sigma Shift 12 / 3', x: 0, y: 540, size: [420, 90], widgets: [12, 3] },
  { key: 'clip', type: 'CLIPLoader', title: '加载 CLIP', x: 0, y: 680, size: [420, 110], widgets: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors', 'minimax', 'default'] },
  { key: 'vaeV', type: 'VAELoader', title: '视频 VAE', x: 0, y: 840, size: [420, 60], widgets: ['minimax_h3_video_vae_int8_convrot.safetensors'] },
  { key: 'vaeA', type: 'VAELoader', title: '音频 VAE', x: 0, y: 940, size: [420, 60], widgets: ['minimax_h3_audio_vae_fp32.safetensors'] },

  { key: 'res', type: 'ResolutionSelector', title: '★ 改这里 · 一采分辨率 16:9 / 0.4MP', red: true, x: 560, y: 0, size: [300, 150], widgets: ['16:9 (Widescreen)', 0.4, 32] },
  { key: 'dur', type: 'PrimitiveFloat', title: '★ 改这里 · 时长（秒）', red: true, x: 560, y: 200, size: [300, 80], widgets: [8] },
  { key: 'math', type: 'ComfyMathExpression', title: '换算帧数（24fps，对齐 17k+5）', x: 560, y: 320, size: [300, 120], widgets: [FRAMES_EXPR] },
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 结构化 · 首尾帧）', red: true, x: 560, y: 480, size: [470, 340], widgets: [P_FLF] },
  { key: 'imgA', type: 'LoadImage', title: '★ 改这里 · 首帧（已预填）', red: true, x: 560, y: 860, size: [300, 330], widgets: [ASSETS.flfFirst, 'image'] },
  { key: 'imgB', type: 'LoadImage', title: '★ 改这里 · 末帧（已预填）', red: true, x: 900, y: 860, size: [300, 330], widgets: [ASSETS.flfLast, 'image'] },
  { key: 'scA', type: 'ImageScaleToTotalPixels', title: '首帧缩到 1.5MP', x: 560, y: 1230, size: [280, 110], widgets: ['nearest-exact', 1.5, 32] },
  { key: 'scB', type: 'ImageScaleToTotalPixels', title: '末帧缩到 1.5MP', x: 900, y: 1230, size: [280, 110], widgets: ['nearest-exact', 1.5, 32] },

  { key: 'i2v', type: 'MiniMaxH3ImageToVideo', title: 'MiniMax H3 首尾帧（出条件 + 潜空间）', x: 1140, y: 0, size: [320, 260], widgets: ['', 864, 480, 293] },
  { key: 'i2v2', type: 'MiniMaxH3ImageToVideo', title: '三采专用条件（不挂帧）', x: 1140, y: 320, size: [320, 220], widgets: ['', 864, 480, 293] },

  { key: 'sched', type: 'BasicScheduler', title: '调度器 9 步 / simple', x: 1540, y: 0, size: [290, 120], widgets: ['simple', 9, 1] },
  { key: 'splitA', type: 'SplitSigmas', title: '切分 A：一采 3 步', x: 1540, y: 170, size: [290, 90], widgets: [3] },
  { key: 'splitB', type: 'SplitSigmas', title: '切分 B：二采 3 步 / 三采 3 步', x: 1540, y: 310, size: [290, 90], widgets: [3] },
  { key: 'noise', type: 'RandomNoise', title: '★ 改这里 · 噪声种子（三采共用）', red: true, x: 1540, y: 450, size: [290, 90], widgets: [999, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1540, y: 580, size: [290, 70], widgets: ['euler'] },
  { key: 'g1', type: 'BasicGuider', title: '引导器 · 一采 / 二采', x: 1540, y: 690, size: [290, 60], widgets: [] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（0.4MP）', x: 1900, y: 0, size: [250, 170], widgets: [] },
  { key: 'sep1', type: 'LTXVSeparateAVLatent', title: '分离 AV', x: 1900, y: 230, size: [240, 60], widgets: [] },
  { key: 'up1', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 1.5×（只放视频）', x: 1900, y: 330, size: [430, 280], widgets: [UPSCALER_MODEL, 'scale by multiplier', 1.5, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat1', type: 'LTXVConcatAVLatent', title: '拼回音频', x: 1900, y: 650, size: [240, 60], widgets: [] },

  { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（中清）', x: 2400, y: 0, size: [250, 170], widgets: [] },
  { key: 'sep2', type: 'LTXVSeparateAVLatent', title: '分离 AV', x: 2400, y: 230, size: [240, 60], widgets: [] },
  { key: 'up2', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 1.5×（只放视频）', x: 2400, y: 330, size: [430, 280], widgets: [UPSCALER_MODEL, 'scale by multiplier', 1.5, 32, 'cuda', 'fp16', true, true] },
  { key: 'cat2', type: 'LTXVConcatAVLatent', title: '拼回音频', x: 2400, y: 650, size: [240, 60], widgets: [] },

  { key: 'guide1', type: 'MiniMaxH3AddGuide', title: '三采锚点：首帧 @0', x: 2900, y: 330, size: [300, 190], widgets: [0] },
  { key: 'guide2', type: 'MiniMaxH3AddGuide', title: '三采锚点：末帧 @-1', x: 2900, y: 560, size: [300, 190], widgets: [-1] },
  { key: 'g3', type: 'BasicGuider', title: '引导器 · 三采（挂首尾帧）', x: 2900, y: 790, size: [300, 60], widgets: [] },
  { key: 'pass3', type: 'SamplerCustomAdvanced', title: '三采（高清收尾）', x: 3280, y: 0, size: [250, 170], widgets: [] },

  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 3640, y: 0, size: [240, 60], widgets: [] },
  { key: 'adec', type: 'VAEDecodeAudio', title: '音频解码', x: 3640, y: 120, size: [240, 60], widgets: [] },
  { key: 'create', type: 'CreateVideo', title: '合成 24fps 视频', x: 3640, y: 240, size: [240, 190], widgets: [24, 8, 'sRGB', 'auto', 'none'] },
  { key: 'save', type: 'SaveVideo', title: '保存视频', orange: true, x: 3640, y: 480, size: [340, 240], widgets: ['video/H3_THREE_PASS', 'auto', 'auto', 'auto'] },

  { key: 'note', type: 'MarkdownNote', title: '说明', x: 4060, y: 0, size: [540, 700], widgets: [threeNote] },
];

const threeWires = [
  ['unet', 0, 'lora1', 'model'],
  ['lora1', 0, 'lora2', 'model'],
  ['lora2', 0, 'attn', 'model'],
  ['attn', 0, 'shift', 'model'],
  ['shift', 0, 'sched', 'model'],
  ['shift', 0, 'g1', 'model'],
  ['shift', 0, 'g3', 'model'],

  ['res', 0, 'i2v', 'width'],
  ['res', 1, 'i2v', 'height'],
  ['res', 0, 'i2v2', 'width'],
  ['res', 1, 'i2v2', 'height'],
  ['dur', 0, 'math', 'values.a'],
  ['math', 1, 'i2v', 'length'],
  ['math', 1, 'i2v2', 'length'],
  ['prompt', 0, 'i2v', 'prompt'],
  ['prompt', 0, 'i2v2', 'prompt'],
  ['clip', 0, 'i2v', 'clip'],
  ['clip', 0, 'i2v2', 'clip'],
  ['vaeV', 0, 'i2v', 'vae'],
  ['vaeV', 0, 'i2v2', 'vae'],
  ['imgA', 0, 'i2v', 'first_frame'],
  ['imgB', 0, 'i2v', 'last_frame'],
  ['imgA', 0, 'scA', 'image'],
  ['imgB', 0, 'scB', 'image'],

  ['sched', 0, 'splitA', 'sigmas'],
  ['splitA', 1, 'splitB', 'sigmas'],
  ['splitA', 0, 'pass1', 'sigmas'],
  ['splitB', 0, 'pass2', 'sigmas'],
  ['splitB', 1, 'pass3', 'sigmas'],
  ['noise', 0, 'pass1', 'noise'],
  ['noise', 0, 'pass2', 'noise'],
  ['noise', 0, 'pass3', 'noise'],
  ['ksel', 0, 'pass1', 'sampler'],
  ['ksel', 0, 'pass2', 'sampler'],
  ['ksel', 0, 'pass3', 'sampler'],
  ['i2v', 0, 'g1', 'conditioning'],
  ['g1', 0, 'pass1', 'guider'],
  ['g1', 0, 'pass2', 'guider'],
  ['i2v', 1, 'pass1', 'latent_image'],

  ['pass1', 1, 'sep1', 'av_latent'],
  ['sep1', 0, 'up1', 'latent'],
  ['up1', 0, 'cat1', 'video_latent'],
  ['sep1', 1, 'cat1', 'audio_latent'],
  ['cat1', 0, 'pass2', 'latent_image'],

  ['pass2', 1, 'sep2', 'av_latent'],
  ['sep2', 0, 'up2', 'latent'],
  ['up2', 0, 'cat2', 'video_latent'],
  ['sep2', 1, 'cat2', 'audio_latent'],
  ['cat2', 0, 'pass3', 'latent_image'],

  ['i2v2', 0, 'guide1', 'positive'],
  ['guide1', 0, 'guide2', 'positive'],
  ['guide2', 0, 'g3', 'conditioning'],
  ['g3', 0, 'pass3', 'guider'],
  ['cat2', 0, 'guide1', 'latent'],
  ['cat2', 0, 'guide2', 'latent'],
  ['scA', 0, 'guide1', 'image'],
  ['scB', 0, 'guide2', 'image'],
  ['vaeV', 0, 'guide1', 'vae'],
  ['vaeV', 0, 'guide2', 'vae'],

  ['pass3', 0, 'vdec', 'samples'],
  ['pass3', 0, 'adec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vaeA', 0, 'adec', 'vae'],
  ['vdec', 0, 'create', 'images'],
  ['adec', 0, 'create', 'audio'],
  ['create', 0, 'save', 'video'],
];

build({ file: 'H3_twopass_v1.ui.json', noteText: twoNote, nodes: twoNodes, wires: twoWires });
build({ file: 'H3_threepass_v1.ui.json', noteText: threeNodes.find((n) => n.key === 'note').widgets[0], nodes: threeNodes, wires: threeWires });
