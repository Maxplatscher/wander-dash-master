import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveMap } from './LiveMap';

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  GoogleMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Marker: () => null,
  OverlayView: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    { OVERLAY_MOUSE_TARGET: 'overlayMouseTarget' },
  ),
}));

vi.mock('@/lib/google-maps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/google-maps')>()),
  getGoogleMapsApiKey: () => 'test-key',
}));

vi.mock('@/lib/dispatch-context', () => ({
  useDispatch: () => ({ selectedDate: new Date(2026, 7, 22, 12) }),
}));

vi.mock('@/integrations/supabase/client', () => {
  function query(table: string) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: mocks.tables[table] ?? [], error: null }),
    };
    return builder;
  }

  return { supabase: { from: vi.fn(query) } };
});

function renderMap() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LiveMap fill />
    </QueryClientProvider>,
  );
}

describe('LiveMap', () => {
  beforeEach(() => {
    mocks.tables = {};
  });

  it('kennzeichnet die Karte als Tourposition ohne GPS-Ortung', async () => {
    renderMap();

    expect(await screen.findByText('Tourposition')).toBeInTheDocument();
    expect(screen.getByText('Fahrer-GPS oder letzter Stop')).toBeInTheDocument();
    expect(screen.getByText('Keine GPS-Ortung')).toBeInTheDocument();
    expect(screen.queryByText(/Live-Standort/)).not.toBeInTheDocument();
  });

  it('zeigt ohne aktive Tour einen erklärenden Leerzustand statt Demo-Markern', async () => {
    renderMap();

    expect(await screen.findByText('Keine aktive Tour an diesem Tag')).toBeInTheDocument();
    expect(screen.queryByText(/Max M\./)).not.toBeInTheDocument();
  });

  it('verortet eine Tour über den letzten bestätigten Stop', async () => {
    mocks.tables = {
      tour: [{ id: 'tour-1', description: 'Südtour', driver_id: 'driver-1' }],
      driver: [{ id: 'driver-1', name: 'Testfahrer' }],
      tour_stop: [
        {
          id: 'stop-1',
          tour_id: 'tour-1',
          shipment_id: 'shipment-1',
          stop_index: 1,
          driver_completed: true,
          driver_completed_at: '2026-08-22T07:15:00Z',
        },
        {
          id: 'stop-2',
          tour_id: 'tour-1',
          shipment_id: 'shipment-2',
          stop_index: 2,
          driver_completed: false,
          driver_completed_at: null,
        },
      ],
      shipment: [
        {
          id: 'shipment-1',
          customer_name: 'Meier GmbH',
          name: null,
          delivery_address: 'Hauptstr. 1, München',
          location_x: 48.137,
          location_y: 11.576,
        },
        {
          id: 'shipment-2',
          customer_name: 'Schulz AG',
          name: null,
          delivery_address: 'Bahnhofstr. 5, München',
          location_x: null,
          location_y: null,
        },
      ],
    };

    renderMap();

    expect(await screen.findByRole('button', { name: 'Testfahrer' })).toBeInTheDocument();
    expect(screen.getByText(/1 mit Koordinaten/)).toBeInTheDocument();
    expect(screen.queryByText(/Ohne Koordinaten/)).not.toBeInTheDocument();
  });

  it('listet Touren ohne Koordinaten mit Begründung auf', async () => {
    mocks.tables = {
      tour: [{ id: 'tour-1', description: 'Südtour', driver_id: 'driver-1' }],
      driver: [{ id: 'driver-1', name: 'Testfahrer' }],
      tour_stop: [
        {
          id: 'stop-1',
          tour_id: 'tour-1',
          shipment_id: 'shipment-1',
          stop_index: 1,
          driver_completed: false,
          driver_completed_at: null,
        },
      ],
      shipment: [
        {
          id: 'shipment-1',
          customer_name: 'Meier GmbH',
          name: null,
          delivery_address: 'Hauptstr. 1, München',
          location_x: null,
          location_y: null,
        },
      ],
    };

    renderMap();

    expect(await screen.findByText('Keine Position auf der Karte darstellbar')).toBeInTheDocument();
    expect(screen.getByText('Ohne Koordinaten (1)')).toBeInTheDocument();
    expect(screen.getByText(/Testfahrer/)).toBeInTheDocument();
    expect(
      screen.getByText(/Lieferadressen nicht in Koordinaten umgerechnet/),
    ).toBeInTheDocument();
  });

  it('zeigt eine frische GPS-Position mit Alter statt als Live-Standort', async () => {
    mocks.tables = {
      tour: [{ id: 'tour-1', description: 'Südtour', driver_id: 'driver-1' }],
      driver: [{ id: 'driver-1', name: 'Testfahrer' }],
      tour_stop: [],
      shipment: [],
      driver_position: [
        {
          driver_id: 'driver-1',
          lat: 52.373,
          lng: 9.739,
          accuracy_m: 18,
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    renderMap();

    expect(await screen.findByRole('button', { name: 'Testfahrer' })).toBeInTheDocument();
    expect(screen.getByText(/^GPS /)).toBeInTheDocument();
    expect(screen.queryByText(/Live-Standort/)).not.toBeInTheDocument();
  });
});
