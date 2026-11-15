/**
 * 自检 + 导出 API 格式（给 rhx.mjs run 用）
 * 用法：node check.mjs [dist/xxx.ui.json]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2]
  || (existsSync(join(HERE, 'workflow.ui.json')) ? join(HERE, 'workflow.ui.json') : join(HERE, 'dist/H3_duet_replace_twopass.ui.json'));
const j = JSON.parse(readFileSync(file, 'utf8'));
const nodes = j.nodes || [];
const links = j.links || [];
const byId = new Map(nodes.map((n) => [n.id, n]));

const errs = [];
const warns = [];

// 1. 连线自洽
const linkMap = new Map(links.map((l) => [l[0], l]));
for (const n of nodes) {
  for (const i of n.inputs || []) {
    if (i.link == null) continue;
    const l = linkMap.get(i.link);
    if (!l) { errs.push(`#${n.id} ${i.name} 指向不存在的 link ${i.link}`); continue; }
    if (l[3] !== n.id) errs.push(`L${i.link} 目标不是 #${n.id}`);
  }
  for (const o of n.outputs || []) {
    for (const id of o.links || []) {
      const l = linkMap.get(id);
      if (!l) { errs.push(`#${n.id} 输出指向不存在的 link ${id}`); continue; }
      if (l[1] !== n.id) errs.push(`L${id} 源不是 #${n.id}`);
    }
  }
}
for (const l of links) {
  const s = byId.get(l[1]);
  const d = byId.get(l[3]);
  if (!s || !d) { errs.push(`L${l[0]} 端点缺失`); continue; }
  if (!(d.inputs[l[4]] || {}).link) errs.push(`L${l[0]} 目标输入未回指`);
  if (!((s.outputs[l[2]] || {}).links || []).includes(l[0])) errs.push(`L${l[0]} 源输出未回指`);
}

// 2. 素材非空
for (const n of nodes) {
  if (n.type === 'LoadImage') {
    const v = (n.widgets_values || [])[0];
    if (!v || !v.startsWith('openapi/')) errs.push(`#${n.id} LoadImage 未填平台 fileName：${v}`);
  }
  if (n.type === 'VHS_LoadVideo') {
    const v = (n.widgets_values || {}).video;
    if (!v || !v.startsWith('openapi/')) errs.push(`#${n.id} VHS_LoadVideo 未填平台 fileName：${v}`);
  }
}

// 3. 输出节点
const outs = nodes.filter((n) => ['VHS_VideoCombine', 'SaveVideo', 'SaveImage'].includes(n.type));
if (!outs.length) errs.push('没有输出节点');
for (const o of outs) {
  const need = o.type === 'VHS_VideoCombine' ? ['images', 'audio'] : ['images'];
  for (const name of need) {
    const i = (o.inputs || []).find((x) => x.name === name);
    if (!i || i.link == null) errs.push(`输出节点 #${o.id} 缺少 ${name}`);
  }
}

// 4. 配色
const red = nodes.filter((n) => n.color === '#c0392b');
const orange = nodes.filter((n) => n.color === '#d35400');
const both = nodes.filter((n) => n.color === '#c0392b' && n.bgcolor === '#5a3208');
if (!red.length) errs.push('没有红色可改节点');
if (!orange.length) errs.push('没有橙色输出节点');
if (both.length) errs.push('有节点同时是红/橙');
if (red.length > 6) warns.push(`红块 ${red.length} 个，超过 6 个会失去指路作用`);

// 5. 帧数网格
const r2v = nodes.find((n) => n.type === 'MiniMaxH3ReferenceToVideo');
const lengthWidget = r2v?.outputs ? null : null;
const len = r2v?.inputs?.find((i) => i.name === 'length')?.widget?.value;
const lenVal = r2v?.widgets_values?.[3];
const vid = nodes.find((n) => n.type === 'VHS_LoadVideo')?.widgets_values?.frame_load_cap;
if (lenVal != null && ((lenVal - 5) % 17 !== 0)) errs.push(`length=${lenVal} 不在 17k+5 网格`);
if (vid != null && lenVal != null && vid !== lenVal) errs.push(`frame_load_cap=${vid} 与 length=${lenVal} 不一致`);

console.log(`节点 ${nodes.length} / 连线 ${links.length} / 红 ${red.length} 橙 ${orange.length}`);
if (warns.length) console.log('WARN:\n  ' + warns.join('\n  '));
if (errs.length) {
  console.log('FAIL:\n  ' + errs.join('\n  '));
  process.exit(1);
}
console.log('✓ 自检通过');

/* ---------------- 导出 API 格式 ---------------- */
const API_WIDGET_OK = {
  LoadImage: ['image'],
  PrimitiveStringMultiline: ['value'],
  UNETLoader: ['unet_name', 'weight_dtype'],
  CLIPLoader: ['clip_name', 'type', 'device'],
  VAELoader: ['vae_name'],
  LoraLoaderModelOnly: ['lora_name', 'strength_model'],
  BasicScheduler: ['scheduler', 'steps', 'denoise'],
  KSamplerSelect: ['sampler_name'],
  RandomNoise: ['noise_seed', 'control_after_generate'],
  H3SigmaRefiner: ['extra_steps', 'start_at_sigma', 'end_at_sigma', 'spacing'],
  SplitSigmas: ['step'],
  MinimaxH3LatentUpscaler3D: ['model_name', 'mode', 'mode.scale', 'align', 'device', 'precision', 'enable_chunking', 'force_unload'],
  PathchSageAttentionKJ: ['sage_attention', 'allow_compile'],
  ComfyMathExpression: ['expression'],
};

const api = {};
const SKIP = new Set(['MarkdownNote', 'Note', 'VRAM_Debug']);
for (const n of nodes) {
  if (SKIP.has(n.type)) continue;
  const inputs = {};
  // 先把 widget 值按名字写进去
  if (n.type === 'VHS_LoadVideo') {
    const w = n.widgets_values || {};
    for (const k of ['video', 'force_rate', 'force_size', 'custom_width', 'custom_height', 'frame_load_cap', 'skip_first_frames', 'select_every_nth', 'format']) {
      if (w[k] !== undefined) inputs[k] = w[k];
    }
  } else if (n.type === 'VHS_VideoCombine') {
    const w = n.widgets_values || {};
    for (const k of ['frame_rate', 'loop_count', 'filename_prefix', 'format', 'pix_fmt', 'crf', 'save_output', 'save_metadata', 'trim_to_audio']) {
      if (w[k] !== undefined) inputs[k] = w[k];
    }
  } else if (n.widgets_values && !Array.isArray(n.widgets_values)) {
    Object.assign(inputs, n.widgets_values);
  } else if (Array.isArray(n.widgets_values)) {
    const names = API_WIDGET_OK[n.type];
    if (names) {
      names.forEach((name, k) => {
        if (k < n.widgets_values.length && n.widgets_values[k] !== undefined) inputs[name] = n.widgets_values[k];
      });
    }
    // 其余节点用「widget 输入顺序」兜底
    const wi = (n.inputs || []).filter((i) => i.widget && i.widget.name);
    if (!names && wi.length) {
      wi.forEach((i, k) => {
        if (k < n.widgets_values.length) inputs[i.widget.name] = n.widgets_values[k];
      });
    }
  }
  // 连线覆盖
  for (let k = 0; k < (n.inputs || []).length; k += 1) {
    const i = n.inputs[k];
    if (i.link == null) continue;
    const l = linkMap.get(i.link);
    let src = byId.get(l[1]);
    let slot = l[2];
    // 纯 UI 的透传节点（VRAM_Debug 等）在 API 里不存在，顺着它的输入继续找真源
    let hops = 0;
    while (SKIP.has(src.type) && hops < 8) {
      const pass = (src.inputs || []).find((x) => x.name === 'any_input') || (src.inputs || []).find((x) => x.link != null);
      if (!pass || pass.link == null) break;
      const pl = linkMap.get(pass.link);
      src = byId.get(pl[1]);
      slot = pl[2];
      hops += 1;
    }
    inputs[i.name] = [String(src.id), slot];
  }
  api[String(n.id)] = { class_type: n.type, inputs };
}

const apiPath = join(dirname(file), basename(file).replace(/\.ui\.json$/, '.api.json'));
writeFileSync(apiPath, JSON.stringify(api, null, 1));
console.log(`API 版：${apiPath}  节点 ${Object.keys(api).length}`);
