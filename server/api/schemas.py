# server/api/schemas.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from pydantic import BaseModel

class SessionCreate(BaseModel):
    theme: str
    participants: List[str]
    initial_prompt: str

class GenerateRequest(BaseModel):
    session_id: str
    prompt: str

# 基础模型
class TimestampSchema(BaseModel):
    created_at: datetime = Field(default_factory=datetime.now, 
                                description="记录创建时间")
    updated_at: Optional[datetime] = Field(None, 
                                         description="最后更新时间")

# 请求模型
class SessionCreateRequest(BaseModel):
    theme: str = Field(..., 
                      min_length=5, 
                      max_length=100,
                      example="科幻太空歌剧",
                      description="小说主题")
    preset_name: Optional[str] = Field("default",
                                     description="使用的预设配置名称")

    @validator('theme')
    def theme_must_contain_chinese(cls, v):
        if not any('\u4e00' <= c <= '\u9fff' for c in v):
            raise ValueError('主题必须包含中文')
        return v

class GenerationRequest(SessionCreateRequest):
    session_id: str = Field(..., 
                           min_length=6,
                           description="会话ID")
    prompt: str = Field(..., 
                       min_length=10,
                       max_length=1000,
                       example="主角在太空站发现了一个神秘外星装置",
                       description="生成提示词")
    temperature: Optional[float] = Field(0.7,
                                      ge=0.1,
                                      le=1.0,
                                      description="生成温度参数")

# 响应模型  
class GenerationResponse(TimestampSchema):
    content: str = Field(..., 
                        description="生成的文本内容")
    session_id: str = Field(..., 
                           description="关联的会话ID")
    model_name: str = Field("deepseek-r1:14b",
                           description="使用的模型名称")
    tokens_used: int = Field(..., 
                            ge=0,
                            description="消耗的token数量")

class SessionInfoResponse(TimestampSchema):
    session_id: str
    theme: str
    progress: float = Field(0.0,
                           ge=0.0,
                           le=1.0,
                           description="创作进度百分比")
    latest_content: Optional[str] = Field(None,
                                         description="最新生成内容片段")

class HistoryRecord(BaseModel):
    role: str = Field(..., 
                     enum=["user", "assistant", "system"],
                     description="消息来源")
    content: str
    timestamp: datetime

# 错误响应模型
class ErrorResponse(BaseModel):
    error_code: int = Field(..., 
                           example=400,
                           description="HTTP状态码")
    message: str = Field(..., 
                        example="无效的会话ID",
                        description="错误摘要")
    detail: Optional[str] = Field(None,
                                 example="找不到session_id: abc123",
                                 description="调试详情")

# WebSocket消息模型
class WSMessage(BaseModel):
    type: str = Field(..., 
                     enum=["status", "partial", "complete"],
                     description="消息类型")
    content: str
    session_id: str
    is_final: bool = False