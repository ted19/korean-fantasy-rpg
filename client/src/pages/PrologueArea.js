import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import StageBattle from '../srpg/StageBattle';
import './PrologueArea.css';

const PROLOGUE_DATA = {
  '풍수사': {
    title: '바람이 부르는 자',
    scenes: [
      {
        bg: '/stages/gojoseon_bg.png',
        speaker: '???',
        text: '...이곳의 기운이 심상치 않구나.',
      },
      {
        bg: '/stages/gojoseon_bg.png',
        speaker: '나레이션',
        text: '고조선 시대, 대지의 기운이 흐트러지기 시작했다. 산맥의 용맥이 끊기고, 마을에는 재앙이 찾아왔다.',
      },
      {
        bg: '/stages/gojoseon_bg.png',
        speaker: '스승',
        text: '너는 풍수의 재능을 타고났다. 바람과 물, 대지의 흐름을 읽는 힘... 그것이 네 운명이다.',
      },
      {
        bg: '/stages/gojoseon_bg.png',
        speaker: '풍수사',
        text: '스승님, 용맥이 끊긴 이유를 찾아야 합니다. 이대로는 마을이 위험합니다.',
      },
      {
        bg: '/stages/gojoseon_bg.png',
        speaker: '스승',
        text: '산 너머 고대 사당에서 사악한 기운이 느껴진다. 그곳으로 가거라. 하지만 조심해야 한다... 마물들이 득실거릴 것이다.',
      },
      {
        bg: '/dungeons/forest_bg.png',
        speaker: '나레이션',
        text: '풍수사는 첫 번째 시련을 향해 발걸음을 옮겼다. 숲길에 들어서자, 수상한 기운이 감돌기 시작했다.',
      },
      {
        bg: '/dungeons/forest_bg.png',
        speaker: '풍수사',
        text: '...기운이 뒤틀려 있다. 분명 마물의 소행이다. 여기서부터가 시작이군.',
      },
    ],
    battleIntro: '숲에서 마물이 나타났다! 첫 번째 전투를 시작합니다.',
  },
  '무당': {
    title: '영혼의 소리를 듣는 자',
    scenes: [
      {
        bg: '/stages/samhan_bg.png',
        speaker: '???',
        text: '...들리는가? 저 너머에서 울려오는 영혼의 울음소리가.',
      },
      {
        bg: '/stages/samhan_bg.png',
        speaker: '나레이션',
        text: '삼한 시대, 인간과 신령의 경계가 허물어지기 시작했다. 원혼들이 이승을 떠돌며 산 자들을 괴롭혔다.',
      },
      {
        bg: '/stages/samhan_bg.png',
        speaker: '큰무당',
        text: '아이야, 너에게는 특별한 영안이 있다. 보통 사람에게는 보이지 않는 것들이 너에게는 보이지.',
      },
      {
        bg: '/stages/samhan_bg.png',
        speaker: '무당',
        text: '큰어머니, 요즘 마을 근처에서 원혼들이 점점 늘어나고 있어요. 이전과는 다른 느낌이에요.',
      },
      {
        bg: '/stages/samhan_bg.png',
        speaker: '큰무당',
        text: '누군가가 이승과 저승의 문을 건드리고 있다. 네가 직접 가서 확인하거라. 부적과 방울을 가져가렴.',
      },
      {
        bg: '/dungeons/spirit_forest_bg.png',
        speaker: '나레이션',
        text: '무당은 영혼의 숲으로 향했다. 울창한 나무 사이로 푸르스름한 도깨비불이 흔들리고 있었다.',
      },
      {
        bg: '/dungeons/spirit_forest_bg.png',
        speaker: '무당',
        text: '...이 기운, 단순한 원혼이 아니야. 무언가 더 큰 힘이 이들을 조종하고 있어.',
      },
    ],
    battleIntro: '원혼들이 덮쳐온다! 첫 번째 전투를 시작합니다.',
  },
  '승려': {
    title: '금강의 수호자',
    scenes: [
      {
        bg: '/stages/silla_bg.png',
        speaker: '???',
        text: '...마음을 비우고, 호흡을 가다듬어라.',
      },
      {
        bg: '/stages/silla_bg.png',
        speaker: '나레이션',
        text: '신라 시대, 깊은 산중 사찰에서 한 승려가 수행을 이어가고 있었다. 그러나 세상 밖에서는 마물의 침입이 시작되고 있었다.',
      },
      {
        bg: '/stages/silla_bg.png',
        speaker: '주지스님',
        text: '수행자여, 네 금강의 힘은 이미 충분하다. 하지만 진정한 깨달음은 산 밖에서 얻는 법이지.',
      },
      {
        bg: '/stages/silla_bg.png',
        speaker: '승려',
        text: '스님, 산 아래 마을에서 마물이 나타났다는 소식을 들었습니다. 제가 가겠습니다.',
      },
      {
        bg: '/stages/silla_bg.png',
        speaker: '주지스님',
        text: '좋다. 네 주먹과 경문이 마을 사람들을 지켜줄 것이다. 가거라, 그리고 돌아와 네가 본 것을 알려주거라.',
      },
      {
        bg: '/dungeons/cave_bg.png',
        speaker: '나레이션',
        text: '승려는 산을 내려와 동굴 입구에 도착했다. 동굴 안에서 으르렁거리는 소리가 울려퍼졌다.',
      },
      {
        bg: '/dungeons/cave_bg.png',
        speaker: '승려',
        text: '나무아미타불... 이 안에 마물이 숨어있구나. 금강의 힘으로 물리치겠다.',
      },
    ],
    battleIntro: '동굴에서 마물이 나타났다! 첫 번째 전투를 시작합니다.',
  },
  '저승사자': {
    title: '저승의 사자, 이승을 걷다',
    scenes: [
      {
        bg: '/dungeons/demon_bg.png',
        speaker: '???',
        text: '...때가 되었다. 이승으로 건너가라.',
      },
      {
        bg: '/dungeons/demon_bg.png',
        speaker: '나레이션',
        text: '저승과 이승의 경계에서, 한 사자(使者)가 눈을 떴다. 염라대왕의 명을 받들어 이승으로 향하는 임무가 주어졌다.',
      },
      {
        bg: '/dungeons/demon_bg.png',
        speaker: '염라대왕',
        text: '이승의 질서가 흐트러지고 있다. 죽어야 할 자가 죽지 않고, 죽지 말아야 할 자가 죽고 있다.',
      },
      {
        bg: '/dungeons/demon_bg.png',
        speaker: '저승사자',
        text: '명을 받들겠습니다, 대왕님. 이승의 혼란을 바로잡겠습니다.',
      },
      {
        bg: '/dungeons/demon_bg.png',
        speaker: '염라대왕',
        text: '네 낫은 영혼을 거두기 위한 것이지만... 이번에는 살아있는 마물들도 베어야 할 것이다. 조심하거라.',
      },
      {
        bg: '/dungeons/swamp_bg.png',
        speaker: '나레이션',
        text: '저승사자는 이승의 늪지대에 발을 디뎠다. 이곳저곳에서 비정상적으로 떠도는 혼백들이 보였다.',
      },
      {
        bg: '/dungeons/swamp_bg.png',
        speaker: '저승사자',
        text: '...이것은 자연스러운 죽음이 아니다. 누군가가 의도적으로 혼백을 조종하고 있군.',
      },
    ],
    battleIntro: '늪지대의 마물들이 나타났다! 첫 번째 전투를 시작합니다.',
  },
};

function PrologueArea({ character, charState, learnedSkills, passiveBonuses, onPrologueClear, onCharStateUpdate }) {
  const [phase, setPhase] = useState('story'); // 'story' | 'battle_intro' | 'battle' | 'result'
  const [sceneIdx, setSceneIdx] = useState(0);
  const [textVisible, setTextVisible] = useState('');
  const [textDone, setTextDone] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [prologueMonsters, setPrologueMonsters] = useState(null);
  const [prologueStage, setPrologueStage] = useState(null);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [battleError, setBattleError] = useState(null);
  const timerRef = useRef(null);

  const data = PROLOGUE_DATA[character.class_type] || PROLOGUE_DATA['풍수사'];
  const scenes = data.scenes;
  const currentScene = scenes[sceneIdx];

  // Typewriter effect
  useEffect(() => {
    if (phase !== 'story') return;
    setTextVisible('');
    setTextDone(false);
    const text = currentScene.text;
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setTextVisible(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timerRef.current);
        setTextDone(true);
      }
    }, 30);
    return () => clearInterval(timerRef.current);
  }, [sceneIdx, phase]);

  const handleClick = () => {
    if (phase === 'story') {
      if (!textDone) {
        clearInterval(timerRef.current);
        setTextVisible(currentScene.text);
        setTextDone(true);
        return;
      }
      if (sceneIdx < scenes.length - 1) {
        setSceneIdx(sceneIdx + 1);
      } else {
        setPhase('battle_intro');
      }
    }
  };

  const startBattle = async () => {
    setLoadingBattle(true);
    setBattleError(null);
    try {
      const res = await api.get('/characters/prologue-battle');
      setPrologueMonsters(res.data.monsters);
      setPrologueStage(res.data.stage);
      setPhase('battle');
    } catch (err) {
      console.error('Failed to load prologue battle:', err);
      setBattleError('전투 데이터를 불러올 수 없습니다. 서버를 확인해주세요.');
    } finally {
      setLoadingBattle(false);
    }
  };

  const handleBattleEnd = async (result) => {
    setPhase('result');
    setShowReward(true);
    // 프롤로그 전투 세션 잔여 데이터 삭제
    api.post('/battle/session/clear').catch(() => {});
    try {
      const res = await api.post('/characters/prologue-clear');
      if (res.data.rewards) {
        onCharStateUpdate({
          gold: (charState.gold || 0) + res.data.rewards.gold,
          exp: (charState.exp || 0) + res.data.rewards.exp,
        });
      }
    } catch (err) {
      console.error('Prologue clear error:', err);
    }
  };

  const handleFinish = () => {
    setFadeOut(true);
    setTimeout(() => {
      onPrologueClear();
    }, 600);
  };

  // Battle phase - render StageBattle fullscreen
  if (phase === 'battle' && prologueStage && prologueMonsters) {
    return (
      <div className="prologue-battle-wrap">
        <StageBattle
          stage={prologueStage}
          character={character}
          charState={charState}
          learnedSkills={learnedSkills || []}
          passiveBonuses={passiveBonuses || {}}
          activeSummons={[]}
          activeMercenaries={[]}
          monsters={prologueMonsters}
          groupKey="prologue"
          onBattleEnd={handleBattleEnd}
          onLog={() => {}}
        />
      </div>
    );
  }

  return (
    <div className={`prologue-area${fadeOut ? ' fade-out' : ''}`}>
      {/* Story Phase */}
      {phase === 'story' && (
        <div className="prologue-scene" onClick={handleClick}>
          <div className="prologue-bg">
            <img src={currentScene.bg} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="prologue-bg-overlay" />
          </div>
          <div className="prologue-chapter-title">
            <div className="prologue-chapter-label">프롤로그</div>
            <div className="prologue-chapter-name">{data.title}</div>
          </div>
          <div className="prologue-progress">
            {scenes.map((_, i) => (
              <div key={i} className={`prologue-progress-dot${i <= sceneIdx ? ' active' : ''}`} />
            ))}
          </div>
          <div className="prologue-dialog">
            <div className="prologue-dialog-inner">
              <div className={`prologue-speaker${currentScene.speaker === '나레이션' ? ' narration' : ''}`}>
                {currentScene.speaker === '나레이션' ? '' : currentScene.speaker}
              </div>
              <div className="prologue-text">{textVisible}</div>
              {textDone && (
                <div className="prologue-next-hint">
                  {sceneIdx < scenes.length - 1 ? '클릭하여 계속...' : '클릭하여 전투 시작...'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Battle Intro */}
      {phase === 'battle_intro' && (
        <div className="prologue-battle-intro">
          <div className="prologue-bg">
            <img src={scenes[scenes.length - 1].bg} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="prologue-bg-overlay battle" />
          </div>
          <div className="prologue-battle-intro-content">
            <div className="prologue-battle-alert">!</div>
            <div className="prologue-battle-intro-text">{data.battleIntro}</div>
            <button className="prologue-battle-start-btn" onClick={startBattle} disabled={loadingBattle}>
              {loadingBattle ? '준비 중...' : '전투 시작'}
            </button>
            {battleError && <div style={{ color: '#e94560', marginTop: 12, fontSize: 14, textAlign: 'center' }}>{battleError}</div>}
          </div>
        </div>
      )}

      {/* Result Phase */}
      {phase === 'result' && showReward && (
        <div className="prologue-result">
          <div className="prologue-bg">
            <img src={scenes[0].bg} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="prologue-bg-overlay result" />
          </div>
          <div className="prologue-result-content">
            <div className="prologue-result-badge">PROLOGUE CLEAR</div>
            <div className="prologue-result-title">프롤로그 완료!</div>
            <div className="prologue-result-story">
              {character.class_type === '풍수사' && '용맥의 이상을 감지한 풍수사의 여정이 본격적으로 시작됩니다.'}
              {character.class_type === '무당' && '이승과 저승의 균열을 감지한 무당의 여정이 본격적으로 시작됩니다.'}
              {character.class_type === '승려' && '마물의 침입에 맞서는 승려의 수행길이 본격적으로 시작됩니다.'}
              {character.class_type === '저승사자' && '이승의 혼란을 바로잡기 위한 저승사자의 임무가 본격적으로 시작됩니다.'}
            </div>
            <div className="prologue-result-rewards">
              <div className="prologue-reward-title">보상</div>
              <div className="prologue-reward-items">
                <div className="prologue-reward-item">
                  <span className="prologue-reward-icon gold">G</span>
                  <span>골드 +500</span>
                </div>
                <div className="prologue-reward-item">
                  <span className="prologue-reward-icon exp">E</span>
                  <span>경험치 +50</span>
                </div>
              </div>
            </div>
            <div className="prologue-result-unlock">
              <div className="prologue-unlock-title">잠금 해제</div>
              <div className="prologue-unlock-items">
                <span>홈</span><span>마을</span><span>스테이지</span><span>도감</span>
              </div>
            </div>
            <button className="prologue-finish-btn" onClick={handleFinish}>
              모험 시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrologueArea;
