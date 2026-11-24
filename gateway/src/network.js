function normalizeAddress(address) {
  const bare = (address || '').replace('::ffff:', '');
  return bare === '::1' ? '127.0.0.1' : bare;
}

module.exports = { normalizeAddress };
