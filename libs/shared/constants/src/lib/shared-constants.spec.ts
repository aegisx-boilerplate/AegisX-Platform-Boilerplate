import { sharedConstants } from './shared-constants.js';

describe('sharedConstants', () => {
  it('should work', () => {
    expect(sharedConstants()).toEqual('shared-constants');
  });
});
