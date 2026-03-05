import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/ui/login_bg.png';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${bgLoaded ? 'loaded' : ''}`}>
      {/* 배경 이미지 레이어 */}
      <div className="auth-bg" style={{ backgroundImage: 'url(/ui/login_bg.png)' }} />
      <div className="auth-bg-overlay" />

      {/* 떠다니는 파티클 효과 */}
      <div className="auth-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="auth-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              opacity: 0.3 + Math.random() * 0.5,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
            }}
          />
        ))}
      </div>

      {/* 메인 콘텐츠 - 중앙 배치 */}
      <div className="auth-center-layout">
        <div className="auth-center-card">
          <div className="auth-center-header">
            <h1 className="auth-hero-title">금오신화</h1>
            <p className="auth-hero-subtitle">한국 판타지 RPG</p>
          </div>

          <div className="auth-form-inner">
            <h2 className="auth-form-title">로그인</h2>
            <p className="auth-form-desc">모험을 계속하세요</p>

              {error && (
                <div className="auth-error">
                  <span className="auth-error-icon">!</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">사용자명</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="사용자명을 입력하세요"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label">비밀번호</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="비밀번호를 입력하세요"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? (
                    <span className="auth-submit-loading">
                      <span className="auth-spinner" />
                      접속 중...
                    </span>
                  ) : (
                    <>
                      <span>접속하기</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="auth-divider">
                <span>또는</span>
              </div>

            <p className="auth-switch">
              아직 계정이 없으신가요?{' '}
              <Link to="/register" className="auth-switch-link">새로운 모험 시작</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
