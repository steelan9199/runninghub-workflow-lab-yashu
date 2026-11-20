// 生成器：改下面的常量或 assets/prompt.txt，重跑即生成 workflow.ui.json
// 用法：node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ==== 可调常量 ====
const WIDTH = 1344;
const HEIGHT = 768;
const DURATION = 14;      // 秒；会被吸附到 H3 的 17k+5 帧网格
const SEED = 20261120;
const TURBO = false;      // true = 8 步 turbo LoRA，false = 20 步原模型

// ==== 节点 ID（不要改） ====
const NODE_H3 = 5;
const NODE_DURATION = 15;
const NODE_SEED = 8;
const NODE_TURBO = 22;

const prompt = fs.readFileSync(path.join(DIR, 'assets', 'prompt.txt'), 'utf8').trim();
const graph = JSON.parse(fs.readFileSync(path.join(DIR, 'assets', 'base.ui.json'), 'utf8'));
const node = (id) => {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node ${id} not found in base.ui.json`);
  return n;
};

const raw = Math.max(5, Math.round(DURATION * 24));
// 注意：JS 的 % 对负数返回负值，必须先 +17 再取模，否则 14s 会算出 328 帧
const pad = (((5 - (raw % 17)) % 17) + 17) % 17;
const length = raw + pad;

const h3 = node(NODE_H3);
h3.widgets_values[0] = prompt;
h3.widgets_values[1] = WIDTH;
h3.widgets_values[2] = HEIGHT;
h3.widgets_values[3] = length;

node(NODE_DURATION).widgets_values[0] = DURATION;
node(NODE_SEED).widgets_values[0] = SEED;
node(NODE_TURBO).widgets_values[0] = TURBO;

fs.writeFileSync(path.join(DIR, 'workflow.ui.json'), JSON.stringify(graph, null, 2) + '\n');
console.log(`OK ${WIDTH}x${HEIGHT} ${DURATION}s -> ${length} 帧 = ${(length / 24).toFixed(3)}s, seed ${SEED}, turbo ${TURBO}`);
