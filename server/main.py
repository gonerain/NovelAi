# server/main.py
import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from server.api.routes import router as ai_router
from server.core.novelai_core import NovelAICore

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 应用生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化AI核心
    try:
        app.state.ai_core = NovelAICore()
        logger.info("AI核心初始化完成")
        yield
    finally:
        # 关闭时清理资源
        logger.info("正在关闭AI服务...")
        await app.state.ai_core.shutdown()
        logger.info("服务已安全关闭")

# 创建FastAPI实例
app = FastAPI(
    title="AI小说生成系统",
    description="基于深度学习的多角色协作小说创作平台",
    version="1.0.0",
    lifespan=lifespan
)

# 配置中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加路由
app.include_router(
    ai_router,
    prefix="/api/v1",
    tags=["AI Generation"],
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "服务器内部错误"
        }
    }
)

# 健康检查端点
@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "OK"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": 422,
            "message": "参数校验失败",
            "detail": exc.errors()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error_code": 500,
            "message": "服务器内部错误",
            "detail": str(exc)
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # 开发环境配置
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["server"],
        log_level="debug"
    )