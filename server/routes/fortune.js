const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

// ── 운세 결과 정의 ──
const FORTUNE_RESULTS = [
  { grade: '대길', icon: '☀️', color: '#fbbf24', msg: '하늘이 당신의 편입니다! 위대한 힘이 깃듭니다.', buff_type: 'attack', buff_value: 15, duration: 5 },
  { grade: '대길', icon: '☀️', color: '#fbbf24', msg: '용맹한 기운이 감돕니다. 적을 두려워하지 마십시오.', buff_type: 'defense', buff_value: 15, duration: 5 },
  { grade: '중길', icon: '🌤️', color: '#60a5fa', msg: '좋은 기운이 흐르고 있습니다. 순조로운 하루가 될 것입니다.', buff_type: 'attack', buff_value: 10, duration: 3 },
  { grade: '중길', icon: '🌤️', color: '#60a5fa', msg: '재물운이 열렸습니다. 금화가 모일 것입니다.', buff_type: 'gold', buff_value: 20, duration: 3 },
  { grade: '소길', icon: '⛅', color: '#a3e635', msg: '작은 행운이 찾아옵니다. 방심하지 마십시오.', buff_type: 'defense', buff_value: 8, duration: 3 },
  { grade: '소길', icon: '⛅', color: '#a3e635', msg: '수호의 기운이 약하게 감지됩니다.', buff_type: 'crit', buff_value: 5, duration: 3 },
  { grade: '평', icon: '☁️', color: '#9ca3af', msg: '평범한 하루입니다. 무리하지 마십시오.', buff_type: null, buff_value: 0, duration: 0 },
  { grade: '흉', icon: '🌧️', color: '#f87171', msg: '흉한 기운이 느껴집니다... 조심하십시오.', buff_type: null, buff_value: 0, duration: 0 },
];

// ── 점괘 정의 ──
const DIVINATIONS = [
  { id: 'battle', name: '전투 점괘', desc: '전투력 강화의 기운을 불러옵니다.', price: 150, buff_type: 'attack', buff_value: 20, duration: 5, icon: '⚔️' },
  { id: 'guard', name: '수호 점괘', desc: '수호의 결계로 방어력을 높입니다.', price: 150, buff_type: 'defense', buff_value: 20, duration: 5, icon: '🛡️' },
  { id: 'wealth', name: '재물 점괘', desc: '재물운을 끌어당겨 획득 골드를 높입니다.', price: 200, buff_type: 'gold', buff_value: 30, duration: 5, icon: '💰' },
  { id: 'critical', name: '파멸 점괘', desc: '치명적 일격의 확률을 높입니다.', price: 250, buff_type: 'crit', buff_value: 10, duration: 5, icon: '💥' },
];

// ── 타로 카드 정의 (78장: 메이저 아르카나 22장 + 마이너 아르카나 56장) ──
function getCardSuit(idx) {
  if (idx < 22) return 'major';
  if (idx < 36) return 'wands';
  if (idx < 50) return 'cups';
  if (idx < 64) return 'swords';
  return 'pentacles';
}
const TAROT_CARDS = [
  { index: 0,  name: '바보', nameEn: 'The Fool',           upright: '새로운 시작, 자유, 모험', reversed: '무모함, 방향 상실', buff_type: 'crit', buff_value: 8,
    reading: { past: { up: '과거에 두려움 없이 새로운 길을 택한 경험이 지금의 당신을 만들었습니다.', rev: '과거의 무모한 선택이 아직도 그림자를 드리우고 있습니다.' }, present: { up: '지금은 새로운 모험을 시작할 때입니다. 두려워하지 마십시오.', rev: '방향을 잃고 헤매고 있습니다. 잠시 멈추어 길을 살피십시오.' }, future: { up: '예상치 못한 새로운 기회가 곧 찾아올 것입니다.', rev: '성급한 판단은 화를 부를 수 있습니다. 신중하게 나아가십시오.' } } },
  { index: 1,  name: '마법사', nameEn: 'The Magician',     upright: '의지력, 창조, 집중', reversed: '속임수, 재능 낭비', buff_type: 'attack', buff_value: 12,
    reading: { past: { up: '뛰어난 재능과 의지로 많은 것을 이루어 냈습니다.', rev: '과거에 자신의 능력을 제대로 발휘하지 못한 것이 아쉬움으로 남아 있습니다.' }, present: { up: '당신에겐 원하는 것을 이룰 모든 도구가 갖추어져 있습니다. 집중하십시오.', rev: '누군가의 속임수에 주의하십시오. 또는 스스로의 재능을 낭비하고 있지는 않은지 돌아보십시오.' }, future: { up: '강력한 힘을 발휘할 기회가 다가옵니다. 준비하십시오.', rev: '앞으로의 길에서 기만에 빠지지 않도록 경계하십시오.' } } },
  { index: 2,  name: '여사제', nameEn: 'The High Priestess', upright: '직관, 신비, 내면의 지혜', reversed: '비밀, 단절', buff_type: 'defense', buff_value: 12,
    reading: { past: { up: '직관을 따랐던 과거의 선택이 올바른 것이었음이 증명되고 있습니다.', rev: '숨겨진 비밀이 과거부터 당신을 따라다니고 있습니다.' }, present: { up: '마음의 소리에 귀를 기울이십시오. 내면의 지혜가 답을 알고 있습니다.', rev: '중요한 정보가 아직 드러나지 않았습니다. 성급한 판단을 삼가십시오.' }, future: { up: '숨겨진 진실이 곧 밝혀질 것입니다. 직관을 믿으십시오.', rev: '앞으로 다가올 비밀에 주의하십시오. 모든 것이 보이는 그대로는 아닙니다.' } } },
  { index: 3,  name: '여황제', nameEn: 'The Empress',       upright: '풍요, 자연, 양육', reversed: '의존, 공허', buff_type: 'regen', buff_value: 15,
    reading: { past: { up: '과거의 풍요로운 경험이 당신의 기반을 단단히 해주었습니다.', rev: '과거에 누군가에게 너무 의존했던 것이 지금의 불안으로 이어지고 있습니다.' }, present: { up: '풍요와 성장의 기운이 당신을 감싸고 있습니다. 자연의 흐름에 맡기십시오.', rev: '공허함을 느끼고 있다면, 자신을 먼저 돌보는 것이 필요합니다.' }, future: { up: '풍요로운 결실이 다가오고 있습니다. 인내의 열매를 거두게 될 것입니다.', rev: '미래에 공허함에 빠지지 않도록 지금부터 내면을 채우십시오.' } } },
  { index: 4,  name: '황제', nameEn: 'The Emperor',         upright: '권위, 안정, 리더십', reversed: '독재, 경직', buff_type: 'defense', buff_value: 15,
    reading: { past: { up: '확고한 의지와 리더십으로 안정적인 기반을 쌓아왔습니다.', rev: '과거의 지나친 통제욕이 관계에 균열을 남겼습니다.' }, present: { up: '강한 리더십이 필요한 시기입니다. 확고한 결단을 내리십시오.', rev: '지나친 완고함이 오히려 상황을 악화시키고 있습니다. 유연함을 갖추십시오.' }, future: { up: '안정과 질서가 찾아올 것입니다. 흔들리지 마십시오.', rev: '경직된 사고는 미래의 기회를 놓치게 할 수 있습니다.' } } },
  { index: 5,  name: '교황', nameEn: 'The Hierophant',      upright: '전통, 가르침, 믿음', reversed: '도그마, 반항', buff_type: 'gold', buff_value: 10,
    reading: { past: { up: '스승이나 전통에서 배운 지혜가 당신의 뿌리가 되었습니다.', rev: '과거의 관습에 얽매여 성장이 멈추었던 시기가 있었습니다.' }, present: { up: '경험 있는 이의 조언에 귀를 기울이십시오. 지혜가 전해질 것입니다.', rev: '기존의 틀을 깨고 자신만의 길을 찾을 때입니다.' }, future: { up: '좋은 스승이나 가르침을 만나게 될 것입니다.', rev: '앞으로의 여정에서 맹목적인 믿음은 위험할 수 있습니다.' } } },
  { index: 6,  name: '연인', nameEn: 'The Lovers',          upright: '사랑, 조화, 선택', reversed: '불화, 유혹', buff_type: 'all', buff_value: 5,
    reading: { past: { up: '과거의 중요한 선택이 지금의 당신을 이끌어왔습니다.', rev: '과거의 갈등과 불화가 아직 마음에 남아 있습니다.' }, present: { up: '중요한 선택의 기로에 서 있습니다. 마음이 이끄는 대로 따르십시오.', rev: '유혹에 주의하십시오. 겉모습에 현혹되지 말고 진심을 살피십시오.' }, future: { up: '조화로운 관계와 올바른 선택이 빛나는 미래를 열어줄 것입니다.', rev: '불화의 씨앗을 미리 제거하지 않으면 미래에 화를 부를 수 있습니다.' } } },
  { index: 7,  name: '전차', nameEn: 'The Chariot',         upright: '승리, 결단력, 전진', reversed: '좌절, 통제 불능', buff_type: 'attack', buff_value: 15,
    reading: { past: { up: '강한 의지로 장애물을 극복하고 승리를 거두었습니다.', rev: '과거에 통제할 수 없었던 상황이 좌절감을 남겼습니다.' }, present: { up: '전진할 때입니다! 강한 결단력으로 목표를 향해 돌진하십시오.', rev: '방향을 잃고 질주하고 있습니다. 잠시 고삐를 당기십시오.' }, future: { up: '눈부신 승리가 기다리고 있습니다. 멈추지 마십시오.', rev: '앞으로의 도전에서 무작정 달리기보다 전략이 필요합니다.' } } },
  { index: 8,  name: '힘', nameEn: 'Strength',              upright: '용기, 인내, 내면의 힘', reversed: '나약함, 자기 의심', buff_type: 'defense', buff_value: 10,
    reading: { past: { up: '내면의 용기로 어려운 시련을 이겨낸 경험이 있습니다.', rev: '과거에 두려움에 굴복했던 기억이 아직 당신을 붙잡고 있습니다.' }, present: { up: '진정한 힘은 내면에 있습니다. 인내하며 자신을 믿으십시오.', rev: '자기 의심이 당신을 약하게 만들고 있습니다. 스스로를 믿으십시오.' }, future: { up: '내면의 강인함이 앞으로의 시련을 극복하는 열쇠가 될 것입니다.', rev: '나약함을 극복하지 않으면 다가올 시련에 무너질 수 있습니다.' } } },
  { index: 9,  name: '은둔자', nameEn: 'The Hermit',        upright: '내면 탐색, 지혜, 고독', reversed: '고립, 외로움', buff_type: 'crit', buff_value: 10,
    reading: { past: { up: '홀로 깊이 사색했던 시간이 큰 지혜를 가져다주었습니다.', rev: '과거의 고립이 마음에 외로움의 상처를 남겼습니다.' }, present: { up: '혼자만의 시간이 필요합니다. 내면을 들여다보면 답이 보일 것입니다.', rev: '지나친 고독은 독이 됩니다. 주변 사람들에게 손을 내밀어보십시오.' }, future: { up: '깊은 통찰이 미래의 길을 밝혀줄 것입니다.', rev: '고립에 빠지지 않도록 주의하십시오. 혼자서는 갈 수 없는 길이 있습니다.' } } },
  { index: 10, name: '운명의 수레바퀴', nameEn: 'Wheel of Fortune', upright: '행운, 전환점, 운명', reversed: '불운, 저항', buff_type: 'gold', buff_value: 20,
    reading: { past: { up: '운명의 전환점이 당신의 삶을 크게 바꾸어 놓았습니다.', rev: '불운한 시기를 겪었지만, 그것 또한 지나간 것입니다.' }, present: { up: '운명의 바퀴가 당신 편으로 돌아가고 있습니다. 행운을 잡으십시오!', rev: '지금은 불운한 시기입니다. 하지만 바퀴는 언제나 다시 돕니다.' }, future: { up: '큰 행운의 전환점이 곧 찾아올 것입니다.', rev: '변화에 저항하지 마십시오. 운명의 흐름을 받아들이면 길이 열립니다.' } } },
  { index: 11, name: '정의', nameEn: 'Justice',             upright: '공정, 진실, 균형', reversed: '불공정, 부정직', buff_type: 'all', buff_value: 6,
    reading: { past: { up: '과거의 올바른 행동이 지금의 좋은 결과로 돌아오고 있습니다.', rev: '과거에 불공정한 일을 겪었거나, 진실을 외면한 적이 있습니다.' }, present: { up: '공정하게 행동하십시오. 진실은 반드시 빛을 봅니다.', rev: '균형이 무너져 있습니다. 정직함으로 바로잡을 때입니다.' }, future: { up: '인과응보의 결과가 나타날 것입니다. 정당한 보상을 받게 됩니다.', rev: '불공정한 상황이 다가올 수 있습니다. 진실을 지키십시오.' } } },
  { index: 12, name: '매달린 사람', nameEn: 'The Hanged Man', upright: '희생, 인내, 새로운 관점', reversed: '지연, 무의미한 희생', buff_type: 'defense', buff_value: 8,
    reading: { past: { up: '과거의 희생과 인내가 새로운 시각을 열어주었습니다.', rev: '과거에 무의미한 희생을 했던 경험이 있습니다.' }, present: { up: '지금은 기다림의 시기입니다. 관점을 바꾸면 새로운 길이 보일 것입니다.', rev: '더 이상의 무의미한 희생은 그만두십시오. 다른 방법을 찾으십시오.' }, future: { up: '인내의 끝에 깨달음이 기다리고 있습니다.', rev: '끝없는 지연에 좌절하지 마십시오. 능동적으로 움직일 때가 옵니다.' } } },
  { index: 13, name: '죽음', nameEn: 'Death',               upright: '변화, 종결, 변환', reversed: '변화 거부, 정체', buff_type: 'attack', buff_value: 10,
    reading: { past: { up: '과거의 큰 변화가 당신을 완전히 새로운 사람으로 만들었습니다.', rev: '변화를 거부했던 과거가 정체를 불러왔습니다.' }, present: { up: '끝은 새로운 시작입니다. 낡은 것을 놓아주고 변화를 받아들이십시오.', rev: '변화를 두려워하며 제자리에 머물고 있습니다. 과감히 전진하십시오.' }, future: { up: '큰 변화가 다가오고 있습니다. 두려워하지 마십시오, 그것은 재탄생입니다.', rev: '변화를 계속 거부하면 정체의 늪에 빠질 수 있습니다.' } } },
  { index: 14, name: '절제', nameEn: 'Temperance',          upright: '균형, 절제, 조화', reversed: '극단, 불균형', buff_type: 'regen', buff_value: 10,
    reading: { past: { up: '균형 잡힌 태도가 과거의 어려움을 무사히 넘기게 해주었습니다.', rev: '과거에 극단적인 선택이 불균형을 초래했습니다.' }, present: { up: '조화와 균형이 필요한 시기입니다. 극단을 피하고 중용을 지키십시오.', rev: '삶의 균형이 무너져 있습니다. 쉼과 활동 사이의 조화를 찾으십시오.' }, future: { up: '절제와 인내가 아름다운 조화를 이루어낼 것입니다.', rev: '극단으로 치우치면 미래에 큰 불균형이 찾아올 수 있습니다.' } } },
  { index: 15, name: '악마', nameEn: 'The Devil',           upright: '유혹, 속박, 욕망', reversed: '해방, 각성', buff_type: 'crit', buff_value: 15,
    reading: { past: { up: '과거에 강렬한 욕망이나 속박에 사로잡혔던 경험이 있습니다.', rev: '과거의 속박에서 벗어나 자유를 되찾았던 경험이 있습니다.' }, present: { up: '유혹에 주의하십시오. 눈앞의 쾌락이 당신을 속박할 수 있습니다.', rev: '사슬을 끊어낼 때입니다. 당신을 옭아매는 것에서 해방되십시오.' }, future: { up: '강한 유혹이 다가올 것입니다. 의지를 굳게 하십시오.', rev: '곧 속박에서 벗어나 자유를 얻게 될 것입니다.' } } },
  { index: 16, name: '탑', nameEn: 'The Tower',             upright: '파괴, 격변, 각성', reversed: '파국 회피, 두려움', buff_type: 'attack', buff_value: 20,
    reading: { past: { up: '과거의 격변이 모든 것을 뒤흔들었지만, 그 폐허 위에 새것이 세워졌습니다.', rev: '과거에 파국을 간신히 피했지만, 그 두려움이 아직 남아 있습니다.' }, present: { up: '갑작스러운 변화가 닥치고 있습니다. 하지만 파괴 후에 각성이 옵니다.', rev: '무너질 것을 붙잡고 있습니다. 놓아줄 용기가 필요합니다.' }, future: { up: '큰 격변이 예고됩니다. 하지만 그것은 더 강한 자신을 만드는 계기가 될 것입니다.', rev: '재앙을 피할 수 있습니다. 미리 대비하십시오.' } } },
  { index: 17, name: '별', nameEn: 'The Star',              upright: '희망, 영감, 치유', reversed: '절망, 신뢰 상실', buff_type: 'regen', buff_value: 20,
    reading: { past: { up: '절망 속에서도 희망을 잃지 않았기에 여기까지 올 수 있었습니다.', rev: '과거에 깊은 절망을 겪었던 상처가 남아 있습니다.' }, present: { up: '희망의 빛이 비추고 있습니다. 영감을 따라 나아가십시오.', rev: '희망을 잃고 있지만, 별은 구름 뒤에도 빛나고 있습니다. 포기하지 마십시오.' }, future: { up: '밝고 희망찬 미래가 기다리고 있습니다. 치유와 회복의 시간이 올 것입니다.', rev: '신뢰를 회복하지 않으면 미래가 어두워질 수 있습니다.' } } },
  { index: 18, name: '달', nameEn: 'The Moon',              upright: '환상, 무의식, 직감', reversed: '혼란, 기만', buff_type: 'crit', buff_value: 12,
    reading: { past: { up: '과거에 직감이 이끄는 대로 행동하여 숨겨진 진실을 찾아냈습니다.', rev: '과거에 혼란과 기만에 휘둘렸던 경험이 있습니다.' }, present: { up: '보이는 것이 전부가 아닙니다. 무의식의 목소리에 귀를 기울이십시오.', rev: '혼란 속에 빠져 있습니다. 감정에 휘둘리지 말고 냉정함을 유지하십시오.' }, future: { up: '직감이 중요한 역할을 할 것입니다. 꿈과 영감에 주목하십시오.', rev: '미래에 기만에 주의하십시오. 진실과 거짓을 구분하는 눈이 필요합니다.' } } },
  { index: 19, name: '태양', nameEn: 'The Sun',             upright: '성공, 기쁨, 활력', reversed: '의기소침, 지연된 성공', buff_type: 'all', buff_value: 8,
    reading: { past: { up: '과거의 빛나는 성공과 기쁨이 지금의 자신감의 원천입니다.', rev: '과거에 기대했던 성공이 지연되어 의기소침했던 시기가 있었습니다.' }, present: { up: '태양이 당신을 비추고 있습니다! 활력과 기쁨으로 가득한 시기입니다.', rev: '성공이 가까이 있지만 아직 완전히 드러나지 않았습니다. 조금만 더 인내하십시오.' }, future: { up: '눈부신 성공과 기쁨이 기다리고 있습니다. 자신 있게 나아가십시오.', rev: '성공이 다소 지연될 수 있지만, 반드시 찾아올 것입니다.' } } },
  { index: 20, name: '심판', nameEn: 'Judgement',           upright: '부활, 각성, 심판', reversed: '자기 의심, 후회', buff_type: 'attack', buff_value: 12,
    reading: { past: { up: '과거의 결단이 당신을 새로운 차원으로 이끌었습니다.', rev: '과거에 후회스러운 결정을 내렸고, 그 그림자가 남아 있습니다.' }, present: { up: '각성의 시간입니다. 과거를 돌아보고, 새로운 자신으로 다시 태어나십시오.', rev: '자기 의심에 사로잡혀 있습니다. 과거의 후회를 놓아주십시오.' }, future: { up: '부활과 재탄생의 기회가 곧 찾아올 것입니다.', rev: '후회에 매달리면 미래의 기회를 놓칠 수 있습니다. 앞을 보십시오.' } } },
  { index: 21, name: '세계', nameEn: 'The World',           upright: '완성, 통합, 성취', reversed: '미완성, 지연', buff_type: 'all', buff_value: 10,
    reading: { past: { up: '과거에 하나의 큰 여정을 완성한 경험이 지금의 당신을 완성시켰습니다.', rev: '과거에 마무리 짓지 못한 일이 아직 마음에 걸려 있습니다.' }, present: { up: '하나의 여정이 완성되고 있습니다. 모든 것이 제자리를 찾아가고 있습니다.', rev: '아직 완성에 이르지 못했습니다. 마지막 한 발짝이 남아 있습니다.' }, future: { up: '위대한 성취가 기다리고 있습니다. 모든 노력이 결실을 맺을 것입니다.', rev: '완성이 지연될 수 있지만, 포기하지 않으면 반드시 이루어집니다.' } } },
  // ── 마이너 아르카나 (56장) ──
  { index: 22, suit: 'wands', name: '지팡이 에이스', nameEn: 'Ace of Wands', upright: '영감, 새로운 시작, 창조력', reversed: '지연, 동기 부족', buff_type: 'attack', buff_value: 5,
    reading: { past: { up: '과거에 번뜩이는 영감이 새로운 도전을 이끌었습니다.', rev: '과거에 좋은 기회를 미루다가 놓쳤던 경험이 있습니다.' }, present: { up: '새로운 시작의 불꽃이 타오르고 있습니다. 창조적 에너지를 발휘하십시오.', rev: '동기가 부족합니다. 열정을 되살릴 무언가를 찾으십시오.' }, future: { up: '창조적인 기회가 곧 찾아올 것입니다.', rev: '시작이 지연될 수 있으나, 준비를 게을리하지 마십시오.' } } },
  { index: 23, suit: 'wands', name: '지팡이 2', nameEn: 'Two of Wands', upright: '계획, 결정, 진취', reversed: '두려움, 우유부단', buff_type: 'attack', buff_value: 4,
    reading: { past: { up: '과거의 대담한 계획이 지금의 기반을 만들었습니다.', rev: '과거에 결정을 내리지 못해 기회를 놓친 적이 있습니다.' }, present: { up: '넓은 시야로 미래를 계획할 때입니다. 과감히 결정하십시오.', rev: '두려움이 발을 묶고 있습니다. 용기를 내십시오.' }, future: { up: '계획한 일이 순조롭게 진행될 것입니다.', rev: '우유부단함은 기회를 앗아갈 수 있습니다.' } } },
  { index: 24, suit: 'wands', name: '지팡이 3', nameEn: 'Three of Wands', upright: '확장, 선견지명, 리더십', reversed: '장애, 지연', buff_type: 'gold', buff_value: 5,
    reading: { past: { up: '과거의 선견지명이 현재의 성장을 가져왔습니다.', rev: '과거에 확장을 시도했으나 장애에 부딪혔던 경험이 있습니다.' }, present: { up: '더 넓은 세계로 나아갈 준비가 되었습니다. 시야를 확장하십시오.', rev: '예상치 못한 장애가 있습니다. 인내가 필요합니다.' }, future: { up: '노력의 결실이 더 큰 기회로 확장될 것입니다.', rev: '지연이 있겠으나 포기하지 마십시오.' } } },
  { index: 25, suit: 'wands', name: '지팡이 4', nameEn: 'Four of Wands', upright: '축하, 안정, 화합', reversed: '불안정, 갈등', buff_type: 'defense', buff_value: 5,
    reading: { past: { up: '과거에 이룬 안정과 화합이 지금의 기쁨의 근원입니다.', rev: '과거에 불안정했던 시기가 마음의 불안을 남겼습니다.' }, present: { up: '축하할 일이 있습니다. 안정과 화합의 기운이 감돕니다.', rev: '관계에 갈등이 생기고 있습니다. 대화로 해결하십시오.' }, future: { up: '기쁜 소식과 안정이 찾아올 것입니다.', rev: '불안정한 시기가 올 수 있으니 대비하십시오.' } } },
  { index: 26, suit: 'wands', name: '지팡이 5', nameEn: 'Five of Wands', upright: '경쟁, 갈등, 도전', reversed: '회피, 타협', buff_type: 'crit', buff_value: 4,
    reading: { past: { up: '과거의 치열한 경쟁이 당신을 단련시켰습니다.', rev: '과거에 갈등을 회피하여 문제가 커졌던 적이 있습니다.' }, present: { up: '경쟁이 치열합니다. 도전을 두려워하지 마십시오.', rev: '불필요한 갈등은 피하고 타협점을 찾으십시오.' }, future: { up: '경쟁에서 승리할 기회가 올 것입니다.', rev: '갈등을 조율하는 지혜가 필요합니다.' } } },
  { index: 27, suit: 'wands', name: '지팡이 6', nameEn: 'Six of Wands', upright: '승리, 인정, 자신감', reversed: '자만, 실패', buff_type: 'attack', buff_value: 6,
    reading: { past: { up: '과거의 승리와 인정이 자신감의 바탕이 되었습니다.', rev: '과거에 자만심이 실패를 불렀던 경험이 있습니다.' }, present: { up: '승리의 기운이 감돕니다! 자신감을 가지고 나아가십시오.', rev: '자만에 빠지지 마십시오. 겸손이 진정한 힘입니다.' }, future: { up: '노력에 대한 인정과 보상이 기다리고 있습니다.', rev: '교만은 패배를 부릅니다. 초심을 잃지 마십시오.' } } },
  { index: 28, suit: 'wands', name: '지팡이 7', nameEn: 'Seven of Wands', upright: '방어, 결의, 도전', reversed: '포기, 압도', buff_type: 'defense', buff_value: 4,
    reading: { past: { up: '과거에 어려운 상황에서도 굳건히 자리를 지켰습니다.', rev: '과거에 압도당해 포기했던 경험이 아쉬움으로 남아 있습니다.' }, present: { up: '도전이 다가오고 있습니다. 굳건히 자리를 지키십시오.', rev: '너무 많은 것에 압도당하고 있습니다. 중요한 것에 집중하십시오.' }, future: { up: '어려움을 극복하고 자신의 위치를 지킬 것입니다.', rev: '포기하지 않는 것이 승리의 열쇠입니다.' } } },
  { index: 29, suit: 'wands', name: '지팡이 8', nameEn: 'Eight of Wands', upright: '신속, 진행, 여행', reversed: '지연, 혼란', buff_type: 'attack', buff_value: 5,
    reading: { past: { up: '과거에 빠르게 움직여 기회를 잡았습니다.', rev: '과거에 혼란 속에서 방향을 잃었던 적이 있습니다.' }, present: { up: '일이 빠르게 진행되고 있습니다. 흐름에 올라타십시오.', rev: '혼란스러운 상황입니다. 속도를 줄이고 정리하십시오.' }, future: { up: '신속한 발전과 좋은 소식이 곧 전해질 것입니다.', rev: '지연이 예상됩니다. 조급해하지 마십시오.' } } },
  { index: 30, suit: 'wands', name: '지팡이 9', nameEn: 'Nine of Wands', upright: '인내, 끈기, 경계', reversed: '피로, 의심', buff_type: 'defense', buff_value: 5,
    reading: { past: { up: '수많은 시련을 견뎌온 인내가 지금의 힘입니다.', rev: '과거의 끝없는 시련이 피로감을 남겼습니다.' }, present: { up: '거의 다 왔습니다. 마지막까지 인내하십시오.', rev: '지쳐 있지만, 여기서 포기하면 모든 것이 수포로 돌아갑니다.' }, future: { up: '끈기가 결국 승리를 안겨줄 것입니다.', rev: '의심을 거두고 자신의 강인함을 믿으십시오.' } } },
  { index: 31, suit: 'wands', name: '지팡이 10', nameEn: 'Ten of Wands', upright: '책임, 부담, 완수', reversed: '과부하, 위임', buff_type: 'gold', buff_value: 4,
    reading: { past: { up: '무거운 책임을 다했던 경험이 성장의 밑거름이 되었습니다.', rev: '과거에 너무 많은 짐을 졌던 것이 부담으로 남아 있습니다.' }, present: { up: '무거운 짐이지만 끝이 보입니다. 조금만 더 힘내십시오.', rev: '모든 것을 혼자 감당하려 하지 마십시오. 도움을 구하십시오.' }, future: { up: '책임을 완수하면 큰 보상이 따를 것입니다.', rev: '과부하를 줄이지 않으면 무너질 수 있습니다.' } } },
  { index: 32, suit: 'wands', name: '지팡이 시종', nameEn: 'Page of Wands', upright: '열정, 탐험, 발견', reversed: '조급, 방향 상실', buff_type: 'crit', buff_value: 4,
    reading: { past: { up: '과거의 열정적인 탐험이 소중한 경험을 가져다주었습니다.', rev: '과거에 조급한 마음으로 방향을 잃었던 적이 있습니다.' }, present: { up: '새로운 것을 발견할 열정이 충만합니다. 탐험하십시오!', rev: '방향을 잃고 있습니다. 잠시 멈추고 목표를 재설정하십시오.' }, future: { up: '흥미로운 발견이 기다리고 있습니다.', rev: '조급함을 다스리면 더 좋은 결과를 얻을 것입니다.' } } },
  { index: 33, suit: 'wands', name: '지팡이 기사', nameEn: 'Knight of Wands', upright: '모험, 열정, 대담', reversed: '성급, 무모', buff_type: 'attack', buff_value: 6,
    reading: { past: { up: '과거의 대담한 모험이 잊지 못할 경험을 안겨주었습니다.', rev: '과거에 성급한 행동으로 후회한 적이 있습니다.' }, present: { up: '대담하게 행동할 때입니다. 열정을 불태우십시오!', rev: '너무 성급합니다. 계획 없는 행동은 위험합니다.' }, future: { up: '열정적인 기회가 곧 찾아올 것입니다. 준비하십시오.', rev: '무모한 행동을 삼가면 좋은 결과를 얻을 것입니다.' } } },
  { index: 34, suit: 'wands', name: '지팡이 여왕', nameEn: 'Queen of Wands', upright: '자신감, 열정, 결단력', reversed: '질투, 이기심', buff_type: 'attack', buff_value: 7,
    reading: { past: { up: '과거에 자신감 있는 결단이 성공을 이끌었습니다.', rev: '과거에 질투심이 관계를 해쳤던 경험이 있습니다.' }, present: { up: '당신의 열정과 결단력이 빛나고 있습니다. 자신을 믿으십시오.', rev: '이기심을 경계하십시오. 진정한 리더는 나누는 자입니다.' }, future: { up: '강한 결단력이 밝은 미래를 열어줄 것입니다.', rev: '질투와 이기심을 다스리면 더 큰 것을 얻게 됩니다.' } } },
  { index: 35, suit: 'wands', name: '지팡이 왕', nameEn: 'King of Wands', upright: '리더십, 비전, 기업가 정신', reversed: '독재, 무모함', buff_type: 'attack', buff_value: 8,
    reading: { past: { up: '과거의 비전과 리더십이 많은 이들에게 영감을 주었습니다.', rev: '과거에 독단적인 결정으로 주변을 힘들게 했던 적이 있습니다.' }, present: { up: '리더로서의 자질이 빛나고 있습니다. 비전을 제시하십시오.', rev: '독재적인 태도를 버리십시오. 소통이 진정한 리더십입니다.' }, future: { up: '위대한 리더십을 발휘할 기회가 다가옵니다.', rev: '무모한 결정은 모든 것을 위험에 빠뜨릴 수 있습니다.' } } },
  { index: 36, suit: 'cups', name: '성배 에이스', nameEn: 'Ace of Cups', upright: '새로운 감정, 사랑, 영적 각성', reversed: '억압된 감정, 공허', buff_type: 'regen', buff_value: 6,
    reading: { past: { up: '과거에 마음을 열었던 경험이 깊은 감동을 남겼습니다.', rev: '과거에 감정을 억압하여 마음에 공허함이 생겼습니다.' }, present: { up: '새로운 감정의 물결이 밀려오고 있습니다. 마음을 열어보십시오.', rev: '감정을 억누르지 마십시오. 마음의 목소리에 귀를 기울이십시오.' }, future: { up: '깊은 감동과 사랑이 기다리고 있습니다.', rev: '감정의 공허함을 채우지 않으면 외로움이 깊어질 수 있습니다.' } } },
  { index: 37, suit: 'cups', name: '성배 2', nameEn: 'Two of Cups', upright: '유대, 조화, 파트너십', reversed: '불화, 단절', buff_type: 'defense', buff_value: 4,
    reading: { past: { up: '과거의 깊은 유대가 소중한 관계를 만들었습니다.', rev: '과거에 소중한 관계가 단절되었던 아픔이 있습니다.' }, present: { up: '조화로운 관계가 형성되고 있습니다. 파트너십을 소중히 하십시오.', rev: '관계에 불화가 생기고 있습니다. 진심으로 소통하십시오.' }, future: { up: '좋은 만남과 유대가 기다리고 있습니다.', rev: '관계의 균열을 방치하면 단절로 이어질 수 있습니다.' } } },
  { index: 38, suit: 'cups', name: '성배 3', nameEn: 'Three of Cups', upright: '축하, 우정, 공동체', reversed: '과잉, 고립', buff_type: 'gold', buff_value: 4,
    reading: { past: { up: '과거에 좋은 동료들과 함께한 기쁨이 따뜻한 추억입니다.', rev: '과거에 주변에서 고립되었던 외로움이 남아 있습니다.' }, present: { up: '함께 축하할 기쁜 일이 있습니다. 동료들과 나누십시오.', rev: '고립되어 있지는 않은지 돌아보십시오. 손을 내미십시오.' }, future: { up: '기쁜 모임과 축하의 자리가 기다리고 있습니다.', rev: '지나친 방탕은 소중한 것을 잃게 할 수 있습니다.' } } },
  { index: 39, suit: 'cups', name: '성배 4', nameEn: 'Four of Cups', upright: '명상, 무관심, 재평가', reversed: '자각, 새 기회', buff_type: 'defense', buff_value: 3,
    reading: { past: { up: '과거에 깊은 사색이 새로운 깨달음을 가져다주었습니다.', rev: '과거에 무관심으로 지나쳤던 기회가 있었음을 깨닫고 있습니다.' }, present: { up: '잠시 멈추고 지금 가진 것을 재평가할 때입니다.', rev: '눈앞의 기회를 놓치고 있습니다. 눈을 크게 뜨십시오.' }, future: { up: '내면의 성찰이 새로운 길을 열어줄 것입니다.', rev: '새로운 기회가 왔을 때 놓치지 않도록 준비하십시오.' } } },
  { index: 40, suit: 'cups', name: '성배 5', nameEn: 'Five of Cups', upright: '상실, 후회, 슬픔', reversed: '수용, 치유', buff_type: 'regen', buff_value: 4,
    reading: { past: { up: '과거의 상실이 깊은 슬픔을 남겼습니다.', rev: '과거의 상실을 받아들이고 치유가 시작되었습니다.' }, present: { up: '잃은 것에 슬퍼하고 있지만, 아직 남아있는 것이 있습니다.', rev: '상실을 수용하고 앞으로 나아갈 때입니다. 치유는 이미 시작되었습니다.' }, future: { up: '슬픔이 지나가고 회복의 시간이 올 것입니다.', rev: '상실을 받아들이면 새로운 기쁨을 발견하게 될 것입니다.' } } },
  { index: 41, suit: 'cups', name: '성배 6', nameEn: 'Six of Cups', upright: '향수, 순수, 추억', reversed: '과거 집착, 미성숙', buff_type: 'regen', buff_value: 4,
    reading: { past: { up: '순수했던 과거의 추억이 마음을 따뜻하게 합니다.', rev: '과거에 집착하여 현재를 놓치고 있었던 적이 있습니다.' }, present: { up: '순수한 마음으로 돌아가 보십시오. 소중한 것을 떠올리십시오.', rev: '과거에 연연하지 마십시오. 지금 이 순간이 중요합니다.' }, future: { up: '따뜻한 추억과 재회가 기다리고 있습니다.', rev: '과거에 매달리면 미래의 가능성을 놓칠 수 있습니다.' } } },
  { index: 42, suit: 'cups', name: '성배 7', nameEn: 'Seven of Cups', upright: '환상, 선택, 상상력', reversed: '환멸, 현실 직시', buff_type: 'crit', buff_value: 3,
    reading: { past: { up: '과거에 풍부한 상상력이 다양한 가능성을 열어주었습니다.', rev: '과거에 환상에 빠져 현실을 직시하지 못했던 적이 있습니다.' }, present: { up: '많은 선택지가 있습니다. 신중하게 고르십시오.', rev: '환상에서 벗어나 현실을 직시할 때입니다.' }, future: { up: '다양한 가능성 중에서 최선을 택할 기회가 올 것입니다.', rev: '비현실적인 기대는 실망을 부릅니다.' } } },
  { index: 43, suit: 'cups', name: '성배 8', nameEn: 'Eight of Cups', upright: '떠남, 포기, 성장', reversed: '두려움, 집착', buff_type: 'defense', buff_value: 4,
    reading: { past: { up: '과거에 익숙한 것을 떠났던 용기가 성장을 가져왔습니다.', rev: '과거에 떠나야 할 때 두려움에 머물렀던 적이 있습니다.' }, present: { up: '더 이상 의미 없는 것을 놓아줄 때입니다. 새로운 길로 나아가십시오.', rev: '놓아주는 것이 두렵지만, 집착은 더 큰 고통을 부릅니다.' }, future: { up: '과감한 결단이 더 나은 미래로 이끌 것입니다.', rev: '변화를 두려워하면 성장이 멈출 수 있습니다.' } } },
  { index: 44, suit: 'cups', name: '성배 9', nameEn: 'Nine of Cups', upright: '만족, 소원 성취, 행복', reversed: '탐욕, 불만', buff_type: 'gold', buff_value: 6,
    reading: { past: { up: '과거에 소원이 이루어져 큰 만족을 느꼈습니다.', rev: '과거에 가진 것에 만족하지 못하고 더 많은 것을 원했습니다.' }, present: { up: '소원이 이루어지는 시기입니다! 감사하는 마음을 잊지 마십시오.', rev: '가진 것에 감사하십시오. 탐욕은 행복을 앗아갑니다.' }, future: { up: '원하던 것을 이루게 될 것입니다. 기대하십시오!', rev: '끝없는 욕심은 오히려 불행을 부릅니다.' } } },
  { index: 45, suit: 'cups', name: '성배 10', nameEn: 'Ten of Cups', upright: '행복, 가정, 완성', reversed: '불화, 깨진 꿈', buff_type: 'regen', buff_value: 7,
    reading: { past: { up: '과거에 깊은 행복과 조화를 경험했던 소중한 시기가 있었습니다.', rev: '과거에 기대했던 행복이 이루어지지 않았던 아픔이 있습니다.' }, present: { up: '진정한 행복이 가까이에 있습니다. 감사의 마음으로 받아들이십시오.', rev: '관계의 불화가 행복을 방해하고 있습니다. 화합을 위해 노력하십시오.' }, future: { up: '완전한 행복과 조화가 찾아올 것입니다.', rev: '꿈이 깨지지 않도록 소중한 것을 지키십시오.' } } },
  { index: 46, suit: 'cups', name: '성배 시종', nameEn: 'Page of Cups', upright: '직감, 창의, 순수', reversed: '미숙, 감정 기복', buff_type: 'regen', buff_value: 3,
    reading: { past: { up: '과거에 순수한 마음으로 세상을 바라보았던 때가 있었습니다.', rev: '과거에 감정 기복으로 주변을 힘들게 했던 적이 있습니다.' }, present: { up: '직감을 믿고 창의적으로 접근하십시오. 순수한 마음이 답입니다.', rev: '감정에 휘둘리고 있습니다. 성숙한 대처가 필요합니다.' }, future: { up: '직감이 이끄는 대로 따르면 좋은 결과가 있을 것입니다.', rev: '감정을 다스리는 법을 배우면 더 성장할 것입니다.' } } },
  { index: 47, suit: 'cups', name: '성배 기사', nameEn: 'Knight of Cups', upright: '로맨스, 매력, 제안', reversed: '변덕, 비현실', buff_type: 'crit', buff_value: 4,
    reading: { past: { up: '과거에 매력적인 제안이 인생을 바꾸었습니다.', rev: '과거에 감정에 이끌려 비현실적인 선택을 했던 적이 있습니다.' }, present: { up: '매력적인 기회나 제안이 다가오고 있습니다. 마음을 열어보십시오.', rev: '감정에만 의존하지 마십시오. 현실을 직시하십시오.' }, future: { up: '마음을 사로잡는 기회가 찾아올 것입니다.', rev: '변덕스러운 마음을 다스려야 진정한 기회를 잡을 수 있습니다.' } } },
  { index: 48, suit: 'cups', name: '성배 여왕', nameEn: 'Queen of Cups', upright: '연민, 직관, 치유', reversed: '의존, 감정 과잉', buff_type: 'regen', buff_value: 7,
    reading: { past: { up: '과거에 깊은 연민과 이해로 많은 이를 치유했습니다.', rev: '과거에 감정에 과도하게 빠져 자신을 잃었던 적이 있습니다.' }, present: { up: '직관과 연민의 힘이 강해지고 있습니다. 치유의 에너지를 나누십시오.', rev: '타인에게 과도하게 의존하고 있습니다. 자립이 필요합니다.' }, future: { up: '치유와 회복의 시간이 곧 찾아올 것입니다.', rev: '감정의 균형을 찾아야 더 밝은 미래가 열립니다.' } } },
  { index: 49, suit: 'cups', name: '성배 왕', nameEn: 'King of Cups', upright: '감정 통제, 지혜, 관용', reversed: '감정 억압, 조종', buff_type: 'defense', buff_value: 6,
    reading: { past: { up: '과거에 감정을 현명하게 다스려 어려움을 극복했습니다.', rev: '과거에 감정을 억압하거나 타인을 조종하려 했던 적이 있습니다.' }, present: { up: '감정의 파도 위에서 균형을 유지하십시오. 지혜로운 판단이 필요합니다.', rev: '감정을 억누르지 말고 건강하게 표현하십시오.' }, future: { up: '감정적 성숙이 위대한 성취를 가져올 것입니다.', rev: '감정을 조종하려 하면 관계가 무너질 수 있습니다.' } } },
  { index: 50, suit: 'swords', name: '검 에이스', nameEn: 'Ace of Swords', upright: '명확함, 진실, 돌파', reversed: '혼란, 오해', buff_type: 'attack', buff_value: 6,
    reading: { past: { up: '과거에 진실을 꿰뚫어 보는 명확한 판단이 성공을 이끌었습니다.', rev: '과거에 오해와 혼란이 큰 갈등을 일으켰습니다.' }, present: { up: '진실이 명확해지는 순간입니다. 날카로운 통찰로 돌파하십시오.', rev: '혼란 속에 있습니다. 냉정하게 사실을 파악하십시오.' }, future: { up: '진실이 밝혀지고 새로운 돌파구가 열릴 것입니다.', rev: '오해를 풀지 않으면 더 큰 혼란이 올 수 있습니다.' } } },
  { index: 51, suit: 'swords', name: '검 2', nameEn: 'Two of Swords', upright: '결정 장애, 균형, 교착', reversed: '결단, 정보 과잉', buff_type: 'defense', buff_value: 3,
    reading: { past: { up: '과거에 어려운 선택 앞에서 균형을 유지했습니다.', rev: '과거에 결정을 미루다가 상황이 악화되었던 적이 있습니다.' }, present: { up: '두 길 사이에서 고민하고 있습니다. 마음을 가라앉히고 판단하십시오.', rev: '더 이상 미루지 마십시오. 결단의 시간입니다.' }, future: { up: '어려운 선택이 다가오지만 균형 잡힌 판단이 가능할 것입니다.', rev: '결정을 미루면 더 어려워집니다.' } } },
  { index: 52, suit: 'swords', name: '검 3', nameEn: 'Three of Swords', upright: '마음의 상처, 슬픔, 이별', reversed: '치유, 용서', buff_type: 'regen', buff_value: 4,
    reading: { past: { up: '과거에 마음에 큰 상처를 받았지만 그것이 성장의 계기가 되었습니다.', rev: '과거의 상처를 치유하고 용서를 시작했습니다.' }, present: { up: '마음에 고통이 있지만, 이것은 성장의 과정입니다.', rev: '치유가 시작되고 있습니다. 용서하고 놓아주십시오.' }, future: { up: '아픔이 지나가면 더 강해진 자신을 발견하게 될 것입니다.', rev: '상처를 품고 있지 말고 치유의 길로 나아가십시오.' } } },
  { index: 53, suit: 'swords', name: '검 4', nameEn: 'Four of Swords', upright: '휴식, 명상, 회복', reversed: '불안, 소진', buff_type: 'regen', buff_value: 5,
    reading: { past: { up: '과거에 적절한 휴식이 전력을 회복시켜주었습니다.', rev: '과거에 쉬지 못하고 달려 소진되었던 경험이 있습니다.' }, present: { up: '지금은 쉬어야 할 때입니다. 휴식은 게으름이 아닌 전략입니다.', rev: '불안감에 쉬지 못하고 있습니다. 멈추지 않으면 무너집니다.' }, future: { up: '충분한 휴식 후에 더 강하게 돌아올 것입니다.', rev: '소진을 방치하면 큰 대가를 치르게 됩니다.' } } },
  { index: 54, suit: 'swords', name: '검 5', nameEn: 'Five of Swords', upright: '갈등, 패배, 배신', reversed: '화해, 과거 극복', buff_type: 'crit', buff_value: 5,
    reading: { past: { up: '과거의 치열한 갈등에서 승리했지만 대가가 컸습니다.', rev: '과거의 갈등을 극복하고 화해의 길을 찾았습니다.' }, present: { up: '승리만을 추구하면 모든 것을 잃을 수 있습니다. 현명하게 싸우십시오.', rev: '과거의 갈등을 놓아주고 앞으로 나아갈 때입니다.' }, future: { up: '갈등에서 진정한 승리는 지혜로운 선택에서 옵니다.', rev: '화해하면 잃었던 것을 되찾을 수 있습니다.' } } },
  { index: 55, suit: 'swords', name: '검 6', nameEn: 'Six of Swords', upright: '전환, 이동, 회복', reversed: '저항, 미해결', buff_type: 'defense', buff_value: 4,
    reading: { past: { up: '과거에 어려운 상황을 떠나 새로운 곳에서 회복했습니다.', rev: '과거에 변화에 저항하여 고통이 길어졌던 적이 있습니다.' }, present: { up: '어려운 시기를 지나 평화로운 곳으로 이동하고 있습니다.', rev: '변화에 저항하지 마십시오. 떠나야 할 때를 인식하십시오.' }, future: { up: '더 나은 곳으로의 전환이 곧 이루어질 것입니다.', rev: '미해결된 문제를 안고 가면 새로운 곳에서도 고통이 계속됩니다.' } } },
  { index: 56, suit: 'swords', name: '검 7', nameEn: 'Seven of Swords', upright: '전략, 은밀, 기지', reversed: '발각, 양심', buff_type: 'crit', buff_value: 4,
    reading: { past: { up: '과거에 기지와 전략으로 위기를 모면했습니다.', rev: '과거의 은밀한 행동이 발각되어 곤란했던 적이 있습니다.' }, present: { up: '지혜로운 전략이 필요한 때입니다. 신중하게 움직이십시오.', rev: '숨기고 있는 것이 있다면 드러날 때가 되었습니다. 정직이 최선입니다.' }, future: { up: '기지를 발휘하면 어려운 상황을 헤쳐나갈 수 있습니다.', rev: '부정직한 방법은 결국 발각될 것입니다.' } } },
  { index: 57, suit: 'swords', name: '검 8', nameEn: 'Eight of Swords', upright: '속박, 무력감, 제약', reversed: '해방, 새 관점', buff_type: 'defense', buff_value: 3,
    reading: { past: { up: '과거에 스스로 만든 속박에 갇혀 있었던 적이 있습니다.', rev: '과거의 속박에서 벗어나 새로운 관점을 얻었습니다.' }, present: { up: '갇혀 있다고 느끼지만, 사실 탈출구는 있습니다. 눈을 열어보십시오.', rev: '속박에서 벗어나고 있습니다. 자유가 가까이 있습니다.' }, future: { up: '스스로의 한계를 깨뜨리면 자유를 얻을 것입니다.', rev: '새로운 관점이 해방의 열쇠가 될 것입니다.' } } },
  { index: 58, suit: 'swords', name: '검 9', nameEn: 'Nine of Swords', upright: '불안, 악몽, 걱정', reversed: '극복, 희망', buff_type: 'attack', buff_value: 4,
    reading: { past: { up: '과거에 심한 불안과 걱정에 시달렸던 시기가 있었습니다.', rev: '과거의 두려움을 극복하고 희망을 되찾았습니다.' }, present: { up: '걱정과 불안이 밤잠을 설치게 합니다. 하지만 대부분은 기우입니다.', rev: '불안을 극복하고 있습니다. 희망의 빛이 보이기 시작합니다.' }, future: { up: '걱정이 현실이 되지 않도록 행동하십시오.', rev: '어둠이 지나고 희망이 찾아올 것입니다.' } } },
  { index: 59, suit: 'swords', name: '검 10', nameEn: 'Ten of Swords', upright: '종말, 배신, 최악', reversed: '재기, 회복', buff_type: 'attack', buff_value: 5,
    reading: { past: { up: '과거에 최악의 상황을 겪었지만, 그것이 바닥이었습니다.', rev: '과거의 최악에서 재기한 경험이 당신의 강인함을 증명합니다.' }, present: { up: '최악의 순간이지만, 이보다 더 나빠지지는 않습니다. 이제 올라갈 일만 남았습니다.', rev: '최악은 지났습니다. 재기의 시간입니다.' }, future: { up: '끝은 새로운 시작입니다. 재기할 준비를 하십시오.', rev: '바닥을 찍은 후에는 반드시 상승이 있습니다.' } } },
  { index: 60, suit: 'swords', name: '검 시종', nameEn: 'Page of Swords', upright: '호기심, 지성, 관찰', reversed: '험담, 사기', buff_type: 'crit', buff_value: 3,
    reading: { past: { up: '과거에 날카로운 관찰력이 중요한 발견을 이끌었습니다.', rev: '과거에 가벼운 말이 큰 화를 불렀던 경험이 있습니다.' }, present: { up: '예리한 관찰력과 호기심이 진실을 밝혀낼 것입니다.', rev: '말을 조심하십시오. 험담은 자신에게 돌아옵니다.' }, future: { up: '지적 호기심이 새로운 발견으로 이어질 것입니다.', rev: '경솔한 언행은 미래에 화를 부를 수 있습니다.' } } },
  { index: 61, suit: 'swords', name: '검 기사', nameEn: 'Knight of Swords', upright: '야망, 신속, 단호', reversed: '무모, 공격성', buff_type: 'attack', buff_value: 6,
    reading: { past: { up: '과거에 단호하고 신속한 행동이 목표를 달성하게 해주었습니다.', rev: '과거에 공격적인 태도로 주변을 상처 입혔던 적이 있습니다.' }, present: { up: '단호하게 돌진할 때입니다. 망설이지 마십시오!', rev: '공격성을 조절하십시오. 무모한 행동은 위험합니다.' }, future: { up: '신속한 행동이 승리를 가져올 것입니다.', rev: '무모함을 자제하면 더 좋은 결과를 얻을 것입니다.' } } },
  { index: 62, suit: 'swords', name: '검 여왕', nameEn: 'Queen of Swords', upright: '독립, 통찰, 진실', reversed: '냉혹, 편견', buff_type: 'crit', buff_value: 5,
    reading: { past: { up: '과거에 독립적인 판단과 통찰이 올바른 길을 찾게 해주었습니다.', rev: '과거에 냉혹한 태도로 주변과 벽을 쌓았던 적이 있습니다.' }, present: { up: '진실을 꿰뚫어 보는 통찰력이 필요합니다. 독립적으로 판단하십시오.', rev: '너무 냉혹해지지 마십시오. 진실에도 온기가 필요합니다.' }, future: { up: '통찰력이 중요한 선택의 순간에 길을 밝혀줄 것입니다.', rev: '편견을 버리면 더 넓은 세계가 보일 것입니다.' } } },
  { index: 63, suit: 'swords', name: '검 왕', nameEn: 'King of Swords', upright: '지성, 권위, 공정', reversed: '폭정, 냉소', buff_type: 'attack', buff_value: 7,
    reading: { past: { up: '과거에 지성과 공정함으로 존경을 받았습니다.', rev: '과거에 권위를 남용하여 주변을 두렵게 했던 적이 있습니다.' }, present: { up: '냉철한 판단과 공정함이 필요한 때입니다. 지성으로 이끄십시오.', rev: '냉소적인 태도를 버리십시오. 따뜻한 리더십이 필요합니다.' }, future: { up: '지적 권위가 인정받는 때가 올 것입니다.', rev: '폭정은 반드시 반발을 부릅니다. 공정하게 행동하십시오.' } } },
  { index: 64, suit: 'pentacles', name: '동전 에이스', nameEn: 'Ace of Pentacles', upright: '새로운 기회, 번영, 실현', reversed: '기회 상실, 낭비', buff_type: 'gold', buff_value: 7,
    reading: { past: { up: '과거에 좋은 기회를 잡아 번영의 기반을 마련했습니다.', rev: '과거에 좋은 기회를 놓쳤던 아쉬움이 남아 있습니다.' }, present: { up: '번영의 새로운 기회가 눈앞에 있습니다. 놓치지 마십시오!', rev: '기회가 있지만 낭비하고 있습니다. 현명하게 활용하십시오.' }, future: { up: '물질적 번영의 기회가 곧 찾아올 것입니다.', rev: '기회를 놓치지 않으려면 지금부터 준비하십시오.' } } },
  { index: 65, suit: 'pentacles', name: '동전 2', nameEn: 'Two of Pentacles', upright: '균형, 적응, 유연', reversed: '불균형, 과부하', buff_type: 'defense', buff_value: 3,
    reading: { past: { up: '과거에 유연하게 적응하여 여러 일을 동시에 처리했습니다.', rev: '과거에 여러 일을 감당하지 못해 과부하에 걸렸던 적이 있습니다.' }, present: { up: '여러 일의 균형을 잘 잡고 있습니다. 유연하게 대처하십시오.', rev: '너무 많은 일을 동시에 하고 있습니다. 우선순위를 정하십시오.' }, future: { up: '유연한 대처가 여러 기회를 동시에 잡게 해줄 것입니다.', rev: '균형을 잃으면 모든 것을 놓칠 수 있습니다.' } } },
  { index: 66, suit: 'pentacles', name: '동전 3', nameEn: 'Three of Pentacles', upright: '협력, 장인정신, 성장', reversed: '불화, 미숙', buff_type: 'gold', buff_value: 4,
    reading: { past: { up: '과거에 좋은 팀워크가 뛰어난 결과를 만들어냈습니다.', rev: '과거에 협력이 부족하여 결과물이 미숙했던 적이 있습니다.' }, present: { up: '협력과 장인정신이 빛나는 때입니다. 함께하면 더 큰 것을 이룹니다.', rev: '혼자서는 한계가 있습니다. 전문가의 도움을 구하십시오.' }, future: { up: '협력을 통해 뛰어난 성과를 거둘 것입니다.', rev: '실력을 갈고닦아야 더 좋은 기회가 옵니다.' } } },
  { index: 67, suit: 'pentacles', name: '동전 4', nameEn: 'Four of Pentacles', upright: '안정, 절약, 보존', reversed: '인색, 집착', buff_type: 'defense', buff_value: 5,
    reading: { past: { up: '과거에 현명한 절약이 안정적인 기반을 만들었습니다.', rev: '과거에 지나친 인색함이 관계를 해쳤습니다.' }, present: { up: '가진 것을 지키되, 흐름을 막지는 마십시오.', rev: '물질에 지나치게 집착하고 있습니다. 놓아줄 줄도 알아야 합니다.' }, future: { up: '현명한 관리가 안정된 미래를 보장할 것입니다.', rev: '집착을 버려야 더 큰 풍요가 찾아옵니다.' } } },
  { index: 68, suit: 'pentacles', name: '동전 5', nameEn: 'Five of Pentacles', upright: '곤궁, 고난, 소외', reversed: '회복, 원조', buff_type: 'regen', buff_value: 4,
    reading: { past: { up: '과거에 경제적 어려움이나 소외를 겪었던 시기가 있었습니다.', rev: '과거의 곤궁에서 벗어나 회복의 길을 걸어왔습니다.' }, present: { up: '어려운 시기이지만, 도움의 손길은 가까이에 있습니다.', rev: '곤궁에서 벗어나고 있습니다. 도움을 받아들이십시오.' }, future: { up: '고난이 지나가고 회복의 시기가 올 것입니다.', rev: '도움을 구하면 더 빨리 어려움에서 벗어날 수 있습니다.' } } },
  { index: 69, suit: 'pentacles', name: '동전 6', nameEn: 'Six of Pentacles', upright: '관대, 나눔, 균형', reversed: '부채, 이기심', buff_type: 'gold', buff_value: 5,
    reading: { past: { up: '과거에 나눔의 기쁨을 알았던 경험이 있습니다.', rev: '과거에 이기심으로 나누지 못했던 후회가 남아 있습니다.' }, present: { up: '나눌 수 있을 때 나누십시오. 관대함은 돌아옵니다.', rev: '주는 것과 받는 것의 균형이 필요합니다.' }, future: { up: '나눔이 더 큰 풍요를 가져올 것입니다.', rev: '이기심은 결국 고독을 부릅니다.' } } },
  { index: 70, suit: 'pentacles', name: '동전 7', nameEn: 'Seven of Pentacles', upright: '인내, 투자, 성찰', reversed: '조급, 낭비', buff_type: 'gold', buff_value: 4,
    reading: { past: { up: '과거에 인내심 있게 투자한 것이 결실을 맺고 있습니다.', rev: '과거에 조급함으로 투자를 낭비했던 경험이 있습니다.' }, present: { up: '씨앗은 뿌려졌습니다. 인내하며 결실을 기다리십시오.', rev: '조급해하지 마십시오. 급할수록 돌아가야 합니다.' }, future: { up: '오랜 투자가 풍성한 결실을 맺을 것입니다.', rev: '인내를 잃으면 그동안의 노력이 수포로 돌아갈 수 있습니다.' } } },
  { index: 71, suit: 'pentacles', name: '동전 8', nameEn: 'Eight of Pentacles', upright: '장인정신, 근면, 숙련', reversed: '태만, 완벽주의', buff_type: 'attack', buff_value: 5,
    reading: { past: { up: '과거에 꾸준한 노력과 수련이 뛰어난 실력을 만들었습니다.', rev: '과거에 노력을 게을리하여 실력이 정체되었던 적이 있습니다.' }, present: { up: '실력을 갈고닦을 때입니다. 꾸준한 노력이 최고를 만듭니다.', rev: '완벽에 집착하거나 노력을 게을리하지 마십시오.' }, future: { up: '꾸준한 수련이 대가의 경지로 이끌 것입니다.', rev: '태만은 퇴보를 부릅니다. 끊임없이 갈고닦으십시오.' } } },
  { index: 72, suit: 'pentacles', name: '동전 9', nameEn: 'Nine of Pentacles', upright: '풍요, 자립, 사치', reversed: '과시, 의존', buff_type: 'gold', buff_value: 7,
    reading: { past: { up: '과거에 자립하여 풍요를 이루었던 경험이 자신감을 줍니다.', rev: '과거에 과시욕으로 분수에 맞지 않는 소비를 했던 적이 있습니다.' }, present: { up: '노력의 결실을 즐기십시오. 풍요롭고 독립적인 시기입니다.', rev: '겉치레에 신경 쓰지 마십시오. 진정한 풍요는 내면에 있습니다.' }, future: { up: '자립과 풍요의 시기가 곧 찾아올 것입니다.', rev: '과시와 낭비를 경계하면 풍요가 오래갈 것입니다.' } } },
  { index: 73, suit: 'pentacles', name: '동전 10', nameEn: 'Ten of Pentacles', upright: '유산, 부, 완성', reversed: '분쟁, 파산', buff_type: 'gold', buff_value: 8,
    reading: { past: { up: '과거에 쌓아온 것들이 든든한 유산이 되고 있습니다.', rev: '과거에 재물 분쟁이나 손실을 겪었던 아픈 기억이 있습니다.' }, present: { up: '물질적 완성에 가까이 와 있습니다. 유산을 지혜롭게 관리하십시오.', rev: '재물에 대한 분쟁이 있을 수 있습니다. 현명하게 대처하십시오.' }, future: { up: '풍요로운 유산과 안정된 미래가 기다리고 있습니다.', rev: '재물 관리에 소홀하면 파산의 위험이 있습니다.' } } },
  { index: 74, suit: 'pentacles', name: '동전 시종', nameEn: 'Page of Pentacles', upright: '성실, 학습, 기회', reversed: '나태, 비실용', buff_type: 'gold', buff_value: 3,
    reading: { past: { up: '과거에 성실한 학습이 귀중한 지식을 가져다주었습니다.', rev: '과거에 나태함으로 좋은 기회를 놓쳤던 적이 있습니다.' }, present: { up: '새로운 기술이나 지식을 배울 좋은 시기입니다. 성실히 임하십시오.', rev: '나태함을 극복하고 실용적인 목표를 세우십시오.' }, future: { up: '학습한 것이 실질적인 기회로 이어질 것입니다.', rev: '게으름을 극복해야 기회가 찾아옵니다.' } } },
  { index: 75, suit: 'pentacles', name: '동전 기사', nameEn: 'Knight of Pentacles', upright: '효율, 근면, 책임', reversed: '지루함, 완고', buff_type: 'defense', buff_value: 5,
    reading: { past: { up: '과거에 묵묵히 책임을 다한 것이 신뢰의 바탕이 되었습니다.', rev: '과거에 융통성 없는 태도로 기회를 놓쳤던 적이 있습니다.' }, present: { up: '꾸준하고 성실하게 나아가십시오. 효율적인 노력이 빛날 것입니다.', rev: '지나치게 경직되어 있습니다. 유연함도 필요합니다.' }, future: { up: '근면한 노력이 확실한 성과를 가져올 것입니다.', rev: '완고함을 버리면 더 좋은 길이 보일 것입니다.' } } },
  { index: 76, suit: 'pentacles', name: '동전 여왕', nameEn: 'Queen of Pentacles', upright: '풍요, 실용, 양육', reversed: '과보호, 물질주의', buff_type: 'regen', buff_value: 6,
    reading: { past: { up: '과거에 실용적인 지혜로 풍요로운 환경을 만들었습니다.', rev: '과거에 물질에 집착하여 소중한 것을 놓쳤던 경험이 있습니다.' }, present: { up: '실용적인 접근이 풍요를 가져오고 있습니다. 주변을 돌보십시오.', rev: '물질만 추구하지 마십시오. 마음의 풍요도 중요합니다.' }, future: { up: '풍요롭고 안정된 환경이 조성될 것입니다.', rev: '물질주의에 빠지지 않으면 진정한 풍요를 누릴 것입니다.' } } },
  { index: 77, suit: 'pentacles', name: '동전 왕', nameEn: 'King of Pentacles', upright: '부, 안정, 성공', reversed: '탐욕, 부패', buff_type: 'gold', buff_value: 8,
    reading: { past: { up: '과거에 현명한 경영으로 부와 안정을 이루었습니다.', rev: '과거에 탐욕이 부패를 불렀던 뼈아픈 교훈이 있습니다.' }, present: { up: '물질적 성공과 안정이 절정에 이르고 있습니다.', rev: '부에 취해 도덕을 잃지 마십시오. 탐욕은 파멸의 길입니다.' }, future: { up: '위대한 부와 안정이 기다리고 있습니다.', rev: '청렴을 지키면 진정한 성공이 찾아올 것입니다.' } } },

];

// ── 부적 정의 ──
const TALISMANS = [
  { id: 'talisman_atk', name: '파마 부적', desc: '공격력 +25% 증가 (7전투)', price: 400, buff_type: 'attack', buff_value: 25, duration: 7, icon: '🔥', grade: '고급' },
  { id: 'talisman_def', name: '수호 부적', desc: '방어력 +25% 증가 (7전투)', price: 400, buff_type: 'defense', buff_value: 25, duration: 7, icon: '🛡️', grade: '고급' },
  { id: 'talisman_gold', name: '재물 부적', desc: '획득 골드 +40% 증가 (7전투)', price: 500, buff_type: 'gold', buff_value: 40, duration: 7, icon: '💰', grade: '고급' },
  { id: 'talisman_crit', name: '파천 부적', desc: '치명타율 +15% 증가 (7전투)', price: 600, buff_type: 'crit', buff_value: 15, duration: 7, icon: '⚡', grade: '희귀' },
  { id: 'talisman_hp', name: '재생 부적', desc: '전투 후 HP 20% 회복 (7전투)', price: 500, buff_type: 'regen', buff_value: 20, duration: 7, icon: '💚', grade: '고급' },
  { id: 'talisman_all', name: '만능 부적', desc: '공격·방어 +15%, 골드 +20% (10전투)', price: 1000, buff_type: 'all', buff_value: 15, duration: 10, icon: '✨', grade: '희귀' },
];

// ── 오늘의 운세 확인 ──
router.get('/daily', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [existing] = await pool.query(
      'SELECT * FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND DATE(created_at) = CURDATE()',
      [char.id, 'daily']
    );

    let nextDailyAt = null;
    if (existing.length > 0) {
      const created = new Date(existing[0].created_at);
      const tomorrow = new Date(created);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      nextDailyAt = tomorrow.toISOString();
    }

    res.json({
      todayFortune: existing.length > 0 ? existing[0] : null,
      gold: char.gold,
      nextDailyAt,
    });
  } catch (err) {
    console.error('Fortune daily check error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 오늘의 운세 뽑기 ──
router.post('/daily', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [existing] = await pool.query(
      'SELECT * FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND DATE(created_at) = CURDATE()',
      [char.id, 'daily']
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '오늘의 운세는 이미 확인하셨습니다.', fortune: existing[0] });
    }

    // 가중 확률: 대길 10%, 중길 25%, 소길 25%, 평 25%, 흉 15%
    const roll = Math.random() * 100;
    let result;
    if (roll < 10) result = FORTUNE_RESULTS.filter(f => f.grade === '대길')[Math.floor(Math.random() * 2)];
    else if (roll < 35) result = FORTUNE_RESULTS.filter(f => f.grade === '중길')[Math.floor(Math.random() * 2)];
    else if (roll < 60) result = FORTUNE_RESULTS.filter(f => f.grade === '소길')[Math.floor(Math.random() * 2)];
    else if (roll < 85) result = FORTUNE_RESULTS[6]; // 평
    else result = FORTUNE_RESULTS[7]; // 흉

    await pool.query(
      `INSERT INTO character_fortunes (character_id, fortune_type, fortune_grade, fortune_msg, buff_type, buff_value, remaining_battles, icon, color)
       VALUES (?, 'daily', ?, ?, ?, ?, ?, ?, ?)`,
      [char.id, result.grade, result.msg, result.buff_type, result.buff_value, result.duration, result.icon, result.color]
    );

    const [fortune] = await pool.query(
      'SELECT * FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND DATE(created_at) = CURDATE()',
      [char.id, 'daily']
    );

    res.json({ fortune: fortune[0], message: `오늘의 운세: ${result.grade}` });
  } catch (err) {
    console.error('Fortune daily draw error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 점괘 목록 ──
router.get('/divinations', auth, async (req, res) => {
  res.json({ divinations: DIVINATIONS });
});

// ── 점괘 구매 ──
router.post('/divination', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const { divId } = req.body;
    const div = DIVINATIONS.find(d => d.id === divId);
    if (!div) return res.status(400).json({ message: '존재하지 않는 점괘입니다.' });

    // 점괘 쿨타임 체크 (8시간)
    const [lastDiv] = await pool.query(
      'SELECT created_at FROM character_fortunes WHERE character_id = ? AND fortune_type = ? ORDER BY created_at DESC LIMIT 1',
      [char.id, 'divination']
    );
    if (lastDiv.length > 0) {
      const lastTime = new Date(lastDiv[0].created_at);
      const cooldownMs = 8 * 60 * 60 * 1000; // 8 hours
      const elapsed = Date.now() - lastTime.getTime();
      if (elapsed < cooldownMs) {
        const remaining = cooldownMs - elapsed;
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return res.status(400).json({
          message: `점괘 쿨타임 중입니다. ${hours}시간 ${minutes}분 후 다시 이용 가능합니다.`,
          cooldownRemaining: remaining
        });
      }
    }

    if (char.gold < div.price) return res.status(400).json({ message: '골드가 부족합니다.' });

    // 같은 타입 버프가 이미 있으면 덮어쓰기
    await pool.query(
      'DELETE FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND buff_type = ?',
      [char.id, 'divination', div.buff_type]
    );

    await pool.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [div.price, char.id]);

    await pool.query(
      `INSERT INTO character_fortunes (character_id, fortune_type, fortune_grade, fortune_msg, buff_type, buff_value, remaining_battles, icon, color)
       VALUES (?, 'divination', ?, ?, ?, ?, ?, ?, '#22d3ee')`,
      [char.id, div.name, div.desc, div.buff_type, div.buff_value, div.duration, div.icon]
    );

    const newGold = char.gold - div.price;
    res.json({ message: `${div.name}의 기운이 깃들었습니다!`, gold: newGold });
  } catch (err) {
    console.error('Divination error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 부적 목록 ──
router.get('/talismans', auth, async (req, res) => {
  res.json({ talismans: TALISMANS });
});

// ── 부적 구매 ──
router.post('/talisman', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const { talismanId } = req.body;
    const tal = TALISMANS.find(t => t.id === talismanId);
    if (!tal) return res.status(400).json({ message: '존재하지 않는 부적입니다.' });
    if (char.gold < tal.price) return res.status(400).json({ message: '골드가 부족합니다.' });

    // 같은 타입 버프가 이미 있으면 덮어쓰기
    await pool.query(
      'DELETE FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND buff_type = ?',
      [char.id, 'talisman', tal.buff_type]
    );

    await pool.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [tal.price, char.id]);

    await pool.query(
      `INSERT INTO character_fortunes (character_id, fortune_type, fortune_grade, fortune_msg, buff_type, buff_value, remaining_battles, icon, color)
       VALUES (?, 'talisman', ?, ?, ?, ?, ?, ?, '#a78bfa')`,
      [char.id, tal.name, tal.desc, tal.buff_type, tal.buff_value, tal.duration, tal.icon]
    );

    const newGold = char.gold - tal.price;
    res.json({ message: `${tal.name}을(를) 활성화했습니다!`, gold: newGold });
  } catch (err) {
    console.error('Talisman error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 스프레드 타입 정의 ──
const SPREAD_TYPES = {
  one: {
    id: 'one', name: '원 카드', nameEn: 'One Card', cardCount: 1, cost: 100, maxPerDay: 5,
    desc: '하나의 카드로 오늘의 메시지를 받습니다.',
    positions: [{ key: 'message', label: '오늘의 메시지', desc: '지금 이 순간 당신에게 가장 필요한 메시지입니다.' }],
  },
  three: {
    id: 'three', name: '쓰리 카드', nameEn: 'Three Card', cardCount: 3, cost: 300, maxPerDay: 3,
    desc: '과거·현재·미래를 읽는 전통적인 스프레드입니다.',
    positions: [
      { key: 'past', label: '과거', desc: '현재 상황의 근원이 되는 과거의 영향' },
      { key: 'present', label: '현재', desc: '지금 당신이 직면한 상황과 에너지' },
      { key: 'future', label: '미래', desc: '현재 흐름이 이어질 때 펼쳐질 미래' },
    ],
  },
  celtic: {
    id: 'celtic', name: '켈틱 크로스', nameEn: 'Celtic Cross', cardCount: 5, cost: 500, maxPerDay: 1,
    desc: '상황을 깊이 있게 분석하는 정통 스프레드입니다.',
    positions: [
      { key: 'present', label: '현재 상황', desc: '당신이 현재 처한 핵심 상황' },
      { key: 'challenge', label: '장애물', desc: '당신 앞에 놓인 도전이나 방해 요소' },
      { key: 'past', label: '기반', desc: '현재 상황을 만든 과거의 토대' },
      { key: 'advice', label: '조언', desc: '이 상황에서 취해야 할 행동' },
      { key: 'outcome', label: '결과', desc: '현재 흐름이 이끄는 최종 결과' },
    ],
  },
};

// ── 타로 상태 (오늘 남은 횟수, 비용) ──
router.get('/tarot/status', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [readings] = await pool.query(
      'SELECT spread_type, COUNT(*) as cnt FROM character_tarot_readings WHERE character_id = ? AND DATE(created_at) = CURDATE() GROUP BY spread_type',
      [char.id]
    );

    const usedMap = {};
    readings.forEach(r => { usedMap[r.spread_type || 'three'] = r.cnt; });

    const spreads = Object.values(SPREAD_TYPES).map(s => ({
      ...s,
      usedToday: usedMap[s.id] || 0,
      remaining: Math.max(0, s.maxPerDay - (usedMap[s.id] || 0)),
    }));

    res.json({ spreads, gold: char.gold, totalCards: TAROT_CARDS.length });
  } catch (err) {
    console.error('Tarot status error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 타로 컬렉션 (발견 카드 + 전체 목록) ──
router.get('/tarot/collection', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [discovered] = await pool.query(
      'SELECT card_index, discovered_at FROM character_tarot_collection WHERE character_id = ? ORDER BY card_index',
      [char.id]
    );

    const discoveredSet = new Set(discovered.map(d => d.card_index));
    const cards = TAROT_CARDS.map(c => ({
      ...c,
      suit: c.suit || getCardSuit(c.index),
      discovered: discoveredSet.has(c.index),
      discovered_at: discovered.find(d => d.card_index === c.index)?.discovered_at || null,
    }));

    res.json({ cards, totalCount: TAROT_CARDS.length, discoveredCount: discovered.length });
  } catch (err) {
    console.error('Tarot collection error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 타로 스프레드 뽑기 (정통 프로세스) ──
router.post('/tarot/draw', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const { spreadType = 'three' } = req.body;
    const spreadDef = SPREAD_TYPES[spreadType];
    if (!spreadDef) return res.status(400).json({ message: '존재하지 않는 스프레드 타입입니다.' });

    // 타로 쿨타임 체크 (4시간)
    const [lastTarot] = await pool.query(
      'SELECT created_at FROM character_tarot_readings WHERE character_id = ? ORDER BY created_at DESC LIMIT 1',
      [char.id]
    );
    if (lastTarot.length > 0) {
      const lastTime = new Date(lastTarot[0].created_at);
      const cooldownMs = 4 * 60 * 60 * 1000; // 4 hours
      const elapsed = Date.now() - lastTime.getTime();
      if (elapsed < cooldownMs) {
        const remaining = cooldownMs - elapsed;
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return res.status(400).json({
          message: `타로 쿨타임 중입니다. ${hours}시간 ${minutes}분 후 다시 이용 가능합니다.`,
          cooldownRemaining: remaining
        });
      }
    }

    const cost = spreadDef.cost;
    if (char.gold < cost) return res.status(400).json({ message: `골드가 부족합니다. (필요: ${cost}G)` });

    const [readings] = await pool.query(
      'SELECT COUNT(*) as cnt FROM character_tarot_readings WHERE character_id = ? AND spread_type = ? AND DATE(created_at) = CURDATE()',
      [char.id, spreadType]
    );
    if (readings[0].cnt >= spreadDef.maxPerDay) {
      return res.status(400).json({ message: `오늘의 ${spreadDef.name} 횟수를 모두 사용했습니다. (${spreadDef.maxPerDay}/${spreadDef.maxPerDay})` });
    }

    // 78장 덱에서 N장 뽑기 (중복 불가) - 정통 셔플
    const cardCount = spreadDef.cardCount;
    const deck = Array.from({ length: TAROT_CARDS.length }, (_, i) => i);
    // Fisher-Yates 셔플
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const drawnIndices = deck.slice(0, cardCount);

    const spread = drawnIndices.map(idx => {
      const card = TAROT_CARDS[idx];
      const isReversed = Math.random() < 0.35;
      return { ...card, isReversed, reversedText: card.reversed };
    });

    // 버프: 첫 번째 카드(원카드) 또는 present 위치 카드(쓰리카드/켈틱)
    const buffCardIdx = spreadType === 'one' ? 0 : spreadType === 'three' ? 1 : 0;
    const buffCard = spread[buffCardIdx];
    const buffMultiplier = buffCard.isReversed ? 0.5 : 1.0;
    const buffBase = spreadType === 'celtic' ? Math.round(buffCard.buff_value * 1.5) : buffCard.buff_value;
    const finalBuffValue = Math.round(buffBase * buffMultiplier);
    const duration = spreadType === 'one' ? 3 : spreadType === 'three' ? 5 : 7;

    // 골드 차감
    await pool.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [cost, char.id]);

    // 리딩 기록 저장 (가변 카드 수 지원)
    const card1 = spread[0] || null;
    const card2 = spread[1] || null;
    const card3 = spread[2] || null;
    await pool.query(
      `INSERT INTO character_tarot_readings (character_id, spread_type, card1_index, card1_reversed, card2_index, card2_reversed, card3_index, card3_reversed, buff_type, buff_value, gold_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [char.id, spreadType,
        card1 ? card1.index : 0, card1 ? (card1.isReversed ? 1 : 0) : 0,
        card2 ? card2.index : 0, card2 ? (card2.isReversed ? 1 : 0) : 0,
        card3 ? card3.index : 0, card3 ? (card3.isReversed ? 1 : 0) : 0,
        buffCard.buff_type, finalBuffValue, cost]
    );

    // 발견 카드 컬렉션에 추가
    for (const card of spread) {
      await pool.query(
        'INSERT IGNORE INTO character_tarot_collection (character_id, card_index) VALUES (?, ?)',
        [char.id, card.index]
      );
    }

    // 기존 타로 버프 제거 후 새 버프 등록
    await pool.query(
      'DELETE FROM character_fortunes WHERE character_id = ? AND fortune_type = ?',
      [char.id, 'tarot']
    );

    if (finalBuffValue > 0) {
      const buffLabel = buffCard.isReversed ? `${buffCard.name} (역방향)` : buffCard.name;
      const buffMsg = buffCard.isReversed ? buffCard.reversedText : buffCard.upright;
      await pool.query(
        `INSERT INTO character_fortunes (character_id, fortune_type, fortune_grade, fortune_msg, buff_type, buff_value, remaining_battles, icon, color)
         VALUES (?, 'tarot', ?, ?, ?, ?, ?, '🃏', '#c084fc')`,
        [char.id, buffLabel, buffMsg, buffCard.buff_type, finalBuffValue, duration]
      );
    }

    const newGold = char.gold - cost;
    const usedToday = readings[0].cnt + 1;

    // 위치별 해석 생성
    const spreadWithReading = spread.map((s, i) => {
      const posDef = spreadDef.positions[i];
      const posKey = posDef.key;
      // reading 매핑: message→present, challenge→present, advice→future, outcome→future
      const readingKey = posKey === 'message' ? 'present' : posKey === 'challenge' ? 'present' : posKey === 'advice' ? 'future' : posKey === 'outcome' ? 'future' : posKey;
      const dir = s.isReversed ? 'rev' : 'up';
      const reading = s.reading?.[readingKey]?.[dir] || (s.isReversed ? s.reversedText : s.upright);
      return {
        index: s.index,
        suit: s.suit || getCardSuit(s.index),
        name: s.name,
        nameEn: s.nameEn,
        reversed: s.isReversed,
        upright: s.upright,
        reversedText: s.reversedText,
        buff_type: s.buff_type,
        buff_value: s.buff_value,
        reading,
        position: posDef.label,
        positionDesc: posDef.desc,
      };
    });

    // 종합 해석 생성
    let summary;
    if (spreadType === 'one') {
      const c = spread[0];
      const dir = c.isReversed ? '역방향' : '정방향';
      summary = `${c.name}(${dir}) 카드가 나타났습니다. ${c.isReversed ? '역방향의 기운이 감지되니 주의가 필요합니다.' : '정방향의 좋은 기운이 당신과 함께합니다.'}`;
    } else if (spreadType === 'three') {
      const dirs = spread.map(s => s.isReversed ? '역방향' : '정방향');
      summary = `${spread[0].name}(${dirs[0]})이 과거를, ${spread[1].name}(${dirs[1]})이 현재를, ${spread[2].name}(${dirs[2]})이 미래를 나타냅니다. ${spread[1].isReversed ? '현재 역경의 기운이 감지되나, 이를 극복하면 더욱 강해질 것입니다.' : '현재 좋은 기운이 흐르고 있습니다. 이 흐름을 놓치지 마십시오.'}`;
    } else {
      const majorCount = spread.filter(s => getCardSuit(s.index) === 'major').length;
      const reversedCount = spread.filter(s => s.isReversed).length;
      let tone = '균형 잡힌';
      if (majorCount >= 3) tone = '운명적인 전환이 예고되는';
      else if (reversedCount >= 3) tone = '내면의 성찰이 필요한';
      else if (reversedCount === 0) tone = '강력한 순풍이 부는';
      summary = `${tone} 리딩입니다. ${spread[0].name}이(가) 현재를 비추고, ${spread[1].name}이(가) 장애를 나타내며, ${spread[4].name}이(가) 최종 결과를 향하고 있습니다. ${majorCount >= 2 ? '메이저 아르카나가 다수 출현하여 운명의 전환점에 있음을 암시합니다.' : '마이너 아르카나가 주를 이루어 일상에서의 변화를 나타냅니다.'}`;
    }

    res.json({
      spreadType,
      spreadDef: { name: spreadDef.name, cardCount: spreadDef.cardCount },
      spread: spreadWithReading,
      buffCard: {
        name: buffCard.name,
        buff_type: buffCard.buff_type,
        buff_value: finalBuffValue,
        reversed: buffCard.isReversed,
        duration,
      },
      summary,
      gold: newGold,
      usedToday,
      message: `${spreadDef.name} 점술 완료! ${buffCard.name} 카드의 기운이 깃들었습니다.`,
    });
  } catch (err) {
    console.error('Tarot draw error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 내 활성 버프 목록 ──
router.get('/buffs', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [buffs] = await pool.query(
      'SELECT * FROM character_fortunes WHERE character_id = ? AND remaining_battles > 0 ORDER BY created_at DESC',
      [char.id]
    );

    res.json({ buffs, gold: char.gold });
  } catch (err) {
    console.error('Buffs error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 쿨타임 조회 ──
router.get('/cooldowns', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const now = Date.now();

    // 일일 운세 쿨타임
    const [dailyExist] = await pool.query(
      'SELECT created_at FROM character_fortunes WHERE character_id = ? AND fortune_type = ? AND DATE(created_at) = CURDATE()',
      [char.id, 'daily']
    );
    let dailyCooldown = 0;
    if (dailyExist.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      dailyCooldown = Math.max(0, tomorrow.getTime() - now);
    }

    // 점괘 쿨타임 (8시간)
    const [lastDiv] = await pool.query(
      'SELECT created_at FROM character_fortunes WHERE character_id = ? AND fortune_type = ? ORDER BY created_at DESC LIMIT 1',
      [char.id, 'divination']
    );
    let divCooldown = 0;
    if (lastDiv.length > 0) {
      const elapsed = now - new Date(lastDiv[0].created_at).getTime();
      divCooldown = Math.max(0, 8 * 3600000 - elapsed);
    }

    // 타로 쿨타임 (4시간)
    const [lastTarot] = await pool.query(
      'SELECT created_at FROM character_tarot_readings WHERE character_id = ? ORDER BY created_at DESC LIMIT 1',
      [char.id]
    );
    let tarotCooldown = 0;
    if (lastTarot.length > 0) {
      const elapsed = now - new Date(lastTarot[0].created_at).getTime();
      tarotCooldown = Math.max(0, 4 * 3600000 - elapsed);
    }

    res.json({
      daily: { cooldown: dailyCooldown, available: dailyCooldown === 0 },
      divination: { cooldown: divCooldown, available: divCooldown === 0 },
      tarot: { cooldown: tarotCooldown, available: tarotCooldown === 0 },
    });
  } catch (err) {
    console.error('Cooldowns error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
