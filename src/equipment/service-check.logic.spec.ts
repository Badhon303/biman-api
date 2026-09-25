import { crossedHourBands } from './service-check.logic';

describe('crossedHourBands', () => {
  const services = [
    { id: 'f', minHours: 0, maxHours: 500 },
    { id: 'b', minHours: 500, maxHours: 1000 },
    { id: 'custom', minHours: 1000, maxHours: null },
  ];

  it('returns every threshold crossed by a large meter jump in order', () => {
    expect(
      crossedHourBands(services, 250, 1100, new Set()).map((item) => item.id),
    ).toEqual(['f', 'b', 'custom']);
  });

  it('does not include the previous value or an unchecked future band', () => {
    expect(
      crossedHourBands(services, 500, 900, new Set()).map((item) => item.id),
    ).toEqual([]);
  });

  it('does not return a previously checked threshold', () => {
    expect(
      crossedHourBands(services, 250, 1100, new Set(['b:1000'])).map(
        (item) => item.id,
      ),
    ).toEqual(['f', 'custom']);
  });
});
