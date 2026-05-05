import eta_provider


def test_default_provider_is_manhattan(monkeypatch):
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    m = eta_provider.get_travel_matrix([(0, 0), (2, 3)])
    assert m == [[0, 5], [5, 0]]
    assert eta_provider.get_current_provider() == "manhattan"


def test_osrm_success(monkeypatch):
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "osrm")

    def fake_osrm(coords):
        return [[0, 7], [7, 0]]

    monkeypatch.setattr(eta_provider, "_osrm_matrix", fake_osrm)
    m = eta_provider.get_travel_matrix([(0, 0), (1, 1)])
    assert m == [[0, 7], [7, 0]]
    assert eta_provider.get_current_provider() == "osrm"


def test_osrm_fallback_to_manhattan(monkeypatch):
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "osrm")

    def failing_osrm(coords):
        raise RuntimeError("OSRM down")

    monkeypatch.setattr(eta_provider, "_osrm_matrix", failing_osrm)
    m = eta_provider.get_travel_matrix([(0, 0), (1, 2)])
    assert m == [[0, 3], [3, 0]]
    assert eta_provider.get_current_provider() == "manhattan"
