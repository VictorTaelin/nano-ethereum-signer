
const lib_BN = lib(() => {
    'use strict';

    var exports = {};

    // Utils
    function assert (val, msg) {
      if (!val) throw new Error(msg || 'Assertion failed');
    }

    // Could use `inherits` module, but don't want to move from single file
    // architecture yet.
    function inherits (ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }

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
    };//3

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
    };//10

    BN.prototype.byteLength = function byteLength () {
      return Math.ceil(this.bitLength() / 8);
    };//8

    BN.prototype.neg = function neg () {
      return this.clone().ineg();
    };//26

    BN.prototype.ineg = function ineg () {
      if (!this.isZero()) {
        this.negative ^= 1;
      }

      return this;
    };//2

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
    };//21

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
    };//7?6

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
    };//7?

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
    };//7?4

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
    };//3

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
    };//1

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
    };//2

    BN.prototype.modn = function modn (num) {
      assert(num <= 0x3ffffff);
      var p = (1 << 26) % num;

      var acc = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        acc = (p * acc + (this.words[i] | 0)) % num;
      }

      return acc;
    };//1

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
    };//2

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
    };//2

    BN.prototype.isEven = function isEven () {
      return (this.words[0] & 1) === 0;
    };//1

    BN.prototype.isOdd = function isOdd () {
      return (this.words[0] & 1) === 1;
    };//6?2

    // And first word and num
    BN.prototype.andln = function andln (num) {
      return this.words[0] & num;
    };//5

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
    };//15

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
    };//14

    BN.prototype.fromRed = function fromRed () {
      assert(this.red, 'fromRed works only with numbers in reduction context');
      return this.red.convertFrom(this);
    };//16

    BN.prototype._forceRed = function _forceRed (ctx) {
      this.red = ctx;
      return this;
    };

    BN.prototype.redAdd = function redAdd (num) {
      assert(this.red, 'redAdd works only with red numbers');
      return this.red.add(this, num);
    };//8

    BN.prototype.redIAdd = function redIAdd (num) {
      assert(this.red, 'redIAdd works only with red numbers');
      return this.red.iadd(this, num);
    };//20

    BN.prototype.redSub = function redSub (num) {
      assert(this.red, 'redSub works only with red numbers');
      return this.red.sub(this, num);
    }; //8

    BN.prototype.redISub = function redISub (num) {
      assert(this.red, 'redISub works only with red numbers');
      return this.red.isub(this, num);
    }; //27

    BN.prototype.redMul = function redMul (num) {
      assert(this.red, 'redMul works only with red numbers');
      this.red._verify2(this, num);
      return this.red.mul(this, num);
    }; //44

    BN.prototype.redSqr = function redSqr () {
      assert(this.red, 'redSqr works only with red numbers');
      this.red._verify1(this);
      return this.red.sqr(this);
    }; //29

    // Square root over p
    BN.prototype.redSqrt = function redSqrt () {
      assert(this.red, 'redSqrt works only with red numbers');
      this.red._verify1(this);
      return this.red.sqrt(this);
    }; //1

    BN.prototype.redInvm = function redInvm () {
      assert(this.red, 'redInvm works only with red numbers');
      this.red._verify1(this);
      return this.red.invm(this);
    }; //3

    // Return negative clone of `this` % `red modulo`
    BN.prototype.redNeg = function redNeg () {
      assert(this.red, 'redNeg works only with red numbers');
      this.red._verify1(this);
      return this.red.neg(this);
    }; //4

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
    }; //4?

    Red.prototype.add = function add (a, b) {
      this._verify2(a, b);

      var res = a.add(b);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res._forceRed(this);
    }; //8?

    Red.prototype.iadd = function iadd (a, b) {
      this._verify2(a, b);

      var res = a.iadd(b);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res;
    }; //20?

    Red.prototype.sub = function sub (a, b) {
      this._verify2(a, b);

      var res = a.sub(b);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res._forceRed(this);
    }; //8?

    Red.prototype.isub = function isub (a, b) {
      this._verify2(a, b);

      var res = a.isub(b);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res;
    }; //27?

    Red.prototype.mul = function mul (a, b) {
      this._verify2(a, b);
      return this.imod(a.mul(b));
    }; //44?

    Red.prototype.sqr = function sqr (a) {
      return this.mul(a, a);
    }; //29

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
    }; //1

    Red.prototype.invm = function invm (a) {
      var inv = a._invmp(this.m);
      if (inv.negative !== 0) {
        inv.negative = 0;
        return this.imod(inv).redNeg();
      } else {
        return this.imod(inv);
      }
    }; //3

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