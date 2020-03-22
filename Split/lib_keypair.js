const lib_keypair = lib(() => {
    "use strict";

    var exports = {};

    var BN = lib_BN();
    var utils = lib_utils_a();
    var assert = utils.assert;

    function KeyPair(ec, options) {
      this.ec = ec;
      this.priv = null;
      this.pub = null;

      // KeyPair(ec, { priv: ..., pub: ... })
      if (options.priv)
        this._importPrivate(options.priv, options.privEnc);
      if (options.pub)
        this._importPublic(options.pub, options.pubEnc);
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

      if (!this.pub)
        this.pub = this.ec.g.mul(this.priv);

      if (!enc)
        return this.pub;

      return this.pub.encode(enc, compact);
    };

    KeyPair.prototype.getPrivate = function getPrivate(enc) {
      if (enc === 'hex')
        return this.priv.toString(16, 2);
      else
        return this.priv;
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