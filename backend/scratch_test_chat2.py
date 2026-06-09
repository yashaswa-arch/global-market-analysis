import urllib.request
import json
import urllib.error

try:
    req = urllib.request.Request(
        'http://localhost:8000/api/chat/ask', 
        data=json.dumps({'question': 'What is the latest news?'}).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    print("SUCCESS:")
    print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("OTHER ERROR:", e)
