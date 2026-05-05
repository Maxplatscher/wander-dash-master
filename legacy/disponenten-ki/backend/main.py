from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import case, func, select, text, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from auth import (
    DEV_NO_AUTH,
    create_access_token,
    get_current_user_optional,
    get_current_user_required,
    hash_password,
    require_company_access,
    require_roles,
)
from db import Base, SessionLocal, engine
from models import (
    Company,
    Driver,
    EmailLog,
    PlanRun,
    PlanVersion,
    ROLE_ADMIN,
    ROLE_DISPATCHER,
    ROLE_DRIVER,
    Shipment,
    Tour,
    TourStop,
    User,
    Vehicle,
)
from eta_provider import get_current_provider, get_travel_matrix
from optimizer import optimize_routes
from version_deltas import (
    cache_get,
    cache_set,
    compare_adjacent_versions,
    thresholds_from_env,
)
from routers import calendar as calendar_router
from core.request_logging import RequestLoggingMiddleware


APP_STARTED_AT = time.time()

# Fester Depot-/Tourstart: Wipshausen (31234 Edemissen), Rathausring 10
# Speicherung als lon/lat * 10_000, damit bestehende int-Felder genutzt werden koennen.
DEPOT_X = 103533  # lon 10.3533
DEPOT_Y = 523883  # lat 52.3883


# --------------------------------------------------
# App
# --------------------------------------------------


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    from services.email_intake_config import config_is_runnable, load_email_intake_config
    from services.email_poller import poll_once

    task: asyncio.Task | None = None
    cfg = load_email_intake_config()
    if config_is_runnable(cfg):
        interval_s = max(30.0, cfg.poll_interval_ms / 1000.0)

        async def _email_poll_loop() -> None:
            while True:
                try:
                    await asyncio.to_thread(poll_once, None, DEPOT_X, DEPOT_Y)
                except Exception as ex:
                    print("[email-poller]", ex, file=sys.stderr)
                await asyncio.sleep(interval_s)

        task = asyncio.create_task(_email_poll_loop())
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Disponenten KI API", version="0.1.0", lifespan=_app_lifespan)

app.add_middleware(RequestLoggingMiddleware)

app.include_router(calendar_router.router)


@app.exception_handler(Exception)
def log_unhandled_exception(request: Request, exc: Exception):
    """Bei jedem unbehandelten Fehler: Traceback ins Terminal, dann 500 mit Meldung."""
    if isinstance(exc, HTTPException):
        raise exc
    tb = traceback.format_exc()
    print("\n" + "=" * 60 + "\n[500] Unbehandelte Exception:\n" + tb + "=" * 60 + "\n")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Siehe Server-Konsole (Terminal) für Traceback."},
    )


# --------------------------------------------------
# Database Setup
# --------------------------------------------------

try:
    Base.metadata.create_all(bind=engine)
except OperationalError as e:
    url_hint = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://easy:easy@localhost:5432/easyplanning (Standard)",
    )
    print("\n" + "=" * 64, file=sys.stderr)
    print("FEHLER: PostgreSQL ist nicht erreichbar.", file=sys.stderr)
    print("", file=sys.stderr)
    print("  Erwartet wird eine laufende Datenbank auf Port 5432.", file=sys.stderr)
    print("  Typischer Fix (Projektroot):", file=sys.stderr)
    print("    1) Docker Desktop starten und warten bis es bereit ist", file=sys.stderr)
    print("    2) docker compose up -d db", file=sys.stderr)
    print("    3) Uvicorn erneut starten", file=sys.stderr)
    print("", file=sys.stderr)
    print("  DATABASE_URL:", url_hint, file=sys.stderr)
    print("  Details siehe DEPLOYMENT.md", file=sys.stderr)
    print("=" * 64 + "\n", file=sys.stderr)
    raise SystemExit(1) from e


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# Frontend (optional)
# --------------------------------------------------

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    """Verhindert 404 im Browser-Log."""
    return Response(status_code=204)


@app.get("/")
def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={"Cache-Control": "no-store, max-age=0, must-revalidate"},
        )
    return JSONResponse(
        {
            "message": "Frontend not found yet. Create 'frontend/index.html' in the project root.",
            "swagger": "http://127.0.0.1:8000/docs",
            "health": "http://127.0.0.1:8000/health",
        }
    )


# --------------------------------------------------
# Health
# --------------------------------------------------

@app.get("/health")
def health():
    """Liveness/Readiness: DB, IMAP-Poller-Zustand, Version, Uptime."""
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    imap_status = "unknown"
    try:
        from services.email_poller import get_poller_state

        st = get_poller_state()
        cf = int(st.get("consecutive_failures") or 0)
        imap_status = "ok" if cf < 3 else "degraded"
    except Exception:
        imap_status = "unknown"
    overall = "ok"
    if db_status != "ok":
        overall = "degraded"
    return {
        "status": overall,
        "db": db_status,
        "imap": imap_status,
        "version": "0.1.0",
        "uptime_seconds": int(time.time() - APP_STARTED_AT),
    }


@app.get("/auth/status")
def auth_status():
    """Öffentlich. Bei EASYPLAN_DEV=1: require_auth=false → Frontend zeigt kein Login."""
    return {"require_auth": not DEV_NO_AUTH}


# --------------------------------------------------
# Auth & Users
# --------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    company_id: Optional[uuid.UUID] = None
    driver_id: Optional[uuid.UUID] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = ROLE_DISPATCHER
    company_id: Optional[uuid.UUID] = None
    driver_id: Optional[uuid.UUID] = None


@app.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login per E-Mail + Passwort. Liefert JWT und User-Info."""
    stmt = select(User).where(User.email == body.email.strip().lower())
    user = db.execute(stmt).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort ungültig.")
    from auth import verify_password
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort ungültig.")
    token = create_access_token(
        str(user.id), user.role, user.company_id, user.driver_id
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }


@app.get("/auth/me", response_model=UserOut)
def auth_me(current: User = Depends(get_current_user_required)):
    return current


@app.post("/auth/register", response_model=UserOut)
def register(body: UserCreate, db: Session = Depends(get_db)):
    """Ersten User anlegen (nur wenn noch keine User existieren). Sonst 403."""
    from auth import verify_password
    n = len(db.execute(select(User)).scalars().all())
    if n > 0:
        raise HTTPException(status_code=403, detail="Registrierung deaktiviert. Bereits User vorhanden.")
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="E-Mail und Passwort erforderlich.")
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="E-Mail bereits vergeben.")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=body.role or ROLE_ADMIN,
        company_id=body.company_id,
        driver_id=body.driver_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/users", response_model=UserOut)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    """Neuen User anlegen (nur Admin)."""
    if current.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Nur Admin darf User anlegen.")
    email = body.email.strip().lower()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="E-Mail bereits vergeben.")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=body.role or ROLE_DISPATCHER,
        company_id=body.company_id,
        driver_id=body.driver_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------
# Companies
# --------------------------------------------------


class CompanyCreate(BaseModel):
    name: str


class CompanyOut(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


@app.post("/companies", response_model=CompanyOut)
def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles([ROLE_ADMIN])),
):
    try:
        db_company = Company(name=company.name)
        db.add(db_company)
        db.commit()
        db.refresh(db_company)
        return db_company
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Eine Company mit diesem Namen existiert bereits.",
        )


@app.get("/companies", response_model=List[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    result = db.execute(select(Company)).scalars().all()
    if current.role != ROLE_ADMIN:
        result = [c for c in result if c.id == current.company_id]
    return result


# --------------------------------------------------
# Vehicles
# --------------------------------------------------


class VehicleCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    capacity: int


class VehicleOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    capacity: int

    model_config = ConfigDict(from_attributes=True)


def _require_company(current: User, company_id: uuid.UUID) -> None:
    if current.role == ROLE_ADMIN:
        return
    if current.company_id != company_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Mandanten.")


@app.post("/vehicles", response_model=VehicleOut)
def create_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, vehicle.company_id)
    db_vehicle = Vehicle(
        company_id=vehicle.company_id,
        name=vehicle.name,
        capacity=vehicle.capacity,
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


@app.get("/vehicles", response_model=List[VehicleOut])
def list_vehicles(
    company_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    stmt = select(Vehicle)
    if company_id is not None:
        _require_company(current, company_id)
        stmt = stmt.where(Vehicle.company_id == company_id)
    elif current.role != ROLE_ADMIN:
        stmt = stmt.where(Vehicle.company_id == current.company_id)
    result = db.execute(stmt).scalars().all()
    return result


@app.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    _require_company(current, v.company_id)
    return v


class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None


@app.patch("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: uuid.UUID,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    _require_company(current, v.company_id)
    if body.name is not None:
        v.name = body.name
    if body.capacity is not None:
        v.capacity = body.capacity
    db.commit()
    db.refresh(v)
    return v


@app.delete("/vehicles/{vehicle_id}")
def delete_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    _require_company(current, v.company_id)
    db.delete(v)
    db.commit()
    return {"ok": True}


# --------------------------------------------------
# Shipments
# --------------------------------------------------


class ShipmentCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    demand: int
    location_x: int
    location_y: int
    window_start: int
    window_end: int
    service_date: Optional[date] = None


class ShipmentOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    demand: int
    location_x: int
    location_y: int
    window_start: int
    window_end: int
    service_date: Optional[date] = None
    intake_source: Optional[str] = None
    intake_status: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    email_notes: Optional[str] = None
    seller_email: Optional[str] = None
    positionen: Optional[List[Any]] = None
    weight_kg: Optional[int] = None
    missing_fields: Optional[List[Any]] = None
    email_received_at: Optional[datetime] = None
    email_processed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@app.post("/shipments", response_model=ShipmentOut)
def create_shipment(
    shipment: ShipmentCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, shipment.company_id)
    db_shipment = Shipment(
        company_id=shipment.company_id,
        name=shipment.name,
        demand=shipment.demand,
        location_x=shipment.location_x,
        location_y=shipment.location_y,
        window_start=shipment.window_start,
        window_end=shipment.window_end,
        service_date=shipment.service_date,
    )
    db.add(db_shipment)
    db.commit()
    db.refresh(db_shipment)
    return db_shipment


class ShipmentFreigabeIn(BaseModel):
    """Pflichtfelder für Freigabe; nur gesetzte Felder überschreiben."""

    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    requested_date: Optional[date] = None
    weight_kg: Optional[int] = None
    positionen: Optional[List[Any]] = None
    email_notes: Optional[str] = None


@app.patch("/shipments/{shipment_id}/freigabe", response_model=ShipmentOut)
def release_shipment_for_planning(
    shipment_id: uuid.UUID,
    body: ShipmentFreigabeIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    from services.email_confirm import format_release_mail, send_intake_confirmation
    from services.email_intake_config import load_email_intake_config
    from services.lieferschein_validation import (
        shipment_row_to_validation_dict,
        validate_shipment_for_release,
    )

    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    _require_company(current, s.company_id)
    if s.intake_source != "email":
        raise HTTPException(
            status_code=400,
            detail="Freigabe nur für Sendungen aus E-Mail-Eingang (intake_source=email).",
        )
    if s.intake_status not in ("unvollständig", "manuell_prüfen"):
        raise HTTPException(
            status_code=400,
            detail="Sendung ist nicht in der Freigabe-Warteschlange.",
        )

    data = body.model_dump(exclude_unset=True)
    if "requested_date" in data:
        s.service_date = data.pop("requested_date")
    for k, v in data.items():
        setattr(s, k, v)

    d = shipment_row_to_validation_dict(s)
    d["requested_date"] = s.service_date
    missing = validate_shipment_for_release(d)
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"missing_fields": missing, "message": "Pflichtfelder unvollständig."},
        )

    now = datetime.now(timezone.utc)
    s.intake_status = None
    s.missing_fields = []
    s.released_at = now
    s.released_by = (current.email or "dispatcher")[:255]

    db.commit()
    db.refresh(s)

    cfg = load_email_intake_config()
    if s.seller_email and cfg.confirm_enabled:
        try:
            cust = (s.customer_name or s.name or "")[:200]
            sd = str(s.service_date or "")
            disp = s.released_by or current.email or "Disposition"
            supplemented: list[str] = []
            if body.customer_name is not None:
                supplemented.append("Kundenname")
            if body.delivery_address is not None:
                supplemented.append("Lieferadresse")
            if body.requested_date is not None:
                supplemented.append("Wunschtermin")
            if body.weight_kg is not None:
                supplemented.append("Gewicht")
            if body.positionen is not None:
                supplemented.append("Artikelpositionen")
            if body.email_notes is not None:
                supplemented.append("Bemerkungen")
            subj, txt = format_release_mail(cust, sd, disp, supplemented)
            send_intake_confirmation(cfg, s.seller_email, subj, txt)
        except Exception:
            pass

    return s


@app.get("/shipments", response_model=List[ShipmentOut])
def list_shipments(
    company_id: Optional[uuid.UUID] = None,
    date_filter: Optional[date] = Query(None, alias="date"),
    intake_incomplete: bool = Query(
        False,
        description="Nur Sendungen mit E-Mail-Eingang unvollständig / manuell prüfen",
    ),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    stmt = select(Shipment)
    if company_id is not None:
        _require_company(current, company_id)
        stmt = stmt.where(Shipment.company_id == company_id)
    elif current.role != ROLE_ADMIN:
        stmt = stmt.where(Shipment.company_id == current.company_id)
    if intake_incomplete:
        stmt = stmt.where(
            Shipment.intake_status.in_(["unvollständig", "manuell_prüfen"])
        )
        if date_filter is not None:
            stmt = stmt.where(Shipment.service_date == date_filter)
        stmt = stmt.order_by(
            case((Shipment.intake_status == "manuell_prüfen", 0), else_=1),
            Shipment.email_received_at.asc().nulls_last(),
        )
    elif date_filter is not None:
        stmt = stmt.where(
            (Shipment.service_date == date_filter) | (Shipment.service_date.is_(None))
        )
    result = db.execute(stmt).scalars().all()
    return result


@app.get("/shipments/{shipment_id}", response_model=ShipmentOut)
def get_shipment(
    shipment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    _require_company(current, s.company_id)
    return s


class ShipmentUpdate(BaseModel):
    name: Optional[str] = None
    demand: Optional[int] = None
    location_x: Optional[int] = None
    location_y: Optional[int] = None
    window_start: Optional[int] = None
    window_end: Optional[int] = None
    service_date: Optional[date] = None
    intake_source: Optional[str] = None
    intake_status: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    email_notes: Optional[str] = None
    missing_fields: Optional[List[Any]] = None
    weight_kg: Optional[int] = None
    positionen: Optional[List[Any]] = None


@app.patch("/shipments/{shipment_id}", response_model=ShipmentOut)
def update_shipment(
    shipment_id: uuid.UUID,
    body: ShipmentUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    _require_company(current, s.company_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@app.delete("/shipments/{shipment_id}")
def delete_shipment(
    shipment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    s = db.get(Shipment, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    _require_company(current, s.company_id)
    try:
        db.delete(s)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Sendung ist noch einer Tour zugeordnet und kann nicht gelöscht werden.",
        )
    return {"ok": True}


# --------------------------------------------------
# E-Mail-Eingang Lieferschein (Block 12)
# --------------------------------------------------


@app.get("/email-intake/status")
def email_intake_status(
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    from services.email_intake_config import config_is_runnable, load_email_intake_config
    from services.email_poller import get_poller_state

    cfg = load_email_intake_config()
    st = get_poller_state()
    return {
        "config_enabled": cfg.enabled,
        "runnable": config_is_runnable(cfg),
        "poll_interval_ms": cfg.poll_interval_ms,
        **st,
    }


@app.post("/email-intake/poll-now")
def email_intake_poll_now(
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    from services.email_intake_config import config_is_runnable, load_email_intake_config
    from services.email_poller import poll_once

    cfg = load_email_intake_config()
    if not config_is_runnable(cfg):
        raise HTTPException(
            status_code=400,
            detail="E-Mail-Poller nicht konfiguriert (EMAIL_IMAP_ENABLED, Zugangsdaten, EMAIL_DEFAULT_COMPANY_ID).",
        )
    try:
        poll_once(cfg, DEPOT_X, DEPOT_Y)
    except Exception as ex:
        raise HTTPException(status_code=502, detail=str(ex)) from ex
    return {"ok": True}


@app.get("/email-intake/logs", response_model=List[dict])
def email_intake_logs(
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    rows = (
        db.execute(select(EmailLog).order_by(EmailLog.created_at.desc()).limit(limit))
        .scalars()
        .all()
    )
    out = []
    for r in rows:
        out.append(
            {
                "id": str(r.id),
                "message_id": r.message_id,
                "subject": r.subject,
                "from_addr": r.from_addr,
                "status": r.status,
                "error_detail": r.error_detail,
                "shipment_id": str(r.shipment_id) if r.shipment_id else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "processed_at": r.processed_at.isoformat() if r.processed_at else None,
            }
        )
    return out


# --------------------------------------------------
# Drivers
# --------------------------------------------------


class DriverCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    phone: Optional[str] = None
    status: str = "available"
    shift_start: int
    shift_end: int


class DriverOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    phone: Optional[str] = None
    status: str
    shift_start: int
    shift_end: int

    model_config = ConfigDict(from_attributes=True)


@app.post("/drivers", response_model=DriverOut)
def create_driver(
    driver: DriverCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, driver.company_id)
    db_driver = Driver(
        company_id=driver.company_id,
        name=driver.name,
        phone=driver.phone,
        status=driver.status,
        shift_start=driver.shift_start,
        shift_end=driver.shift_end,
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver


@app.get("/drivers", response_model=List[DriverOut])
def list_drivers(
    company_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    stmt = select(Driver)
    if company_id is not None:
        _require_company(current, company_id)
        stmt = stmt.where(Driver.company_id == company_id)
    elif current.role != ROLE_ADMIN:
        stmt = stmt.where(Driver.company_id == current.company_id)
    return db.execute(stmt).scalars().all()


@app.get("/drivers/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    d = db.get(Driver, driver_id)
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    _require_company(current, d.company_id)
    return d


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    shift_start: Optional[int] = None
    shift_end: Optional[int] = None


@app.patch("/drivers/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: uuid.UUID,
    body: DriverUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    d = db.get(Driver, driver_id)
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    _require_company(current, d.company_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@app.delete("/drivers/{driver_id}")
def delete_driver(
    driver_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    d = db.get(Driver, driver_id)
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    _require_company(current, d.company_id)
    db.delete(d)
    db.commit()
    return {"ok": True}


# --------------------------------------------------
# OR-Tools Optimization
# --------------------------------------------------


class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]]
    demands: List[int]
    vehicle_capacities: List[int]
    time_windows: List[List[int]]  # [[start, end], ...] für jede Location
    num_vehicles: int
    depot: int


class RouteResult(BaseModel):
    vehicle_id: int
    route: List[int]
    arrival_times: List[int]
    cost: int


class OptimizationResult(BaseModel):
    routes: List[RouteResult]
    total_cost: int
    unassigned: List[int]


@app.post("/optimize", response_model=OptimizationResult)
def optimize(
    data: OptimizationRequest,
    current: User = Depends(get_current_user_required),
):
    result = optimize_routes(
        distance_matrix=data.distance_matrix,
        demands=data.demands,
        vehicle_capacities=data.vehicle_capacities,
        time_windows=data.time_windows,
        num_vehicles=data.num_vehicles,
        depot=data.depot,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# --------------------------------------------------
# Company-level Planning (DB → Optimizer → DB)
# --------------------------------------------------


class PlannedStop(BaseModel):
    stop_index: int
    shipment_id: Optional[uuid.UUID]
    arrival_time: int


class PlannedRoute(BaseModel):
    vehicle_id: uuid.UUID
    stops: List[PlannedStop]
    cost: int


class PlanRequest(BaseModel):
    """Optional Replan-Constraints: Locked Shipments müssen eingeplant bleiben, Preassigned fixiert Shipment → Fahrzeug."""

    date: Optional[date] = None
    locked_shipment_ids: List[uuid.UUID] = []
    preassigned: Optional[Dict[str, str]] = None  # shipment_id (str) -> vehicle_id (str), UUIDs als String
    auto_activate: bool = False  # wenn True: neue Tour-Version wird direkt als aktiv gesetzt

    @field_validator("date", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class PlanTourResult(BaseModel):
    tour_id: uuid.UUID
    company_id: uuid.UUID
    date: date
    version: int
    is_active: bool
    total_cost: Optional[int] = None  # kann bei Edge-Cases None sein
    routes: List[PlannedRoute]
    unassigned_shipments: List[uuid.UUID]
    locked_applied: bool = True
    conflicts: List[str] = []


def _parse_plan_body(body: Optional[dict]) -> tuple[date, bool, List[uuid.UUID], Optional[Dict[str, str]]]:
    """Body-Dict in Plan-Parameter umwandeln, ohne Pydantic (vermeidet 422)."""
    if not body or not isinstance(body, dict):
        return date.today(), False, [], None
    try:
        plan_date = date.today()
        if body.get("date"):
            s = str(body["date"]).strip()
            if s and len(s) >= 10:
                plan_date = date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        plan_date = date.today()
    auto_activate = bool(body.get("auto_activate", False))
    locked = []
    for sid in body.get("locked_shipment_ids") or []:
        try:
            locked.append(uuid.UUID(sid) if isinstance(sid, str) else sid)
        except (ValueError, TypeError):
            pass
    preassigned = body.get("preassigned")
    if preassigned is not None and not isinstance(preassigned, dict):
        preassigned = None
    return plan_date, auto_activate, locked, preassigned


@app.post("/companies/{company_id}/plan", response_model=PlanTourResult)
async def plan_company_tour(
    company_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    body = None
    try:
        raw = await request.body()
        if raw:
            body = json.loads(raw)
    except Exception:
        pass
    _require_company(current, company_id)
    vehicles: List[Vehicle] = (
        db.execute(select(Vehicle).where(Vehicle.company_id == company_id))
        .scalars()
        .all()
    )
    shipments: List[Shipment] = (
        db.execute(select(Shipment).where(Shipment.company_id == company_id))
        .scalars()
        .all()
    )

    if not vehicles:
        raise HTTPException(status_code=400, detail="No vehicles for this company")

    if not shipments:
        raise HTTPException(status_code=400, detail="No shipments for this company")

    plan_date, auto_activate, locked_shipment_ids, preassigned = _parse_plan_body(body)

    # Filter shipments by service_date if set
    shipments = [s for s in shipments if s.service_date is None or s.service_date == plan_date]
    # E-Mail-Eingang: unvollständig / manuell nicht planen
    shipments = [
        s
        for s in shipments
        if (s.intake_status is None or s.intake_status not in ("unvollständig", "manuell_prüfen"))
    ]
    if not shipments:
        raise HTTPException(
            status_code=400,
            detail=f"No shipments for company on {plan_date} (service_date filter)",
        )
    shipment_ids = [s.id for s in shipments]
    vehicle_ids = [v.id for v in vehicles]

    locked_node_indices: List[int] = []
    for sid in locked_shipment_ids:
        try:
            i = shipment_ids.index(sid)
            locked_node_indices.append(i + 1)  # Node-Index 1-based (0 = Depot)
        except ValueError:
            pass  # Shipment nicht in dieser Company, ignorieren

    preassigned_node_to_vehicle: Dict[int, int] = {}
    for sid_str, vid_str in (preassigned or {}).items():
        try:
            sid = uuid.UUID(sid_str)
            vid = uuid.UUID(vid_str)
            ni = shipment_ids.index(sid)
            vi = vehicle_ids.index(vid)
            preassigned_node_to_vehicle[ni + 1] = vi
        except (ValueError, TypeError):
            pass

    num_locations = len(shipments) + 1  # +1 für Depot an Index 0
    coords: List[tuple[int, int]] = [(DEPOT_X, DEPOT_Y)]  # Depot (Wipshausen)
    for s in shipments:
        coords.append((s.location_x, s.location_y))
    distance_matrix: List[List[int]] = get_travel_matrix(coords)
    eta_provider_used = get_current_provider()

    demands: List[int] = [0] + [s.demand for s in shipments]
    vehicle_capacities: List[int] = [v.capacity for v in vehicles]
    time_windows: List[List[int]] = (
        [[0, 600]] + [[s.window_start, s.window_end] for s in shipments]
    )

    optimization_result = optimize_routes(
        distance_matrix=distance_matrix,
        demands=demands,
        vehicle_capacities=vehicle_capacities,
        time_windows=time_windows,
        num_vehicles=len(vehicles),
        depot=0,
        locked_node_indices=locked_node_indices if locked_node_indices else None,
        preassigned_node_to_vehicle=preassigned_node_to_vehicle or None,
    )

    if "error" in optimization_result:
        conflicts = optimization_result.get("conflicts") or []
        plan_run = PlanRun(
            company_id=company_id,
            status="error",
            input_snapshot={
                "eta_provider": eta_provider_used,
                "demands": demands,
                "vehicle_capacities": vehicle_capacities,
                "time_windows": time_windows,
                "num_vehicles": len(vehicles),
                "locked_shipment_ids": [str(s) for s in locked_shipment_ids],
                "preassigned": preassigned,
            },
            result_snapshot={
                "error": optimization_result["error"],
                "conflicts": conflicts,
            },
        )
        db.add(plan_run)
        db.commit()
        detail = optimization_result["error"]
        if conflicts:
            detail = {"message": detail, "conflicts": conflicts}
        raise HTTPException(status_code=400, detail=detail)

    current_max_version = db.execute(
        select(func.max(Tour.version)).where(
            Tour.company_id == company_id,
            Tour.date == plan_date,
        )
    ).scalar()
    next_version = (current_max_version or 0) + 1

    tour = Tour(
        company_id=company_id,
        date=plan_date,
        version=next_version,
        is_active=False,
        total_cost=optimization_result["total_cost"],
        description="Auto-planned tour",
    )
    db.add(tour)
    db.flush()  # Tour-ID erhalten, bevor wir TourStops anlegen

    planned_routes: List[PlannedRoute] = []
    unassigned_shipments: List[uuid.UUID] = []

    for route_info in optimization_result["routes"]:
        vehicle_idx: int = route_info["vehicle_id"]
        vehicle = vehicles[vehicle_idx]
        route_nodes: List[int] = route_info["route"]
        arrival_times: List[int] = route_info.get(
            "arrival_times", [0] * len(route_nodes)
        )
        cost: int = route_info["cost"]

        planned_stops: List[PlannedStop] = []

        for stop_index, (node_idx, arrival) in enumerate(
            zip(route_nodes, arrival_times)
        ):
            shipment_id: Optional[uuid.UUID] = None
            if node_idx != 0:
                shipment_obj = shipments[node_idx - 1]
                shipment_id = shipment_obj.id

            tour_stop = TourStop(
                tour_id=tour.id,
                vehicle_id=vehicle.id,
                shipment_id=shipment_id,
                stop_index=stop_index,
                arrival_time=arrival,
            )
            db.add(tour_stop)

            planned_stops.append(
                PlannedStop(
                    stop_index=stop_index,
                    shipment_id=shipment_id,
                    arrival_time=arrival,
                )
            )

        planned_routes.append(
            PlannedRoute(
                vehicle_id=vehicle.id,
                stops=planned_stops,
                cost=cost,
            )
        )

    # Unassigned Knoten → zugehörige Shipment-UUIDs sammeln
    for node in optimization_result.get("unassigned", []):
        if 1 <= node <= len(shipments):
            unassigned_shipments.append(shipments[node - 1].id)

    locked_applied = optimization_result.get("locked_applied", True)
    conflicts = optimization_result.get("conflicts") or []

    plan_run = PlanRun(
        company_id=company_id,
        status="success",
        input_snapshot={
            "eta_provider": eta_provider_used,
            "demands": demands,
            "vehicle_capacities": vehicle_capacities,
            "time_windows": time_windows,
            "num_vehicles": len(vehicles),
            "locked_shipment_ids": [str(s) for s in locked_shipment_ids],
            "preassigned": preassigned,
        },
        result_snapshot={
            "tour_id": str(tour.id),
            "eta_provider": eta_provider_used,
            "total_cost": optimization_result["total_cost"],
            "unassigned_shipments": [str(sid) for sid in unassigned_shipments],
            "locked_applied": locked_applied,
            "conflicts": conflicts,
        },
    )
    db.add(plan_run)
    db.flush()
    tour.plan_run_id = plan_run.id

    plan_version = PlanVersion(
        company_id=company_id,
        date=plan_date,
        version=next_version,
        plan_run_id=plan_run.id,
        is_active=False,
        total_cost=optimization_result["total_cost"],
        description="Auto-planned tour",
    )
    db.add(plan_version)
    db.flush()
    tour.plan_version_id = plan_version.id

    # Auto-Activate Workflow: genau eine aktive Tour pro Company+Date
    if auto_activate:
        db.execute(
            update(Tour)
            .where(Tour.company_id == company_id, Tour.date == plan_date)
            .values(is_active=False)
        )
        db.execute(
            update(PlanVersion)
            .where(PlanVersion.company_id == company_id, PlanVersion.date == plan_date)
            .values(is_active=False)
        )
        tour.is_active = True
        plan_version.is_active = True

    db.commit()

    return PlanTourResult(
        tour_id=tour.id,
        company_id=company_id,
        date=tour.date,
        version=tour.version,
        is_active=tour.is_active,
        total_cost=optimization_result["total_cost"],
        routes=planned_routes,
        unassigned_shipments=unassigned_shipments,
        locked_applied=locked_applied,
        conflicts=conflicts,
    )


# --------------------------------------------------
# PlanRun Logging API
# --------------------------------------------------


class PlanRunListItem(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    created_at: datetime
    status: str
    total_cost: Optional[int] = None
    unassigned_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class PlanRunDetail(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    created_at: datetime
    status: str
    input_snapshot: dict | None
    result_snapshot: dict | None

    model_config = ConfigDict(from_attributes=True)


@app.get("/plan_runs", response_model=List[PlanRunListItem])
def list_plan_runs(
    company_id: Optional[uuid.UUID] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    stmt = select(PlanRun).order_by(PlanRun.created_at.desc())
    if company_id is not None:
        _require_company(current, company_id)
        stmt = stmt.where(PlanRun.company_id == company_id)
    elif current.role != ROLE_ADMIN:
        stmt = stmt.where(PlanRun.company_id == current.company_id)
    result: List[PlanRun] = db.execute(stmt.limit(limit)).scalars().all()

    items: List[PlanRunListItem] = []
    for run in result:
        total_cost = None
        unassigned_count = None
        if isinstance(run.result_snapshot, dict):
            total_cost = run.result_snapshot.get("total_cost")
            unassigned = run.result_snapshot.get("unassigned_shipments")
            if isinstance(unassigned, list):
                unassigned_count = len(unassigned)
        items.append(
            PlanRunListItem(
                id=run.id,
                company_id=run.company_id,
                created_at=run.created_at,
                status=run.status,
                total_cost=total_cost,
                unassigned_count=unassigned_count,
            )
        )
    return items


@app.get("/plan_runs/{plan_run_id}", response_model=PlanRunDetail)
def get_plan_run(
    plan_run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    run = db.get(PlanRun, plan_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="PlanRun not found")
    _require_company(current, run.company_id)
    return run


# --------------------------------------------------
# Tour Versioning API
# --------------------------------------------------


class TourSummary(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    date: date
    version: int
    is_active: bool
    total_cost: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlanVersionSummary(BaseModel):
    """Touren Plan – eine Planversion pro Mandant/Datum."""
    id: uuid.UUID
    company_id: uuid.UUID
    date: date
    version: int
    is_active: bool
    total_cost: Optional[int] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TourStopOut(BaseModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    shipment_id: Optional[uuid.UUID]
    stop_index: int
    arrival_time: int
    departure_time: Optional[int] = None
    segment_cost: Optional[int] = None
    driver_completed: bool = False
    driver_completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TourDetailOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    date: date
    version: int
    is_active: bool
    total_cost: Optional[int] = None
    created_at: datetime
    description: Optional[str] = None
    plan_run_id: Optional[uuid.UUID] = None
    stops: List[TourStopOut]


class DriverTourStopOut(BaseModel):
    tour_stop_id: uuid.UUID
    stop_index: int
    shipment_id: Optional[uuid.UUID] = None
    shipment_name: Optional[str] = None
    arrival_time: int
    location_x: Optional[int] = None
    location_y: Optional[int] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class DriverTourTodayOut(BaseModel):
    status: str
    status_label: str
    date: date
    driver_id: Optional[uuid.UUID] = None
    driver_name: Optional[str] = None
    driver_status: Optional[str] = None
    tour_id: Optional[uuid.UUID] = None
    tour_version: Optional[int] = None
    vehicle_id: Optional[uuid.UUID] = None
    vehicle_name: Optional[str] = None
    next_stop: Optional[DriverTourStopOut] = None
    remaining_stops: int = 0
    progress_completed: int = 0
    progress_total: int = 0
    stops: List[DriverTourStopOut] = []
    message: Optional[str] = None


class DispatcherVehicleProgressOut(BaseModel):
    """Fortschritt je Fahrzeug auf der aktiven Tour (Dispatcher-Leseansicht)."""

    vehicle_id: uuid.UUID
    vehicle_name: str
    customer_stops_total: int
    customer_stops_done: int
    customer_stops_open: int
    tour_complete: bool
    next_stop_tour_stop_id: Optional[uuid.UUID] = None
    next_stop_name: Optional[str] = None
    next_stop_arrival_time: Optional[int] = None


class DispatcherDriverBriefOut(BaseModel):
    driver_id: uuid.UUID
    name: str
    status: str


class DispatcherOperationsSnapshotOut(BaseModel):
    """Aggregierte operative Lage für Mandant + Datum (nur Admin/Dispatcher)."""

    date: date
    has_active_tour: bool
    active_tour_id: Optional[uuid.UUID] = None
    active_version: Optional[int] = None
    vehicles_deployed: int = 0
    customer_stops_total: int = 0
    customer_stops_done: int = 0
    customer_stops_open: int = 0
    progress_percent: int = 0
    vehicles: List[DispatcherVehicleProgressOut] = Field(default_factory=list)
    drivers: List[DispatcherDriverBriefOut] = Field(default_factory=list)


class VersionDeltaOut(BaseModel):
    version: int
    is_active: bool
    total_cost: Optional[int] = None
    unassigned_count: Optional[int] = None
    eta_span_minutes: Optional[int] = None
    cost_delta: Optional[int] = None
    unassigned_delta: Optional[int] = None
    eta_span_delta: Optional[int] = None
    changes: List[str] = Field(
        default_factory=list,
        description="Fachliche Delta-Hinweise (Kosten/Unassigned/Struktur/ETA ab Schwellen).",
    )
    quality_notes: List[str] = Field(
        default_factory=list,
        description="Hinweise bei fehlenden Vergleichsdaten oder eingeschränkter Vergleichbarkeit.",
    )
    compared_to_version: Optional[int] = Field(
        default=None,
        description="Vorgängerversion, gegen die differenziert wurde (falls vorhanden).",
    )
    created_at: datetime


@app.get("/companies/{company_id}/plan_versions", response_model=List[PlanVersionSummary])
def list_plan_versions(
    company_id: uuid.UUID,
    date_filter: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, company_id)
    stmt = select(PlanVersion).where(PlanVersion.company_id == company_id)
    if date_filter is not None:
        stmt = stmt.where(PlanVersion.date == date_filter)
    stmt = stmt.order_by(PlanVersion.date.desc(), PlanVersion.version.desc())
    return db.execute(stmt).scalars().all()


@app.get("/companies/{company_id}/tours", response_model=List[TourSummary])
def list_company_tours(
    company_id: uuid.UUID,
    date_filter: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, company_id)
    stmt = select(Tour).where(Tour.company_id == company_id)
    if date_filter is not None:
        stmt = stmt.where(Tour.date == date_filter)
    stmt = stmt.order_by(Tour.date.desc(), Tour.version.desc())
    tours = db.execute(stmt).scalars().all()
    return tours


@app.get("/companies/{company_id}/version_deltas", response_model=List[VersionDeltaOut])
def get_version_deltas(
    company_id: uuid.UUID,
    date_filter: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    _require_company(current, company_id)
    cache_key = f"{company_id}:{date_filter.isoformat()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    tours: List[Tour] = (
        db.execute(
            select(Tour)
            .where(Tour.company_id == company_id, Tour.date == date_filter)
            .order_by(Tour.version.desc(), Tour.created_at.desc())
        )
        .scalars()
        .all()
    )
    if not tours:
        return []

    thresholds = thresholds_from_env()

    by_version: Dict[int, List[Tour]] = {}
    for t in tours:
        by_version.setdefault(t.version, []).append(t)

    versions_sorted = sorted(by_version.keys(), reverse=True)
    snapshots: Dict[int, Dict[str, object]] = {}

    for v in versions_sorted:
        group = by_version[v]
        tour_ids = [t.id for t in group]
        stops = (
            db.execute(
                select(TourStop)
                .where(TourStop.tour_id.in_(tour_ids))
                .order_by(TourStop.stop_index)
            )
            .scalars()
            .all()
        )
        vehicle_seq: Dict[str, List[str]] = {}
        eta_min: Optional[int] = None
        eta_max: Optional[int] = None
        for s in stops:
            vid = str(s.vehicle_id)
            vehicle_seq.setdefault(vid, [])
            if s.shipment_id:
                vehicle_seq[vid].append(str(s.shipment_id))
            if s.arrival_time is not None:
                eta_min = s.arrival_time if eta_min is None else min(eta_min, s.arrival_time)
                eta_max = s.arrival_time if eta_max is None else max(eta_max, s.arrival_time)

        vehicle_keys = sorted(vehicle_seq.keys())
        order_signature = "|".join(
            f"{k}:{'>'.join(vehicle_seq.get(k, []))}" for k in vehicle_keys
        )
        eta_span = (eta_max - eta_min) if (eta_min is not None and eta_max is not None) else None

        first_with_run = next((t for t in group if t.plan_run_id), None)
        unassigned_count: Optional[int] = None
        if first_with_run and first_with_run.plan_run_id:
            pr = db.get(PlanRun, first_with_run.plan_run_id)
            arr = (pr.result_snapshot or {}).get("unassigned_shipments") if pr else None
            if isinstance(arr, list):
                unassigned_count = len(arr)

        snapshots[v] = {
            "is_active": any(t.is_active for t in group),
            "total_cost": group[0].total_cost,
            "created_at": group[0].created_at,
            "vehicle_signature": "|".join(vehicle_keys),
            "order_signature": order_signature,
            "eta_span": eta_span,
            "unassigned_count": unassigned_count,
        }

    result: List[VersionDeltaOut] = []
    for idx, v in enumerate(versions_sorted):
        cur = snapshots[v]
        prev = snapshots[versions_sorted[idx + 1]] if idx + 1 < len(versions_sorted) else None
        changes: List[str] = []
        quality_notes: List[str] = []
        cost_delta: Optional[int] = None
        unassigned_delta: Optional[int] = None
        eta_span_delta: Optional[int] = None
        compared_to: Optional[int] = None

        if prev:
            prev_v = versions_sorted[idx + 1]
            compared_to = prev_v
            changes, quality_notes, cost_delta, unassigned_delta, eta_span_delta = (
                compare_adjacent_versions(cur, prev, v, prev_v, thresholds)
            )
        else:
            quality_notes.append("Keine ältere Version zum Vergleich (älteste Version am Tag).")

        created_at = cur.get("created_at")
        result.append(
            VersionDeltaOut(
                version=v,
                is_active=bool(cur.get("is_active")),
                total_cost=cur.get("total_cost") if isinstance(cur.get("total_cost"), int) else None,
                unassigned_count=cur.get("unassigned_count")
                if isinstance(cur.get("unassigned_count"), int)
                else None,
                eta_span_minutes=cur.get("eta_span") if isinstance(cur.get("eta_span"), int) else None,
                cost_delta=cost_delta,
                unassigned_delta=unassigned_delta,
                eta_span_delta=eta_span_delta,
                changes=changes,
                quality_notes=quality_notes,
                compared_to_version=compared_to,
                created_at=created_at if isinstance(created_at, datetime) else datetime.utcnow(),
            )
        )

    cache_set(cache_key, result)
    return result


@app.get("/tours/{tour_id}", response_model=TourDetailOut)
def get_tour(
    tour_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    tour = db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    _require_company(current, tour.company_id)

    stops = (
        db.execute(
            select(TourStop).where(TourStop.tour_id == tour_id).order_by(TourStop.stop_index)
        )
        .scalars()
        .all()
    )

    return TourDetailOut(
        id=tour.id,
        company_id=tour.company_id,
        date=tour.date,
        version=tour.version,
        is_active=tour.is_active,
        total_cost=tour.total_cost,
        created_at=tour.created_at,
        description=tour.description,
        plan_run_id=tour.plan_run_id,
        stops=stops,
    )


@app.get(
    "/companies/{company_id}/dispatcher/operations_snapshot",
    response_model=DispatcherOperationsSnapshotOut,
)
def dispatcher_operations_snapshot(
    company_id: uuid.UUID,
    date_filter: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    """Lese-Endpoint: aktive Tour, Stopp-Fortschritt je Fahrzeug, Fahrer-Stammdaten-Status."""
    _require_company(current, company_id)

    driver_rows_db = (
        db.execute(
            select(Driver)
            .where(Driver.company_id == company_id)
            .order_by(Driver.name.asc())
        )
        .scalars()
        .all()
    )
    driver_rows = [
        DispatcherDriverBriefOut(driver_id=d.id, name=d.name, status=d.status)
        for d in driver_rows_db
    ]

    tour = (
        db.execute(
            select(Tour)
            .where(
                Tour.company_id == company_id,
                Tour.date == date_filter,
                Tour.is_active.is_(True),
            )
            .order_by(Tour.version.desc())
        )
        .scalars()
        .first()
    )

    if not tour:
        return DispatcherOperationsSnapshotOut(
            date=date_filter,
            has_active_tour=False,
            drivers=driver_rows,
        )

    stops: List[TourStop] = (
        db.execute(
            select(TourStop).where(TourStop.tour_id == tour.id).order_by(TourStop.stop_index)
        )
        .scalars()
        .all()
    )

    by_vehicle: Dict[uuid.UUID, List[TourStop]] = {}
    for s in stops:
        by_vehicle.setdefault(s.vehicle_id, []).append(s)

    vehicle_ids = list(by_vehicle.keys())
    vehicles_db: List[Vehicle] = []
    if vehicle_ids:
        vehicles_db = (
            db.execute(select(Vehicle).where(Vehicle.id.in_(vehicle_ids)))
            .scalars()
            .all()
        )
    vmap = {v.id: v for v in vehicles_db}

    shipment_ids = [s.shipment_id for s in stops if s.shipment_id is not None]
    ship_map: Dict[uuid.UUID, Shipment] = {}
    if shipment_ids:
        ship_rows = (
            db.execute(select(Shipment).where(Shipment.id.in_(shipment_ids)))
            .scalars()
            .all()
        )
        ship_map = {x.id: x for x in ship_rows}

    vehicle_rows: List[DispatcherVehicleProgressOut] = []
    total_cust = 0
    done_cust = 0

    for vid in sorted(by_vehicle.keys(), key=lambda x: str(x)):
        v_stops = by_vehicle[vid]
        cust = [x for x in v_stops if x.shipment_id is not None]
        n = len(cust)
        d_done = sum(1 for x in cust if bool(getattr(x, "driver_completed", False)))
        incomplete = [x for x in cust if not bool(getattr(x, "driver_completed", False))]
        incomplete.sort(key=lambda x: x.stop_index)
        next_s = incomplete[0] if incomplete else None
        next_name: Optional[str] = None
        next_aid: Optional[uuid.UUID] = None
        next_arr: Optional[int] = None
        if next_s is not None:
            sh = ship_map.get(next_s.shipment_id) if next_s.shipment_id else None
            next_name = sh.name if sh else None
            next_aid = next_s.id
            next_arr = next_s.arrival_time

        vn = vmap.get(vid)
        vehicle_rows.append(
            DispatcherVehicleProgressOut(
                vehicle_id=vid,
                vehicle_name=vn.name if vn else "Fahrzeug",
                customer_stops_total=n,
                customer_stops_done=d_done,
                customer_stops_open=max(0, n - d_done),
                tour_complete=n > 0 and d_done >= n,
                next_stop_tour_stop_id=next_aid,
                next_stop_name=next_name,
                next_stop_arrival_time=next_arr,
            )
        )
        total_cust += n
        done_cust += d_done

    pct = int(round(100.0 * done_cust / total_cust)) if total_cust > 0 else 0

    return DispatcherOperationsSnapshotOut(
        date=date_filter,
        has_active_tour=True,
        active_tour_id=tour.id,
        active_version=tour.version,
        vehicles_deployed=len(vehicle_rows),
        customer_stops_total=total_cust,
        customer_stops_done=done_cust,
        customer_stops_open=max(0, total_cust - done_cust),
        progress_percent=pct,
        vehicles=vehicle_rows,
        drivers=driver_rows,
    )


def _driver_tour_today_payload(
    db: Session,
    current: User,
    driver: Optional[Driver],
    tour: Tour,
    target_date: date,
) -> DriverTourTodayOut:
    """Baut die Fahrer-Tour-Antwort inkl. Fortschritt (Stopp erledigt)."""
    stops: List[TourStop] = (
        db.execute(
            select(TourStop).where(TourStop.tour_id == tour.id).order_by(TourStop.stop_index)
        )
        .scalars()
        .all()
    )
    if not stops:
        return DriverTourTodayOut(
            status="planned",
            status_label="Tour geplant",
            date=target_date,
            driver_id=current.driver_id,
            driver_name=driver.name if driver else None,
            driver_status=driver.status if driver else None,
            tour_id=tour.id,
            tour_version=tour.version,
            message="Tour aktiv, aber noch ohne Stops.",
        )

    vehicle_id = stops[0].vehicle_id
    vehicle = db.get(Vehicle, vehicle_id)
    vehicle_stops = [s for s in stops if s.vehicle_id == vehicle_id]
    shipment_ids = [s.shipment_id for s in vehicle_stops if s.shipment_id is not None]
    shipment_map: Dict[uuid.UUID, Shipment] = {}
    if shipment_ids:
        ship_rows = (
            db.execute(select(Shipment).where(Shipment.id.in_(shipment_ids)))
            .scalars()
            .all()
        )
        shipment_map = {s.id: s for s in ship_rows}

    stop_items: List[DriverTourStopOut] = []
    for s in vehicle_stops:
        shp = shipment_map.get(s.shipment_id) if s.shipment_id else None
        stop_items.append(
            DriverTourStopOut(
                tour_stop_id=s.id,
                stop_index=s.stop_index,
                shipment_id=s.shipment_id,
                shipment_name=shp.name if shp else ("Depot" if s.shipment_id is None else None),
                arrival_time=s.arrival_time,
                location_x=shp.location_x if shp else None,
                location_y=shp.location_y if shp else None,
                completed=bool(getattr(s, "driver_completed", False)),
                completed_at=getattr(s, "driver_completed_at", None),
            )
        )

    now = datetime.now()
    now_min = now.hour * 60 + now.minute
    service_stops = [s for s in stop_items if s.shipment_id is not None]
    progress_total = len(service_stops)
    progress_completed = sum(1 for s in service_stops if s.completed)

    # Nächster / aktiver Stopp: erste Kunden-Stopps ohne „erledigt“ (Reihenfolge)
    incomplete = [s for s in service_stops if not s.completed]
    next_stop = incomplete[0] if incomplete else None
    remaining = len(incomplete)

    if not service_stops:
        status = "planned"
        status_label = "Tour geplant"
    elif progress_completed >= progress_total and progress_total > 0:
        status = "completed"
        status_label = "Tour abgeschlossen"
    elif progress_completed == 0 and next_stop is not None and now_min < next_stop.arrival_time:
        status = "planned"
        status_label = "Tour geplant"
    else:
        status = "on_route"
        status_label = "Unterwegs"

    return DriverTourTodayOut(
        status=status,
        status_label=status_label,
        date=target_date,
        driver_id=current.driver_id,
        driver_name=driver.name if driver else None,
        driver_status=driver.status if driver else None,
        tour_id=tour.id,
        tour_version=tour.version,
        vehicle_id=vehicle_id,
        vehicle_name=vehicle.name if vehicle else None,
        next_stop=next_stop,
        remaining_stops=remaining,
        progress_completed=progress_completed,
        progress_total=progress_total,
        stops=stop_items,
        message=None,
    )


@app.get("/driver/me/tour-today", response_model=DriverTourTodayOut)
def get_driver_tour_today(
    for_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    if current.role != ROLE_DRIVER:
        raise HTTPException(status_code=403, detail="Nur fuer Rolle driver erlaubt")
    if not current.company_id:
        raise HTTPException(status_code=400, detail="Driver-User hat keine company_id")

    target_date = for_date or date.today()
    driver = db.get(Driver, current.driver_id) if current.driver_id else None

    tour = (
        db.execute(
            select(Tour)
            .where(
                Tour.company_id == current.company_id,
                Tour.date == target_date,
                Tour.is_active.is_(True),
            )
            .order_by(Tour.version.desc())
        )
        .scalars()
        .first()
    )
    if not tour:
        return DriverTourTodayOut(
            status="no_assignment",
            status_label="Kein Einsatz",
            date=target_date,
            driver_id=current.driver_id,
            driver_name=driver.name if driver else None,
            driver_status=driver.status if driver else None,
            message="Heute ist keine aktive Tour zugewiesen.",
        )

    return _driver_tour_today_payload(db, current, driver, tour, target_date)


class DriverMeStatusBody(BaseModel):
    """Einsatzstatus des Fahrers (frei wählbarer Kurztext, z. B. available / on_tour / pause)."""

    status: str


@app.patch("/driver/me", response_model=DriverOut)
def patch_driver_me(
    body: DriverMeStatusBody,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    if current.role != ROLE_DRIVER:
        raise HTTPException(status_code=403, detail="Nur fuer Rolle driver erlaubt")
    if not current.driver_id:
        raise HTTPException(status_code=400, detail="Driver-User ohne driver_id")
    d = db.get(Driver, current.driver_id)
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    _require_company(current, d.company_id)
    st = (body.status or "").strip()
    if not st or len(st) > 50:
        raise HTTPException(status_code=400, detail="status muss 1–50 Zeichen haben")
    d.status = st
    db.commit()
    db.refresh(d)
    return d


@app.post("/driver/me/tour-stops/{tour_stop_id}/complete", response_model=DriverTourTodayOut)
def complete_driver_tour_stop(
    tour_stop_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    if current.role != ROLE_DRIVER:
        raise HTTPException(status_code=403, detail="Nur fuer Rolle driver erlaubt")
    if not current.company_id or not current.driver_id:
        raise HTTPException(status_code=400, detail="Driver-User unvollständig")

    stop = db.get(TourStop, tour_stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="TourStop not found")
    if not stop.shipment_id:
        raise HTTPException(status_code=400, detail="Depot-Stopps können nicht abgehakt werden")
    tour = db.get(Tour, stop.tour_id)
    if not tour or tour.company_id != current.company_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Stopp")
    active_tour = (
        db.execute(
            select(Tour)
            .where(
                Tour.company_id == current.company_id,
                Tour.date == tour.date,
                Tour.is_active.is_(True),
            )
        )
        .scalars()
        .first()
    )
    if not active_tour or active_tour.id != tour.id:
        raise HTTPException(status_code=400, detail="Nur Stopps der aktiven Tour können bearbeitet werden")

    stop.driver_completed = True
    stop.driver_completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(stop)

    driver = db.get(Driver, current.driver_id)
    return _driver_tour_today_payload(db, current, driver, tour, tour.date)


@app.post("/driver/me/tour-stops/{tour_stop_id}/uncomplete", response_model=DriverTourTodayOut)
def uncomplete_driver_tour_stop(
    tour_stop_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    if current.role != ROLE_DRIVER:
        raise HTTPException(status_code=403, detail="Nur fuer Rolle driver erlaubt")
    if not current.company_id or not current.driver_id:
        raise HTTPException(status_code=400, detail="Driver-User unvollständig")

    stop = db.get(TourStop, tour_stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="TourStop not found")
    tour = db.get(Tour, stop.tour_id)
    if not tour or tour.company_id != current.company_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Stopp")
    active_tour = (
        db.execute(
            select(Tour)
            .where(
                Tour.company_id == current.company_id,
                Tour.date == tour.date,
                Tour.is_active.is_(True),
            )
        )
        .scalars()
        .first()
    )
    if not active_tour or active_tour.id != tour.id:
        raise HTTPException(status_code=400, detail="Nur Stopps der aktiven Tour können bearbeitet werden")

    stop.driver_completed = False
    stop.driver_completed_at = None
    db.commit()
    db.refresh(stop)

    driver = db.get(Driver, current.driver_id)
    return _driver_tour_today_payload(db, current, driver, tour, tour.date)


@app.post("/tours/{tour_id}/activate", response_model=TourDetailOut)
def activate_tour(
    tour_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
):
    tour = db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    _require_company(current, tour.company_id)

    db.execute(
        update(Tour)
        .where(Tour.company_id == tour.company_id, Tour.date == tour.date)
        .values(is_active=False)
    )
    db.execute(
        update(PlanVersion)
        .where(PlanVersion.company_id == tour.company_id, PlanVersion.date == tour.date)
        .values(is_active=False)
    )
    tour.is_active = True
    if tour.plan_version_id:
        pv = db.get(PlanVersion, tour.plan_version_id)
        if pv:
            pv.is_active = True
    db.commit()
    db.refresh(tour)

    stops = (
        db.execute(
            select(TourStop).where(TourStop.tour_id == tour_id).order_by(TourStop.stop_index)
        )
        .scalars()
        .all()
    )

    return TourDetailOut(
        id=tour.id,
        company_id=tour.company_id,
        date=tour.date,
        version=tour.version,
        is_active=tour.is_active,
        total_cost=tour.total_cost,
        created_at=tour.created_at,
        description=tour.description,
        plan_run_id=tour.plan_run_id,
        stops=stops,
    )


# --------------------------------------------------
# One-Click-Demo (Phase A)
# --------------------------------------------------


@app.post("/demo/one-click")
def one_click_demo(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_required),
    scenario: str = Query("stable", description="Demo-Szenario: stable|problem"),
):
    """Legt Demo-Mandant mit Fahrzeugen und Sendungen an. Frontend ruft danach Plan erstellen mit auto_activate auf.
    Kein Request-Body nötig (wird ignoriert, um 422 bei leerem Body zu vermeiden)."""
    from datetime import date as date_type
    today = date_type.today()
    name = "Easy Planning Demo"
    existing = db.execute(select(Company).where(Company.name == name)).scalars().all()
    if existing:
        company = existing[0]
    else:
        company = Company(name=name)
        db.add(company)
        db.flush()
    cid = company.id

    vehicles_existing = db.execute(select(Vehicle).where(Vehicle.company_id == cid)).scalars().all()
    if len(vehicles_existing) < 2:
        for i in range(2 - len(vehicles_existing)):
            v = Vehicle(company_id=cid, name=f"Transporter {i+1}", capacity=100)
            db.add(v)
        db.flush()

    # Demo-Sendungen deterministisch neu aufsetzen, ohne FK-Verletzungen:
    # - bestehende Rows werden aktualisiert (statt delete)
    # - fehlende Rows werden ergänzt
    # Koordinaten sind als lon/lat * 10_000 gespeichert (geo-encoded).
    sc = (scenario or "stable").strip().lower()
    if sc not in {"stable", "problem"}:
        raise HTTPException(status_code=400, detail="scenario muss 'stable' oder 'problem' sein.")

    demos = (
        [
            # Stabiler Tag: alles planbar, breite Fenster
            # Braunschweig (2 Kunden)
            ("Braunschweig Zentrum", 10, 105268, 522689, 360, 1020),
            ("Braunschweig Nord", 10, 105146, 522973, 360, 1020),
            # Magdeburg (1 Kunde)
            ("Magdeburg Mitte", 10, 116276, 521205, 360, 1020),
            # Goslar (2 Kunden)
            ("Goslar Altstadt", 10, 104270, 519059, 360, 1020),
            ("Goslar Nord", 10, 104234, 519267, 360, 1020),
        ]
        if sc == "stable"
        else [
            # Problemtag: mind. 1 Sendung absichtlich nicht einplanbar (Kapazität zu hoch)
            # plus ein extrem enges Zeitfenster, um die Lage "stressig" wirken zu lassen.
            ("Braunschweig Zentrum", 10, 105268, 522689, 360, 1020),
            ("Braunschweig Nord", 10, 105146, 522973, 360, 1020),
            ("Magdeburg Mitte", 10, 116276, 521205, 360, 1020),
            ("Goslar Altstadt", 10, 104270, 519059, 360, 1020),
            # unassigned: demand > capacity (Transporter 100)
            ("Nicht einplanbar (Überkapazität)", 120, 104234, 519267, 360, 1020),
            # sehr enges Fenster, ggf. Konfliktsignal je nach ETA/Plan
            ("Enges Zeitfenster", 10, 116276, 521205, 480, 485),
        ]
    )
    existing_shipments = (
        db.execute(select(Shipment).where(Shipment.company_id == cid).order_by(Shipment.id))
        .scalars()
        .all()
    )
    # Alle bestehenden Demo-Sendungen aus dem Tagesplan nehmen.
    for s in existing_shipments:
        s.service_date = None
    # Erste 5 bestehende aktualisieren, fehlende erzeugen.
    for i, (name_s, demand, x, y, w_start, w_end) in enumerate(demos):
        if i < len(existing_shipments):
            s = existing_shipments[i]
            s.name = name_s
            s.demand = demand
            s.location_x = x
            s.location_y = y
            s.window_start = w_start
            s.window_end = w_end
            s.service_date = today
        else:
            s = Shipment(
                company_id=cid,
                name=name_s,
                demand=demand,
                location_x=x,
                location_y=y,
                window_start=w_start,
                window_end=w_end,
                service_date=today,
            )
            db.add(s)
    db.commit()
    return {
        "company_id": str(cid),
        "date": today.isoformat(),
        "message": f"Demo-Daten ({'Stabiler Tag' if sc == 'stable' else 'Problemtag'}) angelegt. Klicke im Dashboard auf „Plan erstellen“ mit aktivierter Option „Auto aktivieren“.",
    }