import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:8000/test'; // 修正测试接口地址

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 初始化测试会话
  useEffect(() => {
    const initTestSession = async () => {
      try {
        // 创建测试会话
        const sessionRes = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
        const { session_id } = await sessionRes.json();
        
        // 初始化会话列表
        setSessions([{ id: session_id, title: '测试会话' }]);
        setCurrentSessionId(session_id);

        // 加载测试历史
        const historyRes = await fetch(`${API_BASE}/sessions/${session_id}/history`);
        const history = await historyRes.json();
        
        setMessages(history.map(msg => ({
          id: msg.timestamp || Date.now(),
          text: msg.content,
          isUser: msg.role === 'user'
        })));

      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    initTestSession();
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentSessionId) return;
  
    // 添加用户消息
    const userMessage = {
      id: Date.now(),
      text: newMessage,
      isUser: true
    };
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
  
    try {
      setIsLoading(true);
      
      // 调用测试接口
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          prompt: newMessage,
          // delay: 0.5 // 可选参数
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP错误 ${res.status}`);
      }
      
      const data = await res.json();
  
      // 防御性处理开始
      if (data?.rounds) {
        setMessages(prev => [
          ...prev,
          ...data.rounds
            .filter(round => round?.role === 'ai')
            .map(round => ({
              id: Date.now() + Math.random(),
              text: round.content || '空回复',
              isUser: false
            }))
        ]);
      } else {
        throw new Error("无效的响应格式");
      }
      
    } catch (error) {
      console.error('请求失败:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          text: `错误: ${error.message}`,
          isUser: false
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          会话列表
          <div className="test-badge">测试模式</div>
        </div>
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
            onClick={() => setCurrentSessionId(session.id)}
          >
            {session.title}
          </div>
        ))}
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.isUser ? 'user' : 'ai'}`}
            >
              {message.text}
              {isLoading && !message.isUser && (
                <div className="typing-indicator">...</div>
              )}
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;