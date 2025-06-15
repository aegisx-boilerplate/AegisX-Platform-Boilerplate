import { minio } from './minio.js';

describe('minio', () => {
  it('should work', () => {
    expect(minio()).toEqual('minio');
  });
});
