"""Auth router: register, login, me."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from bson import ObjectId
from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.schemas import UserCreate, UserLogin, Token, UserOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(u: dict) -> UserOut:
    return UserOut(
        id=str(u["_id"]),
        name=u["name"],
        email=u["email"],
        role=u["role"],
        employee_id=u.get("employee_id"),
        department=u.get("department"),
        created_at=u.get("created_at", datetime.now(timezone.utc)),
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate):
    db = get_db()
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")
    now = datetime.now(timezone.utc)
    doc = {
        "name": body.name,
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "role": body.role,
        "employee_id": body.employee_id,
        "department": body.department,
        "created_at": now,
        "is_active": True,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token({"sub": body.email, "role": body.role})
    return Token(access_token=token, user=_user_out(doc))


@router.post("/login", response_model=Token)
async def login(body: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return Token(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Update own profile (name, employee_id, department only)."""
    db = get_db()
    allowed = {k: v for k, v in body.items() if k in ("name", "employee_id", "department")}
    if not allowed:
        raise HTTPException(400, "No updatable fields provided")
    from bson import ObjectId as _OID
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": allowed})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return _user_out(updated)


@router.get("/users", response_model=list[UserOut])
async def list_users(current_user=Depends(get_current_user)):
    """Admin only: list all users."""
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    db = get_db()
    users = await db.users.find({}).to_list(200)
    return [_user_out(u) for u in users]
