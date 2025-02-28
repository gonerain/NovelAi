# server/main.py
import logging
from fastapi import FastAPI, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import sys
import locale

# 正确导入路由（确保在routes.py中正确定义）
from .api.routes import main_router, test_router  # 确保api_router和test_router在routes.py中分开定义
from server.core.novelai_core import NovelAICore

# 在文件开头添加编码设置
if sys.stdout.encoding != 'UTF-8':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """增强版生命周期管理"""
    # 初始化阶段
    ai_core = NovelAICore()
    try:
        logger.info("AI核心初始化开始...")
        # 如果有异步初始化逻辑，这里可以添加 await ai_core.initialize()
        app.state.ai_core = ai_core
        logger.info("AI核心初始化完成")
        yield
    except Exception as e:
        logger.error(f"初始化失败: {str(e)}", exc_info=True)
        raise
    finally:
        # 关闭阶段
        logger.info("正在关闭AI服务...")
        try:
            await asyncio.wait_for(
                ai_core.shutdown(),
                timeout=5  # 设置5秒超时
            )
        except asyncio.TimeoutError:
            logger.error("服务关闭超时，可能存在未释放资源")
        except asyncio.CancelledError:
            logger.warning("服务关闭过程被外部取消")
        except Exception as e:
            logger.error(f"服务关闭异常: {str(e)}", exc_info=True)
        finally:
            del app.state.ai_core  # 强制释放资源
            logger.info("服务资源已释放")

app = FastAPI(
    title="AI小说生成系统",
    description="基于深度学习的多角色协作小说创作平台",
    version="1.0.0",
    lifespan=lifespan
)

# 中间件配置增强
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"]
)

# 正确注册路由（移除APIRouter的多余前缀）
app.include_router(main_router, prefix="/api/v1")  # api_router内部无前缀
app.include_router(test_router, prefix="/test")    # test_router内部无前缀

@app.get("/health", tags=["System"])
async def health_check():
    """增强版健康检查接口"""
    return {
        "status": "OK",
        "details": {
            "ai_core_initialized": hasattr(app.state, "ai_core"),
            "active_sessions": len(app.state.ai_core.active_sessions) if hasattr(app.state, "ai_core") else 0
        }
    }

# 异常处理增强
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """详细参数验证错误响应"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": 422,
            "message": "参数校验失败",
            "details": exc.errors()
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        # 生产环境应关闭reload
        server_header=False,  # 隐藏服务器头信息
        timeout_keep_alive=60  # 连接保持时间
    )