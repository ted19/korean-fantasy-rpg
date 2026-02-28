import React, { useState, useEffect } from 'react';
import { Badge, Button } from 'react-bootstrap';
import api from '../api';

const TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '⬆️' };

function SkillImg({ skillId, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !skillId) return <span className={className}>{fallback}</span>;
  return <img src={`/skills/${skillId}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
}

function SkillPanel({ charState, onLog, onSkillsUpdate }) {
  const [skills, setSkills] = useState([]);

  const loadSkills = async () => {
    try {
      const res = await api.get('/skill/list');
      setSkills(res.data.skills);
      if (onSkillsUpdate) onSkillsUpdate(res.data.skills.filter(s => s.learned));
    } catch {}
  };

  useEffect(() => { loadSkills(); }, [charState.level]);

  const handleLearn = async (skillId) => {
    try {
      const res = await api.post('/skill/learn', { skillId });
      onLog(res.data.message, 'level');
      loadSkills();
    } catch (err) {
      onLog(err.response?.data?.message || '습득 실패', 'damage');
    }
  };

  return (
    <div className="skill-list" style={{ flex: 1, overflowY: 'auto' }}>
      {skills.map((s) => {
        const canLearn = !s.learned && charState.level >= s.required_level;
        return (
          <div key={s.id} className={`skill-item ${s.learned ? 'learned' : ''} ${!s.learned && charState.level < s.required_level ? 'locked' : ''}`}>
            <div className="skill-header-row">
              <SkillImg skillId={s.id} fallback={TYPE_ICONS[s.type]} className="skill-icon-img" />
              <span className="skill-name-text">{s.name}</span>
              <Badge bg="dark" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', fontSize: 10 }}>{s.mp_cost} MP</Badge>
            </div>
            <div className="skill-desc-text">{s.description}</div>
            <div className="skill-meta">
              {s.type === 'attack' && <span className="skill-tag atk">x{s.damage_multiplier}</span>}
              {s.heal_amount > 0 && <span className="skill-tag heal">HP+{s.heal_amount}</span>}
              {s.buff_stat && <span className="skill-tag buff">{{attack:'ATK', defense:'DEF', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명', evasion:'회피'}[s.buff_stat] || s.buff_stat}+{s.buff_value} ({s.buff_duration}턴)</span>}
              {s.cooldown > 0 && <span className="skill-tag cd">CD:{s.cooldown}</span>}
              <span className="skill-tag lvl">Lv.{s.required_level}</span>
            </div>
            {!s.learned && (
              <Button
                size="sm"
                variant="primary"
                className="w-100 mt-1"
                disabled={!canLearn}
                onClick={() => handleLearn(s.id)}
              >
                {canLearn ? '습득' : `Lv.${s.required_level} 필요`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SkillPanel;
