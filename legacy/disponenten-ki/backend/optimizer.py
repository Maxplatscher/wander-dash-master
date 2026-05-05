from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver import routing_enums_pb2


OPTIMIZER_VERSION = "0.5.0-replan-locked"

print(f"[optimizer] optimizer.py geladen (Version {OPTIMIZER_VERSION})")


def optimize_routes(
    distance_matrix,
    demands,
    vehicle_capacities,
    time_windows,
    num_vehicles,
    depot,
    unassigned_penalty: int = 10_000,
    locked_node_indices=None,
    preassigned_node_to_vehicle=None,
):
    # Basic validation
    if not distance_matrix or not isinstance(distance_matrix, list):
        return {"error": "distance_matrix is missing or invalid"}

    num_locations = len(distance_matrix)

    if len(demands) != num_locations:
        return {"error": "Length of demands must match number of locations"}

    if len(vehicle_capacities) != num_vehicles:
        return {"error": "Length of vehicle_capacities must match num_vehicles"}

    if len(time_windows) != num_locations:
        return {"error": "Length of time_windows must match number of locations"}

    manager = pywrapcp.RoutingIndexManager(
        num_locations,
        num_vehicles,
        depot,
    )

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Kapazitäts-Constraint
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)

    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,
        vehicle_capacities,
        True,
        "Capacity",
    )

    # Zeitfenster-Constraint (Time Dimension)
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    time_callback_index = routing.RegisterTransitCallback(time_callback)

    horizon = max(end for _, end in time_windows)

    routing.AddDimension(
        time_callback_index,
        30,
        horizon,
        False,
        "Time",
    )

    time_dimension = routing.GetDimensionOrDie("Time")

    for location_idx in range(num_locations):
        index = manager.NodeToIndex(location_idx)
        start, end = time_windows[location_idx]
        time_dimension.CumulVar(index).SetRange(start, end)

    locked = set(locked_node_indices or [])
    preassigned = dict(preassigned_node_to_vehicle or {})

    # Preassigned: Node muss von bestimmtem Fahrzeug bedient werden
    for node, vehicle_idx in preassigned.items():
        if 1 <= node < num_locations and 0 <= vehicle_idx < num_vehicles:
            idx = manager.NodeToIndex(node)
            # OR-Tools bindings unterscheiden sich je nach Version; harter VehicleVar-Constraint ist stabil.
            routing.solver().Add(routing.VehicleVar(idx) == int(vehicle_idx))

    # Unassigned: nur für Nicht-Depot-Nodes, die NICHT locked sind
    # Locked Nodes haben keine Disjunction → müssen eingeplant werden
    for node in range(1, num_locations):
        if node in locked:
            continue
        index = manager.NodeToIndex(node)
        routing.AddDisjunction([index], unassigned_penalty)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        conflicts = []
        if locked or preassigned:
            conflicts.append(
                "No solution found; locked/preassigned constraints may conflict with capacity or time windows."
            )
        return {"error": "No solution found", "conflicts": conflicts}

    routes = []
    total_cost = 0
    unassigned = []
    node_to_vehicle = {}  # node_index -> vehicle_id (für Nachprüfung)

    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        route = []
        arrival_times = []

        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            route.append(node_index)
            node_to_vehicle[node_index] = vehicle_id
            arrival_times.append(solution.Value(time_dimension.CumulVar(index)))
            index = solution.Value(routing.NextVar(index))

        node_index = manager.IndexToNode(index)
        route.append(node_index)
        arrival_times.append(solution.Value(time_dimension.CumulVar(index)))

        route_cost = 0
        for i in range(len(route) - 1):
            route_cost += distance_matrix[route[i]][route[i + 1]]

        if len(route) > 2:
            routes.append(
                {
                    "vehicle_id": vehicle_id,
                    "route": route,
                    "arrival_times": arrival_times,
                    "cost": route_cost,
                }
            )
            total_cost += route_cost

    # Unassigned Knoten (NextVar(index) == index)
    for node in range(1, num_locations):
        index = manager.NodeToIndex(node)
        if solution.Value(routing.NextVar(index)) == index:
            unassigned.append(node)

    # Replan-Check: Locks eingehalten?
    locked_applied = True
    conflicts = []
    for node in locked:
        if node in unassigned:
            locked_applied = False
            conflicts.append(f"Locked node {node} could not be assigned (e.g. capacity/time window).")
    for node, expected_vehicle in preassigned.items():
        if node in unassigned:
            locked_applied = False
            conflicts.append(f"Preassigned node {node} could not be assigned to vehicle {expected_vehicle}.")
        elif node_to_vehicle.get(node) != expected_vehicle:
            locked_applied = False
            conflicts.append(
                f"Preassigned node {node} was assigned to vehicle {node_to_vehicle.get(node)} instead of {expected_vehicle}."
            )

    return {
        "routes": routes,
        "total_cost": total_cost,
        "unassigned": unassigned,
        "locked_applied": locked_applied,
        "conflicts": conflicts,
    }