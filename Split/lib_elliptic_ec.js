const lib_elliptic_ec = lib(() => {
    "use strict";

    var exports = {};

    var BN = lib_BN();
    var HmacDRBG = lib_hmac_drgb();
    var utils = lib_utils_a();
    var curves = lib_curves();
    var assert = utils.assert;

    var KeyPair = lib_keypair();
    var Signature = lib_signature();

    function EC(options) {
      if (!(this instanceof EC))
        return new EC(options);

      // Shortcut `elliptic.ec(curve-name)`
      if (typeof options === 'string') {
        assert(curves.hasOwnProperty(options), 'Unknown curve ' + options);

        options = curves[options];
      }

      // Shortcut for `elliptic.ec(elliptic.curves.curveName)`
      if (options instanceof curves.PresetCurve)
        options = { curve: options };

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
      var delta = msg.byteLength() * 8 - this.n.bitLength();
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
      if (!options)
        options = {};

      key = this.keyFromPrivate(key, enc);
      msg = this._truncateToN(new BN(msg, 16));

      // Zero-extend key to provide enough entropy
      var bytes = this.n.byteLength();
      var bkey = key.getPrivate().toArray('be', bytes);

      // Zero-extend nonce to have the same byte size as N
      var nonce = msg.toArray('be', bytes);

      // Instantiate Hmac_DRBG
      var drbg = new HmacDRBG({
        hash: this.hash,
        entropy: bkey,
        nonce: nonce,
        pers: options.pers,
        persEnc: options.persEnc || 'utf8'
      });

      // Number of bytes to generate
      var ns1 = this.n.sub(new BN(1));

      for (var iter = 0; true; iter++) {
        var k = options.k ?
            options.k(iter) :
            new BN(drbg.generate(this.n.byteLength()));
        k = this._truncateToN(k, true);
        if (k.cmpn(1) <= 0 || k.cmp(ns1) >= 0)
          continue;

        var kp = this.g.mul(k);
        if (kp.isInfinity())
          continue;

        var kpX = kp.getX();
        var r = kpX.umod(this.n);
        if (r.cmpn(0) === 0)
          continue;

        var s = k.invm(this.n).mul(r.mul(key.getPrivate()).iadd(msg));
        s = s.umod(this.n);
        if (s.cmpn(0) === 0)
          continue;

        var recoveryParam = (kp.getY().isOdd() ? 1 : 0) |
                            (kpX.cmp(r) !== 0 ? 2 : 0);

        // Use complement of `s`, if it is > `n / 2`
        if (options.canonical && s.cmp(this.nh) > 0) {
          s = this.n.sub(s);
          recoveryParam ^= 1;
        }

        return new Signature({ r: r, s: s, recoveryParam: recoveryParam });
      }
    };

    EC.prototype.recoverPubKey = function(msg, signature, j, enc) {
      assert((3 & j) === j, 'The recovery param is more than two bits');
      signature = new Signature(signature, enc);

      var n = this.n;
      var e = new BN(msg);
      var r = signature.r;
      var s = signature.s;

      // A set LSB signifies that the y-coordinate is odd
      var isYOdd = j & 1;
      var isSecondKey = j >> 1;
      if (r.cmp(this.curve.p.umod(this.curve.n)) >= 0 && isSecondKey)
        throw new Error('Unable to find sencond key candinate');

      // 1.1. Let x = r + jn.
      if (isSecondKey)
        r = this.curve.pointFromX(r.add(this.curve.n), isYOdd);
      else
        r = this.curve.pointFromX(r, isYOdd);

      var rInv = signature.r.invm(n);
      var s1 = n.sub(e).mul(rInv).umod(n);
      var s2 = s.mul(rInv).umod(n);

      // 1.6.1 Compute Q = r^-1 (sR -  eG)
      //               Q = r^-1 (sR + -eG)
      return this.g.mulAdd(s1, r, s2);
    };

    return exports;
  });
