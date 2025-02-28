import requests

API_BASE = "http://localhost:8000/api/v1"

def test_workflow():
    try:
        # 1. 创建会话（需新增参数）
        session_res = requests.post(
            f"{API_BASE}/sessions",
            json={
                "theme": "武侠江湖",
                "participants": ["plot_writer", "character_designer"],
                "initial_prompt": "客栈比武场景"
            }
        )
        session_res.raise_for_status()
        session_id = session_res.json()["session_id"]
        print(f"✅ 创建会话成功 ID: {session_id}")
        check_res = requests.get(f"{API_BASE}/sessions/{session_id}")
        print(check_res)

        # 2. 发起讨论（参数结构变更）
        generate_res = requests.post(
            f"{API_BASE}/generate",
            json={
                "session_id": session_id,
                "initiator": "plot_writer",
                "prompt": "设计主角的武功招式",
                "max_rounds": 1
            }
        )

        generate_res.raise_for_status()
        print("🎉 生成结果：", generate_res.json()["final_draft"])

    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP错误: {e.response.status_code}")
        print("错误详情:", e.response.json())
    except KeyError as e:
        print(f"❌ 响应数据异常: 缺少字段 {str(e)}")

if __name__ == "__main__":
    test_workflow()