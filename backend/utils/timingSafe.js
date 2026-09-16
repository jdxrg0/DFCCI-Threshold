const crypto = require('crypto');

// Compares two numeric strings in constant time so a side-channel observer
// cannot learn the OTP a digit at a time. Non-numeric or mismatched-length
// inputs are flattened to a fixed padding so the timing stays uniform.
const safeEqualNum = (a, b) => {
  const as = String(a ?? '');
  const bs = String(b ?? '');
  const aBuf = Buffer.from(as.replace(/\D/g, '0').slice(0, 6).padEnd(6, '0'));
  const bBuf = Buffer.from(bs.replace(/\D/g, '0').slice(0, 6).padEnd(6, '0'));
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
};

module.exports = { safeEqualNum };