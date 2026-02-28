import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import CreateCharacter from './pages/CreateCharacter';
import api from './api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      Promise.all([
        api.get('/auth/me'),
        api.get('/characters/me'),
      ])
        .then(([userRes, charRes]) => {
          setUser(userRes.data.user);
          setCharacter(charRes.data.character);
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    api.get('/characters/me').then((res) => setCharacter(res.data.character));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCharacter(null);
  };

  const handleCharacterDeleted = () => {
    setCharacter(null);
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
              ) : !character ? (
                <Navigate to="/create-character" />
              ) : (
                <Home
                  user={user}
                  character={character}
                  onLogout={handleLogout}
                  onCharacterDeleted={handleCharacterDeleted}
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
              ) : character ? (
                <Navigate to="/" />
              ) : (
                <CreateCharacter onCharacterCreated={setCharacter} />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
