from fastapi import APIRouter
from core.novelai_core import NovelAICore

router = APIRouter()
ai_core = NovelAICore()

@router.post("/sessions")
def create_session(theme: str):
    session_id = ai_core.create_session(theme)
    return {"session_id": session_id}

@router.post("/generate")
def generate_text(session_id: str, prompt: str):
    response = ai_core.generate(session_id, prompt)
    return {"text": response}