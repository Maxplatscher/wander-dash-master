"""
Kalender-API (Block 14): Touren + Sendungen für Dispatcher-Ansicht.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from typing import Generator, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import require_roles
from db import SessionLocal
from models import (
    ROLE_ADMIN,
    ROLE_DISPATCHER,
    PlanRun,
    Shipment,
    Tour,
    TourStop,
    User,
    Vehicle,
)

router = APIRouter(tags=["calendar"])

DEFAULT_MAX_TOURS_PER_DAY = 5


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_company(current: User, company_id: uuid.UUID) -> None:
    if current.role == ROLE_ADMIN:
        return
    if current.company_id != company_id:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Mandanten.")


def _mins_to_hhmm(m: int) -> str:
    m = max(0, int(m))
    return f"{m // 60:02d}:{m % 60:02d}"


class CalendarEntryOut(BaseModel):
    id: str = Field(description="Entitäts-ID (UUID als String)")
    type: str = Field(
        description="tour | unassigned | incomplete_shipment",
    )
    title: str
    date: date
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    driver_name: Optional[str] = None
    shipment_count: Optional[int] = None
    has_conflict: Optional[bool] = None
    customer_name: Optional[str] = None
    intake_status: Optional[str] = None
    color: str = "blue"


class CalendarResponse(BaseModel):
    entries: List[CalendarEntryOut]
    max_tours_per_day: int = DEFAULT_MAX_TOURS_PER_DAY

    model_config = ConfigDict(from_attributes=True)


@router.get("/companies/{company_id}/calendar", response_model=CalendarResponse)
def get_company_calendar(
    company_id: uuid.UUID,
    start: date = Query(..., description="Beginn des Zeitraums (inkl.)"),
    end: date = Query(..., description="Ende des Zeitraums (inkl.)"),
    db: Session = Depends(get_db),
    current: User = Depends(require_roles([ROLE_ADMIN, ROLE_DISPATCHER])),
):
    if end < start:
        raise HTTPException(status_code=400, detail="end muss >= start sein")
    _require_company(current, company_id)

    tours_all = (
        db.execute(
            select(Tour).where(
                Tour.company_id == company_id,
                Tour.date >= start,
                Tour.date <= end,
            )
        )
        .scalars()
        .all()
    )

    # Pro Kalendertag nur die höchste Versionsnummer anzeigen (weniger Ballast).
    best_by_day: dict[date, Tour] = {}
    for t in tours_all:
        cur = best_by_day.get(t.date)
        if cur is None or t.version > cur.version:
            best_by_day[t.date] = t
    tours_display = list(best_by_day.values())

    tour_ids_all = [t.id for t in tours_all]
    assigned_shipment_ids: set[uuid.UUID] = set()
    stops_by_tour: dict[uuid.UUID, list[TourStop]] = defaultdict(list)
    if tour_ids_all:
        all_stops = (
            db.execute(select(TourStop).where(TourStop.tour_id.in_(tour_ids_all)))
            .scalars()
            .all()
        )
        for st in all_stops:
            stops_by_tour[st.tour_id].append(st)
            if st.shipment_id:
                assigned_shipment_ids.add(st.shipment_id)

    vehicle_ids: set[uuid.UUID] = set()
    for t in tours_display:
        for st in stops_by_tour.get(t.id, []):
            vehicle_ids.add(st.vehicle_id)
    vmap: dict[uuid.UUID, Vehicle] = {}
    if vehicle_ids:
        vrows = (
            db.execute(select(Vehicle).where(Vehicle.id.in_(vehicle_ids)))
            .scalars()
            .all()
        )
        vmap = {v.id: v for v in vrows}

    entries: List[CalendarEntryOut] = []

    for tour in sorted(tours_display, key=lambda x: (x.date, x.version)):
        stops = stops_by_tour.get(tour.id, [])
        cust_stops = [s for s in stops if s.shipment_id is not None]
        shipment_count = len(cust_stops)
        times = [s.arrival_time for s in stops if s.arrival_time is not None]
        t_min = min(times) if times else None
        t_max = max(times) if times else None

        vnames = []
        seen_v = set()
        for st in sorted(stops, key=lambda x: x.stop_index):
            if st.vehicle_id in seen_v:
                continue
            seen_v.add(st.vehicle_id)
            vn = vmap.get(st.vehicle_id)
            vnames.append(vn.name if vn else "Fahrzeug")
        driver_label = ", ".join(vnames) if vnames else None

        has_conflict = False
        if tour.plan_run_id:
            pr = db.get(PlanRun, tour.plan_run_id)
            if pr and isinstance(pr.result_snapshot, dict):
                rs = pr.result_snapshot
                conflicts = rs.get("conflicts") or []
                unassigned = rs.get("unassigned_shipments") or []
                has_conflict = bool(conflicts) or bool(unassigned)

        title = f"Tour v{tour.version}"
        if driver_label:
            title += f" – {driver_label}"

        color = "red" if has_conflict else "blue"

        entries.append(
            CalendarEntryOut(
                id=str(tour.id),
                type="tour",
                title=title,
                date=tour.date,
                time_start=_mins_to_hhmm(t_min) if t_min is not None else None,
                time_end=_mins_to_hhmm(t_max) if t_max is not None else None,
                driver_name=driver_label,
                shipment_count=shipment_count,
                has_conflict=has_conflict,
                color=color,
            )
        )

    shipments = (
        db.execute(
            select(Shipment).where(
                Shipment.company_id == company_id,
                Shipment.service_date.is_not(None),
                Shipment.service_date >= start,
                Shipment.service_date <= end,
            )
        )
        .scalars()
        .all()
    )

    for s in shipments:
        if s.intake_status:
            cname = (s.customer_name or s.name or "").strip() or "Sendung"
            w = s.weight_kg
            title = f"{cname}" + (f" – {w} kg" if w else "")
            entries.append(
                CalendarEntryOut(
                    id=str(s.id),
                    type="incomplete_shipment",
                    title=title,
                    date=s.service_date,  # type: ignore[arg-type]
                    time_start=None,
                    time_end=None,
                    customer_name=s.customer_name,
                    intake_status=s.intake_status,
                    color="gray",
                )
            )
        elif s.id not in assigned_shipment_ids:
            cname = (s.customer_name or s.name or "").strip() or "Sendung"
            w = s.weight_kg
            title = f"{cname}" + (f" – {w} kg" if w else "")
            entries.append(
                CalendarEntryOut(
                    id=str(s.id),
                    type="unassigned",
                    title=title,
                    date=s.service_date,  # type: ignore[arg-type]
                    time_start=None,
                    time_end=None,
                    customer_name=s.customer_name,
                    intake_status=None,
                    color="orange",
                )
            )

    entries.sort(key=lambda e: (e.date, e.type != "tour", e.time_start or "99:99", e.title))

    return CalendarResponse(
        entries=entries,
        max_tours_per_day=DEFAULT_MAX_TOURS_PER_DAY,
    )
