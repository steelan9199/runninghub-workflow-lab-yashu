/**
 * 生成器：templates/base.ui.json + prompt.txt → workflow.ui.json
 * 只改这几个常量，其余接线一律不动。
 * 用法：node build.mjs [--video openapi/xxx.mp4]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- 可改参数 ----
const WIDTH = 864;              // 出片宽 = 生成宽（一采，不放大）
const HEIGHT = 736;             // 出片高 = 生成高
const FRAMES = 158;             // 必须 17k+5
const SEED = 0;                 // 0 = randomize（每次换种子）
const PREFIX = 'norman01_onepass';
const VIDEO = 'openapi/6eeeab9f8261a4f6ff01405dca790b5b2ad4fe2566d1043fb6530c0986e6a318.mp4';
// ------------------

const argv = process.argv.slice(2);
const vIdx = argv.indexOf('--video');
const video = vIdx >= 0 ? argv[vIdx + 1] : VIDEO;

if ((FRAMES - 5) % 17 !== 0) throw new Error(`FRAMES=${FRAMES} 不在 17k+5 网格`);

const j = JSON.parse(readFileSync(join(HERE, 'templates/base.ui.json'), 'utf8'));
const prompt = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
const byType = (t) => j.nodes.filter((n) => n.type === t);

for (const n of byType('MiniMaxH3ReferenceToVideo')) {
  n.widgets_values[1] = WIDTH;
  n.widgets_values[2] = HEIGHT;
  n.widgets_values[3] = FRAMES;
}
for (const n of byType('VHS_LoadVideo')) {
  n.widgets_values.video = video.startsWith('openapi/') ? video : `openapi/${video}`;
  n.widgets_values.frame_load_cap = FRAMES;
}
for (const n of byType('VHS_VideoCombine')) {
  n.widgets_values.filename_prefix = PREFIX;
  n.widgets_values.frame_rate = 24;
}
for (const n of byType('RandomNoise')) {
  n.widgets_values[0] = SEED || Math.floor(Math.random() * 1e15);
  n.widgets_values[1] = SEED ? 'fixed' : 'randomize';
}
for (const n of byType('PrimitiveStringMultiline')) {
  n.widgets_values[0] = prompt;
}

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 2));
console.log(`workflow.ui.json  ${WIDTH}x${HEIGHT} / ${FRAMES} 帧 / seed=${SEED || 'randomize'} / 提示词 ${prompt.length} 字`);
