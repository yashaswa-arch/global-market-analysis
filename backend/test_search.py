import httpx
import asyncio

async def run():
    response = await httpx.AsyncClient().get('http://localhost:8000/api/events?q=China')
    print(response.json())

asyncio.run(run())
