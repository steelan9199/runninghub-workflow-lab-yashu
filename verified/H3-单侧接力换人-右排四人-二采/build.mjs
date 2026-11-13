/**
 * H3 董事会广角（03 片段）· 分三轮换人 · 二采版 UI 工作流生成器
 *
 * 底座：verified/H3-七人换人-董事会宽景-二采（同一支源片 842×720 / 24fps）
 * 一镜 8 人 + 1 只画外手 = 9 个位置 → 拆 L / R / F 三轮：
 *   L：左排 2 人 + 桌首站立（3 张参考图）
 *   R：右排 4 人（4 张参考图）
 *   F：前景后脑 + 左下角画外手（2 张参考图）
 * 三轮同种子、同分辨率、同帧数，跑完用 composite.mjs 按静态羽化遮罩依次贴回。
 *
 * 2026-11-14 教训：5 张参考图一次给，H3 会把红袍角色摊满整排并多生出人；
 * 所以每轮都写死「人数锁 + 构图锁」，且每轮参考图不超过 4 张。
 *
 * 源片：assets/source03.mp4  842×720 / 24fps / AAC 44.1k / 72 帧 / 3.00s
 * 帧数：73（17×4+5 网格；源 72 帧 → 末帧补 1 帧）
 *
 * 用法：node build.mjs
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
const FRAMES = 73;
const WIDTH = 832;
const HEIGHT = 704;
const UPSCALE = 2;
const SEED = 20261114;              // ★ 三轮必须同一个种子
// 参考视频走「滚雪球」：每一轮都喂上一轮的成片，最终片 = F 轮输出，不需要再合成
const VIDEO_L = 'openapi/1bec77dbcc1b96ab8fed1b479f0c2634d9fe3d7c1be5ee21e0f0352122b3f717.mp4'; // 原片 03.mp4
const VIDEO_R = 'openapi/d0f0e3fbe89801f469bd9bf225676b62fffbc99a3db67dac96e66b05a2dc965e.mp4'; // L 轮成片 03-1.mp4
const VIDEO_F = 'openapi/d0f0e3fbe89801f469bd9bf225676b62fffbc99a3db67dac96e66b05a2dc965e.mp4'; // 占位＝L 轮成片；跑完 R 后换成 R 轮成片

const IMG = {
  renwu2: 'openapi/3daceebc09d0e10e8fbab86de5106cdca8f275dfab04d1aaaf8fdbf78ce2acf3.png',
  lvfang: 'openapi/025df0d4c693b8d51f040bdda8a2f29b4684ee1c669bfe21a46d7005e3f07c0d.png',
  huzongxian: 'openapi/3981ed54d8ec515429cbdb995a52e75953d5453b3c6ce4b9052128988b3eb075.png',
  yansong: 'openapi/0bef7cac7e2fcbc7b33b328a7abef2ea02e47cc00b6db3aade7bc7741f18eabe.png',
  xujie: 'openapi/5bade78c180a6c7bff3e9f7293fdd9b7f29515a918bce8bca544b907673dd105.png',
  gaogong: 'openapi/04eca517dcf9a3152ec1511c8ddbe3f2a43b23f6d3012803869d449c66ffe224.png',
  zhangjuzheng: 'openapi/9a7f61b3ef9c2d32bbe2856c4efcd5646997be2ed20e9c7d76dbb4f43f804d73.png',
  yuwang: 'openapi/c8a5fb11528e7afa62f0aa9538908d51c3a6263221f8f22ee1cca70a1c82e7a9.png',
  chenhong: 'openapi/2b23ab9d9486cf30bca0dd56b8f4b91b411c9648f0b36e59c9c3725b2a6770e6.png',
};

const SCENE = `corporate boardroom seen from the near end of a long glossy black conference table that runs away from the camera, a large raised "OSCORP" wall sign on the far wall, two rows of white recessed ceiling spots, pale grey walls, a dark sideboard holding bottles and glasses, and white teacups and saucers set along both sides of the table`;

// 每轮都带的三段硬锁（人数 / 构图 / 去重）
const LOCK_PEOPLE = `FRAME COUNT LOCK: the target video contains exactly the same nine bodies as <Video 1> and not one more - one man standing at the head of the table, two men in the left row, four men in the right row, one large figure seated in the foreground with his back to the camera, and one cropped forearm and hand at the bottom-left corner. Do not add, duplicate, extend, clone or invent any person, head, face, shoulder, hand, or background figure anywhere in the frame; any seat that is empty in <Video 1> stays empty; the background stays exactly as empty of people as in <Video 1>.`;
const LOCK_CAMERA = `FRAME GEOMETRY LOCK: the camera lens, distance, height, tilt and field of view stay identical to <Video 1>, the table keeps its exact length and perspective, the OSCORP sign stays in the same place and the same size, and every person keeps the same size in the frame as in <Video 1>.`;
const LOCK_ONCE = `Each listed subject appears exactly once, only in its own seat, and is never duplicated, repeated along a row, or moved to another seat.`;
const LOCK_MOTION = `GAZE IS STATIC, NOT AN ACTION: every person simply looks at the standing man in the pale blue robe at the head of the table and otherwise stays completely still. Looking is a fixed eye direction, never a movement - nobody turns his head, nobody shakes his head, nobody nods, nobody tilts his head or leans further, and no two people rotate their heads the same way. Every head, shoulder and torso keeps the exact angle it already has in <Video 1> from the first frame to the last, with the same gaze direction, the same blink pattern and the same expression; the only movement in the frame is the movement already present in <Video 1>.`;

/* ---------------- L 轮：左排 2 人 + 桌首站立 ---------------- */
const PROMPT_L = `subject_definitions:
<Video 1> is the source video for the target video edit: a three-second single locked-off wide shot of a ${SCENE}.
<Audio 1> is the synchronized audio track of <Video 1> and is reused unchanged as the target video's complete final audio track.
<Subject 1> is Lü Fang, taken from <Picture 1>: a middle-aged court eunuch, clean-shaven with no beard, wearing a tall red hood with gold vertical stripes and dark swirl patterns and long red ear flaps hanging beside his face, a red robe embroidered with gold roundels and blue cloud borders, a beaded necklace and a black belt set with jade plaques. He sits in the left row on the seat nearest the far end of the table, turned three-quarters toward the camera and looking across at the standing man.
<Subject 2> is Hu Zongxian, taken from <Picture 2>: a Chinese official with a short black beard and moustache, a black hat with gold vertical stripes and two short upturned side wings, and a red robe with a large square gold-embroidered rank badge on the chest. He sits in the left row on the seat closest to the camera, cropped by the left frame border so that only his head, one shoulder and one forearm resting on the table are inside the frame.
<Subject 3> is the young nobleman in <Picture 3>: black hair gathered into a topknot held by a small engraved gold crown with a long horizontal gold pin, a thin dark moustache and a long thin dark beard, and a pale blue robe with a wide indigo collar embroidered with silver cloud scrolls. He stands at the head of the table where the speaker in <Video 1> stands, both arms spread wide and slightly forward with the palms open.
The other six people in <Video 1> are not replaced: the four men in the right row, the large grey-haired figure in the foreground with his back to the camera and the arm at the bottom-left corner all keep exactly the appearance, clothing and pose they have in <Video 1>.

summary:
[video editing + audio reuse] The target video is an edited version of <Video 1>: the two men in the left row and the standing man at the head of the table are replaced one for one, in the same seats and the same poses, by <Subject 1>, <Subject 2> and <Subject 3>, each wearing the costume, headwear and hairstyle shown in their reference picture, while every other person, the locked-off wide framing, the black table, the teacups, the OSCORP wall sign and the room background stay identical, and <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (framing and staging): fully_preserved - the single continuous shot, the wide view from the near end of the table, the reflective black tabletop, the OSCORP wall sign, the white ceiling spots, the sideboard behind the speaker, the white teacups, and the faint handheld drift with no cut, zoom or reframing.
<Subject 1> (left row, far seat): fully_preserved - tall red hood with gold stripes and ear flaps, red embroidered robe, beaded necklace, jade-studded belt, and the clean-shaven face.
<Subject 2> (left row, near seat, cropped): fully_preserved - short black beard, gold-striped black hat with upturned side wings, red robe with a large square chest badge, and only the head, one shoulder and one forearm remaining inside the frame.
<Subject 3> (head of the table, standing): fully_preserved - pale blue robe, indigo cloud collar, black topknot with the gold crown and horizontal pin, thin dark beard, and both arms spread wide with open palms.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage, wide static shot from the near end of a long boardroom table, glossy black reflections on the tabletop, soft overhead office lighting from the white ceiling spots, fine film grain, pale grey walls and a large raised metal "OSCORP" sign on the far wall.
[Shot 1] The frame holds steady with only the faint handheld drift of <Video 1>. <Subject 3> stands at the head of the table directly under the OSCORP sign, facing the camera with both arms spread wide, then lowers his hands and brings them together in front of his chest as he speaks. In the left row <Subject 1> sits at the far seat with his head turned toward <Subject 3>, the red ear flaps of his hood hanging still beside his face, while <Subject 2> sits at the near seat at the extreme left edge of the frame, cropped by the border, his forearm flat on the table. The right row, the foreground and the background do not change at all.
Every replaced person keeps the exact performance of their counterpart in <Video 1>: the same head tilt, the same gaze direction, the same blink rhythm and the same lip movement at the same moments.
The three are three different individuals and must stay visibly distinct: only <Subject 1> wears a tall red hood with ear flaps and is clean-shaven; only <Subject 2> has a short black beard with a moustache and a gold-striped hat with upturned wings; only <Subject 3> wears a pale blue robe with a gold crown and has no official's hat. Never swap two faces, never merge two people into one, never duplicate a face, and never give any of them a western suit, necktie or short modern haircut.
${LOCK_PEOPLE} ${LOCK_CAMERA} ${LOCK_ONCE}
${LOCK_MOTION} The camera never moves closer, never tilts, never pans, never cuts, and nobody stands up, enters or leaves the frame.

overall_soundscape:
Quiet boardroom room tone with a faint ventilation hum and a few distant footstep echoes, all carried by <Audio 1>, which also holds the English dialogue; the sound stays unchanged from the first to the last frame.

non_diegetic_music:
N/A`;

/* ---------------- R 轮：右排 4 人 ---------------- */
const PROMPT_R = `subject_definitions:
<Video 1> is the source video for the target video edit: a three-second single locked-off wide shot of a ${SCENE}.
<Audio 1> is the synchronized audio track of <Video 1> and is reused unchanged as the target video's complete final audio track.
<Subject 1> is Yan Song, taken from <Picture 1>: a very old Chinese official with a long white beard reaching his chest, deep-set eyes and wrinkled skin, a black hat with two very long straight horizontal side wings, and a red robe with a square gold-embroidered rank badge. He sits in the right row on the seat nearest the far end, leaning forward over the table with his head held perfectly still, his eyes resting on the man standing in the pale blue robe at the head of the table.
<Subject 2> is Xu Jie, taken from <Picture 2>: an older Chinese official with a grey beard, a black hat with gold vertical stripes and two short upturned side wings, and a red robe with a square gold-embroidered rank badge. He sits in the right row on the second seat from the far end with one hand on a black leather folder, his head perfectly still and his eyes resting on the man standing in the pale blue robe.
<Subject 3> is Gao Gong, taken from <Picture 3>: an elderly Chinese official whose head is covered by a black official's hat with gold vertical stripes and two upturned side wings, with a short grey moustache and beard and a red robe with a round embroidered rank badge. His hat stays on his head in every frame and his head is never bare. He sits in the right row on the third seat from the far end, his head perfectly still and his eyes resting on the man standing in the pale blue robe.
<Subject 4> is Zhang Juzheng, taken from <Picture 4>: a middle-aged Chinese official with a long black beard reaching his chest, a black hat with side wings and a red robe with a round rank badge. He sits in the right row on the fourth seat, cropped by the right frame border so that only his left shoulder, upper arm and the side of his hat are inside the frame, his head perfectly still and his eyes resting on the man standing in the pale blue robe.
All four men in the right row only look at the standing man in the pale blue robe: they keep their heads still for the whole shot and never turn, nod, shake their heads, lean further or change posture.
<Subject 5> is Lü Fang, already rendered in <Video 1> and not to be changed in this pass: a clean-shaven middle-aged eunuch in a tall red hood with gold vertical stripes, dark swirl patterns and long red ear flaps, a red robe embroidered with gold roundels and blue cloud borders, a beaded necklace and a jade-studded belt, seated in the left row at the seat nearest the far end.
<Subject 6> is Hu Zongxian, already rendered in <Video 1> and not to be changed in this pass: a man with a short black beard and moustache, a black hat with gold vertical stripes and two short upturned side wings, and a red robe with a large square gold-embroidered chest badge, seated in the left row at the near seat, cropped by the left frame border.
<Subject 7> is the young nobleman, already rendered in <Video 1> and not to be changed in this pass: long black hair in a topknot held by a small gold crown with a horizontal gold pin, a thin dark beard and a pale blue robe with an indigo cloud collar, standing at the head of the table.
The remaining two people in <Video 1> - the large grey-haired figure in the foreground with his back to the camera and the arm at the bottom-left corner - also keep exactly the appearance, clothing and pose they have in <Video 1>.

summary:
[video editing + audio reuse] The target video is an edited version of <Video 1>: the four men seated along the right row are replaced one for one, in the same seats and the same poses, by <Subject 1> to <Subject 4>, each wearing the costume, headwear and hairstyle shown in their reference picture, while <Subject 5>, <Subject 6> and <Subject 7> stay exactly as they are already rendered in <Video 1> - the red hood and red robe in the left row, the gold-striped hat beside him, and the pale blue robe and gold crown at the head of the table - and the locked-off wide framing, the black table, the teacups, the OSCORP wall sign and the room background stay identical, and <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (framing and staging): fully_preserved - the single continuous shot, the wide view from the near end of the table, the reflective black tabletop, the OSCORP wall sign, the white ceiling spots, the white teacups, and the faint handheld drift with no cut, zoom or reframing.
<Subject 1> (right row, far seat): fully_preserved - long white beard, black hat with very long horizontal side wings, red robe with a square chest badge, and the forward lean.
<Subject 2> (right row, second seat): fully_preserved - grey beard, gold-striped black hat with upturned side wings, red robe with a square chest badge, and the hand on the black leather folder.
<Subject 3> (right row, third seat): fully_preserved - black official's hat with gold vertical stripes and upturned side wings worn at all times, short grey moustache and beard, red robe with a round chest badge, and the slightly lowered chin.
<Subject 4> (right row, fourth seat, cropped): fully_preserved - long black beard, black hat and red robe, with only the left shoulder, upper arm and the side of the hat remaining inside the frame.
<Subject 5> (left row, far seat): fully_preserved - kept exactly as already rendered in <Video 1>: tall red hood with gold stripes and red ear flaps, red embroidered robe, jade-studded belt, clean-shaven face.
<Subject 6> (left row, near seat, cropped): fully_preserved - kept exactly as already rendered in <Video 1>: short black beard, gold-striped black hat with upturned side wings, red robe with a large square chest badge.
<Subject 7> (head of the table, standing): fully_preserved - kept exactly as already rendered in <Video 1>: pale blue robe with an indigo cloud collar, black topknot, small gold crown with a horizontal pin, thin dark beard.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage, wide static shot from the near end of a long boardroom table, glossy black reflections on the tabletop, soft overhead office lighting from the white ceiling spots, fine film grain, pale grey walls and a large raised metal "OSCORP" sign on the far wall.
[Shot 1] The frame holds steady with only the faint handheld drift of <Video 1>. In the right row <Subject 1> leans forward over the table with his eyes on the standing speaker and his white beard catching the overhead light; <Subject 2> sits upright beside him with one hand resting on a black leather folder; <Subject 3> sits in the third seat with his black official's hat on his head, his chin slightly lowered and his hands near a white teacup; and at the extreme right edge <Subject 4> is cropped by the frame border so that only the left shoulder, upper arm and the side of his hat are visible. In the left row <Subject 5> keeps his tall red hood, his red embroidered robe and his clean-shaven face with his head held at exactly the same angle as in <Video 1>, and <Subject 6> at the near left edge keeps his short black beard, his gold-striped hat and his red robe, cropped by the border as before. At the head of the table <Subject 7> keeps his pale blue robe, his gold crown and his clasped hands, his lips moving exactly as in <Video 1>. The two left-row men are never turned back into men in western suits. The foreground and the background do not change.
Every replaced person keeps the exact performance of their counterpart in <Video 1>: the same head tilt, the same gaze direction, the same blink rhythm and the same lip movement at the same moments.
The four are four different individuals and must stay visibly distinct: only <Subject 1> has a long white beard and very long straight horizontal hat wings; only <Subject 2> has a grey beard with a gold-striped hat; only <Subject 3> has a short grey moustache under a gold-striped hat with upturned wings; only <Subject 4> has a long black beard reaching his chest. Never swap two faces, never merge two people into one, never duplicate a face along the row, and never give any of them a western suit, necktie or short modern haircut.
${LOCK_PEOPLE} ${LOCK_CAMERA} ${LOCK_ONCE}
${LOCK_MOTION} The camera never moves closer, never tilts, never pans, never cuts, and nobody stands up, enters or leaves the frame.

overall_soundscape:
Quiet boardroom room tone with a faint ventilation hum and a few distant footstep echoes, all carried by <Audio 1>, which also holds the English dialogue; the sound stays unchanged from the first to the last frame.

non_diegetic_music:
N/A`;

/* ---------------- F 轮：前景后脑 + 左下角画外手 ---------------- */
const PROMPT_F = `subject_definitions:
<Video 1> is the source video for the target video edit: a three-second single locked-off wide shot of a ${SCENE}.
<Audio 1> is the synchronized audio track of <Video 1> and is reused unchanged as the target video's complete final audio track.
<Subject 1> is Yu Wang, taken from <Picture 1>: a Chinese nobleman in a black robe embroidered in gold, his hair gathered into a topknot held by a small gold crown. He sits in the foreground at the near end of the table with his back to the camera, so only the back of his head, his shoulders and the gold band of the crown are inside the frame.
<Subject 2> is Chen Hong, taken from <Picture 2>: a middle-aged Chinese eunuch wearing a red robe with gold embroidery and a black skullcap. In <Video 1> only his right forearm and hand are inside the frame in the bottom-left corner, the red sleeve resting on the table edge; his head, face and body stay outside the frame.
<Subject 3> is the young nobleman at the head of the table, already rendered in <Video 1> and not to be changed in this pass: long black hair in a topknot held by a small gold crown with a horizontal gold pin, a thin dark beard and a pale blue robe with an indigo cloud collar, standing under the OSCORP sign.
<Subject 4> is Lü Fang in the left row, already rendered in <Video 1> and not to be changed in this pass: a clean-shaven middle-aged eunuch in a tall red hood with gold vertical stripes and long red ear flaps, a red robe with gold roundels and a jade-studded belt.
<Subject 5> is Hu Zongxian in the left row, already rendered in <Video 1> and not to be changed in this pass: a short black beard, a black hat with gold vertical stripes and two short upturned side wings, and a red robe with a large square chest badge, cropped by the left frame border.
<Subject 6> is Yan Song in the right row, already rendered in <Video 1> and not to be changed in this pass: a very old man with a long white beard reaching his chest and a black hat with two very long straight horizontal side wings, leaning forward over the table.
<Subject 7> is Xu Jie in the right row, already rendered in <Video 1> and not to be changed in this pass: a grey beard and a black hat with gold vertical stripes and two short upturned side wings.
<Subject 8> is Gao Gong in the right row, already rendered in <Video 1> and not to be changed in this pass: a short grey moustache and beard under a black official's hat with gold vertical stripes and upturned side wings, his hat always on and his head never bare.
<Subject 9> is Zhang Juzheng in the right row, already rendered in <Video 1> and not to be changed in this pass: a long black beard reaching his chest and a black hat with side wings, cropped by the right frame border.
All seven keep exactly the faces, beards, hats and robes they already have in <Video 1>. None of them is turned back into a man in a western suit, none of their seats becomes empty, and none of their hats is removed.

summary:
[video editing + audio reuse] The target video is an edited version of <Video 1>: the large figure seated in the foreground with his back to the camera and the off-screen owner of the hand in the bottom-left corner are replaced one for one, in the same positions and the same poses, by <Subject 1> and <Subject 2>, while <Subject 3> to <Subject 9> stay exactly as they are already rendered in <Video 1> - the pale blue robe and gold crown at the head of the table, the red hood and the gold-striped hat in the left row and the four red-robed officials with their hats and their white, grey and black beards in the right row - and the locked-off wide framing, the black table, the teacups, the OSCORP wall sign and the room background stay identical, and <Audio 1> is reused as the complete final audio track.

retention_analysis:
<Video 1> (framing and staging): fully_preserved - the single continuous shot, the wide view from the near end of the table, the reflective black tabletop, the OSCORP wall sign, the white ceiling spots, the white teacups, and the faint handheld drift with no cut, zoom or reframing.
<Subject 1> (foreground, back to camera): fully_preserved - black and gold embroidered robe, black hair and the gold crown band, seen only from behind, with the same head size and the same position in the lower centre of the frame.
<Subject 2> (bottom-left corner, cropped): fully_preserved - only the red-sleeved right forearm and hand remain inside the frame; no face or torso is invented.
<Subject 3> (head of the table, standing): fully_preserved - kept exactly as already rendered in <Video 1>: pale blue robe, indigo cloud collar, black topknot, small gold crown with a horizontal pin, thin dark beard.
<Subject 4> (left row, far seat): fully_preserved - kept exactly as already rendered in <Video 1>: tall red hood with gold stripes and red ear flaps, red embroidered robe, jade-studded belt, clean-shaven face.
<Subject 5> (left row, near seat, cropped): fully_preserved - kept exactly as already rendered in <Video 1>: short black beard, gold-striped black hat with upturned side wings, red robe with a large square chest badge.
<Subject 6> (right row, far seat): fully_preserved - kept exactly as already rendered in <Video 1>: long white beard, black hat with very long horizontal side wings, red robe, forward lean.
<Subject 7> (right row, second seat): fully_preserved - kept exactly as already rendered in <Video 1>: grey beard, gold-striped black hat with upturned side wings, red robe with a square chest badge.
<Subject 8> (right row, third seat): fully_preserved - kept exactly as already rendered in <Video 1>: black gold-striped hat worn at all times, short grey moustache and beard, red robe with a round chest badge.
<Subject 9> (right row, fourth seat, cropped): fully_preserved - kept exactly as already rendered in <Video 1>: long black beard, black hat, red robe, cropped by the right frame border.
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.

detailed_description:
Live-action footage, wide static shot from the near end of a long boardroom table, glossy black reflections on the tabletop, soft overhead office lighting from the white ceiling spots, fine film grain, pale grey walls and a large raised metal "OSCORP" sign on the far wall.
[Shot 1] The frame holds steady with only the faint handheld drift of <Video 1>. <Subject 1> fills the lower centre of the frame with his back to the camera, only the back of his head, his shoulders and the gold band of his crown visible above the black leather chair, and he does not turn around or move his head. At the bottom-left corner <Subject 2> shows only a red-sleeved forearm and hand resting on the table edge, and the hand does not move. The head of the table and both rows keep the seven figures already rendered in <Video 1> exactly as they are: <Subject 3> in the pale blue robe and gold crown at the head, <Subject 4> in the tall red hood and <Subject 5> in the gold-striped hat in the left row, and <Subject 6> to <Subject 9> down the right row, each with his black hat on and his white, grey or black beard. Nobody in those seats is turned back into a man in a western suit, no hat is removed, and no seat becomes empty.
The two declared people keep the exact performance of their counterparts in <Video 1>: the foreground head stays completely still and the hand does not lift.
${LOCK_PEOPLE} ${LOCK_CAMERA}
Never invent a face where <Video 1> shows only the back of a head or a cropped forearm, never give <Subject 1> a visible face, and never turn <Subject 2> into a full body inside the frame.
${LOCK_MOTION} The camera never moves closer, never tilts, never pans, never cuts, and nobody stands up, enters or leaves the frame.

overall_soundscape:
Quiet boardroom room tone with a faint ventilation hum and a few distant footstep echoes, all carried by <Audio 1>, which also holds the English dialogue; the sound stays unchanged from the first to the last frame.

non_diegetic_music:
N/A`;

/* ---------------- 生成器 ---------------- */
function buildRound({ tag, refs, prompt, outPrefix, note, video }) {
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

    { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 参考视频（上一轮成片）', red: true,
      x: 460, y: 0, size: [420, 500],
      widgets: { video, frame_load_cap: FRAMES } },
    ...refs.map(([key, title, file], i) => ({
      key, type: 'LoadImage', title, red: true,
      x: 460 + (i % 2) * 330, y: 520 + Math.floor(i / 2) * 340, size: [300, 320],
      widgets: [file, 'image'],
    })),
    { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
      x: 460, y: 2000, size: [620, 420], widgets: [prompt] },

    { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1140, y: 520, size: [300, 110], widgets: [WIDTH] },
    { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1140, y: 660, size: [300, 110], widgets: ['a'] },
    { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1140, y: 800, size: [300, 110], widgets: [HEIGHT] },
    { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1140, y: 940, size: [300, 110], widgets: ['a'] },

    { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
      x: 1500, y: 0, size: [340, 520], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

    { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1900, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
    { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1900, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
    { key: 'split', type: 'SplitSigmas', title: '切分：一采 4 步 / 二采 2 步', x: 1900, y: 350, size: [300, 90], widgets: [4] },
    { key: 'noise', type: 'RandomNoise', title: '噪声种子（★ 三轮必须相同）', red: true, x: 1900, y: 480, size: [300, 90], widgets: [SEED, 'fixed'] },
    { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1900, y: 610, size: [300, 70], widgets: ['euler'] },
    { key: 'guider', type: 'BasicGuider', title: '引导器（两采共用）', x: 1900, y: 720, size: [300, 60] },

    { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（低清跑表演与站位）', x: 2260, y: 0, size: [260, 160] },
    { key: 'sep', type: 'LTXVSeparateAVLatent', title: '分离视频 / 音频潜空间', x: 2260, y: 220, size: [260, 60] },
    { key: 'up', type: 'MinimaxH3LatentUpscaler3D', title: '潜空间 2× 放大（只放视频）', x: 2260, y: 320, size: [440, 280],
      widgets: ['minimax_h3_latent_upscaler_3d_fp16_V2.safetensors', 'scale by multiplier', UPSCALE, 32, 'cuda', 'fp16', true, true] },
    { key: 'cat', type: 'LTXVConcatAVLatent', title: '拼回音频潜空间', x: 2260, y: 640, size: [260, 60] },
    { key: 'pass2', type: 'SamplerCustomAdvanced', title: '二采（高清补细节）', x: 2760, y: 0, size: [260, 160] },

    { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 3100, y: 0, size: [240, 60] },
    { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 3100, y: 120, size: [300, 200] },
    { key: 'out', type: 'VHS_VideoCombine', title: `输出成片（${tag} 轮 · 原声）`, orange: true, x: 3100, y: 360, size: [340, 300],
      widgets: { frame_rate: 24, filename_prefix: outPrefix, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
    { key: 'note', type: 'MarkdownNote', title: '说明', x: 3520, y: 0, size: [520, 720], widgets: [note] },
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
  const p = join(OUT_DIR, `${outPrefix}.ui.json`);
  writeFileSync(p, JSON.stringify(doc, null, 1));
  console.log(`${p}  refs=${refs.length} nodes=${doc.nodes.length} links=${links.length} frames=${FRAMES} seed=${SEED}`);
  return p;
}

const NOTE_COMMON = `### 三轮的硬约束（必须一致）
- \`帧数 ${FRAMES}\` 与 \`种子 ${SEED}\` **L / R / F 三轮一模一样**。
- 参考视频走「滚雪球」：L 喂原片 → R 喂 L 轮成片 → F 喂 R 轮成片。**每一轮的输出就是最终片**，不需要再合成。
- 换参考视频时，\`frame_load_cap\` 保持 ${FRAMES} 不动。

### 素材有效期
图里是平台 \`fileName\`，约 24 小时失效。报「找不到图」不是接线错，重传换名字即可：
\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\` `;

buildRound({
  tag: 'L',
  outPrefix: 'H3_board03L_left',
  video: VIDEO_L,
  refs: [
    ['img1', '★ 改这里 · ① 左排第1席（吕芳）', IMG.lvfang],
    ['img2', '★ 改这里 · ② 左排第2席（胡宗宪·边缘）', IMG.huzongxian],
    ['img3', '★ 改这里 · ③ 桌首站立（人物2·浅蓝袍金冠）', IMG.renwu2],
  ],
  prompt: PROMPT_L,
  note: `## L 轮 · 左排 2 人 + 桌首站立（3 人）

**红块 = 你要改的**：原片、3 张人物图、提示词、种子。**橙块 = 输出**。

### 这一轮换谁
- \`Picture 1\` 吕芳 → ① 左排第 1 席（靠远端，戴眼镜白发那位）
- \`Picture 2\` 胡宗宪 → ② 左排第 2 席（最靠前，被左边缘切掉）
- \`Picture 3\` 人物2（浅蓝袍金冠）→ ③ 桌首站立

右排 4 人、前景后脑、左下角手 **本轮不动**。

### 验收
0.2 / 1.5 / 3.0 秒三帧：① 左排只有 2 个古装人，没有第三个 ② 桌首那人大小与原片一致 ③ 右排还是原来的西装董事。

${NOTE_COMMON}`,
});

buildRound({
  tag: 'R',
  outPrefix: 'H3_board03R_right',
  video: VIDEO_R,
  refs: [
    ['img1', '★ 改这里 · ④ 右排第1席（严嵩·前倾）', IMG.yansong],
    ['img2', '★ 改这里 · ⑤ 右排第2席（徐阶）', IMG.xujie],
    ['img3', '★ 改这里 · ⑥ 右排第3席（高拱）', IMG.gaogong],
    ['img4', '★ 改这里 · ⑦ 右排第4席（张居正·右边缘）', IMG.zhangjuzheng],
  ],
  prompt: PROMPT_R,
  note: `## R 轮 · 右排 4 人

**红块 = 你要改的**：原片、4 张人物图、提示词、种子。**橙块 = 输出**。

### 这一轮换谁（顺序 = 从远端往近端）
- \`Picture 1\` 严嵩（长白须·超长帽翅）→ ④ 右排第 1 席（前倾高管）
- \`Picture 2\` 徐阶（灰须）→ ⑤ 右排第 2 席
- \`Picture 3\` 高拱（灰白发短须）→ ⑥ 右排第 3 席
- \`Picture 4\` 张居正（长黑须）→ ⑦ 右排第 4 席（贴右边缘）

左排、桌首、前景、手 **本轮不动**。

### 验收
0.2 / 1.5 / 3.0 秒三帧：① 右排正好 4 个古装人，没有第五个 ② 从远端到近端依次是 白长须 / 灰须 / 灰发短须 / 长黑须，不许错位 ③ 左排与桌首仍是 L 轮的样子。

${NOTE_COMMON}`,
});

buildRound({
  tag: 'F',
  outPrefix: 'H3_board03F_front',
  video: VIDEO_F,
  refs: [
    ['img1', '★ 改这里 · ⑧ 前景后脑（裕王）', IMG.yuwang],
    ['img2', '★ 改这里 · ⑨ 左下角画外手（陈洪）', IMG.chenhong],
  ],
  prompt: PROMPT_F,
  note: `## F 轮 · 前景后脑 + 左下角画外手（2 人）

**红块 = 你要改的**：原片、2 张人物图、提示词、种子。**橙块 = 输出**。

### 这一轮换谁
- \`Picture 1\` 裕王（黑金袍·金冠）→ ⑧ 前景背对镜头者（只见后脑与肩）
- \`Picture 2\` 陈洪 → ⑨ 左下角画外人物（只有一只手臂和手）

两排与桌首 **本轮不动**。

### 验收
0.2 / 1.5 / 3.0 秒三帧：① 前景后脑换成黑发+金冠，头的大小位置不变 ② 左下角只出现红袖和手，没长出脸或身子 ③ 两排人物保持 L / R 轮的结果。

${NOTE_COMMON}`,
});

console.log('done.');
