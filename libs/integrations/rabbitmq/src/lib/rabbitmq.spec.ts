import { rabbitmq } from './rabbitmq.js';

describe('rabbitmq', () => {
  it('should work', () => {
    expect(rabbitmq()).toEqual('rabbitmq');
  });
});
