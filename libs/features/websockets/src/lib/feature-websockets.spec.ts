import { featureWebsockets } from './feature-websockets.js';

describe('featureWebsockets', () => {
  it('should work', () => {
    expect(featureWebsockets()).toEqual('feature-websockets');
  });
});
