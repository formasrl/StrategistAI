import { formatDateTime } from './dateUtils';

describe('dateUtils', () => {
  it('should format a date correctly', () => {
    const date = new Date('2024-01-01T12:00:00.000Z');
    const formattedDate = formatDateTime(date, 'yyyy-MM-dd');
    expect(formattedDate).toBe('2024-01-01');
  });
});
