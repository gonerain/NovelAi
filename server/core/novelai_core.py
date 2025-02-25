import sys
import os
import uuid
from datetime import datetime
from typing import Dict, List

# 获取当前脚本的绝对路径的父目录的父目录（即项目根目录）
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)

from datetime import datetime
from typing import Dict, List, Optional

from server.core.chat_memory import ChatMemory
from server.core.chat_agent import ChatAgent

class NovelAICore:
    """升级版小说协作系统核心"""
    
    def __init__(self, db_path: str = "novel_ai.db"):
        self.sessions = {}
        self.chat_agent = ChatAgent(db_path)
        self.roles: Dict[str, dict] = {}
        self.active_sessions: Dict[str, dict] = {} 
        self._initialize_default_roles()
    
    def _initialize_default_roles(self):
        """初始化预定义角色系统"""
        role_configs = {
            "plot_writer": {
                "name": "剧情写手",
                "model": "deepseek-r1:14b",
                "preset": "creative",
                "description": "负责生成故事主线和关键剧情转折点"
            },
            "character_designer": {
                "name": "角色设计师",
                "model": "deepseek-r1:14b",
                "preset": "detailed",
                "description": "负责角色设定、性格特征和人物关系"
            },
            "world_builder": {
                "name": "世界观构建师",
                "model": "deepseek-r1:14b",
                "preset": "analytical",
                "description": "负责构建世界观、地理环境和历史背景"
            },
            "editor_in_chief": {
                "name": "总编",
                "model": "deepseek-r1:14b",
                "preset": "critical",
                "description": "负责整合内容、润色文本并最终定稿"
            }
        }
        
        for role_id, config in role_configs.items():
            self.add_role(role_id=role_id,**config)

    def add_role(self, 
                role_id: str,
                name: str,
                model: str,
                preset: str,
                description: str = ""):
        """添加/更新AI角色配置"""
        self.roles[role_id] = {
            "name": name,
            "model": model,
            "preset": preset,
            "description": description
        }

    def create_session(self, 
                      theme: str,
                      participants: List[str],
                      initial_prompt: str = "") -> str:
        """创建新会话"""
        session_id = str(uuid.uuid4())
        self.active_sessions[session_id] = {
            "theme": theme,
            "participants": participants,
            "history": [],
            "current_state": initial_prompt,
            "created_at": datetime.now().isoformat()
        }
        return session_id
    
    def _generate_session_id(self) -> str:
        """生成唯一会话ID"""
        import uuid
        return str(uuid.uuid4())

    def ai_discussion(self,
                     session_id: str,
                     initiator: str,
                     prompt: str,
                     max_rounds: int = 3) -> dict:
        """
        增强版多轮讨论机制
        Args:
            session_id: 会话ID
            initiator: 发起讨论的角色ID
            prompt: 讨论主题
            max_rounds: 最大讨论轮次
        """
        session = self._get_session(session_id)
        discussion_log = []
        
        # 生成角色感知提示
        discussion_prompt = self._build_discussion_prompt(
            session_id=session_id,
            initiator=initiator,
            prompt=prompt
        )
        
        for round_num in range(max_rounds):
            round_log = {"round": round_num+1, "contributions": []}
            
            # 角色依次发言
            for role_id in session["participants"]:
                if role_id == initiator and round_num > 0:
                    continue  # 发起者只在第一轮发言
                
                # 生成角色专属提示
                role_prompt = self._build_role_prompt(
                    role_id=role_id,
                    discussion_prompt=discussion_prompt
                )
                
                # 调用ChatAgent生成响应
                response = self.chat_agent.generate(
                    prompt=role_prompt,
                    session_id=session_id,
                    model=self.roles[role_id]["model"],
                    preset=self.roles[role_id]["preset"]
                )
                
                # 记录贡献
                contribution = {
                    "role": role_id,
                    "input": role_prompt,
                    "output": response,
                    "timestamp": datetime.now().isoformat()
                }
                round_log["contributions"].append(contribution)
                
                # 更新讨论状态
                discussion_prompt = f"最新意见：{response}\n请下一位继续发言："
            
            discussion_log.append(round_log)
            session["current_state"] = self._summarize_discussion(discussion_log)
            
            if self._check_consensus(session_id):
                break
        
        # 生成最终稿
        final_prompt = f"请整合以下讨论内容：{session['current_state']}"
        final_draft = self.chat_agent.generate(
            prompt=final_prompt,
            session_id=session_id,
            model=self.roles["editor_in_chief"]["model"],
            preset=self.roles["editor_in_chief"]["preset"]
        )
        
        return {
            "session_id": session_id,
            "discussion_log": discussion_log,
            "final_draft": final_draft,
            "participants": session["participants"]
        }
    
    def _get_session(self, session_id: str) -> dict:
        """安全获取会话"""
        if session_id not in self.active_sessions:
            raise ValueError(f"无效的会话ID: {session_id}")
        return self.active_sessions[session_id]

    def _build_discussion_prompt(self, session_id: str, initiator: str, prompt: str) -> str:
        """构建讨论启动提示"""
        session = self.active_sessions[session_id]
        return (
            f"当前故事状态：{session['current_state']}\n"
            f"讨论发起者：{self.roles[initiator]['name']}\n"
            f"讨论主题：{prompt}\n"
            "请各位按顺序发表专业意见："
        )

    def _build_role_prompt(self, role_id: str, discussion_prompt: str) -> str:
        """构建角色专属提示"""
        role_info = self.roles[role_id]
        return (
            f"你现在的身份是：{role_info['name']}\n"
            f"角色职责：{role_info['description']}\n"
            f"{discussion_prompt}"
        )

    def _summarize_discussion(self, discussion_log: list) -> str:
        """实时讨论摘要生成（可扩展为调用专用模型）"""
        return "\n".join(
            f"第{round['round']}轮讨论：{', '.join(c['role'] for c in round['contributions'])}"
            for round in discussion_log
        )

    def _check_consensus(self, session_id: str) -> bool:
        """共识检测（基础实现）"""
        history = self.chat_agent.get_history(session_id)
        return len(history) >= 6  # 简单基于讨论次数判断

    def get_session_history(self, session_id: str) -> list:
        """获取会话完整历史"""
        return self.chat_agent.get_history(session_id)

    def export_session_report(self, session_id: str) -> dict:
        """导出会话完整报告"""
        session = self.active_sessions[session_id]
        return {
            "session_id": session_id,
            "participants": session["participants"],
            "current_state": session["current_state"],
            "full_history": self.get_session_history(session_id)
        }

# 使用示例
if __name__ == "__main__":
    # 正确使用方式
    system = NovelAICore()

    # 创建会话（无需手动指定ID）
    session_id = system.create_session(
        theme="科幻校园爱情",
        participants=["plot_writer", "character_designer"],
        initial_prompt="初始故事设定..."
    )

    # 发起讨论
    result = system.ai_discussion(
        session_id=session_id,
        initiator="plot_writer",
        prompt="讨论核心矛盾",
        max_rounds=2
    )
    
    print("最终稿：")
    print(result["final_draft"])
    
    # 查看数据库记录
    print("\n数据库记录：")
    print(system.chat_agent.get_history(session_id))