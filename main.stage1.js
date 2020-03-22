const lib = (fn) => {
  var exports = null;
  return () => {
    exports = exports || fn();
    return exports;
  };
};

const lib_inherits = lib(() => {
  return function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
});

const lib_BN = lib(() => {
'use strict';

let exports = {};
let assert = lib_utils().assert;
let inherits = lib_inherits()

// BN
function BN (number, base, endian) {
if (BN.isBN(number)) {
  return number;
}

this.negative = 0;
this.words = null;
this.length = 0;

// Reduction context
this.red = null;

if (number !== null) {
  if (base === 'le' || base === 'be') {
    endian = base;
    base = 10;
  }

  this._init(number || 0, base || 10, endian || 'be');
}
}
if (typeof module === 'object') {
exports = BN;
} else {
exports.BN = BN;
}

BN.BN = BN;
BN.wordSize = 26;

var Buffer;
BN.isBN = function isBN (num) {
if (num instanceof BN) {
  return true;
}

return num !== null && typeof num === 'object' &&
  num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
};

BN.prototype._init = function init (number, base, endian) {
if (typeof number === 'number') {
  return this._initNumber(number, base, endian);
}

if (typeof number === 'object') {
  return this._initArray(number, base, endian);
}

if (base === 'hex') {
  base = 16;
}
assert(base === (base | 0) && base >= 2 && base <= 36);

number = number.toString().replace(/\s+/g, '');
var start = 0;
if (number[0] === '-') {
  start++;
}

if (base === 16) {
  this._parseHex(number, start);
} else {
  this._parseBase(number, base, start);
}

if (number[0] === '-') {
  this.negative = 1;
}

this.strip();

if (endian !== 'le') return;

this._initArray(this.toArray(), base, endian);
};

BN.prototype._initNumber = function _initNumber (number, base, endian) {
if (number < 0) {
  this.negative = 1;
  number = -number;
}
if (number < 0x4000000) {
  this.words = [ number & 0x3ffffff ];
  this.length = 1;
} else if (number < 0x10000000000000) {
  this.words = [
    number & 0x3ffffff,
    (number / 0x4000000) & 0x3ffffff
  ];
  this.length = 2;
} else {
  assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
  this.words = [
    number & 0x3ffffff,
    (number / 0x4000000) & 0x3ffffff,
    1
  ];
  this.length = 3;
}

if (endian !== 'le') return;

// Reverse the bytes
this._initArray(this.toArray(), base, endian);
};

BN.prototype._initArray = function _initArray (number, base, endian) {
// Perhaps a Uint8Array
assert(typeof number.length === 'number');
if (number.length <= 0) {
  this.words = [ 0 ];
  this.length = 1;
  return this;
}

this.length = Math.ceil(number.length / 3);
this.words = new Array(this.length);
for (var i = 0; i < this.length; i++) {
  this.words[i] = 0;
}

var j, w;
var off = 0;
if (endian === 'be') {
  for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
    w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
    this.words[j] |= (w << off) & 0x3ffffff;
    this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
    off += 24;
    if (off >= 26) {
      off -= 26;
      j++;
    }
  }
} else if (endian === 'le') {
  for (i = 0, j = 0; i < number.length; i += 3) {
    w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
    this.words[j] |= (w << off) & 0x3ffffff;
    this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
    off += 24;
    if (off >= 26) {
      off -= 26;
      j++;
    }
  }
}
return this.strip();
};

function parseHex (str, start, end) {
var r = 0;
var len = Math.min(str.length, end);
for (var i = start; i < len; i++) {
  var c = str.charCodeAt(i) - 48;

  r <<= 4;

  // 'a' - 'f'
  if (c >= 49 && c <= 54) {
    r |= c - 49 + 0xa;

  // 'A' - 'F'
  } else if (c >= 17 && c <= 22) {
    r |= c - 17 + 0xa;

  // '0' - '9'
  } else {
    r |= c & 0xf;
  }
}
return r;
}

BN.prototype._parseHex = function _parseHex (number, start) {
// Create possibly bigger array to ensure that it fits the number
this.length = Math.ceil((number.length - start) / 6);
this.words = new Array(this.length);
for (var i = 0; i < this.length; i++) {
  this.words[i] = 0;
}

var j, w;
// Scan 24-bit chunks and add them to the number
var off = 0;
for (i = number.length - 6, j = 0; i >= start; i -= 6) {
  w = parseHex(number, i, i + 6);
  this.words[j] |= (w << off) & 0x3ffffff;
  // NOTE: `0x3fffff` is intentional here, 26bits max shift + 24bit hex limb
  this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
  off += 24;
  if (off >= 26) {
    off -= 26;
    j++;
  }
}
if (i + 6 !== start) {
  w = parseHex(number, start, i + 6);
  this.words[j] |= (w << off) & 0x3ffffff;
  this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
}
this.strip();
};

BN.prototype.copy = function copy (dest) {
dest.words = new Array(this.length);
for (var i = 0; i < this.length; i++) {
  dest.words[i] = this.words[i];
}
dest.length = this.length;
dest.negative = this.negative;
dest.red = this.red;
};

BN.prototype.clone = function clone () {
var r = new BN(null);
this.copy(r);
return r;
};

BN.prototype._expand = function _expand (size) {
while (this.length < size) {
  this.words[this.length++] = 0;
}
return this;
};

// Remove leading `0` from `this`
BN.prototype.strip = function strip () {
while (this.length > 1 && this.words[this.length - 1] === 0) {
  this.length--;
}
return this._normSign();
};

BN.prototype._normSign = function _normSign () {
// -0 = 0
if (this.length === 1 && this.words[0] === 0) {
  this.negative = 0;
}
return this;
};

var zeros = [
'',
'0',
'00',
'000',
'0000',
'00000',
'000000',
'0000000',
'00000000',
'000000000',
'0000000000',
'00000000000',
'000000000000',
'0000000000000',
'00000000000000',
'000000000000000',
'0000000000000000',
'00000000000000000',
'000000000000000000',
'0000000000000000000',
'00000000000000000000',
'000000000000000000000',
'0000000000000000000000',
'00000000000000000000000',
'000000000000000000000000',
'0000000000000000000000000'
];

var groupSizes = [
0, 0,
25, 16, 12, 11, 10, 9, 8,
8, 7, 7, 7, 7, 6, 6,
6, 6, 6, 6, 6, 5, 5,
5, 5, 5, 5, 5, 5, 5,
5, 5, 5, 5, 5, 5, 5
];

var groupBases = [
0, 0,
33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
];

BN.prototype.toString = function toString (base, padding) {
base = base || 10;
padding = padding | 0 || 1;

var out;
if (base === 16 || base === 'hex') {
  out = '';
  var off = 0;
  var carry = 0;
  for (var i = 0; i < this.length; i++) {
    var w = this.words[i];
    var word = (((w << off) | carry) & 0xffffff).toString(16);
    carry = (w >>> (24 - off)) & 0xffffff;
    if (carry !== 0 || i !== this.length - 1) {
      out = zeros[6 - word.length] + word + out;
    } else {
      out = word + out;
    }
    off += 2;
    if (off >= 26) {
      off -= 26;
      i--;
    }
  }
  if (carry !== 0) {
    out = carry.toString(16) + out;
  }
  while (out.length % padding !== 0) {
    out = '0' + out;
  }
  if (this.negative !== 0) {
    out = '-' + out;
  }
  return out;
}

if (base === (base | 0) && base >= 2 && base <= 36) {
  // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
  var groupSize = groupSizes[base];
  // var groupBase = Math.pow(base, groupSize);
  var groupBase = groupBases[base];
  out = '';
  var c = this.clone();
  c.negative = 0;
  while (!c.isZero()) {
    var r = c.modn(groupBase).toString(base);
    c = c.idivn(groupBase);

    if (!c.isZero()) {
      out = zeros[groupSize - r.length] + r + out;
    } else {
      out = r + out;
    }
  }
  if (this.isZero()) {
    out = '0' + out;
  }
  while (out.length % padding !== 0) {
    out = '0' + out;
  }
  if (this.negative !== 0) {
    out = '-' + out;
  }
  return out;
}

assert(false, 'Base should be between 2 and 36');
};

BN.prototype.toArray = function toArray (endian, length) {
return this.toArrayLike(Array, endian, length);
};

BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
var byteLength = this.byteLength();
var reqLength = length || Math.max(1, byteLength);
assert(byteLength <= reqLength, 'byte array longer than desired length');
assert(reqLength > 0, 'Requested array length <= 0');

this.strip();
var littleEndian = endian === 'le';
var res = new ArrayType(reqLength);

var b, i;
var q = this.clone();
if (!littleEndian) {
  // Assume big-endian
  for (i = 0; i < reqLength - byteLength; i++) {
    res[i] = 0;
  }

  for (i = 0; !q.isZero(); i++) {
    b = q.andln(0xff);
    q.iushrn(8);

    res[reqLength - i - 1] = b;
  }
} else {
  for (i = 0; !q.isZero(); i++) {
    b = q.andln(0xff);
    q.iushrn(8);

    res[i] = b;
  }

  for (; i < reqLength; i++) {
    res[i] = 0;
  }
}

return res;
};

if (Math.clz32) {
BN.prototype._countBits = function _countBits (w) {
  return 32 - Math.clz32(w);
};
} else {
BN.prototype._countBits = function _countBits (w) {
  var t = w;
  var r = 0;
  if (t >= 0x1000) {
    r += 13;
    t >>>= 13;
  }
  if (t >= 0x40) {
    r += 7;
    t >>>= 7;
  }
  if (t >= 0x8) {
    r += 4;
    t >>>= 4;
  }
  if (t >= 0x02) {
    r += 2;
    t >>>= 2;
  }
  return r + t;
};
}

// Return number of used bits in a BN
BN.prototype.bitLength = function bitLength () {
var w = this.words[this.length - 1];
var hi = this._countBits(w);
return (this.length - 1) * 26 + hi;
};

BN.prototype.byteLength = function byteLength () {
return Math.ceil(this.bitLength() / 8);
};

BN.prototype.neg = function neg () {
return this.clone().ineg();
};

BN.prototype.ineg = function ineg () {
if (!this.isZero()) {
  this.negative ^= 1;
}

return this;
};

// Add `num` to `this` in-place
BN.prototype.iadd = function iadd (num) {
var r;

// negative + positive
if (this.negative !== 0 && num.negative === 0) {
  this.negative = 0;
  r = this.isub(num);
  this.negative ^= 1;
  return this._normSign();

// positive + negative
} else if (this.negative === 0 && num.negative !== 0) {
  num.negative = 0;
  r = this.isub(num);
  num.negative = 1;
  return r._normSign();
}

// a.length > b.length
var a, b;
if (this.length > num.length) {
  a = this;
  b = num;
} else {
  a = num;
  b = this;
}

var carry = 0;
for (var i = 0; i < b.length; i++) {
  r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
  this.words[i] = r & 0x3ffffff;
  carry = r >>> 26;
}
for (; carry !== 0 && i < a.length; i++) {
  r = (a.words[i] | 0) + carry;
  this.words[i] = r & 0x3ffffff;
  carry = r >>> 26;
}

this.length = a.length;
if (carry !== 0) {
  this.words[this.length] = carry;
  this.length++;
// Copy the rest of the words
} else if (a !== this) {
  for (; i < a.length; i++) {
    this.words[i] = a.words[i];
  }
}

return this;
};

// Add `num` to `this`
BN.prototype.add = function add (num) {
var res;
if (num.negative !== 0 && this.negative === 0) {
  num.negative = 0;
  res = this.sub(num);
  num.negative ^= 1;
  return res;
} else if (num.negative === 0 && this.negative !== 0) {
  this.negative = 0;
  res = num.sub(this);
  this.negative = 1;
  return res;
}

if (this.length > num.length) return this.clone().iadd(num);

return num.clone().iadd(this);
};

// Subtract `num` from `this` in-place
BN.prototype.isub = function isub (num) {
// this - (-num) = this + num
if (num.negative !== 0) {
  num.negative = 0;
  var r = this.iadd(num);
  num.negative = 1;
  return r._normSign();

// -this - num = -(this + num)
} else if (this.negative !== 0) {
  this.negative = 0;
  this.iadd(num);
  this.negative = 1;
  return this._normSign();
}

// At this point both numbers are positive
var cmp = this.cmp(num);

// Optimization - zeroify
if (cmp === 0) {
  this.negative = 0;
  this.length = 1;
  this.words[0] = 0;
  return this;
}

// a > b
var a, b;
if (cmp > 0) {
  a = this;
  b = num;
} else {
  a = num;
  b = this;
}

var carry = 0;
for (var i = 0; i < b.length; i++) {
  r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
  carry = r >> 26;
  this.words[i] = r & 0x3ffffff;
}
for (; carry !== 0 && i < a.length; i++) {
  r = (a.words[i] | 0) + carry;
  carry = r >> 26;
  this.words[i] = r & 0x3ffffff;
}

// Copy rest of the words
if (carry === 0 && i < a.length && a !== this) {
  for (; i < a.length; i++) {
    this.words[i] = a.words[i];
  }
}

this.length = Math.max(this.length, i);

if (a !== this) {
  this.negative = 1;
}

return this.strip();
};

// Subtract `num` from `this`
BN.prototype.sub = function sub (num) {
return this.clone().isub(num);
};

function smallMulTo (self, num, out) {
out.negative = num.negative ^ self.negative;
var len = (self.length + num.length) | 0;
out.length = len;
len = (len - 1) | 0;

// Peel one iteration (compiler can't do it, because of code complexity)
var a = self.words[0] | 0;
var b = num.words[0] | 0;
var r = a * b;

var lo = r & 0x3ffffff;
var carry = (r / 0x4000000) | 0;
out.words[0] = lo;

for (var k = 1; k < len; k++) {
  // Sum all words with the same `i + j = k` and accumulate `ncarry`,
  // note that ncarry could be >= 0x3ffffff
  var ncarry = carry >>> 26;
  var rword = carry & 0x3ffffff;
  var maxJ = Math.min(k, num.length - 1);
  for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
    var i = (k - j) | 0;
    a = self.words[i] | 0;
    b = num.words[j] | 0;
    r = a * b + rword;
    ncarry += (r / 0x4000000) | 0;
    rword = r & 0x3ffffff;
  }
  out.words[k] = rword | 0;
  carry = ncarry | 0;
}
if (carry !== 0) {
  out.words[k] = carry | 0;
} else {
  out.length--;
}

return out.strip();
}

var imul = Math.imul;

// TODO(indutny): it may be reasonable to omit it for users who don't need
// to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
// multiplication (like elliptic secp256k1).
var comb10MulTo = function comb10MulTo (self, num, out) {
var a = self.words;
var b = num.words;
var o = out.words;
var c = 0;
var lo;
var mid;
var hi;
var a0 = a[0] | 0;
var al0 = a0 & 0x1fff;
var ah0 = a0 >>> 13;
var a1 = a[1] | 0;
var al1 = a1 & 0x1fff;
var ah1 = a1 >>> 13;
var a2 = a[2] | 0;
var al2 = a2 & 0x1fff;
var ah2 = a2 >>> 13;
var a3 = a[3] | 0;
var al3 = a3 & 0x1fff;
var ah3 = a3 >>> 13;
var a4 = a[4] | 0;
var al4 = a4 & 0x1fff;
var ah4 = a4 >>> 13;
var a5 = a[5] | 0;
var al5 = a5 & 0x1fff;
var ah5 = a5 >>> 13;
var a6 = a[6] | 0;
var al6 = a6 & 0x1fff;
var ah6 = a6 >>> 13;
var a7 = a[7] | 0;
var al7 = a7 & 0x1fff;
var ah7 = a7 >>> 13;
var a8 = a[8] | 0;
var al8 = a8 & 0x1fff;
var ah8 = a8 >>> 13;
var a9 = a[9] | 0;
var al9 = a9 & 0x1fff;
var ah9 = a9 >>> 13;
var b0 = b[0] | 0;
var bl0 = b0 & 0x1fff;
var bh0 = b0 >>> 13;
var b1 = b[1] | 0;
var bl1 = b1 & 0x1fff;
var bh1 = b1 >>> 13;
var b2 = b[2] | 0;
var bl2 = b2 & 0x1fff;
var bh2 = b2 >>> 13;
var b3 = b[3] | 0;
var bl3 = b3 & 0x1fff;
var bh3 = b3 >>> 13;
var b4 = b[4] | 0;
var bl4 = b4 & 0x1fff;
var bh4 = b4 >>> 13;
var b5 = b[5] | 0;
var bl5 = b5 & 0x1fff;
var bh5 = b5 >>> 13;
var b6 = b[6] | 0;
var bl6 = b6 & 0x1fff;
var bh6 = b6 >>> 13;
var b7 = b[7] | 0;
var bl7 = b7 & 0x1fff;
var bh7 = b7 >>> 13;
var b8 = b[8] | 0;
var bl8 = b8 & 0x1fff;
var bh8 = b8 >>> 13;
var b9 = b[9] | 0;
var bl9 = b9 & 0x1fff;
var bh9 = b9 >>> 13;

out.negative = self.negative ^ num.negative;
out.length = 19;
/* k = 0 */
lo = imul(al0, bl0);
mid = imul(al0, bh0);
mid = (mid + imul(ah0, bl0)) | 0;
hi = imul(ah0, bh0);
var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
w0 &= 0x3ffffff;
/* k = 1 */
lo = imul(al1, bl0);
mid = imul(al1, bh0);
mid = (mid + imul(ah1, bl0)) | 0;
hi = imul(ah1, bh0);
lo = (lo + imul(al0, bl1)) | 0;
mid = (mid + imul(al0, bh1)) | 0;
mid = (mid + imul(ah0, bl1)) | 0;
hi = (hi + imul(ah0, bh1)) | 0;
var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
w1 &= 0x3ffffff;
/* k = 2 */
lo = imul(al2, bl0);
mid = imul(al2, bh0);
mid = (mid + imul(ah2, bl0)) | 0;
hi = imul(ah2, bh0);
lo = (lo + imul(al1, bl1)) | 0;
mid = (mid + imul(al1, bh1)) | 0;
mid = (mid + imul(ah1, bl1)) | 0;
hi = (hi + imul(ah1, bh1)) | 0;
lo = (lo + imul(al0, bl2)) | 0;
mid = (mid + imul(al0, bh2)) | 0;
mid = (mid + imul(ah0, bl2)) | 0;
hi = (hi + imul(ah0, bh2)) | 0;
var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
w2 &= 0x3ffffff;
/* k = 3 */
lo = imul(al3, bl0);
mid = imul(al3, bh0);
mid = (mid + imul(ah3, bl0)) | 0;
hi = imul(ah3, bh0);
lo = (lo + imul(al2, bl1)) | 0;
mid = (mid + imul(al2, bh1)) | 0;
mid = (mid + imul(ah2, bl1)) | 0;
hi = (hi + imul(ah2, bh1)) | 0;
lo = (lo + imul(al1, bl2)) | 0;
mid = (mid + imul(al1, bh2)) | 0;
mid = (mid + imul(ah1, bl2)) | 0;
hi = (hi + imul(ah1, bh2)) | 0;
lo = (lo + imul(al0, bl3)) | 0;
mid = (mid + imul(al0, bh3)) | 0;
mid = (mid + imul(ah0, bl3)) | 0;
hi = (hi + imul(ah0, bh3)) | 0;
var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
w3 &= 0x3ffffff;
/* k = 4 */
lo = imul(al4, bl0);
mid = imul(al4, bh0);
mid = (mid + imul(ah4, bl0)) | 0;
hi = imul(ah4, bh0);
lo = (lo + imul(al3, bl1)) | 0;
mid = (mid + imul(al3, bh1)) | 0;
mid = (mid + imul(ah3, bl1)) | 0;
hi = (hi + imul(ah3, bh1)) | 0;
lo = (lo + imul(al2, bl2)) | 0;
mid = (mid + imul(al2, bh2)) | 0;
mid = (mid + imul(ah2, bl2)) | 0;
hi = (hi + imul(ah2, bh2)) | 0;
lo = (lo + imul(al1, bl3)) | 0;
mid = (mid + imul(al1, bh3)) | 0;
mid = (mid + imul(ah1, bl3)) | 0;
hi = (hi + imul(ah1, bh3)) | 0;
lo = (lo + imul(al0, bl4)) | 0;
mid = (mid + imul(al0, bh4)) | 0;
mid = (mid + imul(ah0, bl4)) | 0;
hi = (hi + imul(ah0, bh4)) | 0;
var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
w4 &= 0x3ffffff;
/* k = 5 */
lo = imul(al5, bl0);
mid = imul(al5, bh0);
mid = (mid + imul(ah5, bl0)) | 0;
hi = imul(ah5, bh0);
lo = (lo + imul(al4, bl1)) | 0;
mid = (mid + imul(al4, bh1)) | 0;
mid = (mid + imul(ah4, bl1)) | 0;
hi = (hi + imul(ah4, bh1)) | 0;
lo = (lo + imul(al3, bl2)) | 0;
mid = (mid + imul(al3, bh2)) | 0;
mid = (mid + imul(ah3, bl2)) | 0;
hi = (hi + imul(ah3, bh2)) | 0;
lo = (lo + imul(al2, bl3)) | 0;
mid = (mid + imul(al2, bh3)) | 0;
mid = (mid + imul(ah2, bl3)) | 0;
hi = (hi + imul(ah2, bh3)) | 0;
lo = (lo + imul(al1, bl4)) | 0;
mid = (mid + imul(al1, bh4)) | 0;
mid = (mid + imul(ah1, bl4)) | 0;
hi = (hi + imul(ah1, bh4)) | 0;
lo = (lo + imul(al0, bl5)) | 0;
mid = (mid + imul(al0, bh5)) | 0;
mid = (mid + imul(ah0, bl5)) | 0;
hi = (hi + imul(ah0, bh5)) | 0;
var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
w5 &= 0x3ffffff;
/* k = 6 */
lo = imul(al6, bl0);
mid = imul(al6, bh0);
mid = (mid + imul(ah6, bl0)) | 0;
hi = imul(ah6, bh0);
lo = (lo + imul(al5, bl1)) | 0;
mid = (mid + imul(al5, bh1)) | 0;
mid = (mid + imul(ah5, bl1)) | 0;
hi = (hi + imul(ah5, bh1)) | 0;
lo = (lo + imul(al4, bl2)) | 0;
mid = (mid + imul(al4, bh2)) | 0;
mid = (mid + imul(ah4, bl2)) | 0;
hi = (hi + imul(ah4, bh2)) | 0;
lo = (lo + imul(al3, bl3)) | 0;
mid = (mid + imul(al3, bh3)) | 0;
mid = (mid + imul(ah3, bl3)) | 0;
hi = (hi + imul(ah3, bh3)) | 0;
lo = (lo + imul(al2, bl4)) | 0;
mid = (mid + imul(al2, bh4)) | 0;
mid = (mid + imul(ah2, bl4)) | 0;
hi = (hi + imul(ah2, bh4)) | 0;
lo = (lo + imul(al1, bl5)) | 0;
mid = (mid + imul(al1, bh5)) | 0;
mid = (mid + imul(ah1, bl5)) | 0;
hi = (hi + imul(ah1, bh5)) | 0;
lo = (lo + imul(al0, bl6)) | 0;
mid = (mid + imul(al0, bh6)) | 0;
mid = (mid + imul(ah0, bl6)) | 0;
hi = (hi + imul(ah0, bh6)) | 0;
var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
w6 &= 0x3ffffff;
/* k = 7 */
lo = imul(al7, bl0);
mid = imul(al7, bh0);
mid = (mid + imul(ah7, bl0)) | 0;
hi = imul(ah7, bh0);
lo = (lo + imul(al6, bl1)) | 0;
mid = (mid + imul(al6, bh1)) | 0;
mid = (mid + imul(ah6, bl1)) | 0;
hi = (hi + imul(ah6, bh1)) | 0;
lo = (lo + imul(al5, bl2)) | 0;
mid = (mid + imul(al5, bh2)) | 0;
mid = (mid + imul(ah5, bl2)) | 0;
hi = (hi + imul(ah5, bh2)) | 0;
lo = (lo + imul(al4, bl3)) | 0;
mid = (mid + imul(al4, bh3)) | 0;
mid = (mid + imul(ah4, bl3)) | 0;
hi = (hi + imul(ah4, bh3)) | 0;
lo = (lo + imul(al3, bl4)) | 0;
mid = (mid + imul(al3, bh4)) | 0;
mid = (mid + imul(ah3, bl4)) | 0;
hi = (hi + imul(ah3, bh4)) | 0;
lo = (lo + imul(al2, bl5)) | 0;
mid = (mid + imul(al2, bh5)) | 0;
mid = (mid + imul(ah2, bl5)) | 0;
hi = (hi + imul(ah2, bh5)) | 0;
lo = (lo + imul(al1, bl6)) | 0;
mid = (mid + imul(al1, bh6)) | 0;
mid = (mid + imul(ah1, bl6)) | 0;
hi = (hi + imul(ah1, bh6)) | 0;
lo = (lo + imul(al0, bl7)) | 0;
mid = (mid + imul(al0, bh7)) | 0;
mid = (mid + imul(ah0, bl7)) | 0;
hi = (hi + imul(ah0, bh7)) | 0;
var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
w7 &= 0x3ffffff;
/* k = 8 */
lo = imul(al8, bl0);
mid = imul(al8, bh0);
mid = (mid + imul(ah8, bl0)) | 0;
hi = imul(ah8, bh0);
lo = (lo + imul(al7, bl1)) | 0;
mid = (mid + imul(al7, bh1)) | 0;
mid = (mid + imul(ah7, bl1)) | 0;
hi = (hi + imul(ah7, bh1)) | 0;
lo = (lo + imul(al6, bl2)) | 0;
mid = (mid + imul(al6, bh2)) | 0;
mid = (mid + imul(ah6, bl2)) | 0;
hi = (hi + imul(ah6, bh2)) | 0;
lo = (lo + imul(al5, bl3)) | 0;
mid = (mid + imul(al5, bh3)) | 0;
mid = (mid + imul(ah5, bl3)) | 0;
hi = (hi + imul(ah5, bh3)) | 0;
lo = (lo + imul(al4, bl4)) | 0;
mid = (mid + imul(al4, bh4)) | 0;
mid = (mid + imul(ah4, bl4)) | 0;
hi = (hi + imul(ah4, bh4)) | 0;
lo = (lo + imul(al3, bl5)) | 0;
mid = (mid + imul(al3, bh5)) | 0;
mid = (mid + imul(ah3, bl5)) | 0;
hi = (hi + imul(ah3, bh5)) | 0;
lo = (lo + imul(al2, bl6)) | 0;
mid = (mid + imul(al2, bh6)) | 0;
mid = (mid + imul(ah2, bl6)) | 0;
hi = (hi + imul(ah2, bh6)) | 0;
lo = (lo + imul(al1, bl7)) | 0;
mid = (mid + imul(al1, bh7)) | 0;
mid = (mid + imul(ah1, bl7)) | 0;
hi = (hi + imul(ah1, bh7)) | 0;
lo = (lo + imul(al0, bl8)) | 0;
mid = (mid + imul(al0, bh8)) | 0;
mid = (mid + imul(ah0, bl8)) | 0;
hi = (hi + imul(ah0, bh8)) | 0;
var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
w8 &= 0x3ffffff;
/* k = 9 */
lo = imul(al9, bl0);
mid = imul(al9, bh0);
mid = (mid + imul(ah9, bl0)) | 0;
hi = imul(ah9, bh0);
lo = (lo + imul(al8, bl1)) | 0;
mid = (mid + imul(al8, bh1)) | 0;
mid = (mid + imul(ah8, bl1)) | 0;
hi = (hi + imul(ah8, bh1)) | 0;
lo = (lo + imul(al7, bl2)) | 0;
mid = (mid + imul(al7, bh2)) | 0;
mid = (mid + imul(ah7, bl2)) | 0;
hi = (hi + imul(ah7, bh2)) | 0;
lo = (lo + imul(al6, bl3)) | 0;
mid = (mid + imul(al6, bh3)) | 0;
mid = (mid + imul(ah6, bl3)) | 0;
hi = (hi + imul(ah6, bh3)) | 0;
lo = (lo + imul(al5, bl4)) | 0;
mid = (mid + imul(al5, bh4)) | 0;
mid = (mid + imul(ah5, bl4)) | 0;
hi = (hi + imul(ah5, bh4)) | 0;
lo = (lo + imul(al4, bl5)) | 0;
mid = (mid + imul(al4, bh5)) | 0;
mid = (mid + imul(ah4, bl5)) | 0;
hi = (hi + imul(ah4, bh5)) | 0;
lo = (lo + imul(al3, bl6)) | 0;
mid = (mid + imul(al3, bh6)) | 0;
mid = (mid + imul(ah3, bl6)) | 0;
hi = (hi + imul(ah3, bh6)) | 0;
lo = (lo + imul(al2, bl7)) | 0;
mid = (mid + imul(al2, bh7)) | 0;
mid = (mid + imul(ah2, bl7)) | 0;
hi = (hi + imul(ah2, bh7)) | 0;
lo = (lo + imul(al1, bl8)) | 0;
mid = (mid + imul(al1, bh8)) | 0;
mid = (mid + imul(ah1, bl8)) | 0;
hi = (hi + imul(ah1, bh8)) | 0;
lo = (lo + imul(al0, bl9)) | 0;
mid = (mid + imul(al0, bh9)) | 0;
mid = (mid + imul(ah0, bl9)) | 0;
hi = (hi + imul(ah0, bh9)) | 0;
var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
w9 &= 0x3ffffff;
/* k = 10 */
lo = imul(al9, bl1);
mid = imul(al9, bh1);
mid = (mid + imul(ah9, bl1)) | 0;
hi = imul(ah9, bh1);
lo = (lo + imul(al8, bl2)) | 0;
mid = (mid + imul(al8, bh2)) | 0;
mid = (mid + imul(ah8, bl2)) | 0;
hi = (hi + imul(ah8, bh2)) | 0;
lo = (lo + imul(al7, bl3)) | 0;
mid = (mid + imul(al7, bh3)) | 0;
mid = (mid + imul(ah7, bl3)) | 0;
hi = (hi + imul(ah7, bh3)) | 0;
lo = (lo + imul(al6, bl4)) | 0;
mid = (mid + imul(al6, bh4)) | 0;
mid = (mid + imul(ah6, bl4)) | 0;
hi = (hi + imul(ah6, bh4)) | 0;
lo = (lo + imul(al5, bl5)) | 0;
mid = (mid + imul(al5, bh5)) | 0;
mid = (mid + imul(ah5, bl5)) | 0;
hi = (hi + imul(ah5, bh5)) | 0;
lo = (lo + imul(al4, bl6)) | 0;
mid = (mid + imul(al4, bh6)) | 0;
mid = (mid + imul(ah4, bl6)) | 0;
hi = (hi + imul(ah4, bh6)) | 0;
lo = (lo + imul(al3, bl7)) | 0;
mid = (mid + imul(al3, bh7)) | 0;
mid = (mid + imul(ah3, bl7)) | 0;
hi = (hi + imul(ah3, bh7)) | 0;
lo = (lo + imul(al2, bl8)) | 0;
mid = (mid + imul(al2, bh8)) | 0;
mid = (mid + imul(ah2, bl8)) | 0;
hi = (hi + imul(ah2, bh8)) | 0;
lo = (lo + imul(al1, bl9)) | 0;
mid = (mid + imul(al1, bh9)) | 0;
mid = (mid + imul(ah1, bl9)) | 0;
hi = (hi + imul(ah1, bh9)) | 0;
var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
w10 &= 0x3ffffff;
/* k = 11 */
lo = imul(al9, bl2);
mid = imul(al9, bh2);
mid = (mid + imul(ah9, bl2)) | 0;
hi = imul(ah9, bh2);
lo = (lo + imul(al8, bl3)) | 0;
mid = (mid + imul(al8, bh3)) | 0;
mid = (mid + imul(ah8, bl3)) | 0;
hi = (hi + imul(ah8, bh3)) | 0;
lo = (lo + imul(al7, bl4)) | 0;
mid = (mid + imul(al7, bh4)) | 0;
mid = (mid + imul(ah7, bl4)) | 0;
hi = (hi + imul(ah7, bh4)) | 0;
lo = (lo + imul(al6, bl5)) | 0;
mid = (mid + imul(al6, bh5)) | 0;
mid = (mid + imul(ah6, bl5)) | 0;
hi = (hi + imul(ah6, bh5)) | 0;
lo = (lo + imul(al5, bl6)) | 0;
mid = (mid + imul(al5, bh6)) | 0;
mid = (mid + imul(ah5, bl6)) | 0;
hi = (hi + imul(ah5, bh6)) | 0;
lo = (lo + imul(al4, bl7)) | 0;
mid = (mid + imul(al4, bh7)) | 0;
mid = (mid + imul(ah4, bl7)) | 0;
hi = (hi + imul(ah4, bh7)) | 0;
lo = (lo + imul(al3, bl8)) | 0;
mid = (mid + imul(al3, bh8)) | 0;
mid = (mid + imul(ah3, bl8)) | 0;
hi = (hi + imul(ah3, bh8)) | 0;
lo = (lo + imul(al2, bl9)) | 0;
mid = (mid + imul(al2, bh9)) | 0;
mid = (mid + imul(ah2, bl9)) | 0;
hi = (hi + imul(ah2, bh9)) | 0;
var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
w11 &= 0x3ffffff;
/* k = 12 */
lo = imul(al9, bl3);
mid = imul(al9, bh3);
mid = (mid + imul(ah9, bl3)) | 0;
hi = imul(ah9, bh3);
lo = (lo + imul(al8, bl4)) | 0;
mid = (mid + imul(al8, bh4)) | 0;
mid = (mid + imul(ah8, bl4)) | 0;
hi = (hi + imul(ah8, bh4)) | 0;
lo = (lo + imul(al7, bl5)) | 0;
mid = (mid + imul(al7, bh5)) | 0;
mid = (mid + imul(ah7, bl5)) | 0;
hi = (hi + imul(ah7, bh5)) | 0;
lo = (lo + imul(al6, bl6)) | 0;
mid = (mid + imul(al6, bh6)) | 0;
mid = (mid + imul(ah6, bl6)) | 0;
hi = (hi + imul(ah6, bh6)) | 0;
lo = (lo + imul(al5, bl7)) | 0;
mid = (mid + imul(al5, bh7)) | 0;
mid = (mid + imul(ah5, bl7)) | 0;
hi = (hi + imul(ah5, bh7)) | 0;
lo = (lo + imul(al4, bl8)) | 0;
mid = (mid + imul(al4, bh8)) | 0;
mid = (mid + imul(ah4, bl8)) | 0;
hi = (hi + imul(ah4, bh8)) | 0;
lo = (lo + imul(al3, bl9)) | 0;
mid = (mid + imul(al3, bh9)) | 0;
mid = (mid + imul(ah3, bl9)) | 0;
hi = (hi + imul(ah3, bh9)) | 0;
var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
w12 &= 0x3ffffff;
/* k = 13 */
lo = imul(al9, bl4);
mid = imul(al9, bh4);
mid = (mid + imul(ah9, bl4)) | 0;
hi = imul(ah9, bh4);
lo = (lo + imul(al8, bl5)) | 0;
mid = (mid + imul(al8, bh5)) | 0;
mid = (mid + imul(ah8, bl5)) | 0;
hi = (hi + imul(ah8, bh5)) | 0;
lo = (lo + imul(al7, bl6)) | 0;
mid = (mid + imul(al7, bh6)) | 0;
mid = (mid + imul(ah7, bl6)) | 0;
hi = (hi + imul(ah7, bh6)) | 0;
lo = (lo + imul(al6, bl7)) | 0;
mid = (mid + imul(al6, bh7)) | 0;
mid = (mid + imul(ah6, bl7)) | 0;
hi = (hi + imul(ah6, bh7)) | 0;
lo = (lo + imul(al5, bl8)) | 0;
mid = (mid + imul(al5, bh8)) | 0;
mid = (mid + imul(ah5, bl8)) | 0;
hi = (hi + imul(ah5, bh8)) | 0;
lo = (lo + imul(al4, bl9)) | 0;
mid = (mid + imul(al4, bh9)) | 0;
mid = (mid + imul(ah4, bl9)) | 0;
hi = (hi + imul(ah4, bh9)) | 0;
var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
w13 &= 0x3ffffff;
/* k = 14 */
lo = imul(al9, bl5);
mid = imul(al9, bh5);
mid = (mid + imul(ah9, bl5)) | 0;
hi = imul(ah9, bh5);
lo = (lo + imul(al8, bl6)) | 0;
mid = (mid + imul(al8, bh6)) | 0;
mid = (mid + imul(ah8, bl6)) | 0;
hi = (hi + imul(ah8, bh6)) | 0;
lo = (lo + imul(al7, bl7)) | 0;
mid = (mid + imul(al7, bh7)) | 0;
mid = (mid + imul(ah7, bl7)) | 0;
hi = (hi + imul(ah7, bh7)) | 0;
lo = (lo + imul(al6, bl8)) | 0;
mid = (mid + imul(al6, bh8)) | 0;
mid = (mid + imul(ah6, bl8)) | 0;
hi = (hi + imul(ah6, bh8)) | 0;
lo = (lo + imul(al5, bl9)) | 0;
mid = (mid + imul(al5, bh9)) | 0;
mid = (mid + imul(ah5, bl9)) | 0;
hi = (hi + imul(ah5, bh9)) | 0;
var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
w14 &= 0x3ffffff;
/* k = 15 */
lo = imul(al9, bl6);
mid = imul(al9, bh6);
mid = (mid + imul(ah9, bl6)) | 0;
hi = imul(ah9, bh6);
lo = (lo + imul(al8, bl7)) | 0;
mid = (mid + imul(al8, bh7)) | 0;
mid = (mid + imul(ah8, bl7)) | 0;
hi = (hi + imul(ah8, bh7)) | 0;
lo = (lo + imul(al7, bl8)) | 0;
mid = (mid + imul(al7, bh8)) | 0;
mid = (mid + imul(ah7, bl8)) | 0;
hi = (hi + imul(ah7, bh8)) | 0;
lo = (lo + imul(al6, bl9)) | 0;
mid = (mid + imul(al6, bh9)) | 0;
mid = (mid + imul(ah6, bl9)) | 0;
hi = (hi + imul(ah6, bh9)) | 0;
var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
w15 &= 0x3ffffff;
/* k = 16 */
lo = imul(al9, bl7);
mid = imul(al9, bh7);
mid = (mid + imul(ah9, bl7)) | 0;
hi = imul(ah9, bh7);
lo = (lo + imul(al8, bl8)) | 0;
mid = (mid + imul(al8, bh8)) | 0;
mid = (mid + imul(ah8, bl8)) | 0;
hi = (hi + imul(ah8, bh8)) | 0;
lo = (lo + imul(al7, bl9)) | 0;
mid = (mid + imul(al7, bh9)) | 0;
mid = (mid + imul(ah7, bl9)) | 0;
hi = (hi + imul(ah7, bh9)) | 0;
var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
w16 &= 0x3ffffff;
/* k = 17 */
lo = imul(al9, bl8);
mid = imul(al9, bh8);
mid = (mid + imul(ah9, bl8)) | 0;
hi = imul(ah9, bh8);
lo = (lo + imul(al8, bl9)) | 0;
mid = (mid + imul(al8, bh9)) | 0;
mid = (mid + imul(ah8, bl9)) | 0;
hi = (hi + imul(ah8, bh9)) | 0;
var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
w17 &= 0x3ffffff;
/* k = 18 */
lo = imul(al9, bl9);
mid = imul(al9, bh9);
mid = (mid + imul(ah9, bl9)) | 0;
hi = imul(ah9, bh9);
var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
w18 &= 0x3ffffff;
o[0] = w0;
o[1] = w1;
o[2] = w2;
o[3] = w3;
o[4] = w4;
o[5] = w5;
o[6] = w6;
o[7] = w7;
o[8] = w8;
o[9] = w9;
o[10] = w10;
o[11] = w11;
o[12] = w12;
o[13] = w13;
o[14] = w14;
o[15] = w15;
o[16] = w16;
o[17] = w17;
o[18] = w18;
if (c !== 0) {
  o[19] = c;
  out.length++;
}
return out;
};

// Polyfill comb
if (!Math.imul) {
comb10MulTo = smallMulTo;
}

BN.prototype.mulTo = function mulTo (num, out) {
var res;
var len = this.length + num.length;
if (this.length === 10 && num.length === 10) {
  res = comb10MulTo(this, num, out);
} else if (len < 63) {
  res = smallMulTo(this, num, out);
} else if (len < 1024) {
  throw "removed";
  //res = bigMulTo(this, num, out);
} else {
  throw "removed";
  //res = jumboMulTo(this, num, out);
}

return res;
};

// Multiply `this` by `num`
BN.prototype.mul = function mul (num) {
var out = new BN(null);
out.words = new Array(this.length + num.length);
return this.mulTo(num, out);
};

// Shift-left in-place
BN.prototype.iushln = function iushln (bits) {
assert(typeof bits === 'number' && bits >= 0);
var r = bits % 26;
var s = (bits - r) / 26;
var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
var i;

if (r !== 0) {
  var carry = 0;

  for (i = 0; i < this.length; i++) {
    var newCarry = this.words[i] & carryMask;
    var c = ((this.words[i] | 0) - newCarry) << r;
    this.words[i] = c | carry;
    carry = newCarry >>> (26 - r);
  }

  if (carry) {
    this.words[i] = carry;
    this.length++;
  }
}

if (s !== 0) {
  for (i = this.length - 1; i >= 0; i--) {
    this.words[i + s] = this.words[i];
  }

  for (i = 0; i < s; i++) {
    this.words[i] = 0;
  }

  this.length += s;
}

return this.strip();
};

// Shift-right in-place
// NOTE: `hint` is a lowest bit before trailing zeroes
// NOTE: if `extended` is present - it will be filled with destroyed bits
BN.prototype.iushrn = function iushrn (bits, hint, extended) {
assert(typeof bits === 'number' && bits >= 0);
var h;
if (hint) {
  h = (hint - (hint % 26)) / 26;
} else {
  h = 0;
}

var r = bits % 26;
var s = Math.min((bits - r) / 26, this.length);
var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
var maskedWords = extended;

h -= s;
h = Math.max(0, h);

// Extended mode, copy masked part
if (maskedWords) {
  for (var i = 0; i < s; i++) {
    maskedWords.words[i] = this.words[i];
  }
  maskedWords.length = s;
}

if (s === 0) {
  // No-op, we should not move anything at all
} else if (this.length > s) {
  this.length -= s;
  for (i = 0; i < this.length; i++) {
    this.words[i] = this.words[i + s];
  }
} else {
  this.words[0] = 0;
  this.length = 1;
}

var carry = 0;
for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
  var word = this.words[i] | 0;
  this.words[i] = (carry << (26 - r)) | (word >>> r);
  carry = word & mask;
}

// Push carried bits as a mask
if (maskedWords && carry !== 0) {
  maskedWords.words[maskedWords.length++] = carry;
}

if (this.length === 0) {
  this.words[0] = 0;
  this.length = 1;
}

return this.strip();
};

BN.prototype.ushln = function ushln (bits) {
return this.clone().iushln(bits);
};

BN.prototype.ushrn = function ushrn (bits) {
return this.clone().iushrn(bits);
};

// Add plain number `num` to `this`
BN.prototype.iaddn = function iaddn (num) {
assert(typeof num === 'number');
assert(num < 0x4000000);
if (num < 0) return this.isubn(-num);

// Possible sign change
if (this.negative !== 0) {
  if (this.length === 1 && (this.words[0] | 0) < num) {
    this.words[0] = num - (this.words[0] | 0);
    this.negative = 0;
    return this;
  }

  this.negative = 0;
  this.isubn(num);
  this.negative = 1;
  return this;
}

// Add without checks
return this._iaddn(num);
};

BN.prototype._iaddn = function _iaddn (num) {
this.words[0] += num;

// Carry
for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
  this.words[i] -= 0x4000000;
  if (i === this.length - 1) {
    this.words[i + 1] = 1;
  } else {
    this.words[i + 1]++;
  }
}
this.length = Math.max(this.length, i + 1);

return this;
};

// Subtract plain number `num` from `this`
BN.prototype.isubn = function isubn (num) {
assert(typeof num === 'number');
assert(num < 0x4000000);
if (num < 0) return this.iaddn(-num);

if (this.negative !== 0) {
  this.negative = 0;
  this.iaddn(num);
  this.negative = 1;
  return this;
}

this.words[0] -= num;

if (this.length === 1 && this.words[0] < 0) {
  this.words[0] = -this.words[0];
  this.negative = 1;
} else {
  // Carry
  for (var i = 0; i < this.length && this.words[i] < 0; i++) {
    this.words[i] += 0x4000000;
    this.words[i + 1] -= 1;
  }
}

return this.strip();
};

BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
var len = num.length + shift;
var i;

this._expand(len);

var w;
var carry = 0;
for (i = 0; i < num.length; i++) {
  w = (this.words[i + shift] | 0) + carry;
  var right = (num.words[i] | 0) * mul;
  w -= right & 0x3ffffff;
  carry = (w >> 26) - ((right / 0x4000000) | 0);
  this.words[i + shift] = w & 0x3ffffff;
}
for (; i < this.length - shift; i++) {
  w = (this.words[i + shift] | 0) + carry;
  carry = w >> 26;
  this.words[i + shift] = w & 0x3ffffff;
}

if (carry === 0) return this.strip();

// Subtraction overflow
assert(carry === -1);
carry = 0;
for (i = 0; i < this.length; i++) {
  w = -(this.words[i] | 0) + carry;
  carry = w >> 26;
  this.words[i] = w & 0x3ffffff;
}
this.negative = 1;

return this.strip();
};

BN.prototype._wordDiv = function _wordDiv (num, mode) {
var shift = this.length - num.length;

var a = this.clone();
var b = num;

// Normalize
var bhi = b.words[b.length - 1] | 0;
var bhiBits = this._countBits(bhi);
shift = 26 - bhiBits;
if (shift !== 0) {
  b = b.ushln(shift);
  a.iushln(shift);
  bhi = b.words[b.length - 1] | 0;
}

// Initialize quotient
var m = a.length - b.length;
var q;

if (mode !== 'mod') {
  q = new BN(null);
  q.length = m + 1;
  q.words = new Array(q.length);
  for (var i = 0; i < q.length; i++) {
    q.words[i] = 0;
  }
}

var diff = a.clone()._ishlnsubmul(b, 1, m);
if (diff.negative === 0) {
  a = diff;
  if (q) {
    q.words[m] = 1;
  }
}

for (var j = m - 1; j >= 0; j--) {
  var qj = (a.words[b.length + j] | 0) * 0x4000000 +
    (a.words[b.length + j - 1] | 0);

  // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
  // (0x7ffffff)
  qj = Math.min((qj / bhi) | 0, 0x3ffffff);

  a._ishlnsubmul(b, qj, j);
  while (a.negative !== 0) {
    qj--;
    a.negative = 0;
    a._ishlnsubmul(b, 1, j);
    if (!a.isZero()) {
      a.negative ^= 1;
    }
  }
  if (q) {
    q.words[j] = qj;
  }
}
if (q) {
  q.strip();
}
a.strip();

// Denormalize
if (mode !== 'div' && shift !== 0) {
  a.iushrn(shift);
}

return {
  div: q || null,
  mod: a
};
};

// NOTE: 1) `mode` can be set to `mod` to request mod only,
//       to `div` to request div only, or be absent to
//       request both div & mod
//       2) `positive` is true if unsigned mod is requested
BN.prototype.divmod = function divmod (num, mode, positive) {
assert(!num.isZero());

if (this.isZero()) {
  return {
    div: new BN(0),
    mod: new BN(0)
  };
}

var div, mod, res;
if (this.negative !== 0 && num.negative === 0) {
  res = this.neg().divmod(num, mode);

  if (mode !== 'mod') {
    div = res.div.neg();
  }

  if (mode !== 'div') {
    mod = res.mod.neg();
    if (positive && mod.negative !== 0) {
      mod.iadd(num);
    }
  }

  return {
    div: div,
    mod: mod
  };
}

if (this.negative === 0 && num.negative !== 0) {
  res = this.divmod(num.neg(), mode);

  if (mode !== 'mod') {
    div = res.div.neg();
  }

  return {
    div: div,
    mod: res.mod
  };
}

if ((this.negative & num.negative) !== 0) {
  res = this.neg().divmod(num.neg(), mode);

  if (mode !== 'div') {
    mod = res.mod.neg();
    if (positive && mod.negative !== 0) {
      mod.isub(num);
    }
  }

  return {
    div: res.div,
    mod: mod
  };
}

// Both numbers are positive at this point

// Strip both numbers to approximate shift value
if (num.length > this.length || this.cmp(num) < 0) {
  return {
    div: new BN(0),
    mod: this
  };
}

// Very short reduction
if (num.length === 1) {
  if (mode === 'div') {
    return {
      div: this.divn(num.words[0]),
      mod: null
    };
  }

  if (mode === 'mod') {
    return {
      div: null,
      mod: new BN(this.modn(num.words[0]))
    };
  }

  return {
    div: this.divn(num.words[0]),
    mod: new BN(this.modn(num.words[0]))
  };
}

return this._wordDiv(num, mode);
};

// Find `this` / `num`
BN.prototype.div = function div (num) {
return this.divmod(num, 'div', false).div;
};

BN.prototype.umod = function umod (num) {
return this.divmod(num, 'mod', true).mod;
};

// Find Round(`this` / `num`)
BN.prototype.divRound = function divRound (num) {
var dm = this.divmod(num);

// Fast case - exact division
if (dm.mod.isZero()) return dm.div;

var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

var half = num.ushrn(1);
var r2 = num.andln(1);
var cmp = mod.cmp(half);

// Round down
if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;

// Round up
return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
};

BN.prototype.modn = function modn (num) {
assert(num <= 0x3ffffff);
var p = (1 << 26) % num;

var acc = 0;
for (var i = this.length - 1; i >= 0; i--) {
  acc = (p * acc + (this.words[i] | 0)) % num;
}

return acc;
};

BN.prototype.egcd = function egcd (p) {
assert(p.negative === 0);
assert(!p.isZero());

var x = this;
var y = p.clone();

if (x.negative !== 0) {
  x = x.umod(p);
} else {
  x = x.clone();
}

// A * x + B * y = x
var A = new BN(1);
var B = new BN(0);

// C * x + D * y = y
var C = new BN(0);
var D = new BN(1);

var g = 0;

while (x.isEven() && y.isEven()) {
  x.iushrn(1);
  y.iushrn(1);
  ++g;
}

var yp = y.clone();
var xp = x.clone();

while (!x.isZero()) {
  for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1){};
  if (i > 0) {
    x.iushrn(i);
    while (i-- > 0) {
      if (A.isOdd() || B.isOdd()) {
        A.iadd(yp);
        B.isub(xp);
      }

      A.iushrn(1);
      B.iushrn(1);
    }
  }

  for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1){};
  if (j > 0) {
    y.iushrn(j);
    while (j-- > 0) {
      if (C.isOdd() || D.isOdd()) {
        C.iadd(yp);
        D.isub(xp);
      }

      C.iushrn(1);
      D.iushrn(1);
    }
  }

  if (x.cmp(y) >= 0) {
    x.isub(y);
    A.isub(C);
    B.isub(D);
  } else {
    y.isub(x);
    C.isub(A);
    D.isub(B);
  }
}

return {
  a: C,
  b: D,
  gcd: y.iushln(g)
};
};

// This is reduced incarnation of the binary EEA
// above, designated to invert members of the
// _prime_ fields F(p) at a maximal speed
BN.prototype._invmp = function _invmp (p) {
assert(p.negative === 0);
assert(!p.isZero());

var a = this;
var b = p.clone();

if (a.negative !== 0) {
  a = a.umod(p);
} else {
  a = a.clone();
}

var x1 = new BN(1);
var x2 = new BN(0);

var delta = b.clone();

while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
  for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1){};
  if (i > 0) {
    a.iushrn(i);
    while (i-- > 0) {
      if (x1.isOdd()) {
        x1.iadd(delta);
      }

      x1.iushrn(1);
    }
  }

  for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1){};
  if (j > 0) {
    b.iushrn(j);
    while (j-- > 0) {
      if (x2.isOdd()) {
        x2.iadd(delta);
      }

      x2.iushrn(1);
    }
  }

  if (a.cmp(b) >= 0) {
    a.isub(b);
    x1.isub(x2);
  } else {
    b.isub(a);
    x2.isub(x1);
  }
}

var res;
if (a.cmpn(1) === 0) {
  res = x1;
} else {
  res = x2;
}

if (res.cmpn(0) < 0) {
  res.iadd(p);
}

return res;
};

// Invert number in the field F(num)
BN.prototype.invm = function invm (num) {
return this.egcd(num).a.umod(num);
};

BN.prototype.isEven = function isEven () {
return (this.words[0] & 1) === 0;
};

BN.prototype.isOdd = function isOdd () {
return (this.words[0] & 1) === 1;
};

// And first word and num
BN.prototype.andln = function andln (num) {
return this.words[0] & num;
};

BN.prototype.isZero = function isZero () {
return this.length === 1 && this.words[0] === 0;
};

BN.prototype.cmpn = function cmpn (num) {
var negative = num < 0;

if (this.negative !== 0 && !negative) return -1;
if (this.negative === 0 && negative) return 1;

this.strip();

var res;
if (this.length > 1) {
  res = 1;
} else {
  if (negative) {
    num = -num;
  }

  assert(num <= 0x3ffffff, 'Number is too big');

  var w = this.words[0] | 0;
  res = w === num ? 0 : w < num ? -1 : 1;
}
if (this.negative !== 0) return -res | 0;
return res;
};

// Compare two numbers and return:
// 1 - if `this` > `num`
// 0 - if `this` == `num`
// -1 - if `this` < `num`
BN.prototype.cmp = function cmp (num) {
if (this.negative !== 0 && num.negative === 0) return -1;
if (this.negative === 0 && num.negative !== 0) return 1;

var res = this.ucmp(num);
if (this.negative !== 0) return -res | 0;
return res;
};

// Unsigned comparison
BN.prototype.ucmp = function ucmp (num) {
// At this point both numbers have the same sign
if (this.length > num.length) return 1;
if (this.length < num.length) return -1;

var res = 0;
for (var i = this.length - 1; i >= 0; i--) {
  var a = this.words[i] | 0;
  var b = num.words[i] | 0;

  if (a === b) continue;
  if (a < b) {
    res = -1;
  } else if (a > b) {
    res = 1;
  }
  break;
}
return res;
};

BN.red = function red (num) {
return new Red(num);
};

BN.prototype.toRed = function toRed (ctx) {
assert(!this.red, 'Already a number in reduction context');
assert(this.negative === 0, 'red works only with positives');
return ctx.convertTo(this)._forceRed(ctx);
};

BN.prototype.fromRed = function fromRed () {
assert(this.red, 'fromRed works only with numbers in reduction context');
return this.red.convertFrom(this);
};

BN.prototype._forceRed = function _forceRed (ctx) {
this.red = ctx;
return this;
};

BN.prototype.redAdd = function redAdd (num) {
assert(this.red, 'redAdd works only with red numbers');
return this.red.add(this, num);
};

BN.prototype.redIAdd = function redIAdd (num) {
assert(this.red, 'redIAdd works only with red numbers');
return this.red.iadd(this, num);
};

BN.prototype.redSub = function redSub (num) {
assert(this.red, 'redSub works only with red numbers');
return this.red.sub(this, num);
};

BN.prototype.redISub = function redISub (num) {
assert(this.red, 'redISub works only with red numbers');
return this.red.isub(this, num);
};

BN.prototype.redMul = function redMul (num) {
assert(this.red, 'redMul works only with red numbers');
this.red._verify2(this, num);
return this.red.mul(this, num);
};

BN.prototype.redSqr = function redSqr () {
assert(this.red, 'redSqr works only with red numbers');
this.red._verify1(this);
return this.red.sqr(this);
};

// Square root over p
BN.prototype.redSqrt = function redSqrt () {
assert(this.red, 'redSqrt works only with red numbers');
this.red._verify1(this);
return this.red.sqrt(this);
};

BN.prototype.redInvm = function redInvm () {
assert(this.red, 'redInvm works only with red numbers');
this.red._verify1(this);
return this.red.invm(this);
};

// Return negative clone of `this` % `red modulo`
BN.prototype.redNeg = function redNeg () {
assert(this.red, 'redNeg works only with red numbers');
this.red._verify1(this);
return this.red.neg(this);
};

// Prime numbers with efficient reduction
var primes = {
k256: null,
p224: null,
p192: null,
p25519: null
};

// Pseudo-Mersenne prime
function MPrime (name, p) {
// P = 2 ^ N - K
this.name = name;
this.p = new BN(p, 16);
this.n = this.p.bitLength();
this.k = new BN(1).iushln(this.n).isub(this.p);

this.tmp = this._tmp();
}

MPrime.prototype._tmp = function _tmp () {
var tmp = new BN(null);
tmp.words = new Array(Math.ceil(this.n / 13));
return tmp;
};

MPrime.prototype.ireduce = function ireduce (num) {
// Assumes that `num` is less than `P^2`
// num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
var r = num;
var rlen;

do {
  this.split(r, this.tmp);
  r = this.imulK(r);
  r = r.iadd(this.tmp);
  rlen = r.bitLength();
} while (rlen > this.n);

var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
if (cmp === 0) {
  r.words[0] = 0;
  r.length = 1;
} else if (cmp > 0) {
  r.isub(this.p);
} else {
  r.strip();
}

return r;
};

function K256 () {
MPrime.call(
  this,
  'k256',
  'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
}
inherits(K256, MPrime);

K256.prototype.split = function split (input, output) {
// 256 = 9 * 26 + 22
var mask = 0x3fffff;

var outLen = Math.min(input.length, 9);
for (var i = 0; i < outLen; i++) {
  output.words[i] = input.words[i];
}
output.length = outLen;

if (input.length <= 9) {
  input.words[0] = 0;
  input.length = 1;
  return;
}

// Shift by 9 limbs
var prev = input.words[9];
output.words[output.length++] = prev & mask;

for (i = 10; i < input.length; i++) {
  var next = input.words[i] | 0;
  input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
  prev = next;
}
prev >>>= 22;
input.words[i - 10] = prev;
if (prev === 0 && input.length > 10) {
  input.length -= 10;
} else {
  input.length -= 9;
}
};

K256.prototype.imulK = function imulK (num) {
// K = 0x1000003d1 = [ 0x40, 0x3d1 ]
num.words[num.length] = 0;
num.words[num.length + 1] = 0;
num.length += 2;

// bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
var lo = 0;
for (var i = 0; i < num.length; i++) {
  var w = num.words[i] | 0;
  lo += w * 0x3d1;
  num.words[i] = lo & 0x3ffffff;
  lo = w * 0x40 + ((lo / 0x4000000) | 0);
}

// Fast length reduction
if (num.words[num.length - 1] === 0) {
  num.length--;
  if (num.words[num.length - 1] === 0) {
    num.length--;
  }
}
return num;
};

// Exported mostly for testing purposes, use plain name instead
BN._prime = function prime (name) {
// Cached version of prime
if (primes[name]) return primes[name];
var prime = new K256();
primes[name] = prime;
return prime;
};

//
// Base reduction engine
//
function Red (m) {
if (typeof m === 'string') {
  var prime = BN._prime(m);
  this.m = prime.p;
  this.prime = prime;
} else {
  assert(m.gtn(1), 'modulus must be greater than 1');
  this.m = m;
  this.prime = null;
}
}

Red.prototype._verify1 = function _verify1 (a) {
assert(a.negative === 0, 'red works only with positives');
assert(a.red, 'red works only with red numbers');
};

Red.prototype._verify2 = function _verify2 (a, b) {
assert((a.negative | b.negative) === 0, 'red works only with positives');
assert(a.red && a.red === b.red,
  'red works only with red numbers');
};

Red.prototype.imod = function imod (a) {
if (this.prime) return this.prime.ireduce(a)._forceRed(this);
return a.umod(this.m)._forceRed(this);
};

Red.prototype.neg = function neg (a) {
if (a.isZero()) {
  return a.clone();
}

return this.m.sub(a)._forceRed(this);
};

Red.prototype.add = function add (a, b) {
this._verify2(a, b);

var res = a.add(b);
if (res.cmp(this.m) >= 0) {
  res.isub(this.m);
}
return res._forceRed(this);
};

Red.prototype.iadd = function iadd (a, b) {
this._verify2(a, b);

var res = a.iadd(b);
if (res.cmp(this.m) >= 0) {
  res.isub(this.m);
}
return res;
};

Red.prototype.sub = function sub (a, b) {
this._verify2(a, b);

var res = a.sub(b);
if (res.cmpn(0) < 0) {
  res.iadd(this.m);
}
return res._forceRed(this);
};

Red.prototype.isub = function isub (a, b) {
this._verify2(a, b);

var res = a.isub(b);
if (res.cmpn(0) < 0) {
  res.iadd(this.m);
}
return res;
};

Red.prototype.mul = function mul (a, b) {
this._verify2(a, b);
return this.imod(a.mul(b));
};

Red.prototype.sqr = function sqr (a) {
return this.mul(a, a);
};

Red.prototype.sqrt = function sqrt (a) {
if (a.isZero()) return a.clone();

var mod3 = this.m.andln(3);
assert(mod3 % 2 === 1);

// Fast case
if (mod3 === 3) {
  var pow = this.m.add(new BN(1)).iushrn(2);
  return this.pow(a, pow);
}

// Tonelli-Shanks algorithm (Totally unoptimized and slow)
//
// Find Q and S, that Q * 2 ^ S = (P - 1)
var q = this.m.subn(1);
var s = 0;
while (!q.isZero() && q.andln(1) === 0) {
  s++;
  q.iushrn(1);
}
assert(!q.isZero());

var one = new BN(1).toRed(this);
var nOne = one.redNeg();

// Find quadratic non-residue
// NOTE: Max is such because of generalized Riemann hypothesis.
var lpow = this.m.subn(1).iushrn(1);
var z = this.m.bitLength();
z = new BN(2 * z * z).toRed(this);

while (this.pow(z, lpow).cmp(nOne) !== 0) {
  z.redIAdd(nOne);
}

var c = this.pow(z, q);
var r = this.pow(a, q.addn(1).iushrn(1));
var t = this.pow(a, q);
var m = s;
while (t.cmp(one) !== 0) {
  var tmp = t;
  for (var i = 0; tmp.cmp(one) !== 0; i++) {
    tmp = tmp.redSqr();
  }
  assert(i < m);
  var b = this.pow(c, new BN(1).iushln(m - i - 1));

  r = r.redMul(b);
  c = b.redSqr();
  t = t.redMul(c);
  m = i;
}

return r;
};

Red.prototype.invm = function invm (a) {
var inv = a._invmp(this.m);
if (inv.negative !== 0) {
  inv.negative = 0;
  return this.imod(inv).redNeg();
} else {
  return this.imod(inv);
}
};

Red.prototype.pow = function pow (a, num) {
if (num.isZero()) return new BN(1).toRed(this);
if (num.cmpn(1) === 0) return a.clone();

var windowSize = 4;
var wnd = new Array(1 << windowSize);
wnd[0] = new BN(1).toRed(this);
wnd[1] = a;
for (var i = 2; i < wnd.length; i++) {
  wnd[i] = this.mul(wnd[i - 1], a);
}

var res = wnd[0];
var current = 0;
var currentLen = 0;
var start = num.bitLength() % 26;
if (start === 0) {
  start = 26;
}

for (i = num.length - 1; i >= 0; i--) {
  var word = num.words[i];
  for (var j = start - 1; j >= 0; j--) {
    var bit = (word >> j) & 1;
    if (res !== wnd[0]) {
      res = this.sqr(res);
    }

    if (bit === 0 && current === 0) {
      currentLen = 0;
      continue;
    }

    current <<= 1;
    current |= bit;
    currentLen++;
    if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

    res = this.mul(res, wnd[current]);
    currentLen = 0;
    current = 0;
  }
  start = 26;
}

return res;
};

Red.prototype.convertTo = function convertTo (num) {
var r = num.umod(this.m);

return r === num ? r.clone() : r;
};

Red.prototype.convertFrom = function convertFrom (num) {
var res = num.clone();
res.red = null;
return res;
};

return exports;
});

//combines lib_utils_a, lib_utils_b, lib_utils_c, lib_bytes, lib_assert
const lib_utils = lib(() => {
  "use strict";

  let exports = {};

  const assert = (val, msg) => !val ? new Error(msg || 'Assertion failed') : undefined;
  //lib_bytes
  const length = a => (a.length - 2) / 2;
  const flatten = a => "0x" + a.reduce((r, s) => r + s.slice(2), "");
  const slice = (i, j, bs) => "0x" + bs.slice(i * 2 + 2, j * 2 + 2);
  const pad = (l, hex) => hex.length === l * 2 + 2 ? hex : pad(l, "0x" + "0" + hex.slice(2));
  const fromNumber  = num => num.toString(16).length % 2 === 0 ? "0x" + num.toString(16) : "0x0" + num.toString(16);
  const toNumber = hex => parseInt(hex.slice(2), 16);
  const fromNat = bn => bn === "0x0" ? "0x" : bn.length % 2 === 0 ? bn : "0x0" + bn.slice(2);
  const toNat = bn => bn[2] === "0" ? "0x" + bn.slice(3) : bn;

  //lib_utils_c
  const toArray = (msg, enc) => {
    if (Array.isArray(msg)) return msg.slice();
    if (!msg) return [];

    const res = [];
    if (typeof msg !== 'string') {
      return Symbol.iterator in Object(msg) ? [...msg].forEach((e, i) => res[i] = e | 0) : res;
    }
    if (enc === 'hex') {
      let sanitizedMsg = msg.replace(/[^a-z0-9]+/ig, ''); //maybe should be [^a-f0-9] limiting to valid hex. must test
      if (sanitizedMsg.length % 2 !== 0) sanitizedMsg = '0' + sanitizedMsg;
      for (let i = 0; i < sanitizedMsg.length; i += 2)
        res.push(parseInt(sanitizedMsg[i] + sanitizedMsg[i + 1], 16));
    } else {
      for (let i = 0; i < msg.length; i++) {
        const c = msg.charCodeAt(i);
        const hi = c >> 8;
        const lo = c & 0xff;
        hi ? res.push(hi, lo) : res.push(lo);
      }
    }
    return res;
  }
  const zero2 =  word => word.length === 1 ? word.padStart(2, 0) : word;
  const toHex = (msg, res = '') => ([...msg].map((e, i) => res.concat(zero2(e.toString(16)))).join(''));
  const encode = (arr, enc) => enc === 'hex' ? toHex(arr) : arr;

  //lib_utils_b
  //note: lib_utils_b.toArray duplicates functionality of lib_utils_c.toArray(and name clashes)
  const join32 = (msg, start, end, endian) => {
    const len = end - start;
    assert(len % 4 === 0);

    const res = new Array(len / 4);
    for (let i = 0, k = start; i < res.length; i++, k += 4) {
      let w;
      if (endian === 'big')
        w = (msg[k] << 24) | (msg[k + 1] << 16) | (msg[k + 2] << 8) | msg[k + 3];
      else
        w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
      res[i] = w >>> 0;
    }
    return res;
  }
  const split32 = (msg, endian) => {
    const res = new Array(msg.length * 4);
    for (let i = 0, k = 0; i < msg.length; i++, k += 4) {
      const m = msg[i];
      if (endian === 'big') {
        res[k] = m >>> 24;
        res[k + 1] = (m >>> 16) & 0xff;
        res[k + 2] = (m >>> 8) & 0xff;
        res[k + 3] = m & 0xff;
      } else {
        res[k + 3] = m >>> 24;
        res[k + 2] = (m >>> 16) & 0xff;
        res[k + 1] = (m >>> 8) & 0xff;
        res[k] = m & 0xff;
      }
    }
    return res;
  }
  const rotr32 = (w, b) => (w >>> b) | (w << (32 - b));
  const sum32 = (a, b) => (a + b) >>> 0;
  const sum32_4 = (a, b, c, d) => (a + b + c + d) >>> 0;
  const sum32_5 = (a, b, c, d, e) => (a + b + c + d + e) >>> 0;

  //lib_utils_a
  const getNAF = (num, w, bits) => {
    const naf = new Array(Math.max(num.bitLength(), bits) + 1).fill(0);

    const ws = 1 << (w + 1);
    const k = num.clone();

    for (let i = 0; i < naf.length; i++) {
      let z;
      const mod = k.andln(ws - 1);
      if (k.isOdd()) {
        if (mod > (ws >> 1) - 1)
          z = (ws >> 1) - mod;
        else
          z = mod;
        k.isubn(z);
      } else {
        z = 0;
      }

      naf[i] = z;
      k.iushrn(1);
    }
    return naf;
  }

  // Represent k1, k2 in a Joint Sparse Form
  const getJSF = (k1, k2) => {
    const jsf = [ [], [] ];

    k1 = k1.clone();
    k2 = k2.clone();
    let d1 = 0;
    let d2 = 0;
    while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {

      // First phase
      let m14 = (k1.andln(3) + d1) & 3;
      let m24 = (k2.andln(3) + d2) & 3;
      if (m14 === 3)
        m14 = -1;
      if (m24 === 3)
        m24 = -1;
      let u1;
      if ((m14 & 1) === 0) {
        u1 = 0;
      } else {
        let m8 = (k1.andln(7) + d1) & 7;
        if ((m8 === 3 || m8 === 5) && m24 === 2)
          u1 = -m14;
        else
          u1 = m14;
      }
      jsf[0].push(u1);

      let u2;
      if ((m24 & 1) === 0) {
        u2 = 0;
      } else {
        let m8 = (k2.andln(7) + d2) & 7;
        if ((m8 === 3 || m8 === 5) && m14 === 2)
          u2 = -m24;
        else
          u2 = m24;
      }
      jsf[1].push(u2);

      // Second phase
      if (2 * d1 === u1 + 1)
        d1 = 1 - d1;
      if (2 * d2 === u2 + 1)
        d2 = 1 - d2;
      k1.iushrn(1);
      k2.iushrn(1);
    }
    return jsf;
  }

  exports = {
    assert,
    length,
    flatten,
    slice,
    pad,
    fromNumber,
    toNumber,
    fromNat,
    toNat,
    toArray,
    zero2,
    toHex,
    encode,
    join32,
    split32,
    rotr32,
    sum32,
    sum32_4,
    sum32_5,
    getNAF,
    getJSF,
  };

  return exports;
});

const lib_buffer = lib(() => {
  let exports = {};
  /**
  * The Buffer constructor returns instances of `Uint8Array` that have their
  * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
  * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
  * and the `Uint8Array` methods. Square bracket notation works as expected -- it
  * returns a single octet.
  *
  * The `Uint8Array` prototype remains unmodified.
  */
  function Buffer (arg, encodingOrOffset, length) {};

  const createBuffer = (that, length) => {
    if (exports.kMaxLength < length) {
      throw new RangeError('Invalid typed array length')
    }
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
    return that;
  }
  const fromString = (that, string, encoding) => {
    const length = byteLength(string, encoding) | 0
    that = createBuffer(that, length)
    const actual = that.write(string, encoding)
    if (actual !== length) {
      that = that.slice(0, actual)
    }
    return that
  }
  const hexWrite = (buf, string, offset, length) => {
    offset = Number(offset) || 0
    const remaining = buf.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }
    // must be an even number of digits
    const strLen = string.length;
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2;
    }
    for (let i = 0; i < length; ++i) {
      const parsed = parseInt(string.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return i;
      buf[offset + i] = parsed;
    }
    return i;
  }
  const byteLength = (string, encoding) => string.length >>> 1;
  const from = (that, value, encodingOrOffset, length) => fromString(that, value, encodingOrOffset);
  exports.Buffer = Buffer;
  exports.INSPECT_MAX_BYTES = 50;
  exports.kMaxLength = 0x7fffffff; // exports.kMaxLength = kMaxLength()
  /**
  * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
  * if value is a number.
  * Buffer.from(str[, encoding])
  * Buffer.from(array)
  * Buffer.from(buffer)
  * Buffer.from(arrayBuffer[, byteOffset[, length]])
  **/
  Buffer.byteLength = byteLength;
  Buffer.from = (value, encodingOrOffset, length) => from(null, value, encodingOrOffset, length);
  Buffer.isBuffer = (b) => !!(b != null && b._isBuffer);

  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
  if (typeof Symbol !== 'undefined'
            && Symbol.species
            && Buffer[Symbol.species] === Buffer)
  {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    });
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect Buffer instances.
  Buffer.prototype._isBuffer = true;

  Buffer.prototype.write = function write (string, offset, length, encoding) {
    return hexWrite(this, string, 0, this.length);
  }

  return exports;
});

const lib_hash_common = lib(() => {
  "use strict";

  let exports = {};
  const utils = lib_utils();

  function BlockHash() {
    this.pending = null;
    this.pendingTotal = 0;
    this.blockSize = this.constructor.blockSize;
    this.outSize = this.constructor.outSize;
    this.hmacStrength = this.constructor.hmacStrength;
    this.padLength = this.constructor.padLength / 8;
    this.endian = 'big';

    this._delta8 = this.blockSize / 8;
    this._delta32 = this.blockSize / 32;
  }
  exports.BlockHash = BlockHash;

  BlockHash.prototype.update = function update(msg, enc) {
    // Convert message to array, pad it, and join into 32bit blocks
    msg = utils.toArray(msg, enc);
    if (!this.pending)
      this.pending = msg;
    else
      this.pending = this.pending.concat(msg);
    this.pendingTotal += msg.length;

    // Enough data, try updating
    if (this.pending.length >= this._delta8) {
      msg = this.pending;

      // Process pending data in blocks
      const r = msg.length % this._delta8;
      this.pending = msg.slice(msg.length - r, msg.length);
      if (this.pending.length === 0) this.pending = null;

      msg = utils.join32(msg, 0, msg.length - r, this.endian);
      for (let i = 0; i < msg.length; i += this._delta32)
        this._update(msg, i, i + this._delta32);
    }

    return this;
  };

  BlockHash.prototype.digest = function digest(enc) {
    this.update(this._pad());
    utils.assert(this.pending === null);

    return this._digest(enc);
  };

  BlockHash.prototype._pad = function pad() {
    let len = this.pendingTotal;
    const bytes = this._delta8;
    const k = bytes - ((len + this.padLength) % bytes);
    const res = new Array(k + this.padLength);
    res[0] = 0x80;
    for (var i = 1; i < k; i++) res[i] = 0;   //refactor uses var i hoisting. i tracks lenght of res arr iirc

    // Append length
    len <<= 3;
    if (this.endian === 'big') {
      for (let t = 8; t < this.padLength; t++)
        res[i++] = 0;

      res[i++] = 0;
      res[i++] = 0;
      res[i++] = 0;
      res[i++] = 0;
      res[i++] = (len >>> 24) & 0xff;
      res[i++] = (len >>> 16) & 0xff;
      res[i++] = (len >>> 8) & 0xff;
      res[i++] = len & 0xff;
    } else {
      res[i++] = len & 0xff;
      res[i++] = (len >>> 8) & 0xff;
      res[i++] = (len >>> 16) & 0xff;
      res[i++] = (len >>> 24) & 0xff;
      res[i++] = 0;
      res[i++] = 0;
      res[i++] = 0;
      res[i++] = 0;

      for (let t = 8; t < this.padLength; t++)
        res[i++] = 0;
    }

    return res;
    };


  return exports;
});

const lib_keccak = lib(() => {
  let exports = {};

  const HEX_CHARS = '0123456789abcdef'.split('');
  const KECCAK_PADDING = [1, 256, 65536, 16777216];
  const SHIFT = [0, 8, 16, 24];
  const RC = [
      1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907,
      0, 2147483649, 0, 2147516545, 2147483648, 32777, 2147483648, 138,
      0, 136, 0, 2147516425, 0, 2147483658, 0, 2147516555, 0, 139,
      2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648,
      128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545,
      2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
  const Keccak = bits => ({
    blocks: [],
    reset: true,
    block: 0,
    start: 0,
    blockCount: 1600 - (bits << 1) >> 5,
    outputBlocks: bits >> 5,
    s: (s => [].concat(s, s, s, s, s))([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) //refactor? creates arr len 50 fill 0s in a '=> notiation' iife
  });
  const update = (state, message) => {
    let [length, blocks, byteCount, blockCount, outputBlocks, s, index, lastByteIndex, code
          ] = [message.length, state.blocks, state.blockCount << 2, state.blockCount,
          state.outputBlocks,  state.s, 0, 0, 0];

    // update
    while (index < length) {
      if (state.reset) {
        state.reset = false;
        blocks[0] = state.block;
        for (lastByteIndex = 1; lastByteIndex < blockCount + 1; ++lastByteIndex) {
          blocks[lastByteIndex] = 0;
        }
      }
      if (typeof message !== "string") {
        for (lastByteIndex = state.start; index < length && lastByteIndex < byteCount; ++index) {
          blocks[lastByteIndex >> 2] |= message[index] << SHIFT[lastByteIndex++ & 3];
        }
      } else {
        for (lastByteIndex = state.start; index < length && lastByteIndex < byteCount; ++index) {
          code = message.charCodeAt(index);
          if (code < 0x80) {
            blocks[lastByteIndex >> 2] |= code << SHIFT[lastByteIndex++ & 3];
          } else if (code < 0x800) {
            blocks[lastByteIndex >> 2] |= (0xc0 | code >> 6) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code & 0x3f) << SHIFT[lastByteIndex++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[lastByteIndex >> 2] |= (0xe0 | code >> 12) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code >> 6 & 0x3f) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code & 0x3f) << SHIFT[lastByteIndex++ & 3];
          } else {
            code = 0x10000 + ((code & 0x3ff) << 10 | message.charCodeAt(++index) & 0x3ff);
            blocks[lastByteIndex >> 2] |= (0xf0 | code >> 18) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code >> 12 & 0x3f) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code >> 6 & 0x3f) << SHIFT[lastByteIndex++ & 3];
            blocks[lastByteIndex >> 2] |= (0x80 | code & 0x3f) << SHIFT[lastByteIndex++ & 3];
          }
        }
      }

      if (lastByteIndex >= byteCount) {
        state.start = lastByteIndex - byteCount;
        state.block = blocks[blockCount];
        for (let i = 0; i < blockCount; ++i) {
          s[i] ^= blocks[i];
        }
        f(s);
        state.reset = true;
      } else {
        state.start = lastByteIndex;
      }
    }

    // finalize
    blocks[lastByteIndex >> 2] |= KECCAK_PADDING[lastByteIndex & 3];

    if (lastByteIndex === byteCount) {
      blocks[0] = blocks[blockCount];
      for (let i = 1; i < blockCount + 1; ++i) {
        blocks[i] = 0;
      }
    }
    blocks[blockCount - 1] |= 0x80000000;
    for (let i = 0; i < blockCount; ++i) {
      s[i] ^= blocks[i];
    }
    f(s);

    let [hex, j, block] = ['', 0, 0];

    while (j < outputBlocks) {
      for (let i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        block = s[i];
        hex += HEX_CHARS[block >> 4 & 0x0F]
            + HEX_CHARS[block & 0x0F]
            + HEX_CHARS[block >> 12 & 0x0F]
            + HEX_CHARS[block >> 8 & 0x0F]
            + HEX_CHARS[block >> 20 & 0x0F]
            + HEX_CHARS[block >> 16 & 0x0F]
            + HEX_CHARS[block >> 28 & 0x0F]
            + HEX_CHARS[block >> 24 & 0x0F];
      }
      if (j % blockCount === 0) {
        f(s);
        i = 0;
      }
    }
    return "0x" + hex;
  };

  const f = s => {
    let h, l, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, b0, b1, b2, b3, b4,
        b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19,
        b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
        b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47,
        b48, b49;

    for (let n = 0; n < 48; n += 2) {
      c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
      c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
      c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
      c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
      c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
      c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
      c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
      c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
      c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
      c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

      h = c8 ^ (c2 << 1 | c3 >>> 31);
      l = c9 ^ (c3 << 1 | c2 >>> 31);
      s[0] ^= h;
      s[1] ^= l;
      s[10] ^= h;
      s[11] ^= l;
      s[20] ^= h;
      s[21] ^= l;
      s[30] ^= h;
      s[31] ^= l;
      s[40] ^= h;
      s[41] ^= l;
      h = c0 ^ (c4 << 1 | c5 >>> 31);
      l = c1 ^ (c5 << 1 | c4 >>> 31);
      s[2] ^= h;
      s[3] ^= l;
      s[12] ^= h;
      s[13] ^= l;
      s[22] ^= h;
      s[23] ^= l;
      s[32] ^= h;
      s[33] ^= l;
      s[42] ^= h;
      s[43] ^= l;
      h = c2 ^ (c6 << 1 | c7 >>> 31);
      l = c3 ^ (c7 << 1 | c6 >>> 31);
      s[4] ^= h;
      s[5] ^= l;
      s[14] ^= h;
      s[15] ^= l;
      s[24] ^= h;
      s[25] ^= l;
      s[34] ^= h;
      s[35] ^= l;
      s[44] ^= h;
      s[45] ^= l;
      h = c4 ^ (c8 << 1 | c9 >>> 31);
      l = c5 ^ (c9 << 1 | c8 >>> 31);
      s[6] ^= h;
      s[7] ^= l;
      s[16] ^= h;
      s[17] ^= l;
      s[26] ^= h;
      s[27] ^= l;
      s[36] ^= h;
      s[37] ^= l;
      s[46] ^= h;
      s[47] ^= l;
      h = c6 ^ (c0 << 1 | c1 >>> 31);
      l = c7 ^ (c1 << 1 | c0 >>> 31);
      s[8] ^= h;
      s[9] ^= l;
      s[18] ^= h;
      s[19] ^= l;
      s[28] ^= h;
      s[29] ^= l;
      s[38] ^= h;
      s[39] ^= l;
      s[48] ^= h;
      s[49] ^= l;

      b0 = s[0];
      b1 = s[1];
      b32 = s[11] << 4 | s[10] >>> 28;
      b33 = s[10] << 4 | s[11] >>> 28;
      b14 = s[20] << 3 | s[21] >>> 29;
      b15 = s[21] << 3 | s[20] >>> 29;
      b46 = s[31] << 9 | s[30] >>> 23;
      b47 = s[30] << 9 | s[31] >>> 23;
      b28 = s[40] << 18 | s[41] >>> 14;
      b29 = s[41] << 18 | s[40] >>> 14;
      b20 = s[2] << 1 | s[3] >>> 31;
      b21 = s[3] << 1 | s[2] >>> 31;
      b2 = s[13] << 12 | s[12] >>> 20;
      b3 = s[12] << 12 | s[13] >>> 20;
      b34 = s[22] << 10 | s[23] >>> 22;
      b35 = s[23] << 10 | s[22] >>> 22;
      b16 = s[33] << 13 | s[32] >>> 19;
      b17 = s[32] << 13 | s[33] >>> 19;
      b48 = s[42] << 2 | s[43] >>> 30;
      b49 = s[43] << 2 | s[42] >>> 30;
      b40 = s[5] << 30 | s[4] >>> 2;
      b41 = s[4] << 30 | s[5] >>> 2;
      b22 = s[14] << 6 | s[15] >>> 26;
      b23 = s[15] << 6 | s[14] >>> 26;
      b4 = s[25] << 11 | s[24] >>> 21;
      b5 = s[24] << 11 | s[25] >>> 21;
      b36 = s[34] << 15 | s[35] >>> 17;
      b37 = s[35] << 15 | s[34] >>> 17;
      b18 = s[45] << 29 | s[44] >>> 3;
      b19 = s[44] << 29 | s[45] >>> 3;
      b10 = s[6] << 28 | s[7] >>> 4;
      b11 = s[7] << 28 | s[6] >>> 4;
      b42 = s[17] << 23 | s[16] >>> 9;
      b43 = s[16] << 23 | s[17] >>> 9;
      b24 = s[26] << 25 | s[27] >>> 7;
      b25 = s[27] << 25 | s[26] >>> 7;
      b6 = s[36] << 21 | s[37] >>> 11;
      b7 = s[37] << 21 | s[36] >>> 11;
      b38 = s[47] << 24 | s[46] >>> 8;
      b39 = s[46] << 24 | s[47] >>> 8;
      b30 = s[8] << 27 | s[9] >>> 5;
      b31 = s[9] << 27 | s[8] >>> 5;
      b12 = s[18] << 20 | s[19] >>> 12;
      b13 = s[19] << 20 | s[18] >>> 12;
      b44 = s[29] << 7 | s[28] >>> 25;
      b45 = s[28] << 7 | s[29] >>> 25;
      b26 = s[38] << 8 | s[39] >>> 24;
      b27 = s[39] << 8 | s[38] >>> 24;
      b8 = s[48] << 14 | s[49] >>> 18;
      b9 = s[49] << 14 | s[48] >>> 18;

      s[0] = b0 ^ ~b2 & b4;
      s[1] = b1 ^ ~b3 & b5;
      s[10] = b10 ^ ~b12 & b14;
      s[11] = b11 ^ ~b13 & b15;
      s[20] = b20 ^ ~b22 & b24;
      s[21] = b21 ^ ~b23 & b25;
      s[30] = b30 ^ ~b32 & b34;
      s[31] = b31 ^ ~b33 & b35;
      s[40] = b40 ^ ~b42 & b44;
      s[41] = b41 ^ ~b43 & b45;
      s[2] = b2 ^ ~b4 & b6;
      s[3] = b3 ^ ~b5 & b7;
      s[12] = b12 ^ ~b14 & b16;
      s[13] = b13 ^ ~b15 & b17;
      s[22] = b22 ^ ~b24 & b26;
      s[23] = b23 ^ ~b25 & b27;
      s[32] = b32 ^ ~b34 & b36;
      s[33] = b33 ^ ~b35 & b37;
      s[42] = b42 ^ ~b44 & b46;
      s[43] = b43 ^ ~b45 & b47;
      s[4] = b4 ^ ~b6 & b8;
      s[5] = b5 ^ ~b7 & b9;
      s[14] = b14 ^ ~b16 & b18;
      s[15] = b15 ^ ~b17 & b19;
      s[24] = b24 ^ ~b26 & b28;
      s[25] = b25 ^ ~b27 & b29;
      s[34] = b34 ^ ~b36 & b38;
      s[35] = b35 ^ ~b37 & b39;
      s[44] = b44 ^ ~b46 & b48;
      s[45] = b45 ^ ~b47 & b49;
      s[6] = b6 ^ ~b8 & b0;
      s[7] = b7 ^ ~b9 & b1;
      s[16] = b16 ^ ~b18 & b10;
      s[17] = b17 ^ ~b19 & b11;
      s[26] = b26 ^ ~b28 & b20;
      s[27] = b27 ^ ~b29 & b21;
      s[36] = b36 ^ ~b38 & b30;
      s[37] = b37 ^ ~b39 & b31;
      s[46] = b46 ^ ~b48 & b40;
      s[47] = b47 ^ ~b49 & b41;
      s[8] = b8 ^ ~b0 & b2;
      s[9] = b9 ^ ~b1 & b3;
      s[18] = b18 ^ ~b10 & b12;
      s[19] = b19 ^ ~b11 & b13;
      s[28] = b28 ^ ~b20 & b22;
      s[29] = b29 ^ ~b21 & b23;
      s[38] = b38 ^ ~b30 & b32;
      s[39] = b39 ^ ~b31 & b33;
      s[48] = b48 ^ ~b40 & b42;
      s[49] = b49 ^ ~b41 & b43;

      s[0] ^= RC[n];
      s[1] ^= RC[n + 1];
    }
  };

  const keccak = bits => (str, force_utf8 = false) => {
    let msg;
    if (str.slice(0, 2) === "0x" && !force_utf8) {
      msg = [];
      for (let i = 2, l = str.length; i < l; i += 2) msg.push(parseInt(str.slice(i, i + 2), 16));
    } else {
      msg = str;
    }
    return update(Keccak(bits, bits), msg);
  };

  exports = {keccak256: keccak(256)};

  return exports;
});

const lib_elliptic = lib(() => {
  "use strict";

  const exports = {
    utils: lib_utils(),
    curves: lib_curves(),
    ec: lib_elliptic_ec()
  }
  return exports;
});

const lib_base = lib(() => {
  "use strict";

  let exports = {};

  const BN = lib_BN();
  const utils = lib_utils();

  function BaseCurve(type, conf) {
    this.type = type;
    this.p = new BN(conf.p, 16);

    // Use Montgomery, when there is no fast reduction for the prime
    this.red = conf.prime ? BN.red(conf.prime) : BN.mont(this.p);

    // Useful for many curves
    this.zero = new BN(0).toRed(this.red);
    this.one = new BN(1).toRed(this.red);
    this.two = new BN(2).toRed(this.red);

    // Curve configuration, optional
    this.n = conf.n && new BN(conf.n, 16);
    this.g = conf.g && this.pointFromJSON(conf.g, conf.gRed);

    // Temporary arrays
    this._wnafT1 = new Array(4);
    this._wnafT2 = new Array(4);
    this._wnafT3 = new Array(4);
    this._wnafT4 = new Array(4);

    this._bitLength = this.n ? this.n.bitLength() : 0;

    // Generalized Greg Maxwell's trick
    const adjustCount = this.n && this.p.div(this.n);
    if (!adjustCount || adjustCount.cmpn(100) > 0) {
      this.redN = null;
    } else {
      this._maxwellTrick = true;
      this.redN = this.n.toRed(this.red);
    }
  }
  exports = BaseCurve;

  BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p, k) {
    utils.assert(p.precomputed);
    let doubles = p._getDoubles();

    const naf = utils.getNAF(k, 1, this._bitLength);
    let I = (1 << (doubles.step + 1)) - (doubles.step % 2 === 0 ? 2 : 1);
    I /= 3;

    // Translate into more windowed form
    const repr = [];
    for (let j = 0; j < naf.length; j += doubles.step) {
      let nafW = 0;
      for (let K = j + doubles.step - 1; k >= j; k--)
        nafW = (nafW << 1) + naf[K];
      repr.push(nafW);
    }

    let a = this.jpoint(null, null, null);
    let b = this.jpoint(null, null, null);
    for (let i = I; i > 0; i--) {
      for (let j = 0; j < repr.length; j++) {
        const nafW = repr[j];
        if (nafW === i)
          b = b.mixedAdd(doubles.points[j]);
        else if (nafW === -i)
          b = b.mixedAdd(doubles.points[j].neg());
      }
      a = a.add(b);
    }
    return a.toP();
};

  BaseCurve.prototype._wnafMulAdd = function _wnafMulAdd(defW, points, coeffs, len, jacobianResult) {
    let wndWidth = this._wnafT1;
    let wnd = this._wnafT2;
    let naf = this._wnafT3;

    // Fill all arrays
    let max = 0;
    for (let i = 0; i < len; i++) {
      const p = points[i];
      const nafPoints = p._getNAFPoints(defW);
      wndWidth[i] = nafPoints.wnd;
      wnd[i] = nafPoints.points;
    }
    // Comb small window NAFs
    for (let i = len - 1; i >= 1; i -= 2) {
      const a = i - 1;
      const b = i;
      if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
        naf[a] = utils.getNAF(coeffs[a], wndWidth[a], this._bitLength);
        naf[b] = utils.getNAF(coeffs[b], wndWidth[b], this._bitLength);
        // max = Math.max(naf[a].length, max);
        // max = Math.max(naf[b].length, max);
        max = Math.max(naf[a].length, naf[b].length, max);
        continue;
      }
      const comb = [
        points[a], /* 1 */
        null, /* 3 */
        null, /* 5 */
        points[b] /* 7 */
      ];
      // Try to avoid Projective points, if possible
      if (points[a].y.cmp(points[b].y) === 0) {
        comb[1] = points[a].add(points[b]);
        comb[2] = points[a].toJ().mixedAdd(points[b].neg());
      } else if (points[a].y.cmp(points[b].y.redNeg()) === 0) {
        comb[1] = points[a].toJ().mixedAdd(points[b]);
        comb[2] = points[a].add(points[b].neg());
      } else {
        comb[1] = points[a].toJ().mixedAdd(points[b]);
        comb[2] = points[a].toJ().mixedAdd(points[b].neg());
      }
      const index = [
        -3, /* -1 -1 */
        -1, /* -1 0 */
        -5, /* -1 1 */
        -7, /* 0 -1 */
        0, /* 0 0 */
        7, /* 0 1 */
        5, /* 1 -1 */
        1, /* 1 0 */
        3  /* 1 1 */
      ];

      const jsf = utils.getJSF(coeffs[a], coeffs[b]);
      max = Math.max(jsf[0].length, max);
      naf[a] = new Array(max);
      naf[b] = new Array(max);
      for (let j = 0; j < max; j++) {
        const ja = jsf[0][j] | 0;
        const jb = jsf[1][j] | 0;

        naf[a][j] = index[(ja + 1) * 3 + (jb + 1)];
        naf[b][j] = 0;
        wnd[a] = comb;
      }
    }

    let acc = this.jpoint(null, null, null);
    let tmp = this._wnafT4;
    for (let i = max; i >= 0; i--) {
      let k = 0;

      while (i >= 0) {
        let zero = true;
        for (let j = 0; j < len; j++) {
          tmp[j] = naf[j][i] | 0;
          if (tmp[j] !== 0)
            zero = false;
        }
        if (!zero)
          break;
        k++;
        i--;
      }
      if (i >= 0)
        k++;
      acc = acc.dblp(k);
      if (i < 0)
        break;

      for (let j = 0; j < len; j++) {
        let z = tmp[j];
        let p;
        if (z === 0)
          continue;
        else if (z > 0)
          p = wnd[j][(z - 1) >> 1];
        else if (z < 0)
          p = wnd[j][(-z - 1) >> 1].neg();

        if (p.type === 'affine')
          acc = acc.mixedAdd(p);
        else
          acc = acc.add(p);
      }
    }
    // Zeroify references
    wnd.fill(null, 0, len);

    if (jacobianResult)
      return acc;
    else
      return acc.toP();
  };

  function BasePoint(curve, type) {
    this.curve = curve;
    this.type = type;
    this.precomputed = null;
  }
  BaseCurve.BasePoint = BasePoint;

  BasePoint.prototype.validate = function validate() {
    return this.curve.validate(this);
  };

  BasePoint.prototype._encode = function _encode(compact) {
    const len = this.curve.p.byteLength();
    const x = this.getX().toArray('be', len);

    if (compact) return [ this.getY().isEven() ? 0x02 : 0x03 ].concat(x);

    return [ 0x04 ].concat(x, this.getY().toArray('be', len)) ;
  };

  BasePoint.prototype.encode = function encode(enc, compact) {
    return utils.encode(this._encode(compact), enc);
  };

  BasePoint.prototype.precompute = function precompute(power) {
    if (this.precomputed) return this;

    const precomputed = {
      doubles: null,
      naf: null,
      beta: null
    };
    precomputed.naf = this._getNAFPoints(8);
    precomputed.doubles = this._getDoubles(4, power);
    precomputed.beta = this._getBeta();
    this.precomputed = precomputed;

    return this;
  };

  BasePoint.prototype._hasDoubles = function _hasDoubles(k) {
    if (!this.precomputed) return false;

    const doubles = this.precomputed.doubles;
    if (!doubles) return false;

    return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
  };

  BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
    if (this.precomputed && this.precomputed.doubles)
      return this.precomputed.doubles;

    const doubles = [ this ];
    let acc = this;
    for (let i = 0; i < power; i += step) {
      for (let j = 0; j < step; j++)
        acc = acc.dbl();
      doubles.push(acc);
    }
    return {
      step: step,
      points: doubles
    };
  };

  BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
    if (this.precomputed && this.precomputed.naf) return this.precomputed.naf;

    const res = [ this ];
    const max = (1 << wnd) - 1;
    const dbl = max === 1 ? null : this.dbl();
    for (let i = 1; i < max; i++) res[i] = res[i - 1].add(dbl);

    return {
      wnd: wnd,
      points: res
    };
  };

  return exports;
});

const lib_curves = lib(() => {
  "use strict";

  let exports = {};
  const curves = exports;
  const hash = lib_hash();
  const utils = lib_utils();

  function PresetCurve(options) {
    const curve = lib_curve();
    this.curve = new curve(options);
    this.g = this.curve.g;
    this.n = this.curve.n;
    this.hash = options.hash;
    utils.assert(this.g.validate(), 'Invalid curve');
    utils.assert(this.g.mul(this.n).isInfinity(), 'Invalid curve, G*N != O');
  }
  curves.PresetCurve = PresetCurve;

  function defineCurve(name, options) {
    Object.defineProperty(curves, name, {
      configurable: true,
      enumerable: true,
      get: function() {
        const curve = new PresetCurve(options);
        Object.defineProperty(curves, name, {
          configurable: true,
          enumerable: true,
          value: curve
        });
        return curve;
      }
    });
  }

  defineCurve('secp256k1', {
    type: 'short',
    prime: 'k256',
    p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f',
    a: '0',
    b: '7',
    n: 'ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141',
    h: '1',
    hash: hash.sha256,

    // Precomputed endomorphism
    beta: '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
    lambda: '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
    basis: [
      {
        a: '3086d221a7d46bcde86c90e49284eb15',
        b: '-e4437ed6010e88286f547fa90abfe4c3'
      },
      {
        a: '114ca50f7a8e2f3f657c1108d9d44cfd8',
        b: '3086d221a7d46bcde86c90e49284eb15'
      }
    ],

    gRed: false,
    g: [
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
      {}
    ]
  });

  return exports;
});

const lib_hash = lib(() => {
  const exports = {
      utils: lib_utils(),
      common: lib_hash_common(),
      sha: sha = {sha256: lib_sha()},
      hmac: lib_hmac(),
      sha256: sha.sha256
  }
  return exports;
});

const lib_account = lib(() => {
  let exports = {};

  /* WEBPACK VAR INJECTION */(function(Buffer) {
  const Bytes = lib_utils();
  const BN = lib_BN();
  const elliptic = lib_elliptic();
  const secp256k1 = new elliptic.ec("secp256k1"); // eslint-disable-line
  const { keccak256 } = lib_keccak();

  const Nat = {
    fromString: str => {
      const bn = "0x" + (str.slice(0, 2) === "0x"
        ? new BN(str.slice(2), 16)
        : new BN(str, 10)).toString("hex");
      return bn === "0x0" ? "0x" : bn;
    }
  };

  const addressChecksum = address => {
    const addressHash = keccak256(address.slice(2));
    let checksumAddress = "0x";
    for (let i = 0; i < 40; i++)
      checksumAddress += parseInt(addressHash[i + 2], 16) > 7
        ? address[i + 2].toUpperCase()
        : address[i + 2];
    return checksumAddress;
  };

  const addressFromKey = privateKey => {
    const buffer = Buffer.from(privateKey.slice(2), "hex");
    const ecKey = secp256k1.keyFromPrivate(buffer);
    const publicKey = "0x" + ecKey.getPublic(false, 'hex').slice(2);
    const publicHash = keccak256(publicKey);
    const address = addressChecksum("0x" + publicHash.slice(-40));
    return address;
  };

  const encodeSignature = ([v, r, s]) => Bytes.flatten([r, s, v]);

  const decodeSignature = hex => [Bytes.slice(64, Bytes.length(hex), hex), Bytes.slice(0, 32, hex), Bytes.slice(32, 64, hex)];

  const signMessage = (hash, privateKey, addToV = 27) => {
  const signature = secp256k1.keyFromPrivate(Buffer
                                .from(privateKey.slice(2), "hex"))
                                .sign(Buffer.from(hash.slice(2), "hex"),
                                { canonical: true });

    return encodeSignature([Nat.fromString(Bytes.fromNumber(addToV + signature.recoveryParam)),
                                Bytes.pad(32, Bytes.fromNat("0x" + signature.r.toString(16))),
                                Bytes.pad(32, Bytes.fromNat("0x" + signature.s.toString(16)))]);
  };

  const signerAddress = (hash, signature) => {
    const vals = decodeSignature(signature);
    const vrs = { v: Bytes.toNumber(vals[0]), r: vals[1].slice(2), s: vals[2].slice(2) };
    const ecPublicKey = secp256k1.recoverPubKey(Buffer.from(hash.slice(2), "hex"), vrs, vrs.v < 2 ? vrs.v : 1 - vrs.v % 2); // because odd vals mean v=0... sadly that means v=0 means v=1... I hate that
    const publicKey = "0x" + ecPublicKey.encode("hex", false).slice(2);
    const publicHash = keccak256(publicKey);
    const address = addressChecksum("0x" + publicHash.slice(-40));
    return address;
  };

  exports = {
    addressChecksum,
    addressFromKey,
    signMessage,
    signerAddress,
  };
  /* WEBPACK VAR INJECTION */}.call(this, lib_buffer().Buffer))
  return exports;
});

const lib_sha_common = lib(() => {
  "use strict";

  let exports = {};
  const utils = lib_utils();
  const rotr32 = utils.rotr32;

  function ch32(x, y, z) {
    return (x & y) ^ ((~x) & z);
  }
  exports.ch32 = ch32;

  function maj32(x, y, z) {
    return (x & y) ^ (x & z) ^ (y & z);
  }
  exports.maj32 = maj32;

  function s0_256(x) {
    return rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22);
  }
  exports.s0_256 = s0_256;

  function s1_256(x) {
    return rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25);
  }
  exports.s1_256 = s1_256;

  function g0_256(x) {
    return rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3);
  }
  exports.g0_256 = g0_256;

  function g1_256(x) {
    return rotr32(x, 17) ^ rotr32(x, 19) ^ (x >>> 10);
  }
  exports.g1_256 = g1_256;

  return exports;
});

const lib_sha = lib(() => {
  "use strict";

  let exports = {};
  const utils = lib_utils();
  const common = lib_hash_common();
  const shaCommon = lib_sha_common();
  const inherits = lib_inherits()

  let [sum32, sum32_4, sum32_5, ch32, maj32, s0_256, s1_256, g0_256, g1_256,
        BlockHash] = [utils.sum32, utils.sum32_4, utils.sum32_5, shaCommon.ch32,
        shaCommon.maj32, shaCommon.s0_256, shaCommon.s1_256, shaCommon.g0_256,
        shaCommon.g1_256, common.BlockHash];

  const sha256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function SHA256() {
    if (!(this instanceof SHA256))
      return new SHA256();

    BlockHash.call(this);
    this.h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    this.k = sha256_K;
    this.W = new Array(64);
  }
  inherits(SHA256, BlockHash);
  exports = SHA256;

  SHA256.blockSize = 512;
  SHA256.outSize = 256;
  SHA256.hmacStrength = 192;
  SHA256.padLength = 64;

  SHA256.prototype._update = function _update(msg, start) {
    const W = this.W;

    for (let i = 0; i < 16; i++) W[i] = msg[start + i];
    for (let i = 16; i < W.length; i++) W[i] = sum32_4(g1_256(W[i - 2]), W[i - 7], g0_256(W[i - 15]), W[i - 16]);

    let [a, b, c, d, e, f, g, h] = this.h;
    utils.assert(this.k.length === W.length);

    for (let i = 0; i < W.length; i++) {
      const T1 = sum32_5(h, s1_256(e), ch32(e, f, g), this.k[i], W[i]);
      const T2 = sum32(s0_256(a), maj32(a, b, c));
      [h, g, f, e, d, c, b, a] = [g, f, e, sum32(d, T1), c, b, a, sum32(T1, T2)];
    }

    [a, b, c, d, e, f, g, h].forEach((e, i) => sum32(this.h[i], e));
  };

  SHA256.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils.toHex32(this.h, 'big');
  else
    return utils.split32(this.h, 'big');
  };

  return exports;
});

const lib_curve = lib(() => {
  "use strict";

  let exports = {};
  const BN = lib_BN();
  const inherits = lib_inherits();
  const Base = lib_base();
  const utils = lib_utils();

  function ShortCurve(conf) {
    Base.call(this, 'short', conf);

    this.a = new BN(conf.a, 16).toRed(this.red);
    this.b = new BN(conf.b, 16).toRed(this.red);
    this.tinv = this.two.redInvm();

    this.zeroA = this.a.fromRed().cmpn(0) === 0;
    this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;

    // If the curve is endomorphic, precalculate beta and lambda
    this.endo = this._getEndomorphism(conf);
    this._endoWnafT1 = new Array(4);
    this._endoWnafT2 = new Array(4);
  }
  inherits(ShortCurve, Base);
  exports = ShortCurve;

  ShortCurve.prototype._getEndomorphism = function _getEndomorphism(conf) {
    // No efficient endomorphism
    if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1) return;

    // Compute beta and lambda, that lambda * P = (beta * Px; Py)
    let beta;
    let lambda;
    if (conf.beta) {
      beta = new BN(conf.beta, 16).toRed(this.red);
    } else {
      const betas = this._getEndoRoots(this.p);
      // Choose the smallest beta
      beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
      beta = beta.toRed(this.red);
    }
    if (conf.lambda) {
      lambda = new BN(conf.lambda, 16);
    } else {
      // Choose the lambda that is matching selected beta
      const lambdas = this._getEndoRoots(this.n);
      if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
        lambda = lambdas[0];
      } else {
        lambda = lambdas[1];
        utils.assert(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
        // assert.deepStrictEqual(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta), 0, new Error('Assertion failed'))); //assert(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
      }
    }
    // Get basis vectors, used for balanced length-two representation
    let basis;
    if (conf.basis) {
      basis = conf.basis.map(function(vec) {
        return {
          a: new BN(vec.a, 16),
          b: new BN(vec.b, 16)
        };
      });
    } else {
      basis = this._getEndoBasis(lambda);
    }

    return {
      beta: beta,
      lambda: lambda,
      basis: basis
    };
  };

  ShortCurve.prototype._endoSplit = function _endoSplit(k) {
    const basis = this.endo.basis;
    const v1 = basis[0];
    const v2 = basis[1];
    const c1 = v2.b.mul(k).divRound(this.n);
    const c2 = v1.b.neg().mul(k).divRound(this.n);
    const p1 = c1.mul(v1.a);
    const p2 = c2.mul(v2.a);
    const q1 = c1.mul(v1.b);
    const q2 = c2.mul(v2.b);
    // Calculate answer
    const k1 = k.sub(p1).sub(p2);
    const k2 = q1.add(q2).neg();

    return { k1: k1, k2: k2 };
  };

  ShortCurve.prototype.pointFromX = function pointFromX(x, odd) {
    x = new BN(x, 16);
    if (!x.red) x = x.toRed(this.red);

    const y2 = x.redSqr().redMul(x).redIAdd(x.redMul(this.a)).redIAdd(this.b);
    let y = y2.redSqrt();
    if (y.redSqr().redSub(y2).cmp(this.zero) !== 0)
      throw new Error('invalid point');

    // XXX Is there any way to tell if the number is odd without converting it
    // to non-red form?
    const isOdd = y.fromRed().isOdd();
    if (odd && !isOdd || !odd && isOdd) y = y.redNeg();

    return this.point(x, y);
  };

  ShortCurve.prototype.validate = function validate(point) {
    if (point.inf) return true;

    const x = point.x;
    const y = point.y;
    const ax = this.a.redMul(x);
    const rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);

    return y.redSqr().redISub(rhs).cmpn(0) === 0;
  };

  ShortCurve.prototype._endoWnafMulAdd = function _endoWnafMulAdd(points, coeffs, jacobianResult) {
    const npoints = this._endoWnafT1;
    const ncoeffs = this._endoWnafT2;
    for (let i = 0; i < points.length; i++) {
      const split = this._endoSplit(coeffs[i]);
      let p = points[i];
      let beta = p._getBeta();

      if (split.k1.negative) {
        split.k1.ineg();
        p = p.neg(true);
      }
      if (split.k2.negative) {
        split.k2.ineg();
        beta = beta.neg(true);
      }

      npoints[i * 2] = p;
      npoints[i * 2 + 1] = beta;
      ncoeffs[i * 2] = split.k1;
      ncoeffs[i * 2 + 1] = split.k2;
    }

    const res = this._wnafMulAdd(1, npoints, ncoeffs, points.length * 2, jacobianResult);

    // Clean-up references to points and coefficients
    for (let j = 0; j < points.length * 2; j++) {
      npoints[j] = null;
      ncoeffs[j] = null;
    }
    return res;
  };

  function Point(curve, x, y, isRed) {
    Base.BasePoint.call(this, curve, 'affine');
    if (x === null && y === null) {
      this.x = null;
      this.y = null;
      this.inf = true;
    } else {
      this.x = new BN(x, 16);
      this.y = new BN(y, 16);
      // Force redgomery representation when loading from JSON
      if (isRed) {
        this.x.forceRed(this.curve.red);
        this.y.forceRed(this.curve.red);
      }
      if (!this.x.red)
        this.x = this.x.toRed(this.curve.red);
      if (!this.y.red)
        this.y = this.y.toRed(this.curve.red);
      this.inf = false;
    }
  }
  inherits(Point, Base.BasePoint);

  ShortCurve.prototype.point = function point(x, y, isRed) {
    return new Point(this, x, y, isRed);
  };

  ShortCurve.prototype.pointFromJSON = function pointFromJSON(obj, red) {
    return Point.fromJSON(this, obj, red);
  };

  Point.prototype._getBeta = function _getBeta() {
    if (!this.curve.endo) return;

    const pre = this.precomputed;
    if (pre && pre.beta)
      return pre.beta;

      const beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
    if (pre) {
      const curve = this.curve;
      const endoMul = function(p) {
        return curve.point(p.x.redMul(curve.endo.beta), p.y);
      };
      pre.beta = beta;
      beta.precomputed = {
        beta: null,
        naf: pre.naf && {
          wnd: pre.naf.wnd,
          points: pre.naf.points.map(endoMul)
        },
        doubles: pre.doubles && {
          step: pre.doubles.step,
          points: pre.doubles.points.map(endoMul)
        }
      };
    }
    return beta;
  };

  Point.fromJSON = function fromJSON(curve, obj, red) {
    if (typeof obj === 'string')
      obj = JSON.parse(obj);
      const res = curve.point(obj[0], obj[1], red);

    if (!obj[2]) return res;

    const obj2point = obj => curve.point(obj[0], obj[1], red);
    const pre = obj[2];

    res.precomputed = {
      beta: null,
      doubles: pre.doubles && {
        step: pre.doubles.step,
        points: [ res ].concat(pre.doubles.points.map(obj2point))
      },
      naf: pre.naf && {
        wnd: pre.naf.wnd,
        points: [ res ].concat(pre.naf.points.map(obj2point))
      }
    };
    return res;
  };

  Point.prototype.isInfinity = function isInfinity() {
    return this.inf;
  };

  Point.prototype.add = function add(p) {
    // O + P = P
    if (this.inf) return p;
    // P + O = P
    if (p.inf) return this;
    // P + P = 2P
    if (this.eq(p)) return this.dbl();
    // P + (-P) = O
    if (this.neg().eq(p)) return this.curve.point(null, null);
    // P + Q = O
    if (this.x.cmp(p.x) === 0) return this.curve.point(null, null);

    let c = this.y.redSub(p.y);
    if (c.cmpn(0) !== 0) c = c.redMul(this.x.redSub(p.x).redInvm());

    const nx = c.redSqr().redISub(this.x).redISub(p.x);
    const ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
    return this.curve.point(nx, ny);
  };

  Point.prototype.getX = function getX() {
    return this.x.fromRed();
  };

  Point.prototype.getY = function getY() {
    return this.y.fromRed();
  };

  Point.prototype.mul = function mul(k) {
    k = new BN(k, 16);
    if (this.isInfinity())
      return this;
    else if (this._hasDoubles(k))
      return this.curve._fixedNafMul(this, k);
    else if (this.curve.endo)
      return this.curve._endoWnafMulAdd([ this ], [ k ]);
    else
      return this.curve._wnafMul(this, k);
  };

  Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
    const points = [ this, p2 ];
    const coeffs = [ k1, k2 ];
    if (this.curve.endo)
      return this.curve._endoWnafMulAdd(points, coeffs);
    else
      return this.curve._wnafMulAdd(1, points, coeffs, 2);
  };

  Point.prototype.eq = function eq(p) {
    return this === p ||
          this.inf === p.inf &&
              (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
  };

  Point.prototype.neg = function neg(_precompute) {
    if (this.inf) return this;

    const res = this.curve.point(this.x, this.y.redNeg());
    if (_precompute && this.precomputed) {
      const pre = this.precomputed;
      const negate = (p) => p.neg();

      res.precomputed = {
        naf: pre.naf && {
          wnd: pre.naf.wnd,
          points: pre.naf.points.map(negate)
        },
        doubles: pre.doubles && {
          step: pre.doubles.step,
          points: pre.doubles.points.map(negate)
        }
      };
    }
    return res;
  };

  Point.prototype.toJ = function toJ() {
    if (this.inf) return this.curve.jpoint(null, null, null);

    const res = this.curve.jpoint(this.x, this.y, this.curve.one);
    return res;
  };

  function JPoint(curve, x, y, z) {
    Base.BasePoint.call(this, curve, 'jacobian');
    if (x === null && y === null && z === null) {
      this.x = this.curve.one;
      this.y = this.curve.one;
      this.z = new BN(0);
    } else {
      this.x = new BN(x, 16);
      this.y = new BN(y, 16);
      this.z = new BN(z, 16);
    }
    if (!this.x.red)
      this.x = this.x.toRed(this.curve.red);
    if (!this.y.red)
      this.y = this.y.toRed(this.curve.red);
    if (!this.z.red)
      this.z = this.z.toRed(this.curve.red);

    this.zOne = this.z === this.curve.one;
  }
  inherits(JPoint, Base.BasePoint);

  ShortCurve.prototype.jpoint = function jpoint(x, y, z) {
    return new JPoint(this, x, y, z);
  };

  JPoint.prototype.toP = function toP() {
    if (this.isInfinity())
      return this.curve.point(null, null);

    const zinv = this.z.redInvm();
    const zinv2 = zinv.redSqr();
    const ax = this.x.redMul(zinv2);
    const ay = this.y.redMul(zinv2).redMul(zinv);

    return this.curve.point(ax, ay);
  };

  JPoint.prototype.neg = function neg() {
    return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
  };

  JPoint.prototype.add = function add(p) {
    // O + P = P
    if (this.isInfinity()) return p;
    // P + O = P
    if (p.isInfinity()) return this;
    // 12M + 4S + 7A
    const pz2 = p.z.redSqr();
    const z2 = this.z.redSqr();
    const u1 = this.x.redMul(pz2);
    const u2 = p.x.redMul(z2);
    const s1 = this.y.redMul(pz2.redMul(p.z));
    const s2 = p.y.redMul(z2.redMul(this.z));

    const h = u1.redSub(u2);
    const r = s1.redSub(s2);
    if (h.cmpn(0) === 0) {
      if (r.cmpn(0) !== 0)
        return this.curve.jpoint(null, null, null);
      else
        return this.dbl();
    }

    const h2 = h.redSqr();
    const h3 = h2.redMul(h);
    const v = u1.redMul(h2);

    const nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
    const ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
    const nz = this.z.redMul(p.z).redMul(h);

    return this.curve.jpoint(nx, ny, nz);
  };

  JPoint.prototype.mixedAdd = function mixedAdd(p) {
    // O + P = P
    if (this.isInfinity()) return p.toJ();
    // P + O = P
    if (p.isInfinity()) return this;

    // 8M + 3S + 7A
    const z2 = this.z.redSqr();
    const u1 = this.x;
    const u2 = p.x.redMul(z2);
    const s1 = this.y;
    const s2 = p.y.redMul(z2).redMul(this.z);

    const h = u1.redSub(u2);
    const r = s1.redSub(s2);
    if (h.cmpn(0) === 0) {
      return (r.cmpn(0) !== 0) ? this.curve.jpoint(null, null, null) : this.dbl();
    }

    const h2 = h.redSqr();
    const h3 = h2.redMul(h);
    const v = u1.redMul(h2);
    const nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
    const ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
    const nz = this.z.redMul(h);

    return this.curve.jpoint(nx, ny, nz);
  };

  JPoint.prototype.dblp = function dblp(pow) {
    if (pow === 0 || this.isInfinity()) return this;
    if (!pow) return this.dbl();

    if (this.curve.zeroA || this.curve.threeA) {
      let r = this;
      for (let i = 0; i < pow; i++)
        r = r.dbl();
      return r;
    }
    // 1M + 2S + 1A + N * (4S + 5M + 8A)
    // N = 1 => 6M + 6S + 9A
    const a = this.curve.a;
    const tinv = this.curve.tinv;

    let jx = this.x;
    const jy = this.y;
    let jz = this.z;
    let jz4 = jz.redSqr().redSqr();

    // Reuse results
    let jyd = jy.redAdd(jy);
    for (let i = 0; i < pow; i++) {
      const jx2 = jx.redSqr();
      const jyd2 = jyd.redSqr();
      const jyd4 = jyd2.redSqr();
      const c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

      const t1 = jx.redMul(jyd2);
      const nx = c.redSqr().redISub(t1.redAdd(t1));
      const t2 = t1.redISub(nx);
      let dny = c.redMul(t2);
      dny = dny.redIAdd(dny).redISub(jyd4);

      const nz = jyd.redMul(jz);

      if (i + 1 < pow) jz4 = jz4.redMul(jyd4);

      jx = nx;
      jz = nz;
      jyd = dny;
    }
    return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
  };

  JPoint.prototype.dbl = function dbl() {
    if (this.isInfinity()) return this;

    if (this.curve.zeroA)
      return this._zeroDbl();
    else if (this.curve.threeA)
      return this._threeDbl();
    else
      return this._dbl();
  };

  JPoint.prototype._zeroDbl = function _zeroDbl() {
    let nx;
    let ny;
    let nz;
    // Z = 1
    if (this.zOne) {
      // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
      //     #doubling-mdbl-2007-bl
      // 1M + 5S + 14A

      // XX = X1^2
      const xx = this.x.redSqr();
      // YY = Y1^2
      const yy = this.y.redSqr();
      // YYYY = YY^2
      const yyyy = yy.redSqr();
      // S = 2 * ((X1 + YY)^2 - XX - YYYY)
      let s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
      s = s.redIAdd(s);
      // M = 3 * XX + a; a = 0
      const m = xx.redAdd(xx).redIAdd(xx);
      // T = M ^ 2 - 2*S
      const t = m.redSqr().redISub(s).redISub(s);

      // 8 * YYYY
      let yyyy8 = yyyy.redIAdd(yyyy);
      yyyy8 = yyyy8.redIAdd(yyyy8);
      yyyy8 = yyyy8.redIAdd(yyyy8);

      // X3 = T
      nx = t;
      // Y3 = M * (S - T) - 8 * YYYY
      ny = m.redMul(s.redISub(t)).redISub(yyyy8);
      // Z3 = 2*Y1
      nz = this.y.redAdd(this.y);
    } else {
      // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
      //     #doubling-dbl-2009-l
      // 2M + 5S + 13A

      // A = X1^2
      const a = this.x.redSqr();
      // B = Y1^2
      const b = this.y.redSqr();
      // C = B^2
      const c = b.redSqr();
      // D = 2 * ((X1 + B)^2 - A - C)
      let d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
      d = d.redIAdd(d);
      // E = 3 * A
      const e = a.redAdd(a).redIAdd(a);
      // F = E^2
      const f = e.redSqr();

      // 8 * C
      let c8 = c.redIAdd(c);
      c8 = c8.redIAdd(c8);
      c8 = c8.redIAdd(c8);

      // X3 = F - 2 * D
      nx = f.redISub(d).redISub(d);
      // Y3 = E * (D - X3) - 8 * C
      ny = e.redMul(d.redISub(nx)).redISub(c8);
      // Z3 = 2 * Y1 * Z1
      nz = this.y.redMul(this.z);
      nz = nz.redIAdd(nz);
    }

    return this.curve.jpoint(nx, ny, nz);
  };

  JPoint.prototype.isInfinity = function isInfinity() {
    // XXX This code assumes that zero is always zero in red
    return this.z.cmpn(0) === 0;
  };

  return exports;
});

const lib_hmac = lib(() => {
  "use strict";

  let exports = {};
  const utils = lib_utils();

  function Hmac(hash, key, enc) {
    if (!(this instanceof Hmac)) return new Hmac(hash, key, enc);

    this.Hash = hash;
    this.blockSize = hash.blockSize / 8;
    this.outSize = hash.outSize / 8;
    this.inner = null;
    this.outer = null;

    this._init(utils.toArray(key, enc));
  }
  exports = Hmac;

  Hmac.prototype._init = function init(key) {
  // Shorten key, if needed
  if (key.length > this.blockSize) key = new this.Hash().update(key).digest();

  utils.assert(key.length <= this.blockSize);
  // Add padding to key
  for (let i = key.length; i < this.blockSize; i++) key.push(0);

  for (let i = 0; i < key.length; i++) key[i] ^= 0x36;
  this.inner = new this.Hash().update(key);

  // 0x36 ^ 0x5c = 0x6a
  for (let i = 0; i < key.length; i++) key[i] ^= 0x6a;
  this.outer = new this.Hash().update(key);
  };

  Hmac.prototype.update = function update(msg, enc) {
    this.inner.update(msg, enc);
    return this;
  };

  Hmac.prototype.digest = function digest(enc) {
    this.outer.update(this.inner.digest());
    return this.outer.digest(enc);
  };

  return exports;
});

const lib_elliptic_ec = lib(() => {
  "use strict";

  let exports = {};

  const BN = lib_BN();
  const HmacDRBG = lib_hmac_drgb();
  const curves = lib_curves();
  const utils = lib_utils();
  const KeyPair = lib_keypair();
  const Signature = lib_signature();

  function EC(options) {
    if (!(this instanceof EC)) return new EC(options);

    // Shortcut `elliptic.ec(curve-name)`
    if (typeof options === 'string') {
      utils.assert(curves.hasOwnProperty(options), 'Unknown curve ' + options);
      options = curves[options];
    }

    // Shortcut for `elliptic.ec(elliptic.curves.curveName)`
    if (options instanceof curves.PresetCurve) options = { curve: options };

    this.curve = options.curve.curve;
    this.n = this.curve.n;
    this.nh = this.n.ushrn(1);
    this.g = this.curve.g;

    // Point on curve
    this.g = options.curve.g;
    this.g.precompute(options.curve.n.bitLength() + 1);

    // Hash for function for DRBG
    this.hash = options.hash || options.curve.hash;
  }
  exports = EC;

  EC.prototype.keyFromPrivate = function keyFromPrivate(priv, enc) {
    return KeyPair.fromPrivate(this, priv, enc);
  };

  EC.prototype._truncateToN = function truncateToN(msg, truncOnly) {
    const delta = msg.byteLength() * 8 - this.n.bitLength();
    if (delta > 0)
      msg = msg.ushrn(delta);
    if (!truncOnly && msg.cmp(this.n) >= 0)
      return msg.sub(this.n);
    else
      return msg;
  };

  EC.prototype.sign = function sign(msg, key, enc, options) {
    if (typeof enc === 'object') {
      options = enc;
      enc = null;
    }
    if (!options) options = {};

    key = this.keyFromPrivate(key, enc);
    msg = this._truncateToN(new BN(msg, 16));

    // Zero-extend key to provide enough entropy
    const bytes = this.n.byteLength();
    const bkey = key.getPrivate().toArray('be', bytes);
    // Zero-extend nonce to have the same byte size as N
    const nonce = msg.toArray('be', bytes);

    // Instantiate Hmac_DRBG
    const drbg = new HmacDRBG({
      hash: this.hash,
      entropy: bkey,
      nonce: nonce,
      pers: options.pers,
      persEnc: options.persEnc || 'utf8'
    });

    // Number of bytes to generate
    const ns1 = this.n.sub(new BN(1));

    for (let iter = 0; true; iter++) {
      let k = options.k ? options.k(iter) : new BN(drbg.generate(this.n.byteLength()));
      k = this._truncateToN(k, true);
      if (k.cmpn(1) <= 0 || k.cmp(ns1) >= 0) continue;

      const kp = this.g.mul(k);
      if (kp.isInfinity()) continue;

      const kpX = kp.getX();
      const r = kpX.umod(this.n);
      if (r.cmpn(0) === 0) continue;

      let s = k.invm(this.n).mul(r.mul(key.getPrivate()).iadd(msg));
      s = s.umod(this.n);
      if (s.cmpn(0) === 0) continue;

      let recoveryParam = (kp.getY().isOdd() ? 1 : 0) | (kpX.cmp(r) !== 0 ? 2 : 0);

      // Use complement of `s`, if it is > `n / 2`
      if (options.canonical && s.cmp(this.nh) > 0) {
        s = this.n.sub(s);
        recoveryParam ^= 1;
      }

      return new Signature({ r: r, s: s, recoveryParam: recoveryParam });
    }
  };

  EC.prototype.recoverPubKey = function(msg, signature, j, enc) {
    utils.assert((3 & j) === j, 'The recovery param is more than two bits');
    signature = new Signature(signature, enc);

    const n = this.n;
    const e = new BN(msg);
    let r = signature.r;
    const s = signature.s;

    // A set LSB signifies that the y-coordinate is odd
    const isYOdd = j & 1;
    const isSecondKey = j >> 1;
    if (r.cmp(this.curve.p.umod(this.curve.n)) >= 0 && isSecondKey)
      throw new Error('Unable to find sencond key candinate');

    // 1.1. Let x = r + jn.
    if (isSecondKey)
      r = this.curve.pointFromX(r.add(this.curve.n), isYOdd);
    else
      r = this.curve.pointFromX(r, isYOdd);

    const rInv = signature.r.invm(n);
    const s1 = n.sub(e).mul(rInv).umod(n);
    const s2 = s.mul(rInv).umod(n);

    // 1.6.1 Compute Q = r^-1 (sR -  eG)
    //               Q = r^-1 (sR + -eG)
    return this.g.mulAdd(s1, r, s2);
  };

  return exports;
});

const lib_hmac_drgb = lib(() => {
  "use strict";

  let exports = {};
  const hash = lib_hash();
  const utils = lib_utils();

  function HmacDRBG(options) {
    if (!(this instanceof HmacDRBG)) return new HmacDRBG(options);
    this.hash = options.hash;
    this.predResist = !!options.predResist;

    this.outLen = this.hash.outSize;
    this.minEntropy = options.minEntropy || this.hash.hmacStrength;

    this._reseed = null;
    this.reseedInterval = null;
    this.K = null;
    this.V = null;

    const entropy = utils.toArray(options.entropy, options.entropyEnc || 'hex');
    const nonce = utils.toArray(options.nonce, options.nonceEnc || 'hex');
    const pers = utils.toArray(options.pers, options.persEnc || 'hex');

    utils.assert(entropy.length >= (this.minEntropy / 8),
                `Not enough entropy. Minimum is: ${this.minEntropy} bits`);
    this._init(entropy, nonce, pers);
  }
  exports = HmacDRBG;

  HmacDRBG.prototype._init = function init(entropy, nonce, pers) {
    const seed = entropy.concat(nonce).concat(pers);

    this.K = new Array(this.outLen / 8);
    this.V = new Array(this.outLen / 8);
    for (let i = 0; i < this.V.length; i++) {
      this.K[i] = 0x00;
      this.V[i] = 0x01;
    }

    this._update(seed);
    this._reseed = 1;
    this.reseedInterval = 0x1000000000000;  // 2^48
  };

  HmacDRBG.prototype._hmac = function hmac() {
    return new hash.hmac(this.hash, this.K);
  };

  HmacDRBG.prototype._update = function update(seed) {
    let kmac = this._hmac()
                  .update(this.V)
                  .update([ 0x00 ]);

    if (seed) kmac = kmac.update(seed);
    this.K = kmac.digest();
    this.V = this._hmac().update(this.V).digest();
    if (!seed) return;

    this.K = this._hmac()
                .update(this.V)
                .update([ 0x01 ])
                .update(seed)
                .digest();

    this.V = this._hmac().update(this.V).digest();
  };

  HmacDRBG.prototype.generate = function generate(len, enc, add, addEnc) {
    if (this._reseed > this.reseedInterval)
      throw new Error('Reseed is required');

    // Optional encoding
    if (typeof enc !== 'string') {
      addEnc = add;
      add = enc;
      enc = null;
    }

    // Optional additional data
    if (add) {
      add = utils.toArray(add, addEnc || 'hex');
      this._update(add);
    }

    let temp = [];
    while (temp.length < len) {
      this.V = this._hmac().update(this.V).digest();
      temp = temp.concat(this.V);
    }

    const res = temp.slice(0, len);
    this._update(add);
    this._reseed++;
    return utils.encode(res, enc);
  };

  return exports;
});

const lib_keypair = lib(() => {
  "use strict";

  let exports = {};
  const BN = lib_BN();

  function KeyPair(ec, options) {
    this.ec = ec;
    this.priv = null;
    this.pub = null;

    // KeyPair(ec, { priv: ..., pub: ... })
    if (options.priv) this._importPrivate(options.priv, options.privEnc);
    if (options.pub) this._importPublic(options.pub, options.pubEnc);
  }
  exports = KeyPair;

  KeyPair.fromPrivate = function fromPrivate(ec, priv, enc) {
    if (priv instanceof KeyPair)
      return priv;

    return new KeyPair(ec, {
      priv: priv,
      privEnc: enc
    });
  };

  KeyPair.prototype.getPublic = function getPublic(compact, enc) {
    // compact is optional argument
    if (typeof compact === 'string') {
      enc = compact;
      compact = null;
    }

    if (!this.pub) this.pub = this.ec.g.mul(this.priv);

    if (!enc) return this.pub;

    return this.pub.encode(enc, compact);
  };

  KeyPair.prototype.getPrivate = function getPrivate(enc) {
    return (enc === 'hex') ? this.priv.toString(16, 2) : this.priv;
  };

  KeyPair.prototype._importPrivate = function _importPrivate(key, enc) {
    this.priv = new BN(key, enc || 16);
    // Ensure that the priv won't be bigger than n, otherwise we may fail
    // in fixed multiplication method
    this.priv = this.priv.umod(this.ec.curve.n);
  };

  // ECDSA
  KeyPair.prototype.sign = function sign(msg, enc, options) {
    return this.ec.sign(msg, this, enc, options);
  };

  return exports;
});

const lib_signature = lib(() => {
  "use strict";

  let exports = {};
  const BN = lib_BN();
  const utils = lib_utils();

  function Signature(options, enc) {
    if (options instanceof Signature)
      return options;

    utils.assert(options.r && options.s, 'Signature without r or s');
    this.r = new BN(options.r, 16);
    this.s = new BN(options.s, 16);
    this.recoveryParam = (options.recoveryParam === undefined) ? null : options.recoveryParam;
  }
  exports = Signature;

  return exports;
});

const acc = lib_account();
module["exports"]["addressChecksum"] = acc.addressChecksum;
module["exports"]["addressFromKey"] = acc.addressFromKey;
module["exports"]["signMessage"] = acc.signMessage;
module["exports"]["signerAddress"] = acc.signerAddress;
module["exports"]["keccak"] = lib_keccak().keccak256;
