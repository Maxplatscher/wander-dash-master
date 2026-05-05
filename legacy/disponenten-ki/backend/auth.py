"""JWT Auth & Role-Checks. Rollen: admin (alles), dispatcher (eigene Company), driver (eigene Tour)."""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import List, Optional

# Sicherheits-Standard: Auth ist IMMER aktiv, außer explizit deaktiviert.
# Entwicklungsmodus (kein Login): EASYPLAN_DEV=1 setzen.
# Legacy-Fallback: EASYPLAN_REQUIRE_AUTH=0 deaktiviert ebenfalls die Auth (rückwärtskompatibel).
_dev_mode = os.environ.get("EASYPLAN_DEV", "").strip().lower() in ("1", "true", "yes")
_legacy_no_auth = os.environ.get("EASYPLAN_REQUIRE_AUTH", "1").strip().lower() in ("0", "false", "no")
DEV_NO_AUTH = _dev_mode or _legacy_no_auth

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import SessionLocal
from models import User, ROLE_ADMIN, ROLE_DISPATCHER, ROLE_DRIVER

# Konfiguration (in Produktion aus Umgebungsvariablen)
# Unterstuetzt auch JWT_SECRET_KEY als Alias.
SECRET_KEY = os.environ.get(
    "JWT_SECRET",
    os.environ.get("JWT_SECRET_KEY", "easy-planning-dev-secret-change-in-production"),
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 h

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)


def _to_bcrypt_input(plain: str) -> str:
    """Passwort für Bcrypt vorbereiten: SHA256-Hash (64 Hex-Zeichen), um das 72-Byte-Limit zu umgehen."""
    if not isinstance(plain, str):
        plain = str(plain)
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_to_bcrypt_input(plain), hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(_to_bcrypt_input(plain))


def create_access_token(sub: str, role: str, company_id: Optional[uuid.UUID] = None, driver_id: Optional[uuid.UUID] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": sub,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    if company_id:
        payload["company_id"] = str(company_id)
    if driver_id:
        payload["driver_id"] = str(driver_id)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Liefert User wenn gültiger Token, sonst None (für optionale Auth)."""
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    user_id = payload.get("sub")
    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return None
    user = db.get(User, uid)
    if not user or not user.is_active:
        return None
    return user


def _dev_admin_user() -> User:
    """Fake-Admin für Entwicklungsmodus (kein DB-User)."""
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="dev@local",
        role=ROLE_ADMIN,
        company_id=None,
        driver_id=None,
        is_active=True,
    )


async def get_current_user_required(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Erzwingt eingeloggten User; sonst 401. Bei EASYPLAN_DEV=1: ohne Login als Admin durchlassen."""
    if user:
        return user
    if DEV_NO_AUTH:
        return _dev_admin_user()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nicht angemeldet. Bitte einloggen.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_roles(allowed: List[str]):
    """Dependency: User muss eine der Rollen haben."""

    async def _check(current: User = Depends(get_current_user_required)) -> User:
        if current.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rolle '{current.role}' nicht erlaubt. Erforderlich: {allowed}",
            )
        return current

    return _check


def require_company_access(company_id: uuid.UUID):
    """Dependency: User muss Admin sein oder dieselbe company_id haben."""

    async def _check(current: User = Depends(get_current_user_required)) -> User:
        if current.role == ROLE_ADMIN:
            return current
        if current.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kein Zugriff auf diesen Mandanten.",
            )
        return current

    return _check
