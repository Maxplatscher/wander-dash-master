import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverTourView } from "./DriverTourView";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  eqCalls: [] as Array<[string, string, unknown]>,
  stopCompleted: false,
  stops: [] as Array<{
    id: string;
    stop_index: number;
    shipment_id: string | null;
    vehicle_id: string | null;
    driver_completed: boolean;
    driver_completed_at: string | null;
  }>,
  shipments: [] as Array<Record<string, unknown>>,
  vehicles: [] as Array<Record<string, unknown>>,
}));

vi.mock("@react-google-maps/api", () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  GoogleMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Marker: () => null,
  Polyline: () => null,
  InfoWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => {
  function query(table: string) {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        mocks.eqCalls.push([table, column, value]);
        return builder;
      }),
      in: vi.fn(async () => ({
        data: table === "shipment" ? mocks.shipments : mocks.vehicles,
        error: null,
      })),
      order: vi.fn(async () => ({
        data:
          table === "tour_stop"
            ? mocks.stops.map((stop) => ({
                ...stop,
                driver_completed: mocks.stopCompleted || stop.driver_completed,
                driver_completed_at:
                  mocks.stopCompleted ? "2026-08-22T09:00:00Z" : stop.driver_completed_at,
              }))
            : [],
        error: null,
      })),
      maybeSingle: vi.fn(async () => {
        if (table === "users") {
          return { data: { driver_id: "driver-1" }, error: null };
        }
        if (table === "tour") {
          return {
            data: {
              id: "tour-1",
              description: "Samstagstour",
              date: filters.date as string,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };
    return builder;
  }

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-user-1" } },
          error: null,
        })),
      },
      from: vi.fn(query),
      rpc: mocks.rpc,
    },
  };
});

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DriverTourView selectedDate={new Date(2026, 7, 22, 12)} />
    </QueryClientProvider>,
  );
}

describe("DriverTourView", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.eqCalls.length = 0;
    mocks.stopCompleted = false;
    mocks.stops = [];
    mocks.shipments = [];
    mocks.vehicles = [];
  });

  it("lädt die eigene Tour für das lokale Datum und zeigt den Leerzustand", async () => {
    renderView();

    expect(await screen.findByText("Tour ohne Stops")).toBeInTheDocument();
    expect(mocks.eqCalls).toContainEqual(["users", "id", "auth-user-1"]);
    expect(mocks.eqCalls).toContainEqual(["tour", "driver_id", "driver-1"]);
    expect(mocks.eqCalls).toContainEqual(["tour", "date", "2026-08-22"]);
    expect(mocks.eqCalls).toContainEqual(["tour", "is_active", true]);
  });

  it("persistiert den Stopabschluss per RPC und lädt den gespeicherten Stand neu", async () => {
    mocks.stops = [
      {
        id: "stop-1",
        stop_index: 1,
        shipment_id: "shipment-1",
        vehicle_id: "vehicle-1",
        driver_completed: false,
        driver_completed_at: null,
      },
    ];
    mocks.shipments = [
      {
        id: "shipment-1",
        customer_name: "Testkunde",
        name: null,
        delivery_address: "Teststraße 1",
        weight_kg: 125,
        window_start: "2026-08-22T08:00:00Z",
        window_end: "2026-08-22T09:00:00Z",
        location_x: null,
        location_y: null,
      },
    ];
    mocks.vehicles = [{ id: "vehicle-1", name: "Sprinter" }];
    mocks.rpc.mockImplementation(async () => {
      mocks.stopCompleted = true;
      return {
        data: [
          {
            id: "stop-1",
            driver_completed: true,
            driver_completed_at: "2026-08-22T09:00:00Z",
          },
        ],
        error: null,
      };
    });

    renderView();
    fireEvent.click(await screen.findByTitle("Als erledigt speichern"));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("complete_my_tour_stop", {
        p_tour_stop_id: "stop-1",
      });
    });
    expect(await screen.findByText("Tour vollständig erledigt")).toBeInTheDocument();
    expect(screen.getByTitle("Dauerhaft erledigt")).toBeDisabled();
  });
});
