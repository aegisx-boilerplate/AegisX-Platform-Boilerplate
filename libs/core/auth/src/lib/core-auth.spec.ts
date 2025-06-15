import { coreAuth } from './core-auth.js';

describe('coreAuth', () => {
  it('should work', () => {
    expect(coreAuth()).toEqual('core-auth');
  });
});
