"""Authentication utilities: password hashing, JWT tokens."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib, secrets, hmac
from jose import JWTError, jwt
from app.config import settings

# Use PBKDF2-SHA256 + random salt (avoids passlib/bcrypt 5.0 compat issues)
_SEP = "$pbkdf2$"
_ITERS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERS).hex()
    return f"{_SEP}{salt}${h}"


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed.startswith(_SEP):
        return False
    try:
        rest = hashed[len(_SEP):]
        salt, stored = rest.split("$", 1)
    except ValueError:
        return False
    h = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITERS).hex()
    return hmac.compare_digest(h, stored)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
