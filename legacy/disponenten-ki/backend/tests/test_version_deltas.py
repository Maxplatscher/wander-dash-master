"""Unit-Tests für version_deltas.compare_adjacent_versions (ohne DB)."""
from version_deltas import DeltaThresholds, compare_adjacent_versions


def test_compare_cost_only_when_both_int():
    cur = {"total_cost": 110, "unassigned_count": 0, "vehicle_signature": "a", "order_signature": "x", "eta_span": 10}
    prev = {"total_cost": 100, "unassigned_count": 0, "vehicle_signature": "a", "order_signature": "x", "eta_span": 10}
    ch, qn, cd, ud, ed = compare_adjacent_versions(cur, prev, 3, 2, DeltaThresholds(cost=5, eta_minutes=5))
    assert cd == 10
    assert any("Kosten +10" in c for c in ch)
    assert not qn


def test_compare_quality_note_when_cost_missing():
    cur = {"total_cost": None, "unassigned_count": 0, "vehicle_signature": "a", "order_signature": "x", "eta_span": 10}
    prev = {"total_cost": 100, "unassigned_count": 0, "vehicle_signature": "a", "order_signature": "x", "eta_span": 10}
    ch, qn, cd, ud, ed = compare_adjacent_versions(cur, prev, 3, 2, DeltaThresholds(cost=1, eta_minutes=5))
    assert cd is None
    assert any("Kosten" in n and "nicht vergleichbar" in n for n in qn)


def test_compare_structure_always():
    cur = {"total_cost": 100, "unassigned_count": 0, "vehicle_signature": "a,b", "order_signature": "x", "eta_span": 10}
    prev = {"total_cost": 100, "unassigned_count": 0, "vehicle_signature": "a", "order_signature": "x", "eta_span": 10}
    ch, qn, cd, ud, ed = compare_adjacent_versions(cur, prev, 2, 1, DeltaThresholds(cost=999, eta_minutes=999))
    assert any("Fahrzeugzuordnung" in c for c in ch)
