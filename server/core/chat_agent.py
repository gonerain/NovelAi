import sys
import os
import requests

# 获取当前脚本的绝对路径的父目录的父目录（即项目根目录）
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)


import json
import os
from server.core.chat_memory import ChatMemory

class ChatAgent:
    """带记忆功能的对话代理类"""
    
    def __init__(self, 
                 db_path: str = "chat_history.db",
                 presets_dir: str = "presets"):
        """
        初始化对话代理
        :param db_path: 数据库文件路径
        :param presets_dir: 预设文件目录
        """
        self.memory = ChatMemory(db_path)
        self.presets_dir = presets_dir
        os.makedirs(presets_dir, exist_ok=True)

    def _load_preset(self, preset_name: str) -> dict:
        """加载预设配置"""
        preset_path = os.path.join(self.presets_dir, f"{preset_name}.json")
        try:
            with open(preset_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"使用默认预设代替缺失的 {preset_name}")
            return {"temperature": 0.7, "max_tokens": 2000}
        except Exception as e:
            print(f"Error loading preset {preset_name}: {str(e)}")
            return {}

    def generate(self,
                prompt: str,
                session_id: str,
                model: str = "deepseek-r1:14b",
                preset: str = "default",
                max_context_tokens: int = 4096,
                stream: bool = False) -> str:
        """
        执行带上下文的对话生成
        :param prompt: 用户输入的提示
        :param session_id: 会话唯一标识
        :param model: 使用的模型名称
        :param preset: 预设配置名称
        :param max_context_tokens: 最大上下文token数
        :param stream: 是否使用流式传输
        :return: AI生成的响应
        """
        url = "http://localhost:11434/api/generate"
        headers = {"Content-Type": "application/json"}
        
        # 构建上下文提示
        context_prompt = []
        history = self.memory.get_context(session_id, max_tokens=max_context_tokens)
        
        # 转换历史记录格式
        for msg in history:
            role = "用户" if msg["role"] == "user" else "助手"
            context_prompt.append(f"{role}：{msg['content']}")
        
        # 拼接完整提示
        full_prompt = "\n".join(context_prompt + [f"用户：{prompt}", "助手："])

        # 准备请求数据
        data = {
            "model": model,
            "prompt": full_prompt,
            "stream": stream,
            "options": self._load_preset(preset)
        }

        try:
            # 发送请求
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            
            # 解析响应
            response_data = response.json()
            response_text = response_data.get("response", "")
            
            # 保存对话记录
            if session_id:
                self.memory.add_message(session_id, "user", prompt)
                self.memory.add_message(session_id, "assistant", response_text)
            
            return response_text

        except requests.exceptions.RequestException as e:
            return f"请求失败：{str(e)}"
        except json.JSONDecodeError:
            return "响应解析失败"
        except Exception as e:
            return f"未知错误：{str(e)}"

    def get_history(self, session_id: str) -> list:
        """获取指定会话的历史记录"""
        return self.memory.get_context(session_id)

    def clear_history(self, session_id: str) -> None:
        """清除指定会话的历史记录"""
        self.memory.conn.execute(
            "DELETE FROM history WHERE session_id = ?",
            (session_id,)
        )
        self.memory.conn.commit()