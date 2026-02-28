import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import api from '../api';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await api.post('/auth/register', { username, email, password });
      setSuccess('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="auth-container">
      <Container style={{ maxWidth: 420 }}>
        <Card className="shadow-lg border-0" style={{ borderTop: '3px solid var(--accent)' }}>
          <Card.Body className="p-4 p-md-5">
            <h2 className="text-center game-title mb-4">회원가입</h2>
            {error && <Alert variant="danger" className="text-center py-2">{error}</Alert>}
            {success && <Alert variant="success" className="text-center py-2">{success}</Alert>}
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
                <Form.Label>이메일</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
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
              <Form.Group className="mb-3">
                <Form.Label>비밀번호 확인</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100 py-2 mt-2">
                회원가입
              </Button>
            </Form>
            <p className="text-center mt-3" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              이미 계정이 있으신가요? <Link to="/login" style={{ color: 'var(--gold)' }}>로그인</Link>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default Register;
