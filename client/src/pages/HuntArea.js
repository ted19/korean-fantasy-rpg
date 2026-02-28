import React, { useState, useEffect } from 'react';
import { Badge, Button } from 'react-bootstrap';
import api from '../api';

function HuntArea({
  currentLocation,
  charState,
  fighting,
  learnedSkills,
  selectedSkill,
  onSelectSkill,
  mySummons,
  activeSummonIds,
  onToggleSummon,
  onHunt,
}) {
  const [monsters, setMonsters] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMonsters() {
      try {
        const res = await api.get(`/dungeon/${currentLocation}`);
        if (!cancelled) setMonsters(res.data.monsters || []);
      } catch {
        if (!cancelled) setMonsters([]);
      }
    }
    loadMonsters();
    return () => { cancelled = true; };
  }, [currentLocation]);

  return (
    <div className="hunt-area">
      <div className="monster-list-title">출현 몬스터</div>
      <div className="monster-list">
        {monsters.map((m, i) => (
          <Badge key={m.id || i} bg="dark" className="monster-tag border border-secondary p-2">
            {m.icon} {m.name} (HP:{m.hp} ATK:{m.attack})
          </Badge>
        ))}
      </div>

      {mySummons.length > 0 && (
        <div className="summon-select">
          <div className="summon-select-title">
            소환수 동행 ({activeSummonIds.length}/{mySummons.length})
          </div>
          <div className="summon-select-list">
            {mySummons.map((s) => (
              <button
                key={s.id}
                className={`summon-select-btn ${activeSummonIds.includes(s.id) ? 'active' : ''}`}
                onClick={() => onToggleSummon(s.id)}
              >
                <span className="summon-select-icon">{s.icon}</span>
                <span className="summon-select-name">{s.name}</span>
                <span className="summon-select-lv">Lv.{s.level}</span>
                {activeSummonIds.includes(s.id) && <span className="summon-select-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {learnedSkills.length > 0 && (
        <div className="skill-select">
          <div className="skill-select-title">전투 스킬</div>
          <div className="skill-select-btns">
            <Button
              variant={selectedSkill === null ? 'primary' : 'outline-secondary'}
              size="sm"
              onClick={() => onSelectSkill(null)}
            >
              기본 공격
            </Button>
            {learnedSkills.map((s) => (
              <Button
                key={s.id}
                variant={selectedSkill === s.id ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => onSelectSkill(s.id)}
                disabled={charState.currentMp < s.mp_cost}
                title={`${s.description} (MP: ${s.mp_cost})`}
                className={charState.currentMp < s.mp_cost ? 'opacity-25' : ''}
              >
                <span>{s.name}</span>
                <span className="skill-btn-mp ms-1">{s.mp_cost}MP</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="danger"
        size="lg"
        className="btn-hunt mt-3"
        onClick={onHunt}
        disabled={fighting || charState.currentHp <= 0}
      >
        {charState.currentHp <= 0 ? 'HP 부족' : fighting ? '전투 중...' : selectedSkill ? '스킬 사냥' : '사냥하기'}
      </Button>
    </div>
  );
}

export default HuntArea;
