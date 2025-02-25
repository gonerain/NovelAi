import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000'
});

export const NovelAI = {
  createSession: (theme: string) => api.post('/sessions', { theme }),
  
  generateText: (sessionId: string, prompt: string) => 
    api.post('/generate', { session_id: sessionId, prompt }),
  
  getHistory: (sessionId: string) => 
    api.get(`/sessions/${sessionId}/history`)
};