import React, { useEffect, useRef } from 'react';

function BattleLog({ logs }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="game-log">
      <div className="log-header">전투 기록</div>
      <div className="log-content">
        {logs.map((log, i) => (
          <div key={i} className={`log-line log-${log.type}`}>
            {log.time && <span className="log-time">[{log.time}]</span>} {log.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default BattleLog;
