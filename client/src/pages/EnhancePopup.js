import React, { useState, useEffect, useRef } from 'react';
import './EnhancePopup.css';

const GRADE_COLORS = {
  '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa',
  '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b', '초월': '#ff44cc',
};

function ImgFb({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback || '?'}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

export default function EnhancePopup({ unitType, unit, enhanceInfo, onEnhance, onClose }) {
  const [phase, setPhase] = useState('confirm');
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef(null);

  const isMerc = unitType === 'mercenary';
  const gc = GRADE_COLORS[unit.grade] || '#9ca3af';
  const starLevel = unit.star_level || 0;
  const nextStar = enhanceInfo?.nextStar || starLevel + 1;
  const rate = enhanceInfo?.successRate ? Math.round(enhanceInfo.successRate * 100) : 50;
  const imgPath = isMerc ? `/mercenaries_nobg/${unit.template_id}_full.png` : `/summons_nobg/${unit.template_id}_full.png`;

  // 연출 중 카운트다운
  useEffect(() => {
    if (phase !== 'enhancing') return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = t;
    return () => clearInterval(t);
  }, [phase]);

  const handleEnhance = async () => {
    setPhase('enhancing');
    try {
      const res = await onEnhance();
      setTimeout(() => {
        setResult(res);
        setPhase(res.success ? 'success' : 'fail');
      }, 3500);
    } catch (err) {
      setTimeout(() => {
        setResult({ success: false, message: err?.response?.data?.message || '강화 실패' });
        setPhase('fail');
      }, 2000);
    }
  };

  const renderStars = (count, max = 6) => {
    return Array.from({ length: max }, (_, i) => (
      <span key={i} className={`enh-star ${i < count ? 'filled' : 'empty'}`}
        style={i < count ? { color: gc, textShadow: `0 0 8px ${gc}` } : {}}>
        {i < count ? '★' : '☆'}
      </span>
    ));
  };

  return (
    <div className="enh-overlay">
      <div className="enh-popup" onClick={e => e.stopPropagation()}>

        {/* ═══════ 확인 단계 ═══════ */}
        {phase === 'confirm' && (
          <div className="enh-phase enh-confirm">
            <button className="enh-close" onClick={onClose}>&times;</button>
            <div className="enh-bg">
              <img src={`/ui/gacha/enhance_${isMerc ? 'merc' : 'summon'}_confirm_bg.png`} alt="" className="enh-bg-img" />
              <div className="enh-bg-gradient" />
            </div>

            <div className="enh-content">
              {/* 유닛 초상화 */}
              <div className="enh-portrait-wrap" style={{ '--gc': gc }}>
                <div className="enh-portrait-ring" />
                <div className="enh-portrait-ring r2" />
                <div className="enh-portrait">
                  <ImgFb src={imgPath} fallback={isMerc ? '⚔️' : '🔮'} className="enh-portrait-img" />
                </div>
                <div className="enh-portrait-particles">
                  {[...Array(8)].map((_, i) => <div key={i} className="enh-p-particle" style={{ '--pi': i, '--gc': gc }} />)}
                </div>
              </div>

              {/* 유닛 정보 */}
              <div className="enh-unit-name" style={{ color: gc }}>{unit.name}</div>
              <span className="enh-grade-badge" style={{ background: gc }}>{unit.grade}</span>

              {/* 성급 변화 */}
              <div className="enh-star-change">
                <div className="enh-star-row current">
                  <span className="enh-star-label">현재</span>
                  <div className="enh-stars">{renderStars(starLevel)}</div>
                </div>
                <div className="enh-arrow" style={{ color: gc }}>⟱</div>
                <div className="enh-star-row next">
                  <span className="enh-star-label" style={{ color: gc }}>목표</span>
                  <div className="enh-stars">{renderStars(nextStar)}</div>
                </div>
              </div>

              {/* 성공 확률 */}
              <div className="enh-rate-section">
                <div className="enh-rate-header">
                  <span>성공 확률</span>
                  <span className="enh-rate-value" style={{ color: rate >= 70 ? '#4ade80' : rate >= 40 ? '#fbbf24' : '#ef4444' }}>{rate}%</span>
                </div>
                <div className="enh-rate-bar">
                  <div className="enh-rate-fill" style={{ width: `${rate}%`, background: rate >= 70 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : rate >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #ef4444)' }}>
                    <div className="enh-rate-shine" />
                  </div>
                </div>
              </div>

              {/* 소모 아이템 */}
              <div className="enh-cost">
                <span className="enh-cost-icon">⭐</span>
                <span className="enh-cost-name">{enhanceInfo?.ticketName}</span>
                <span className="enh-cost-qty" style={{ color: (enhanceInfo?.ticketOwned || 0) > 0 ? '#4ade80' : '#ef4444' }}>
                  {enhanceInfo?.ticketOwned || 0}개 보유
                </span>
              </div>

              {/* 강화 버튼 */}
              <button className="enh-btn" style={{ '--gc': gc }} onClick={handleEnhance}>
                <span className="enh-btn-icon">⭐</span>
                <span>강화하기</span>
                <div className="enh-btn-shine" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════ 강화 연출 ═══════ */}
        {phase === 'enhancing' && (
          <div className="enh-phase enh-process">
            <div className="enh-bg">
              <img src={`/ui/gacha/enhance_${isMerc ? 'merc' : 'summon'}_process_bg.png`} alt="" className="enh-bg-img enh-bg-process" />
              <div className="enh-bg-gradient process" />
            </div>

            <div className="enh-content enh-center">
              {/* 유닛 초상화 (흔들림) */}
              <div className="enh-process-portrait" style={{ '--gc': gc }}>
                <ImgFb src={imgPath} fallback={isMerc ? '⚔️' : '🔮'} className="enh-portrait-img" />
              </div>

              {/* 에너지 수렴 이펙트 */}
              <div className="enh-energy-wrap">
                {[...Array(20)].map((_, i) => <div key={i} className="enh-energy-orb" style={{ '--ei': i, '--gc': gc }} />)}
              </div>

              {/* 회전 마법진 */}
              <div className="enh-magic-circles">
                <div className="enh-mc c1" style={{ borderColor: gc }} />
                <div className="enh-mc c2" style={{ borderColor: gc }} />
                <div className="enh-mc c3" style={{ borderColor: gc }} />
              </div>

              {/* 충격파 */}
              <div className="enh-shockwaves">
                <div className="enh-shock s1" style={{ borderColor: gc }} />
                <div className="enh-shock s2" style={{ borderColor: gc }} />
                <div className="enh-shock s3" style={{ borderColor: gc }} />
              </div>

              {/* 스파크 방사 */}
              <div className="enh-spark-burst">
                {[...Array(16)].map((_, i) => <div key={i} className="enh-spark-line" style={{ '--si': i, '--gc': gc }} />)}
              </div>

              {/* 최종 플래시 */}
              <div className="enh-final-flash" style={{ '--gc': gc }} />

              {/* 카운트다운 */}
              <div className="enh-countdown">{countdown > 0 ? countdown : '!'}</div>
              <div className="enh-process-text">강화 중...</div>
            </div>
          </div>
        )}

        {/* ═══════ 성공 ═══════ */}
        {phase === 'success' && result && (
          <div className="enh-phase enh-result enh-success">
            <button className="enh-close" onClick={onClose}>&times;</button>
            <div className="enh-bg">
              <img src={`/ui/gacha/enhance_${isMerc ? 'merc' : 'summon'}_success_bg.png`} alt="" className="enh-bg-img enh-bg-result-success" />
              <div className="enh-bg-gradient success" />
            </div>

            <div className="enh-content enh-center">
              {/* 축하 파티클 */}
              <div className="enh-confetti">
                {[...Array(30)].map((_, i) => <div key={i} className="enh-confetti-piece" style={{ '--ci': i }} />)}
              </div>

              <div className="enh-result-icon success">🌟</div>
              <h2 className="enh-result-title success">강화 성공!</h2>

              <div className="enh-result-portrait" style={{ borderColor: gc, boxShadow: `0 0 30px ${gc}60` }}>
                <ImgFb src={imgPath} fallback={isMerc ? '⚔️' : '🔮'} className="enh-portrait-img" />
              </div>

              <div className="enh-result-name" style={{ color: gc }}>{unit.name}</div>
              <div className="enh-result-stars">{renderStars(result.starLevel)}</div>
              <div className="enh-result-star-text" style={{ color: gc }}>{result.starLevel}성 달성!</div>

              <div className="enh-result-bonus">
                <span className="enh-result-bonus-icon">📈</span>
                모든 스탯이 상승했습니다!
              </div>

              <button className="enh-result-btn success" onClick={onClose}>확인</button>
            </div>
          </div>
        )}

        {/* ═══════ 실패 ═══════ */}
        {phase === 'fail' && (
          <div className="enh-phase enh-result enh-fail">
            <button className="enh-close" onClick={onClose}>&times;</button>
            <div className="enh-bg">
              <img src={`/ui/gacha/enhance_${isMerc ? 'merc' : 'summon'}_fail_bg.png`} alt="" className="enh-bg-img enh-bg-result-fail" />
              <div className="enh-bg-gradient fail" />
            </div>

            <div className="enh-content enh-center">
              {/* 파편 이펙트 */}
              <div className="enh-shatter">
                {[...Array(12)].map((_, i) => <div key={i} className="enh-shard" style={{ '--shi': i }} />)}
              </div>

              <div className="enh-result-icon fail">💔</div>
              <h2 className="enh-result-title fail">강화 실패</h2>

              <div className="enh-result-portrait" style={{ borderColor: '#555', filter: 'grayscale(0.5) brightness(0.7)' }}>
                <ImgFb src={imgPath} fallback={isMerc ? '⚔️' : '🔮'} className="enh-portrait-img" />
              </div>

              <div className="enh-result-name" style={{ color: '#888' }}>{unit.name}</div>
              <div className="enh-result-stars">{renderStars(starLevel)}</div>
              <div className="enh-result-star-text" style={{ color: '#888' }}>{starLevel}성 (변동 없음)</div>

              <div className="enh-result-bonus fail-msg">
                <span className="enh-result-bonus-icon">💫</span>
                강화권이 소모되었습니다. 다시 도전하세요!
              </div>

              <button className="enh-result-btn fail" onClick={onClose}>확인</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
