"""MongoDB async connection via Motor"""
import motor.motor_asyncio
from app.config import settings

_client: motor.motor_asyncio.AsyncIOMotorClient | None = None


def get_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db():
    return get_client()[settings.mongodb_db]


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None

