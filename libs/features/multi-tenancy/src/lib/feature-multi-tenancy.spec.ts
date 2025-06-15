import { featureMultiTenancy } from './feature-multi-tenancy.js';

describe('featureMultiTenancy', () => {
  it('should work', () => {
    expect(featureMultiTenancy()).toEqual('feature-multi-tenancy');
  });
});
