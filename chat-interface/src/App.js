import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_TEST = 'http://localhost:8000/test'; // 修正测试接口地址
const API_BASE = 'http://localhost:8000/api/v1'; // 修正测试接口地址

const DEFAULT_PARTICIPANTS = ["plot_writer", "editor_in_chief"];

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCounter, setSessionCounter] = useState(1);

  // 初始化测试会话
  useEffect(() => {
    const initTestSession = async () => {
      try {
        const sessionId = await createNewSession('初始会话');
        if (sessionId) {
          setCurrentSessionId(sessionId);
          const historyRes = await fetch(`${API_BASE}/sessions/${sessionId}/history`);
          const history = await historyRes.json();
          setMessages(history.map(msg => ({
            id: msg.timestamp || Date.now(),
            text: msg.content,
            isUser: msg.role === 'user'
          })));
        }

      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    initTestSession();
  }, []);

    // 处理新建会话点击
    const handleNewSession = async () => {
      const newSessionId = await createNewSession();
      if (newSessionId) {
        setCurrentSessionId(newSessionId);
        setMessages([]); // 清空当前消息
        setNewMessage('');
      }
    };

  
    // 根据消息生成会话参数
    const generateSessionParams = (userInput) => {
      return {
        theme: userInput, // 截取前20字符作为主题
        participants: DEFAULT_PARTICIPANTS,
        initial_prompt: userInput
      };
    };


  // 创建会话（带用户输入参数）
  const createNewSession = async (userInput) => {
    try {
      const params = generateSessionParams(userInput);
      
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!res.ok) throw new Error('会话创建失败');
      
      const { session_id } = await res.json();
      
      setSessions(prev => [...prev, {
        id: session_id,
        title: params.theme  // 使用生成的主题
      }]);
      
      return session_id;
      
    } catch (error) {
      console.error('创建失败:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `会话创建失败: ${error.message}`,
        isUser: false
      }]);
      return null;
    }
  };
  

  const handleSend = async () => {
    const userInput = newMessage.trim();
    if (!userInput) return;
  
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

      // 智能创建会话
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createNewSession(userInput);
        if (!sessionId) return;
        setCurrentSessionId(sessionId);
      }

      // 添加用户消息
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: userInput,
        isUser: true
      }]);
      
      // 发送生成请求
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          prompt: userInput,
          initiator: "user"  // 标记用户为讨论发起者
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
          <button 
              className="new-session-btn"
              onClick={handleNewSession}
              title="新建会话"
            >
              +
            </button>
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