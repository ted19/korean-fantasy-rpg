import React, { useState, useEffect, useRef } from 'react';

function BattleLog({ logs }) {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const logEndRef = useRef(null);
  const prevLenRef = useRef(logs.length);

  useEffect(() => {
    if (logs.length > prevLenRef.current) {
      if (!open) setHasNew(true);
    }
    prevLenRef.current = logs.length;
  }, [logs, open]);

  useEffect(() => {
    if (open) {
      setHasNew(false);
      setTimeout(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [open, logs]);

  return (
    <>
      {/* 플로팅 토글 버튼 */}
      <button
        className={`battlelog-float-btn ${hasNew ? 'has-new' : ''} ${open ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="전투 기록"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        {hasNew && <span className="battlelog-float-badge" />}
      </button>

      {/* 플로팅 패널 */}
      <div className={`battlelog-float-panel ${open ? 'open' : ''}`}>
        <div className="battlelog-float-header">
          <div className="battlelog-float-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>전투 기록</span>
            <span className="battlelog-float-count">{logs.length}</span>
          </div>
          <button className="battlelog-float-close" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="battlelog-float-content">
          {logs.map((log, i) => (
            <div key={i} className={`battlelog-float-line log-${log.type}`}>
              {log.time && <span className="battlelog-float-time">[{log.time}]</span>}
              <span className="battlelog-float-text">{log.text}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 배경 오버레이 (모바일) */}
      {open && <div className="battlelog-float-overlay" onClick={() => setOpen(false)} />}
    </>
  );
}

export default BattleLog;
