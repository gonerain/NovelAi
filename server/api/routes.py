from fastapi import APIRouter
from .schemas import SessionCreate, GenerateRequest  # 新增导入
from server.core.novelai_core import NovelAICore

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

@router.post("/generate")
def generate_text(request: GenerateRequest):
    response = ai_core.ai_discussion(
        session_id=request.session_id,
        prompt=request.prompt
    )
    return {"text": response}