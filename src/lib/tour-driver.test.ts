import { describe, expect, it } from 'vitest';
import { resolveTourDriverId } from './tour-driver';

describe('resolveTourDriverId', () => {
  it('nimmt den Fahrer mit passender Fahrzeugzuordnung', () => {
    const used = new Set<string>();
    expect(
      resolveTourDriverId(
        'veh-1',
        [
          { id: 'd1', assigned_vehicle_id: 'veh-2' },
          { id: 'd2', assigned_vehicle_id: 'veh-1' },
        ],
        used,
      ),
    ).toBe('d2');
  });

  it('fällt auf den einzigen freien Fahrer zurück', () => {
    const used = new Set<string>();
    expect(
      resolveTourDriverId('veh-1', [{ id: 'd1', assigned_vehicle_id: null }], used),
    ).toBe('d1');
  });

  it('rät nicht, wenn mehrere Fahrer ohne Zuordnung frei sind', () => {
    const used = new Set<string>();
    expect(
      resolveTourDriverId(
        'veh-1',
        [
          { id: 'd1', assigned_vehicle_id: null },
          { id: 'd2', assigned_vehicle_id: null },
        ],
        used,
      ),
    ).toBeNull();
  });

  it('überspringt bereits vergebene Fahrer', () => {
    const used = new Set(['d1']);
    expect(
      resolveTourDriverId(
        'veh-2',
        [
          { id: 'd1', assigned_vehicle_id: 'veh-1' },
          { id: 'd2', assigned_vehicle_id: null },
        ],
        used,
      ),
    ).toBe('d2');
  });
});
