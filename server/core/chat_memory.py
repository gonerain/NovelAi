import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import List, Dict

class ChatMemory:
    _local = threading.local()  # 线程本地存储
    
    def __init__(self, db_path='chat_history.db'):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._run_migrations()

    @contextmanager
    def _get_connection(self):
        """获取线程安全的数据库连接"""
        if not hasattr(ChatMemory._local, "conn"):
            ChatMemory._local.conn = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            ChatMemory._local.conn.execute("PRAGMA journal_mode=WAL")
        yield ChatMemory._local.conn

    def _run_migrations(self):
        """更健壮的迁移系统"""
        with self._get_connection() as conn:
            with conn:
                # 检查表是否存在
                cursor = conn.execute("""
                    SELECT name FROM sqlite_master
                    WHERE type='table' AND name='history'
                """)
                
                if cursor.fetchone():
                    # 存在旧表时检查列
                    cursor = conn.execute("PRAGMA table_info(history)")
                    columns = {row[1] for row in cursor}
                    
                    # 逐步执行迁移
                    if 'token_count' not in columns:
                        print("执行迁移：添加 token_count 列")
                        conn.execute('''
                            ALTER TABLE history
                            ADD COLUMN token_count INTEGER DEFAULT 0
                        ''')
                    
                    if 'embedding' not in columns:
                        print("执行迁移：添加 embedding 列")
                        conn.execute('''
                            ALTER TABLE history
                            ADD COLUMN embedding BLOB
                        ''')
                else:
                    # 全新安装时创建完整表结构
                    self._create_table(conn)

    def _create_table(self, conn):
        """创建新表结构"""
        conn.execute('''
            CREATE TABLE history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT CHECK(role IN ('system', 'user', 'assistant')) NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                embedding BLOB,
                token_count INTEGER DEFAULT 0
            )
        ''')
        conn.execute('''
            CREATE INDEX idx_session ON history (session_id)
        ''')

    def _add_embedding_column(self, conn):
        """添加向量字段的迁移"""
        print("正在执行数据库迁移：添加 embedding 字段")
        conn.execute('''
            ALTER TABLE history
            ADD COLUMN embedding BLOB
        ''')
        conn.execute('''
            ALTER TABLE history
            ADD COLUMN token_count INTEGER DEFAULT 0
        ''')

    def add_message(self, session_id: str, role: str, content: str, embedding: bytes = None):
        """存储对话记录（线程安全版）"""
        with self._get_connection() as conn:
            with conn:
                conn.execute('''
                    INSERT INTO history 
                    (session_id, role, content, embedding, token_count)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    session_id,
                    role,
                    content,
                    embedding,
                    self._estimate_tokens(content)
                ))

    def get_context(self, session_id: str, max_tokens: int = 4096) -> List[Dict]:
        """获取智能截断的对话上下文"""
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT role, content, token_count 
                FROM history
                WHERE session_id = ?
                ORDER BY timestamp DESC
            ''', (session_id,))

            messages = []
            total_tokens = 0
            for row in cursor:
                if total_tokens + row[2] > max_tokens:
                    break
                messages.insert(0, {  # 保持时间顺序
                    "role": row[0],
                    "content": row[1]
                })
                total_tokens += row[2]
            return messages

    def _estimate_tokens(self, text: str) -> int:
        """简易的token估算方法（实际应使用tokenizer）"""
        return len(text) // 4  # 假设平均每个token约4字符

    def close(self):
        """关闭所有数据库连接（用于服务关闭时）"""
        if hasattr(ChatMemory._local, "conn"):
            ChatMemory._local.conn.close()
            del ChatMemory._local.conn
    
    def get_full_history(self, session_id: str) -> List[Dict]:
        """获取指定会话的完整历史记录"""
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT role, content, timestamp 
                FROM history
                WHERE session_id = ?
                ORDER BY timestamp ASC  -- 按时间正序排列
            ''', (session_id,))
            
            return [
                {
                    "role": row[0],
                    "content": row[1],
                    "timestamp": row[2]
                }
                for row in cursor.fetchall()
            ]

# 使用示例
if __name__ == "__main__":
    # 初始化测试数据
    memory = ChatMemory(":memory:")  # 内存数据库
    
    # 存储测试消息
    memory.add_message("session_1", "user", "什么是机器学习？")
    memory.add_message("session_1", "assistant", "机器学习是人工智能的一个分支...")
    
    # 获取上下文
    context = memory.get_context("session_1")
    print("对话上下文：")
    for msg in context:
        print(f"{msg['role']}: {msg['content']}")
    
    # 关闭连接
    memory.close()