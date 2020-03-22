const lib_base = lib(() => {
    "use strict";

    var exports = {};

    var BN = lib_BN();
    var utils = lib_utils_a();
    var getNAF = utils.getNAF;
    var getJSF = utils.getJSF;
    var assert = utils.assert;

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
      var adjustCount = this.n && this.p.div(this.n);
      if (!adjustCount || adjustCount.cmpn(100) > 0) {
        this.redN = null;
      } else {
        this._maxwellTrick = true;
        this.redN = this.n.toRed(this.red);
      }
    }
    exports = BaseCurve;

    BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p, k) {
      assert(p.precomputed);
      var doubles = p._getDoubles();

      var naf = getNAF(k, 1, this._bitLength);
      var I = (1 << (doubles.step + 1)) - (doubles.step % 2 === 0 ? 2 : 1);
      I /= 3;

      // Translate into more windowed form
      var repr = [];
      for (var j = 0; j < naf.length; j += doubles.step) {
        var nafW = 0;
        for (var K = j + doubles.step - 1; k >= j; k--)
          nafW = (nafW << 1) + naf[K];
        repr.push(nafW);
      }

      var a = this.jpoint(null, null, null);
      var b = this.jpoint(null, null, null);
      for (var i = I; i > 0; i--) {
        for (var j = 0; j < repr.length; j++) {
          var nafW = repr[j];
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
      var wndWidth = this._wnafT1;
      var wnd = this._wnafT2;
      var naf = this._wnafT3;

      // Fill all arrays
      var max = 0;
      for (var i = 0; i < len; i++) {
        var p = points[i];
        var nafPoints = p._getNAFPoints(defW);
        wndWidth[i] = nafPoints.wnd;
        wnd[i] = nafPoints.points;
      }

      // Comb small window NAFs
      for (var i = len - 1; i >= 1; i -= 2) {
        var a = i - 1;
        var b = i;
        if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
          naf[a] = getNAF(coeffs[a], wndWidth[a], this._bitLength);
          naf[b] = getNAF(coeffs[b], wndWidth[b], this._bitLength);
          max = Math.max(naf[a].length, max);
          max = Math.max(naf[b].length, max);
          continue;
        }

        var comb = [
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

        var index = [
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

        var jsf = getJSF(coeffs[a], coeffs[b]);
        max = Math.max(jsf[0].length, max);
        naf[a] = new Array(max);
        naf[b] = new Array(max);
        for (var j = 0; j < max; j++) {
          var ja = jsf[0][j] | 0;
          var jb = jsf[1][j] | 0;

          naf[a][j] = index[(ja + 1) * 3 + (jb + 1)];
          naf[b][j] = 0;
          wnd[a] = comb;
        }
      }

      var acc = this.jpoint(null, null, null);
      var tmp = this._wnafT4;
      for (var i = max; i >= 0; i--) {
        var k = 0;

        while (i >= 0) {
          var zero = true;
          for (var j = 0; j < len; j++) {
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

        for (var j = 0; j < len; j++) {
          var z = tmp[j];
          var p;
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
      for (var i = 0; i < len; i++)
        wnd[i] = null;

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
      var len = this.curve.p.byteLength();
      var x = this.getX().toArray('be', len);

      if (compact)
        return [ this.getY().isEven() ? 0x02 : 0x03 ].concat(x);

      return [ 0x04 ].concat(x, this.getY().toArray('be', len)) ;
    };

    BasePoint.prototype.encode = function encode(enc, compact) {
      return utils.encode(this._encode(compact), enc);
    };

    BasePoint.prototype.precompute = function precompute(power) {
      if (this.precomputed)
        return this;

      var precomputed = {
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
      if (!this.precomputed)
        return false;

      var doubles = this.precomputed.doubles;
      if (!doubles)
        return false;

      return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
    };

    BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
      if (this.precomputed && this.precomputed.doubles)
        return this.precomputed.doubles;

      var doubles = [ this ];
      var acc = this;
      for (var i = 0; i < power; i += step) {
        for (var j = 0; j < step; j++)
          acc = acc.dbl();
        doubles.push(acc);
      }
      return {
        step: step,
        points: doubles
      };
    };

    BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
      if (this.precomputed && this.precomputed.naf)
        return this.precomputed.naf;

      var res = [ this ];
      var max = (1 << wnd) - 1;
      var dbl = max === 1 ? null : this.dbl();
      for (var i = 1; i < max; i++)
        res[i] = res[i - 1].add(dbl);
      return {
        wnd: wnd,
        points: res
      };
    };

    return exports;
  });