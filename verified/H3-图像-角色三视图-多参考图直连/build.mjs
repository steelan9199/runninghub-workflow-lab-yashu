#!/usr/bin/env node
/**
 * H3-Image 角色三视图 · 多参考图直连 —— 生成器
 *
 * 用法：
 *   node build.mjs                                   # 用 templates/base.ui.json 里已填好的图，原样产出
 *   node build.mjs --front A.png --face B.png --back C.png
 *                                                    # 上传 3 张本地图，替换后产出（需 RUNNINGHUB_API_KEY）
 *   node build.mjs --front openapi/xx.png --face openapi/yy.png --back openapi/zz.png
 *                                                    # 已是平台 fileName 时原样透传，不上传
 *
 * 产出：workflow.ui.json（网页导入用）+ workflow.api.json（rhx 直投用）
 * 图片顺序必须是：--front 正面全身（主图）/ --face 脸部特写 / --back 背面全身。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(ROOT, 'templates', 'base.ui.json');
const KEY = process.env.RUNNINGHUB_API_KEY || '';
const UPLOAD = 'https://www.runninghub.cn/openapi/v2/media/upload/binary';

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function resolveImage(v) {
  if (!v) return null;
  if (v.startsWith('openapi/') || v.startsWith('http://') || v.startsWith('https://')) return v;
  const p = path.resolve(v);
  if (!fs.existsSync(p)) throw new Error('图片不存在: ' + p);
  if (!KEY) throw new Error('上传本地图需要 RUNNINGHUB_API_KEY');
  const buf = fs.readFileSync(p);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), path.basename(p));
  const r = await fetch(UPLOAD, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: fd });
  const j = await r.json();
  if (j.code !== 0 || !j.data?.fileName) throw new Error('上传失败: ' + JSON.stringify(j));
  // 备份原图到 assets/
  const assets = path.join(ROOT, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(p, path.join(assets, path.basename(p)));
  console.log(`↑ ${path.basename(p)} -> ${j.data.fileName}`);
  return j.data.fileName;
}

const ui = JSON.parse(fs.readFileSync(BASE, 'utf8'));

const ids = { front: 504, face: 550, back: 195 };
const fileNames = {};
for (const role of ['front', 'face', 'back']) {
  const v = arg(role);
  if (v) fileNames[role] = await resolveImage(v);
}

for (const n of ui.nodes) {
  if (n.type !== 'LoadImage') continue;
  const role = Object.keys(ids).find(k => ids[k] === n.id);
  if (!role) continue;
  const fn = fileNames[role] || n.widgets_values[0];
  n.widgets_values = [fn, 'image'];
  n.widgets_values_named = { image: fn, upload: 'image' };
  if (n.properties) n.properties.guhaiImageValue = fn;
}

fs.writeFileSync(path.join(ROOT, 'workflow.ui.json'), JSON.stringify(ui, null, 2), 'utf8');

// API 图
const fn = {};
for (const n of ui.nodes) {
  if (n.type === 'LoadImage') {
    const role = Object.keys(ids).find(k => ids[k] === n.id);
    if (role) fn[role] = n.widgets_values[0];
  }
}
const cond = ui.nodes.find(n => n.id === 164);
const prompt = cond.widgets_values[0];
const width = 3168, height = 1280;

const api = {
  "1": { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_h3_image_pruned_bf16.safetensors', weight_dtype: 'default' } },
  "2": { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors', type: 'minimax', device: 'default' } },
  "3": { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_image_vae_fp16.safetensors' } },
  "10": { class_type: 'LoadImage', inputs: { image: fn.front } },
  "11": { class_type: 'LoadImage', inputs: { image: fn.face } },
  "12": { class_type: 'LoadImage', inputs: { image: fn.back } },
  "20": { class_type: 'MiniMaxH3ImageConditioning', inputs: { clip: ['2', 0], vae: ['3', 0], 'images.image_0': ['10', 0], 'images.image_1': ['11', 0], 'images.image_2': ['12', 0], prompt, width, height } },
  "21": { class_type: 'BasicGuider', inputs: { model: ['1', 0], conditioning: ['20', 0] } },
  "22": { class_type: 'RandomNoise', inputs: { noise_seed: 42 } },
  "23": { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  "24": { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.9675236940383911, 0.8875485062599182, 0.75, 0.5327739119529724, 0.23200887441635132, 0.0' } },
  "25": { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['22', 0], guider: ['21', 0], sampler: ['23', 0], sigmas: ['24', 0], latent_image: ['20', 1] } },
  "26": { class_type: 'VAEDecode', inputs: { samples: ['25', 0], vae: ['3', 0] } },
  "27": { class_type: 'SaveImage', inputs: { images: ['26', 0], filename_prefix: 'h3_threeview' } },
};
fs.writeFileSync(path.join(ROOT, 'workflow.api.json'), JSON.stringify(api, null, 2), 'utf8');

console.log('✓ workflow.ui.json / workflow.api.json 已更新');
console.log('  图片:', fn);
