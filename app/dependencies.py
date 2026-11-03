"""FastAPI dependency: extract current user from Bearer token."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.auth import decode_token
from app.database import get_db
from app.schemas import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    db = get_db()
    user = await db.users.find_one({"email": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_engineer(current_user=Depends(get_current_user)):
    if current_user.get("role") not in (UserRole.admin, UserRole.engineer):
        raise HTTPException(status_code=403, detail="Engineer or Admin access required")
    return current_user
