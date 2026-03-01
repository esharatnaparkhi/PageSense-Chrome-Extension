"""
Authentication endpoints (MongoDB version)
"""
import logging
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    verify_google_id_token,
)
from app.schemas.schemas import UserCreate, UserLogin, Token, UserResponse

router = APIRouter()
logger = logging.getLogger("auth")


@router.post("/google", response_model=Token)
async def google_auth(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Sign in or register via Google ID token."""
    logger.info("GOOGLE AUTH endpoint hit")
    google_token = payload.get("token")
    if not google_token:
        raise HTTPException(status_code=400, detail="Missing Google token")

    google_user = verify_google_id_token(google_token)
    email = google_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    now = datetime.utcnow()
    doc = await db.users.find_one_and_update(
        {"email": email},
        {
            "$setOnInsert": {
                "email": email,
                "hashed_password": "",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    access_token = create_access_token({"sub": str(doc["_id"])})
    return Token(access_token=access_token)


@router.post("/register", response_model=Token)
async def register(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Register a new user with email/password."""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.utcnow()
    doc = {
        "email": user_data.email,
        "hashed_password": get_password_hash(user_data.password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    access_token = create_access_token({"sub": str(result.inserted_id)})
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Login with email/password."""
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(
        credentials.password, user.get("hashed_password", "")
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User account is inactive")

    access_token = create_access_token({"sub": str(user["_id"])})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get current user information."""
    user_id = current_user["user_id"]
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        is_active=user.get("is_active", True),
        created_at=user["created_at"],
    )
