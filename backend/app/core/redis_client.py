"""
Redis client for caching and rate limiting
"""
import json
from typing import Optional, Any
import redis.asyncio as aioredis

from app.core.config import settings

redis_client: Optional[aioredis.Redis] = None


async def init_redis():
    """Initialize Redis connection"""
    global redis_client
    redis_client = await aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        await redis_client.close()


async def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    if not redis_client:
        return None
    
    value = await redis_client.get(key)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return None


async def set_cache(key: str, value: Any, ttl: int = settings.REDIS_CACHE_TTL):
    """Set value in cache with TTL"""
    if not redis_client:
        return
    
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    
    await redis_client.setex(key, ttl, value)


async def delete_cache(key: str):
    """Delete value from cache"""
    if not redis_client:
        return
    
    await redis_client.delete(key)


async def increment_rate_limit(key: str, window_seconds: int = 60) -> int:
    """Increment rate limit counter and return current count"""
    if not redis_client:
        return 0
    
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()
    return results[0]