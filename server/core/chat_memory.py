import sqlite3
from datetime import datetime

class ChatMemory:
    def __init__(self, db_path='chat_history.db'):
        self.conn = sqlite3.connect(db_path)
        self._drop_old_table()  # 新增迁移方法
        self._create_table()

    def _drop_old_table(self):
        """处理旧表结构迁移"""
        try:
            self.conn.execute('DROP TABLE IF EXISTS history')
        except Exception as e:
            print(f"迁移表结构时发生错误: {str(e)}")
    
    def _create_table(self):
        """创建对话记录表"""
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                embedding BLOB  -- 用于向量检索的字段
            )
        ''')
    
    def add_message(self, session_id, role, content):
        """存储单条消息"""
        self.conn.execute(
            'INSERT INTO history (session_id, role, content) VALUES (?,?,?)',
            (session_id, role, content)
        )
        self.conn.commit()
    
    def get_context(self, session_id, max_tokens=4096):
        """获取对话上下文（智能截断版）"""
        cursor = self.conn.execute('''
            SELECT role, content FROM history
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT 20  -- 最近20条对话
        ''', (session_id,))
        
        messages = []
        token_count = 0
        for role, content in reversed(cursor.fetchall()):
            msg = f"{role}: {content}"
            msg_tokens = len(msg.split())  # 简易token估算
            
            if token_count + msg_tokens > max_tokens:
                break
                
            messages.insert(0, {"role": role, "content": content})
            token_count += msg_tokens
            
        return messages

# 使用示例
memory = ChatMemory()
session_id = "user_123"

# 存储新消息
memory.add_message(session_id, 'user', '为什么天空是蓝色的？')

# 获取对话上下文
context = memory.get_context(session_id)
# print(context)