import React, { useState, useEffect, useRef } from 'react';
import './GachaPopup.css';

const GRADE_COLORS = {
  '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa',
  '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b', '초월': '#ff44cc',
};
const GRADE_STARS = { '일반':'★', '고급':'★★', '희귀':'★★★', '영웅':'★★★★', '전설':'★★★★★', '신화':'★★★★★★', '초월':'★★★★★★★' };
const GRADE_EFFECTS = {
  '일반': 'gacha-eff-normal', '고급': 'gacha-eff-advanced', '희귀': 'gacha-eff-rare',
  '영웅': 'gacha-eff-hero', '전설': 'gacha-eff-legend', '신화': 'gacha-eff-myth', '초월': 'gacha-eff-transcend',
};

function ImgFallback({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback || '?'}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

export default function GachaPopup({ unitType, ticketType, ticketName, onPull, onClose, onComplete }) {
  const [phase, setPhase] = useState('confirm');
  const [result, setResult] = useState(null);
  const [typing, setTyping] = useState('');
  const typingRef = useRef(null);

  const isMerc = unitType === 'mercenary';
  const isPremium = ticketType?.includes('premium');
  const accentColor = isPremium ? '#ffd700' : (isMerc ? '#fbbf24' : '#c084fc');
  const themeClass = `${isMerc ? 'gacha-merc' : 'gacha-summon'}${isPremium ? ' gacha-premium' : ''}`;

  useEffect(() => {
    if (phase !== 'reveal' || !result) return;
    const introMsg = result.template?.intro_message || result.introMessage || '';
    if (!introMsg) { setTyping(introMsg); return; }
    let i = 0;
    setTyping('');
    const timer = setInterval(() => {
      i++;
      setTyping(introMsg.slice(0, i));
      if (i >= introMsg.length) clearInterval(timer);
    }, 30);
    typingRef.current = timer;
    return () => clearInterval(timer);
  }, [phase, result]);

  const [errorMsg, setErrorMsg] = useState(null);

  const handlePull = async () => {
    setPhase('pulling');
    setErrorMsg(null);
    try {
      const res = await onPull(ticketType);
      const delay = isPremium ? (isMerc ? 7000 : 8000) : (isMerc ? 4000 : 4500);
      setTimeout(() => {
        setResult(res);
        setPhase('reveal');
        if (onComplete) onComplete();
      }, delay);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || '소환에 실패했습니다.';
      setErrorMsg(msg);
      setPhase('confirm');
    }
  };

  const gradeColor = result ? (GRADE_COLORS[result.grade] || '#9ca3af') : accentColor;

  return (
    <div className="gacha-overlay" onClick={phase === 'reveal' ? onClose : undefined}>
      <div className={`gacha-popup ${themeClass}`} onClick={e => e.stopPropagation()}>

        {/* ═══════ 확인 단계 ═══════ */}
        {phase === 'confirm' && (
          <div className={`gacha-confirm ${themeClass}`}>
            <button className="gacha-close" onClick={onClose}>&times;</button>

            {/* 풀스크린 배경 이미지 */}
            <div className="gacha-confirm-bg">
              <img src={isMerc ? (isPremium ? '/ui/gacha/merc_premium_confirm_bg.png' : '/ui/gacha/merc_confirm_bg.png') : (isPremium ? '/ui/gacha/summon_premium_confirm_bg.png' : '/ui/gacha/summon_confirm_bg.png')} alt="" className="gacha-confirm-bg-img" />
              <div className="gacha-confirm-bg-overlay" />
            </div>

            {/* 중앙 아이콘 + 파티클 */}
            <div className="gacha-confirm-center">
              <div className={`gacha-confirm-orb ${isMerc ? 'merc' : 'summon'}`}>
                <span className="gacha-confirm-orb-icon">{isMerc ? '⚔️' : '🔮'}</span>
              </div>
              <div className="gacha-confirm-particles">
                {[...Array(16)].map((_, i) => <div key={i} className="gacha-particle" style={{ '--pi': i, '--color': accentColor }} />)}
              </div>
            </div>

            <h2 className="gacha-confirm-title">
              {isPremium
                ? (isMerc ? '천상의 전장' : '차원의 균열')
                : (isMerc ? '전장의 봉화' : '소환의 마법진')}
            </h2>
            <div className="gacha-confirm-subtitle">
              {isPremium
                ? (isMerc ? '신화의 영웅이 응답합니다...' : '차원을 넘어 신수가 강림합니다...')
                : (isMerc ? '봉화를 밝혀 전장의 영웅을 불러옵니다' : '마법진에 힘을 불어넣어 이세계의 존재를 소환합니다')}
            </div>
            <div className="gacha-confirm-ticket">
              <span className="gacha-confirm-ticket-icon">{isMerc ? '🗡️' : '✨'}</span>
              <span>{ticketName} 1장 사용</span>
            </div>
            <p className="gacha-confirm-desc">
              {isPremium
                ? (isMerc ? '전설을 넘어선 존재가 기다리고 있습니다...' : '신화 속 존재를 만날 수 있을지도...')
                : (isMerc ? '어떤 전사가 부름에 응할지...' : '어떤 존재가 응답할지...')}
            </p>
            {errorMsg && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10, padding: '6px 12px', background: '#ef444415', borderRadius: 8 }}>{errorMsg}</div>}
            <button className="gacha-confirm-btn" style={{ background: accentColor }} onClick={handlePull}>
              {isMerc ? '🔥 봉화 점화' : '✨ 소환 시작'}
            </button>
          </div>
        )}

        {/* ═══════ 연출 단계 ═══════ */}
        {phase === 'pulling' && (
          <div className={`gacha-pulling ${themeClass}`}>
            <div className="gacha-pulling-bg">
              <img src={isMerc ? (isPremium ? '/ui/gacha/merc_premium_pulling_bg.png' : '/ui/gacha/merc_pulling_bg.png') : (isPremium ? '/ui/gacha/summon_premium_pulling_bg.png' : '/ui/gacha/summon_pulling_bg.png')} alt="" className="gacha-pulling-bg-img" />
              <div className="gacha-pulling-bg-overlay" />
            </div>
            {isMerc ? (
              /* 용병: 3단계 불꽃 소환 */
              <div className="merc-pull-scene">
                <div className="merc-pull-sword">⚔️</div>
                <div className="merc-pull-fire-ring">
                  {[...Array(24)].map((_, i) => <div key={i} className="merc-fire-particle" style={{ '--fpi': i }} />)}
                </div>
                <div className="merc-pull-fire-ring ring2">
                  {[...Array(16)].map((_, i) => <div key={i} className="merc-fire-particle outer" style={{ '--fpi': i }} />)}
                </div>
                <div className="merc-pull-shockwave" />
                <div className="merc-pull-shockwave delay" />
                <div className="merc-pull-shockwave delay2" />
                <div className="merc-pull-trails">
                  {[...Array(8)].map((_, i) => <div key={i} className="merc-trail" style={{ '--ti': i }} />)}
                </div>
                <div className="merc-pull-flash" />
              </div>
            ) : (
              /* 소환수: 3단계 마법진 소환 */
              <div className="summon-pull-scene">
                <div className="summon-pull-circles">
                  <div className="summon-pull-circle c1" />
                  <div className="summon-pull-circle c2" />
                  <div className="summon-pull-circle c3" />
                  <div className="summon-pull-circle c4" />
                </div>
                <div className="summon-pull-pillar" />
                <div className="summon-pull-pillar pillar2" />
                <div className="summon-pull-orbs">
                  {[...Array(16)].map((_, i) => <div key={i} className="summon-pull-orb" style={{ '--oi': i }} />)}
                </div>
                <div className="summon-pull-runes">
                  {['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ'].map((r, i) => (
                    <span key={i} className="summon-pull-rune" style={{ '--pri': i }}>{r}</span>
                  ))}
                </div>
                <div className="summon-pull-flash" />
              </div>
            )}
            <div className="gacha-pulling-text">
              {isPremium
                ? (isMerc ? '신화의 영웅이 응답하고 있습니다...' : '차원의 균열이 열리고 있습니다...')
                : (isMerc ? '영웅을 부르는 중...' : '차원의 문을 여는 중...')}
            </div>
          </div>
        )}

        {/* ═══════ 결과 공개 ═══════ */}
        {phase === 'reveal' && result && (
          <div className={`gacha-reveal ${themeClass} ${GRADE_EFFECTS[result.grade] || ''}`}>
            <button className="gacha-close" onClick={onClose}>&times;</button>

            {/* 등급 폭발 이펙트 (용병: 불꽃형, 소환수: 마법형) */}
            <div className={`gacha-reveal-burst ${themeClass}`} style={{ '--grade-color': gradeColor }}>
              {isMerc
                ? [...Array(16)].map((_, i) => <div key={i} className="merc-burst-ember" style={{ '--ei': i, '--grade-color': gradeColor }} />)
                : [...Array(16)].map((_, i) => <div key={i} className="summon-burst-star" style={{ '--si': i, '--grade-color': gradeColor }} />)
              }
            </div>

            {/* 유닛 이미지 */}
            <div className={`gacha-reveal-portrait ${themeClass}`} style={{ borderColor: gradeColor, boxShadow: `0 0 40px ${gradeColor}60` }}>
              {isMerc && <div className="merc-reveal-banner" style={{ background: `linear-gradient(180deg, ${gradeColor}30, transparent)` }} />}
              {!isMerc && <div className="summon-reveal-glow" style={{ background: `radial-gradient(circle, ${gradeColor}40, transparent 70%)` }} />}
              <ImgFallback
                src={isMerc ? `/mercenaries_nobg/${result.templateId}_full.png` : `/summons_nobg/${result.templateId}_full.png`}
                fallback={result.icon || (isMerc ? '⚔️' : '🔮')}
                className="gacha-reveal-img"
              />
            </div>

            {/* 등급 */}
            <div className="gacha-reveal-grade" style={{ background: gradeColor }}>{result.grade}</div>
            <div className="gacha-reveal-stars" style={{ color: gradeColor }}>{GRADE_STARS[result.grade]}</div>

            {/* 이름 */}
            <h2 className="gacha-reveal-name" style={{ color: gradeColor }}>{result.name}</h2>

            {/* 태그 */}
            <div className="gacha-reveal-tags">
              {result.classType && <span className="gacha-reveal-tag">{result.classType}</span>}
              {result.type && <span className="gacha-reveal-tag">{result.type}</span>}
            </div>

            {/* 중복 안내 */}
            {result.resultType === 'duplicate' && (
              <div className="gacha-dupe-notice">
                <div className="gacha-dupe-icon">🔄</div>
                <div className="gacha-dupe-text">이미 보유한 {isMerc ? '용병' : '소환수'}입니다!</div>
                <div className="gacha-dupe-reward">
                  <span className="gacha-dupe-reward-icon">⭐</span>
                  <span>대신 <b style={{ color: gradeColor }}>{result.compensationItem?.name || `${result.compensationGold}G`}</b>을(를) 획득했습니다!</span>
                </div>
              </div>
            )}

            {/* 소개 멘트 (신규일 때만) */}
            {result.resultType !== 'duplicate' && (
              <div className="gacha-reveal-speech">
                <div className={`gacha-reveal-speech-bubble ${themeClass}`}>
                  <span className="gacha-reveal-speech-text">{typing}<span className="gacha-typing-cursor">|</span></span>
                </div>
              </div>
            )}

            <button className="gacha-reveal-close-btn" style={{ borderColor: gradeColor, color: gradeColor }} onClick={onClose}>
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
