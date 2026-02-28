import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import api from '../api';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    }
  };

  return (
    <div className="auth-container">
      <Container style={{ maxWidth: 420 }}>
        <Card className="shadow-lg border-0" style={{ borderTop: '3px solid var(--accent)' }}>
          <Card.Body className="p-4 p-md-5">
            <h2 className="text-center game-title mb-4">로그인</h2>
            {error && <Alert variant="danger" className="text-center py-2">{error}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>사용자명</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="사용자명을 입력하세요"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>비밀번호</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100 py-2 mt-2">
                로그인
              </Button>
            </Form>
            <p className="text-center mt-3" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              계정이 없으신가요? <Link to="/register" style={{ color: 'var(--gold)' }}>회원가입</Link>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default Login;
