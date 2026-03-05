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
      </div>
    </Router>
  );
}

export default App;
