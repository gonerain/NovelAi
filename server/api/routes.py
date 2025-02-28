import asyncio
from typing import List
from fastapi import APIRouter, Query, HTTPException
from .schemas import SessionCreate, GenerateRequest
from server.core.novelai_core import NovelAICore
from pydantic import BaseModel
from datetime import datetime
import random
import time

# 创建两个独立的路由实例
main_router = APIRouter()    # 主业务路由
test_router = APIRouter()     # 测试路由

ai_core = NovelAICore()

# ----------------- 主业务路由 -----------------
@main_router.post("/sessions")
def create_session(request: SessionCreate):
    session_id = ai_core.create_session(
        theme=request.theme,
        participants=request.participants,
        initial_prompt=request.initial_prompt
    )
    return {"session_id": session_id}

@main_router.get("/sessions/{session_id}")
def get_session(session_id: str):
    try:
        return ai_core.active_sessions[session_id]
    except KeyError:
        raise HTTPException(404, detail="会话不存在")

@main_router.post("/generate")
def generate_text(request: GenerateRequest):
    try:
        print(f"[生成] 使用的会话ID: {request.session_id}")
        result = ai_core.ai_discussion(
            session_id=request.session_id,
            initiator=request.initiator,
            prompt=request.prompt,
            max_rounds=request.max_rounds
        )
        return result
    except Exception as e:
        raise HTTPException(500, detail=f"生成失败: {str(e)}")

# ----------------- 测试路由 -----------------
# 添加请求体模型
class TestGenerateRequest(BaseModel):
    session_id: str
    prompt: str
    delay: float = 0.5

MOCK_HISTORY = [
    {
        "role": "user",
        "content": "你好，这是一个测试消息",
        "timestamp": "2024-02-28T10:00:00"
    },
    {
        "role": "ai", 
        "content": "你好！这是模拟回复",
        "timestamp": "2024-02-28T10:00:05"
    }
]

@test_router.post("/sessions")
def create_test_session():
    """测试会话创建"""
    return {"session_id": "test-session-123"}

@test_router.post("/generate")
async def mock_generate(request: TestGenerateRequest):  # 使用模型验证
    try:
        await asyncio.sleep(request.delay)
        return {
            "session_id": request.session_id,
            "rounds": [
                {
                    "role": "user",
                    "content": request.prompt,
                    "timestamp": datetime.now().isoformat()
                },
                {
                    "role": "ai",
                    "content": f"测试回复：{request.prompt} #{random.randint(1,100)}",
                    "timestamp": datetime.now().isoformat()
                }
            ]
        }
    except Exception as e:
        raise HTTPException(400, detail=f"参数错误: {str(e)}")

@test_router.get("/sessions/{session_id}/history")
def get_mock_history(session_id: str):
    """测试历史记录"""
    new_record = {
        "role": "ai",
        "content": f"动态回复 {datetime.now().strftime('%H:%M:%S')}",
        "timestamp": datetime.now().isoformat()
    }
    return MOCK_HISTORY + [new_record]