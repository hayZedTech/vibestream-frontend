import axios from 'axios';

const API = axios.create({
  baseURL: 'https://vibestream-backend.onrender.com/api', // backend URL
});

// Add JWT token to headers if exists
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
