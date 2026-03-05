import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/ui/register_bg.png';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { username, email, password });
      setSuccess('회원가입이 완료되었습니다! 잠시 후 로그인 화면으로 이동합니다.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${bgLoaded ? 'loaded' : ''}`}>
      {/* 배경 이미지 레이어 */}
      <div className="auth-bg" style={{ backgroundImage: 'url(/ui/register_bg.png)' }} />
      <div className="auth-bg-overlay" />

      {/* 파티클 */}
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
            <h2 className="auth-form-title">모험가 등록</h2>
            <p className="auth-form-desc">새로운 모험을 시작하세요</p>

              {error && (
                <div className="auth-error">
                  <span className="auth-error-icon">!</span>
                  {error}
                </div>
              )}
              {success && (
                <div className="auth-success">
                  <span className="auth-success-icon">✓</span>
                  {success}
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
                      placeholder="사용자명 (2~20자)"
                      required
                      minLength={2}
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label">이메일</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="이메일을 입력하세요"
                      required
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
                      placeholder="비밀번호 (4자 이상)"
                      required
                      minLength={4}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label">비밀번호 확인</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호를 다시 입력하세요"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? (
                    <span className="auth-submit-loading">
                      <span className="auth-spinner" />
                      가입 처리 중...
                    </span>
                  ) : (
                    <>
                      <span>모험 시작하기</span>
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
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="auth-switch-link">로그인</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
