from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver import routing_enums_pb2


def create_data_model():
    data = {}
    # Distanzmatrix (vereinfacht)
    data["distance_matrix"] = [
        [0, 9, 10, 7],
        [9, 0, 8, 6],
        [10, 8, 0, 5],
        [7, 6, 5, 0],
    ]
    data["num_vehicles"] = 2
    data["depot"] = 0
    return data


def main():
    data = create_data_model()

    manager = pywrapcp.RoutingIndexManager(
        len(data["distance_matrix"]),
        data["num_vehicles"],
        data["depot"],
    )

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data["distance_matrix"][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    solution = routing.SolveWithParameters(search_parameters)

    if solution:
        for vehicle_id in range(data["num_vehicles"]):
            index = routing.Start(vehicle_id)
            route = []
            while not routing.IsEnd(index):
                route.append(manager.IndexToNode(index))
                index = solution.Value(routing.NextVar(index))
            route.append(manager.IndexToNode(index))
            print(f"Route for vehicle {vehicle_id}: {route}")


if __name__ == "__main__":
    main()