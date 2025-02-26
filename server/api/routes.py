from typing import List
from fastapi import APIRouter
from .schemas import SessionCreate, GenerateRequest  # 新增导入
from server.core.novelai_core import NovelAICore
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
ai_core = NovelAICore()

@router.post("/sessions")
def create_session(request: SessionCreate):
    session_id = ai_core.create_session(
        theme=request.theme,
        participants=request.participants,
        initial_prompt=request.initial_prompt
    )
    return {"session_id": session_id}

# server/api/routes.py
@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    try:
        return ai_core.active_sessions[session_id]
    except KeyError:
        raise HTTPException(404, detail="会话不存在")

# server/api/routes.py
@router.post("/generate")
def generate_text(request: GenerateRequest):
    try:
        # 添加调试日志
        print(f"[生成] 使用的会话ID: {request.session_id}")
        print(f"[生成] 当前所有会话: {ai_core.active_sessions.keys()}")
        result = ai_core.ai_discussion(
            session_id=request.session_id,
            initiator=request.initiator,
            prompt=request.prompt,
            max_rounds=request.max_rounds
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()  # 打印完整堆栈
        raise HTTPException(500, detail=f"生成失败: {str(e)}")
    
class HistoryRecord(BaseModel):
    role: str
    content: str
    timestamp: str
    
@router.get("/sessions/{session_id}/history", response_model=List[HistoryRecord])
def get_session_history(session_id: str):
    try:
        return ai_core.chat_agent.memory.get_full_history(session_id)
    except Exception as e:
        raise HTTPException(500, detail=f"获取历史失败: {str(e)}")