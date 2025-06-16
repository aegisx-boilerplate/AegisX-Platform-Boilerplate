import { coreConfig } from './core-config.js';

describe('coreConfig', () => {
  it('should work', () => {
    expect(coreConfig()).toEqual('core-config v1.0.0');
  });
});
