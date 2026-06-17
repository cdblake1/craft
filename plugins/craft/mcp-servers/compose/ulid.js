// ulid.js -- minimal ULID (Crockford base32) implementation.
//
// 128 bits total: 48 bits ms-since-epoch + 80 bits randomness.
// Crockford base32 alphabet (excludes I, L, O, U) -- 26 chars total.
// Output: 10-char timestamp + 16-char randomness = 26 chars.
//
// We do NOT do monotonic-within-ms ordering; for the backlog's volume the
// natural collision probability is negligible (80 bits randomness per ms).
// This matches the public ULID spec at https://github.com/ulid/spec.

'use strict';

const crypto = require('crypto');

const ENCODING       = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN   = ENCODING.length;
const TIME_LEN       = 10;
const RANDOM_LEN     = 16;
const TIME_MAX       = Math.pow(2, 48) - 1;

function encodeTime(now, len) {
    if (now > TIME_MAX) { throw new Error(`time too large: ${now}`); }
    let out = '';
    for (let i = len - 1; i >= 0; i--) {
        const mod = now % ENCODING_LEN;
        out = ENCODING[mod] + out;
        now = (now - mod) / ENCODING_LEN;
    }
    return out;
}

function encodeRandom(len) {
    // 5 bits per char; use crypto.randomBytes to get high-entropy bytes,
    // then map each byte's low 5 bits onto the alphabet. We use one byte
    // per char for simplicity; the wasted 3 bits per char are fine.
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) {
        out += ENCODING[bytes[i] % ENCODING_LEN];
    }
    return out;
}

function ulid(timeMs) {
    const now = (typeof timeMs === 'number') ? timeMs : Date.now();
    return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

module.exports = { ulid, encodeTime, encodeRandom, TIME_LEN, RANDOM_LEN, ENCODING };
