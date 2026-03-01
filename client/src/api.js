import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
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

export default api;
