import { sharedValidations } from './shared-validations.js';

describe('sharedValidations', () => {
  it('should work', () => {
    expect(sharedValidations()).toEqual('shared-validations');
  });
});
