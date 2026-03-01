import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './FormationArea.css';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_icon.png',
  '무당': '/characters/mudang_icon.png',
  '승려': '/characters/monk_icon.png',
};

const SLOT_NAMES = ['메인 진영', '진영 2', '진영 3', '진영 4'];

function UnitIcon({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <span className={className || 'formation-unit-icon-text'}>{fallback || '?'}</span>;
  return <img src={src} alt="" className={className || 'formation-unit-icon'} onError={() => setErr(true)} />;
}

function FormationArea({ character, charState, mySummons, myMercenaries }) {
  const [formations, setFormations] = useState([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [gridData, setGridData] = useState(Array(3).fill(null).map(() => Array(3).fill(null)));
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('');

  const loadFormations = useCallback(async () => {
    try {
      const res = await api.get('/formation/list');
      setFormations(res.data.formations);
      const current = res.data.formations.find(f => f.slotIndex === activeSlot);
      if (current && current.gridData) {
        setGridData(current.gridData);
      }
    } catch {}
  }, [activeSlot]);

  useEffect(() => { loadFormations(); }, [loadFormations]);

  useEffect(() => {
    const current = formations.find(f => f.slotIndex === activeSlot);
    if (current && current.gridData) {
      setGridData(JSON.parse(JSON.stringify(current.gridData)));
    } else {
      setGridData(Array(3).fill(null).map(() => Array(3).fill(null)));
    }
    setSelectedUnit(null);
    setMessage('');
  }, [activeSlot, formations]);

  // 배치 가능한 유닛 목록 (캐릭터 + 소환수 + 용병)
  const allUnits = [
    {
      id: 'player',
      type: 'player',
      name: character.name,
      subText: `${character.class_type} · Lv.${charState.level}`,
      icon: CLASS_IMAGES[character.class_type],
      fallbackIcon: '⚔️',
      rangeType: 'melee',
    },
    ...(mySummons || []).map(s => ({
      id: `summon_${s.id}`,
      type: 'summon',
      summonId: s.id,
      name: s.name,
      subText: `${s.type} · Lv.${s.level}`,
      icon: s.icon_url_img || `/summons/${s.template_id}_icon.png`,
      fallbackIcon: s.icon || '🐉',
      rangeType: s.range_type || 'melee',
    })),
    ...(myMercenaries || []).map(m => ({
      id: `merc_${m.id}`,
      type: 'mercenary',
      mercId: m.id,
      name: m.name,
      subText: `${m.class_type} · Lv.${m.level}`,
      icon: `/mercenaries/${m.template_id}_icon.png`,
      fallbackIcon: '🗡️',
      rangeType: m.range_type || 'melee',
    })),
  ];

  // 현재 그리드에 배치된 유닛 ID 목록
  const placedUnitIds = new Set();
  gridData.forEach(row => row.forEach(cell => {
    if (cell && cell.unitId) placedUnitIds.add(cell.unitId);
  }));

  const handleUnitClick = (unit) => {
    if (placedUnitIds.has(unit.id)) return;
    setSelectedUnit(prev => prev?.id === unit.id ? null : unit);
  };

  const handleCellClick = (row, col) => {
    const cell = gridData[row][col];

    // 셀에 유닛이 있으면 제거
    if (cell && cell.unitId) {
      const newGrid = gridData.map(r => [...r]);
      newGrid[row][col] = null;
      setGridData(newGrid);
      setMessage('');
      return;
    }

    // 선택된 유닛이 있으면 배치
    if (selectedUnit) {
      const newGrid = gridData.map(r => [...r]);
      newGrid[row][col] = {
        unitId: selectedUnit.id,
        type: selectedUnit.type,
        summonId: selectedUnit.summonId || null,
        mercId: selectedUnit.mercId || null,
        name: selectedUnit.name,
        icon: selectedUnit.icon,
        fallbackIcon: selectedUnit.fallbackIcon,
      };
      setGridData(newGrid);
      setSelectedUnit(null);
      setMessage('');
    }
  };

  const handleRemoveUnit = (e, row, col) => {
    e.stopPropagation();
    const newGrid = gridData.map(r => [...r]);
    newGrid[row][col] = null;
    setGridData(newGrid);
  };

  const handleReset = () => {
    setGridData(Array(3).fill(null).map(() => Array(3).fill(null)));
    setSelectedUnit(null);
    setMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.post('/formation/save', {
        slotIndex: activeSlot,
        name: SLOT_NAMES[activeSlot],
        gridData,
      });
      setMessage('진영이 저장되었습니다.');
      setMsgType('');
      // 리로드
      const res = await api.get('/formation/list');
      setFormations(res.data.formations);
    } catch (err) {
      setMessage(err.response?.data?.message || '저장 실패');
      setMsgType('error');
    }
    setSaving(false);
  };

  return (
    <div className="formation-area">
      {/* 왼쪽: 유닛 카드 목록 */}
      <div className="formation-units">
        <div className="formation-units-header">배치 유닛</div>
        <div className="formation-unit-list">
          {allUnits.map(unit => (
            <div
              key={unit.id}
              className={`formation-unit-card${selectedUnit?.id === unit.id ? ' selected' : ''}${placedUnitIds.has(unit.id) ? ' placed' : ''}${unit.type === 'player' ? ' is-player' : ''}`}
              onClick={() => handleUnitClick(unit)}
            >
              <UnitIcon src={unit.icon} fallback={unit.fallbackIcon} className="formation-unit-icon" />
              <div className="formation-unit-info">
                <div className="formation-unit-name">{unit.name}</div>
                <div className="formation-unit-sub">{unit.subText}</div>
              </div>
              <span className={`formation-unit-range ${unit.rangeType}`}>
                {unit.rangeType === 'melee' ? '근거리' : unit.rangeType === 'magic' ? '마법' : '원거리'}
              </span>
            </div>
          ))}
          {allUnits.length === 1 && (
            <div style={{ color: 'var(--text-dark)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              소환수나 용병이 없습니다. 마을에서 고용하세요.
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 진영 설정 */}
      <div className="formation-right">
        {/* 슬롯 탭 */}
        <div className="formation-slots">
          {SLOT_NAMES.map((name, i) => (
            <div
              key={i}
              className={`formation-slot-tab${activeSlot === i ? ' active' : ''}`}
              onClick={() => setActiveSlot(i)}
            >
              {name}
            </div>
          ))}
        </div>

        {/* 3x3 그리드 */}
        <div className="formation-grid-wrapper">
          <div style={{ position:'absolute', inset:0, background:'url(/ui/formation_grid_bg.png) center/cover no-repeat', opacity:0.1, pointerEvents:'none' }} />
          <div className="formation-grid-label" style={{ position:'relative' }}>
            {selectedUnit ? `"${selectedUnit.name}" 배치할 칸을 선택하세요` : '유닛을 선택 후 칸에 배치'}
          </div>
          <div className="formation-grid">
            {gridData.map((row, ri) =>
              row.map((cell, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className={`formation-cell${cell ? ' has-unit' : ''}${cell && cell.type === 'player' ? ' is-player-cell' : ''}${selectedUnit && !cell ? ' drop-target' : ''}`}
                  onClick={() => handleCellClick(ri, ci)}
                >
                  {cell ? (
                    <>
                      <UnitIcon src={cell.icon} fallback={cell.fallbackIcon} className="formation-cell-icon" />
                      <div className="formation-cell-name">{cell.name}</div>
                      <button
                        className="formation-cell-remove"
                        onClick={(e) => handleRemoveUnit(e, ri, ci)}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="formation-cell-empty">+</span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="formation-grid-row-label">
            <span>후열</span>
            <span>중열</span>
            <span>전열</span>
          </div>
        </div>

        {/* 저장/초기화 */}
        <div className="formation-actions">
          <button className="formation-reset-btn" onClick={handleReset}>초기화</button>
          <button className="formation-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '진영 저장'}
          </button>
        </div>
        <div className={`formation-msg${msgType === 'error' ? ' error' : ''}`}>{message}</div>
      </div>
    </div>
  );
}

export default FormationArea;
