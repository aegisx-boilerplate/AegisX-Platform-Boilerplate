import { coreLogger } from './core-logger.js';

describe('coreLogger', () => {
  it('should work', () => {
    expect(coreLogger()).toEqual('core-logger vAegisX Platform');
  });
});
