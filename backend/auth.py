from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from datetime import datetime
from database.models import User
from services.auth_service import hash_password, create_access_token, authenticate_user
from deps import get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _user_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "level": user.level,
        "level_title": user.level_title,
        "goal": user.goal,
        "background": user.background,
        "has_onboarded": bool(user.goal),
    }


@router.post("/register")
async def register(req: RegisterRequest):
    existing = await User.find_one(User.email == req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    user = User(
        name=req.name,
        email=req.email,
        hashed_password=hash_password(req.password),
        goal="",
        background="",
        created_at=datetime.utcnow(),
    )
    await user.insert()

    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = await authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Rehydrate the current user from their JWT token."""
    return _user_response(current_user)
