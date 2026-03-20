# run.py
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",
        port=8000,
        reload=True  # Tự động restart khi code thay đổi
    )