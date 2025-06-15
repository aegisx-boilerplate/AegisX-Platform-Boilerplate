import { coreDatabase } from './core-database.js';

describe('coreDatabase', () => {
  it('should work', () => {
    expect(coreDatabase()).toEqual('core-database');
  });
});
