import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const selectedCharId = localStorage.getItem('selectedCharId');
  if (selectedCharId) {
    config.headers['X-Char-Id'] = selectedCharId;
  }
  return config;
});

// 중복 로그인 감지 시 강제 로그아웃
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    const status = error.response?.status;
    if (
      (status === 409 && code === 'SESSION_EXPIRED_DUPLICATE') ||
      (status === 401 && code === 'SESSION_REQUIRED')
    ) {
      if (!window._duplicateLoginHandled) {
        window._duplicateLoginHandled = true;
        localStorage.removeItem('token');
        localStorage.removeItem('selectedCharId');
        // 커스텀 이벤트로 팝업 표시 (App.js에서 처리)
        window.dispatchEvent(new CustomEvent('session-expired', { detail: { code } }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
