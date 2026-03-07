import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import CreateCharacter from './pages/CreateCharacter';
import CharacterSelect from './pages/CharacterSelect';
import api from './api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [showSelect, setShowSelect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(null); // { code }

  useEffect(() => {
    const onSessionExpired = (e) => setSessionExpired(e.detail);
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, []);

  const handleSessionExpiredClose = () => {
    setSessionExpired(null);
    window._duplicateLoginHandled = false;
    window.location.href = '/login';
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const selectedCharId = localStorage.getItem('selectedCharId');
      const charUrl = selectedCharId ? `/characters/me?charId=${selectedCharId}` : '/characters/me';
      Promise.all([
        api.get('/auth/me'),
        api.get(charUrl),
      ])
        .then(([userRes, charRes]) => {
          setUser(userRes.data.user);
          if (charRes.data.character) {
            setCharacter(charRes.data.character);
          } else {
            setShowSelect(true);
          }
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // 로그인 후 캐릭터 선택 화면으로
    setShowSelect(true);
    setCharacter(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedCharId');
    setUser(null);
    setCharacter(null);
    setShowSelect(false);
  };

  const handleCharacterDeleted = () => {
    localStorage.removeItem('selectedCharId');
    setCharacter(null);
    setShowSelect(true);
  };

  const handleSelectCharacter = (char) => {
    setCharacter(char);
    setShowSelect(false);
  };

  const handleCharacterCreated = (char) => {
    localStorage.setItem('selectedCharId', char.id);
    setCharacter(char);
    setShowSelect(false);
  };

  const handleGoToSelect = () => {
    setCharacter(null);
    setShowSelect(true);
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : showSelect && !character ? (
                <CharacterSelect
                  onSelectCharacter={handleSelectCharacter}
                  onCreateNew={() => setShowSelect(false)}
                  onLogout={handleLogout}
                />
              ) : !character ? (
                <Navigate to="/create-character" />
              ) : (
                <Home
                  user={user}
                  character={character}
                  onLogout={handleLogout}
                  onCharacterDeleted={handleCharacterDeleted}
                  onGoToCharacterSelect={handleGoToSelect}
                />
              )
            }
          />
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" /> : <Register />}
          />
          <Route
            path="/create-character"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : character || showSelect ? (
                <Navigate to="/" />
              ) : (
                <CreateCharacter
                  onCharacterCreated={handleCharacterCreated}
                  onBack={() => setShowSelect(true)}
                />
              )
            }
          />
        </Routes>
        {sessionExpired && (
          <div className="session-expired-overlay">
            <div className="session-expired-popup">
              <img src="/ui/session_expired_bg.png" alt="" className="session-expired-bg" />
              <div className="session-expired-content">
                <div className="session-expired-icon">
                  <div className="session-expired-seal" />
                </div>
                <h2 className="session-expired-title">세션 종료</h2>
                <p className="session-expired-msg">
                  {sessionExpired.code === 'SESSION_EXPIRED_DUPLICATE'
                    ? '다른 기기에서 로그인되어\n현재 세션이 종료되었습니다.'
                    : '세션이 만료되었습니다.\n다시 로그인해주세요.'}
                </p>
                <div className="session-expired-divider" />
                <button className="session-expired-btn" onClick={handleSessionExpiredClose}>
                  로그인 화면으로
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
