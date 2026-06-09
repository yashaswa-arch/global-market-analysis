import requests
try:
    res = requests.post("http://localhost:8000/api/chat/ask", json={"question": "What is the latest news?"})
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
