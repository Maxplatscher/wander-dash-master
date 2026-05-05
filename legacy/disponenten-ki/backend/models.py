import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


# Rollen: admin = alle Mandanten, dispatcher = ein Mandant (company_id), driver = Fahrer (nur eigene Tour)
ROLE_ADMIN = "admin"
ROLE_DISPATCHER = "dispatcher"
ROLE_DRIVER = "driver"


class User(Base):
    __tablename__ = "users"  # "user" ist in PostgreSQL reserviert

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=True
    )  # null = Admin (alle Mandanten)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=ROLE_DISPATCHER)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("driver.id"), nullable=True
    )  # bei role=driver: zugehöriger Fahrer
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class Company(Base):
    __tablename__ = "company"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)


class Vehicle(Base):
    __tablename__ = "vehicle"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)


class Shipment(Base):
    __tablename__ = "shipment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    demand: Mapped[int] = mapped_column(Integer, nullable=False)
    location_x: Mapped[int] = mapped_column(Integer, nullable=False)
    location_y: Mapped[int] = mapped_column(Integer, nullable=False)
    window_start: Mapped[int] = mapped_column(Integer, nullable=False)
    window_end: Mapped[int] = mapped_column(Integer, nullable=False)
    service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Lieferschein / E-Mail-Eingang (Block 12)
    intake_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    intake_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    email_notes: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    seller_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    positionen: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    email_received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    email_processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    missing_fields: Mapped[list | None] = mapped_column(JSON, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    released_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


class EmailLog(Base):
    """Protokoll je verarbeiteter E-Mail (IMAP)."""

    __tablename__ = "email_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[str | None] = mapped_column(String(900), nullable=True, unique=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    from_addr: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(80), nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipment.id"), nullable=True
    )
    body_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Driver(Base):
    __tablename__ = "driver"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="available")
    shift_start: Mapped[int] = mapped_column(Integer, nullable=False)  # Minuten seit Mitternacht
    shift_end: Mapped[int] = mapped_column(Integer, nullable=False)


class PlanVersion(Base):
    """Touren Plan – eine Version des Plans pro Mandant/Datum."""
    __tablename__ = "touren_plan"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    plan_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_run.id"), nullable=True
    )
    total_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class Tour(Base):
    __tablename__ = "tour"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    plan_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("touren_plan.id"), nullable=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    plan_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_run.id"), nullable=True
    )
    total_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    description: Mapped[str] = mapped_column(String(200), nullable=True)


class TourStop(Base):
    __tablename__ = "tour_stop"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tour_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tour.id"), nullable=False
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicle.id"), nullable=False
    )
    shipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipment.id"), nullable=True
    )
    stop_index: Mapped[int] = mapped_column(Integer, nullable=False)
    arrival_time: Mapped[int] = mapped_column(Integer, nullable=False)
    departure_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    segment_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Fahrer-Fortschritt (operativ): Stopp als erledigt markiert
    driver_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    driver_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PlanRun(Base):
    __tablename__ = "plan_run"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    input_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)