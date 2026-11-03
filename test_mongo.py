"""
Test MongoDB connection — run this AFTER updating .env with your Atlas URI.
Usage: python test_mongo.py
"""
import asyncio
from pathlib import Path

# Load .env manually
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            import os
            os.environ.setdefault(k.strip(), v.strip())

async def test():
    import motor.motor_asyncio
    uri = __import__("os").environ.get("MONGODB_URI", "mongodb://localhost:27017")
    db_name = __import__("os").environ.get("MONGODB_DB", "vmc_roads")

    print(f"Connecting to: {uri[:50]}...")
    client = motor.motor_asyncio.AsyncIOMotorClient(uri, serverSelectionTimeoutMS=8000)
    try:
        info = await client.server_info()
        print(f"✅ Connected! MongoDB version: {info.get('version')}")
        db = client[db_name]
        colls = await db.list_collection_names()
        print(f"✅ Database '{db_name}' OK. Collections: {colls or '(empty — first run)'}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print()
        print("Common fixes:")
        print("  1. Check MONGODB_URI in your .env file")
        print("  2. Make sure your IP is whitelisted in Atlas > Network Access")
        print("  3. Verify your database username and password")
    finally:
        client.close()

asyncio.run(test())
