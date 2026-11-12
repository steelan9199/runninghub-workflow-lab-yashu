#!/usr/bin/env node
/**
 * RunningHub 工作流实验室 —— 学（dump 语料）/ 写（本地 JSON）/ 测（直投 API）
 *
 *   node scripts/rhx.mjs smoke                                   # 全链路自检（无成本：上传→LoadImage→SaveImage→下载）
 *   node scripts/rhx.mjs learn <workflowId> [--tag 文生图]        # 把站上工作流 dump 进 corpus/
 *   node scripts/rhx.mjs index [--grep SaveImage]                # 看语料库
 *   node scripts/rhx.mjs run --workflow my.json --out <dir> \
 *        [--set 6.text="a cat"] [--image 3.image=<本地png>] \
 *        [--shell <workflowId>] [--name out] [--timeout 600] [--dry-run] [--no-download]
 *
 * 契约（2026-11-13 实测）：
 *   ① POST /task/openapi/create 的 workflowId 必填，缺 = {"code":301,"msg":"must not be null"}
 *   ② 同时给 workflow（完整 API 格式 JSON 字符串）时，跑的是这份图，不是站内那张
 *      （证据：把节点 1 改成不存在的类 → FAILED "Node 'bad' not found"）
 *   ③ 因此固定用一个空壳 workflowId 当通道；本技能默认 2120926368186851330（两个 showAnything，零成本）
 *
 * 退出码：0 成功 / 2 参数错 / 3 无 KEY / 4 提交失败 / 5 任务 FAILED / 6 超时 / 7 无产物
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const CORPUS = join(SKILL, 'corpus');
const INDEX = join(CORPUS, 'index.json');
const API = 'https://www.runninghub.cn/openapi/v2';
const ROOT = 'https://www.runninghub.cn';
const KEY = process.env.RUNNINGHUB_API_KEY || '';
const DEFAULT_SHELL = process.env.RH_SHELL || '2120926368186851330';

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : '';
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const flag = (n) => argv.includes(`--${n}`);
const all = (n) => argv.reduce((a, v, i) => (v === `--${n}` && argv[i + 1] ? [...a, argv[i + 1]] : a), []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (c, m) => { console.error(`[rhx] ${m}`); process.exit(c); };

if (!KEY && cmd) die(3, 'RUNNINGHUB_API_KEY 未设置（新开的终端才读得到用户环境变量）');

/* ---------- 传输：本机出网走 MITM 代理，TLS 常被中途 RST，底层重试 ---------- */
async function net(fn, label, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      console.warn(`[rhx] ${label} 第 ${i + 1} 次失败：${e.cause?.code || e.message}`);
      await sleep(800 * (i + 1));
    }
  }
  throw last;
}

const postJson = (path, body, base = API) => net(async () => {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* 非 json */ }
  return { ok: r.ok, status: r.status, json, text };
}, `POST ${path}`);

async function upload(file) {
  if (!existsSync(file)) die(2, `图片不存在：${file}`);
  const buf = readFileSync(file);
  const { r, text } = await net(async () => {
    const fd = new FormData();               // 每次重试都要重建，body 是一次性流
    fd.append('file', new Blob([buf]), basename(file));
    const resp = await fetch(`${API}/media/upload/binary`, {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd,
    });
    return { r: resp, text: await resp.text() };
  }, '上传图片');
  let j = null; try { j = JSON.parse(text); } catch { /* 非 json */ }
  if (!r.ok || !j || j.code !== 0 || !j.data) die(4, `上传失败 ${r.status} ${text.slice(0, 300)}`);
  if (!j.data.fileName) die(4, `上传返回里没有 fileName：${text.slice(0, 300)}`);
  return j.data.fileName;                    // 形如 openapi/xxxx.png，有效期 1 天
}

function extractUrls(obj) {
  const found = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') { if (/^https?:\/\//.test(v)) found.push(v); return; }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') {
      if (typeof v.url === 'string') found.push(v.url);
      if (typeof v.fileUrl === 'string') found.push(v.fileUrl);
      Object.values(v).forEach(walk);
    }
  };
  walk(obj);
  return [...new Set(found)];
}

const extOf = (u) => {
  const m = u.split('?')[0].match(/\.(png|jpe?g|webp|mp4|webm|gif|zip)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
};

async function download(url, file) {
  const n = await net(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(file, buf);
    return buf.length;
  }, '下载产物');
  return n;
}

/* ---------- 提交 / 轮询 ---------- */
async function submit(graph, shell) {
  const payload = {
    apiKey: KEY,
    workflowId: shell,
    workflow: JSON.stringify(graph),
    nodeInfoList: [],          // 一律空：参数直接写进图，避开"服务端拿已存图校验节点"的坑
    addMetadata: false,
    instanceType: arg('instance', 'default'),
    usePersonalQueue: false,
  };
  if (flag('dry-run')) { console.log(JSON.stringify({ ...payload, apiKey: '***' }, null, 1)); return { dryRun: true }; }
  let res = await postJson('/task/openapi/create', payload, ROOT);
  if (!res.ok || !(res.json?.taskId || res.json?.data?.taskId)) {
    const msg = res.text || '';
    if (String(res.json?.code) === '421' || /421/.test(msg)) await sleep(10000); else await sleep(3000);
    res = await postJson('/task/openapi/create', payload, ROOT);
  }
  const taskId = res.json?.taskId || res.json?.data?.taskId;
  if (!taskId) return { error: `E_SUBMIT ${res.status} ${(res.text || '').slice(0, 500)}` };
  console.log(`[rhx] 已提交 taskId=${taskId}（壳 workflowId=${shell}）`);
  return { taskId };
}

async function awaitTask(taskId, timeoutSec) {
  const limit = timeoutSec * 1000;
  const t0 = Date.now();
  while (Date.now() - t0 < limit) {
    await sleep(5000);
    let q;
    try { q = await postJson('/query', { taskId }); } catch { continue; }
    const j = q.json || {};
    const status = j.status || j.data?.status;
    const body = j.data && j.data.status ? j.data : j;
    if (status === 'SUCCESS') return { ok: true, body };
    if (status && !['QUEUED', 'RUNNING', 'CREATED', 'PENDING'].includes(status)) return { ok: false, body, error: `任务 ${status}` };
    process.stdout.write('.');
  }
  return { ok: false, error: `超时 ${timeoutSec}s` };
}

function failDetail(body) {
  const fr = body?.failedReason || {};
  const lines = [];
  if (fr.node_name || fr.node_id) lines.push(`崩在节点 ${fr.node_name || '?'}(${fr.node_id || '?'})`);
  if (fr.exception_type) lines.push(`类型 ${fr.exception_type}`);
  if (fr.exception_message) lines.push(`信息 ${fr.exception_message}`);
  if (fr.traceback) lines.push(`回溯 ${String(fr.traceback).slice(0, 400)}`);
  return lines.length ? lines.join('\n') : JSON.stringify(body).slice(0, 500);
}

/* ---------- run：本地 JSON 直投 ---------- */
async function applyOverrides(graph) {
  for (const spec of all('set')) {
    const i = spec.indexOf('=');
    if (i < 0) die(2, `--set 写法应为 nodeId.field=value：${spec}`);
    const path = spec.slice(0, i), raw = spec.slice(i + 1);
    const m = path.match(/^([^.]+)\.(.+)$/);
    if (!m) die(2, `--set 写法应为 nodeId.field=value：${spec}`);
    const [, id, field] = m;
    if (!graph[id]) die(2, `图里没有节点 ${id}（现有节点：${Object.keys(graph).join(', ')}）`);
    let val = raw;
    try { val = JSON.parse(raw); } catch { /* 保留字符串 */ }
    graph[id].inputs = graph[id].inputs || {};
    graph[id].inputs[field] = val;
    console.log(`[rhx] set ${id}.${field} = ${JSON.stringify(val)}`);
  }
  for (const spec of all('image')) {
    const i = spec.indexOf('=');
    if (i < 0) die(2, `--image 写法应为 nodeId.field=<本地路径|openapi/xxx.png>：${spec}`);
    const path = spec.slice(0, i), src = spec.slice(i + 1);
    const m = path.match(/^([^.]+)\.(.+)$/);
    if (!m) die(2, `--image 写法应为 nodeId.field=...：${spec}`);
    const [, id, field] = m;
    if (!graph[id]) die(2, `图里没有节点 ${id}`);
    const fileName = /^openapi\//.test(src) ? src : await upload(src);
    graph[id].inputs = graph[id].inputs || {};
    graph[id].inputs[field] = fileName;
    console.log(`[rhx] image ${id}.${field} = ${fileName}`);
  }
}

const OUT_NODE = /^(SaveImage|SaveVideo|SaveAudio|SaveAnimatedWEBP|VHS_VideoCombine|Image Save|PreviewImage)/i;

async function run() {
  const file = arg('workflow');
  if (!file) die(2, '缺 --workflow <本地 JSON>');
  if (!existsSync(file)) die(2, `文件不存在：${file}`);
  let graph;
  try { graph = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { die(2, `JSON 解析失败：${e.message}`); }
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) die(2, '顶层必须是 {"节点ID": {...}} 对象');
  for (const [id, n] of Object.entries(graph)) if (!n.class_type) die(2, `节点 ${id} 没有 class_type`);

  const shell = arg('shell', DEFAULT_SHELL);
  console.log(`[rhx] 图 ${basename(file)}：${Object.keys(graph).length} 个节点`);
  await applyOverrides(graph);

  const outs = Object.entries(graph).filter(([, n]) => OUT_NODE.test(n.class_type)).map(([id]) => id);
  if (!outs.length) console.warn('[rhx] ⚠ 图里没有输出节点（SaveImage/SaveVideo…）→ 任务会 SUCCESS 但 results 为空，取不到产物');

  const t0 = Date.now();
  const sub = await submit(graph, shell);
  if (sub.dryRun) return;
  if (sub.error) die(4, sub.error);

  const w = await awaitTask(sub.taskId, Number(arg('timeout', '600')));
  const outDir = resolve(arg('out', join(SKILL, 'out', new Date().toISOString().replace(/[:.]/g, '-'))));
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString();

  if (!w.ok) {
    console.error(`\n[rhx] ✗ ${w.error}\n${failDetail(w.body)}`);
    writeFileSync(join(outDir, '_rhx.result.json'), JSON.stringify({ taskId: sub.taskId, ok: false, error: w.error, body: w.body }, null, 1));
    appendFileSync(join(outDir, '_rhx.log.jsonl'), JSON.stringify({ t: stamp, file, shell, taskId: sub.taskId, status: 'FAILED', error: w.error }) + '\n');
    process.exit(5);
  }

  const urls = extractUrls(w.body);
  const files = [];
  if (!flag('no-download')) {
    const name = arg('name', 'out');
    for (let i = 0; i < urls.length; i++) {
      const f = join(outDir, `${name}_${i + 1}.${extOf(urls[i])}`);
      const size = await download(urls[i], f);
      files.push(f);
      console.log(`[rhx] ↓ ${f}（${(size / 1024).toFixed(1)} KB）`);
    }
  }
  const result = { taskId: sub.taskId, ok: true, shell, file, costMs: Date.now() - t0, urls, files, raw: flag('verbose') ? w.body : undefined };
  writeFileSync(join(outDir, '_rhx.result.json'), JSON.stringify(result, null, 1));
  appendFileSync(join(outDir, '_rhx.log.jsonl'), JSON.stringify({ t: stamp, file, shell, taskId: sub.taskId, status: 'SUCCESS', costMs: result.costMs, files }) + '\n');

  if (!urls.length) { console.error('[rhx] 任务 SUCCESS 但 results 为空（多半没有输出节点）'); process.exit(7); }
  console.log(`\n[rhx] ✓ ${urls.length} 个产物 → ${outDir}`);
}

/* ---------- learn / index：语料库 ---------- */
function loadIndex() {
  if (!existsSync(INDEX)) return { shell: DEFAULT_SHELL, workflows: {} };
  try { return JSON.parse(readFileSync(INDEX, 'utf8')); } catch { return { shell: DEFAULT_SHELL, workflows: {} }; }
}

async function learn(id) {
  if (!id) die(2, '用法：learn <workflowId>');
  const r = await postJson('/api/openapi/getJsonApiFormat', { apiKey: KEY, workflowId: id }, ROOT);
  if (r.json?.code !== 0) die(4, `拉图失败 code=${r.json?.code} ${r.json?.msg || r.text.slice(0, 200)}`);
  const graph = JSON.parse(r.json.data.prompt);
  mkdirSync(CORPUS, { recursive: true });
  const file = join(CORPUS, `wf_${id}.json`);
  writeFileSync(file, JSON.stringify(graph, null, 1));
  const classes = {};
  const outs = [];
  for (const [nid, n] of Object.entries(graph)) {
    classes[n.class_type] = (classes[n.class_type] || 0) + 1;
    if (OUT_NODE.test(n.class_type)) outs.push(`${nid}:${n.class_type}`);
  }
  const ix = loadIndex();
  ix.shell = DEFAULT_SHELL;
  ix.workflows[id] = {
    savedAt: new Date().toISOString(), nodes: Object.keys(graph).length,
    classes, outputs: outs, tag: arg('tag', ''), file: `corpus/wf_${id}.json`,
  };
  writeFileSync(INDEX, JSON.stringify(ix, null, 1));
  console.log(`[rhx] ✓ 已入库 corpus/wf_${id}.json`);
  console.log(`  节点 ${Object.keys(graph).length}：${Object.entries(classes).map(([k, v]) => `${k}×${v}`).join('、')}`);
  console.log(`  输出节点：${outs.length ? outs.join('、') : '无（这份图跑不出产物，只能当接线参考）'}`);
}

function showIndex() {
  const ix = loadIndex();
  const grep = arg('grep');
  const rows = Object.entries(ix.workflows).filter(([, w]) => !grep || JSON.stringify(w).includes(grep));
  if (!rows.length) { console.log('[rhx] 语料库是空的：先跑 learn <workflowId>'); return; }
  console.log(`壳 workflowId = ${ix.shell}\n`);
  for (const [id, w] of rows) {
    console.log(`${id}  ${w.savedAt?.slice(0, 10) || ''}  ${w.nodes} 节点  ${w.tag || ''}`);
    console.log(`   类：${Object.entries(w.classes || {}).map(([k, v]) => `${k}×${v}`).join('、')}`);
    console.log(`   输出：${(w.outputs || []).join('、') || '无'}   ${w.file}`);
  }
}

/* ---------- smoke：零成本全链路自检 ---------- */
const TBL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TBL[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1); raw[o] = 0;
    for (let x = 0; x < w; x++) { const p = o + 1 + x * 3; raw[p] = 40; raw[p + 1] = 120; raw[p + 2] = 220; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function smoke() {
  const png = join(tmpdir(), `rhx_smoke_${Date.now()}.png`);
  writeFileSync(png, makePng(64, 64));
  console.log(`[rhx] smoke：上传 ${basename(png)} → LoadImage → SaveImage → 下载`);
  const fileName = await upload(png);
  const graph = {
    '1': { class_type: 'LoadImage', inputs: { image: fileName }, _meta: { title: 'rhx smoke in' } },
    '2': { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'rhx_smoke' }, _meta: { title: 'rhx smoke out' } },
  };
  const shell = arg('shell', DEFAULT_SHELL);
  const sub = await submit(graph, shell);
  if (sub.error) die(4, sub.error);
  const w = await awaitTask(sub.taskId, 180);
  if (!w.ok) die(5, `${w.error}\n${failDetail(w.body)}`);
  const urls = extractUrls(w.body);
  if (!urls.length) die(7, 'SUCCESS 但 results 为空');
  const out = resolve(arg('out', join(tmpdir(), 'rhx-smoke')));
  mkdirSync(out, { recursive: true });
  const f = join(out, `smoke_1.${extOf(urls[0])}`);
  const size = await download(urls[0], f);
  console.log(`[rhx] ✓ smoke 通过：壳 ID 可用、上传可用、直投可用、产物可下载 → ${f}（${(size / 1024).toFixed(1)} KB）`);
}

/* ---------- 入口 ---------- */
if (cmd === 'run') await run();
else if (cmd === 'learn') await learn(argv[1] && !argv[1].startsWith('--') ? argv[1] : null);
else if (cmd === 'index') showIndex();
else if (cmd === 'smoke') await smoke();
else {
  console.log(`RunningHub 工作流实验室

  node scripts/rhx.mjs smoke                                 零成本全链路自检
  node scripts/rhx.mjs learn <workflowId> [--tag 名]          把站上工作流 dump 进 corpus/
  node scripts/rhx.mjs index [--grep 关键字]                  看语料库
  node scripts/rhx.mjs run --workflow <json> [--out dir]      本地 JSON 直投测试
        [--set 6.text="a cat"] [--image 3.image=<本地png>]
        [--shell <workflowId>] [--name out] [--timeout 600] [--dry-run] [--no-download] [--verbose]

  默认壳 workflowId：${DEFAULT_SHELL}（可用 --shell 或环境变量 RH_SHELL 覆盖）
  环境变量：RUNNINGHUB_API_KEY`);
}
