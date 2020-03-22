const lib_curve = lib(() => {
    "use strict";

    var exports = {};

    var utils = lib_utils_a();
    var BN = lib_BN();
    var inherits = lib_inherits();
    var Base = lib_base();

    var assert = utils.assert;

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
      if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1)
        return;

      // Compute beta and lambda, that lambda * P = (beta * Px; Py)
      var beta;
      var lambda;
      if (conf.beta) {
        beta = new BN(conf.beta, 16).toRed(this.red);
      } else {
        var betas = this._getEndoRoots(this.p);
        // Choose the smallest beta
        beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
        beta = beta.toRed(this.red);
      }
      if (conf.lambda) {
        lambda = new BN(conf.lambda, 16);
      } else {
        // Choose the lambda that is matching selected beta
        var lambdas = this._getEndoRoots(this.n);
        if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
          lambda = lambdas[0];
        } else {
          lambda = lambdas[1];
          assert(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
        }
      }

      // Get basis vectors, used for balanced length-two representation
      var basis;
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
      var basis = this.endo.basis;
      var v1 = basis[0];
      var v2 = basis[1];

      var c1 = v2.b.mul(k).divRound(this.n);
      var c2 = v1.b.neg().mul(k).divRound(this.n);

      var p1 = c1.mul(v1.a);
      var p2 = c2.mul(v2.a);
      var q1 = c1.mul(v1.b);
      var q2 = c2.mul(v2.b);

      // Calculate answer
      var k1 = k.sub(p1).sub(p2);
      var k2 = q1.add(q2).neg();
      return { k1: k1, k2: k2 };
    };

    ShortCurve.prototype.pointFromX = function pointFromX(x, odd) {
      x = new BN(x, 16);
      if (!x.red)
        x = x.toRed(this.red);

      var y2 = x.redSqr().redMul(x).redIAdd(x.redMul(this.a)).redIAdd(this.b);
      var y = y2.redSqrt();
      if (y.redSqr().redSub(y2).cmp(this.zero) !== 0)
        throw new Error('invalid point');

      // XXX Is there any way to tell if the number is odd without converting it
      // to non-red form?
      var isOdd = y.fromRed().isOdd();
      if (odd && !isOdd || !odd && isOdd)
        y = y.redNeg();

      return this.point(x, y);
    };

    ShortCurve.prototype.validate = function validate(point) {
      if (point.inf)
        return true;

      var x = point.x;
      var y = point.y;

      var ax = this.a.redMul(x);
      var rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);
      return y.redSqr().redISub(rhs).cmpn(0) === 0;
    };

    ShortCurve.prototype._endoWnafMulAdd =
        function _endoWnafMulAdd(points, coeffs, jacobianResult) {
      var npoints = this._endoWnafT1;
      var ncoeffs = this._endoWnafT2;
      for (var i = 0; i < points.length; i++) {
        var split = this._endoSplit(coeffs[i]);
        var p = points[i];
        var beta = p._getBeta();

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
      var res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);

      // Clean-up references to points and coefficients
      for (var j = 0; j < i * 2; j++) {
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
      if (!this.curve.endo)
        return;

      var pre = this.precomputed;
      if (pre && pre.beta)
        return pre.beta;

      var beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
      if (pre) {
        var curve = this.curve;
        var endoMul = function(p) {
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

    Point.prototype.toJSON = function toJSON() {/*NOTUSED*/};

    Point.fromJSON = function fromJSON(curve, obj, red) {
      if (typeof obj === 'string')
        obj = JSON.parse(obj);
      var res = curve.point(obj[0], obj[1], red);
      if (!obj[2])
        return res;

      function obj2point(obj) {
        return curve.point(obj[0], obj[1], red);
      }

      var pre = obj[2];
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
      if (this.inf)
        return p;

      // P + O = P
      if (p.inf)
        return this;

      // P + P = 2P
      if (this.eq(p))
        return this.dbl();

      // P + (-P) = O
      if (this.neg().eq(p))
        return this.curve.point(null, null);

      // P + Q = O
      if (this.x.cmp(p.x) === 0)
        return this.curve.point(null, null);

      var c = this.y.redSub(p.y);
      if (c.cmpn(0) !== 0)
        c = c.redMul(this.x.redSub(p.x).redInvm());
      var nx = c.redSqr().redISub(this.x).redISub(p.x);
      var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
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
      var points = [ this, p2 ];
      var coeffs = [ k1, k2 ];
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
      if (this.inf)
        return this;

      var res = this.curve.point(this.x, this.y.redNeg());
      if (_precompute && this.precomputed) {
        var pre = this.precomputed;
        var negate = function(p) {
          return p.neg();
        };
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
      if (this.inf)
        return this.curve.jpoint(null, null, null);

      var res = this.curve.jpoint(this.x, this.y, this.curve.one);
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

      var zinv = this.z.redInvm();
      var zinv2 = zinv.redSqr();
      var ax = this.x.redMul(zinv2);
      var ay = this.y.redMul(zinv2).redMul(zinv);

      return this.curve.point(ax, ay);
    };

    JPoint.prototype.neg = function neg() {
      return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
    };

    JPoint.prototype.add = function add(p) {
      // O + P = P
      if (this.isInfinity())
        return p;

      // P + O = P
      if (p.isInfinity())
        return this;

      // 12M + 4S + 7A
      var pz2 = p.z.redSqr();
      var z2 = this.z.redSqr();
      var u1 = this.x.redMul(pz2);
      var u2 = p.x.redMul(z2);
      var s1 = this.y.redMul(pz2.redMul(p.z));
      var s2 = p.y.redMul(z2.redMul(this.z));

      var h = u1.redSub(u2);
      var r = s1.redSub(s2);
      if (h.cmpn(0) === 0) {
        if (r.cmpn(0) !== 0)
          return this.curve.jpoint(null, null, null);
        else
          return this.dbl();
      }

      var h2 = h.redSqr();
      var h3 = h2.redMul(h);
      var v = u1.redMul(h2);

      var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
      var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
      var nz = this.z.redMul(p.z).redMul(h);

      return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.mixedAdd = function mixedAdd(p) {
      // O + P = P
      if (this.isInfinity())
        return p.toJ();

      // P + O = P
      if (p.isInfinity())
        return this;

      // 8M + 3S + 7A
      var z2 = this.z.redSqr();
      var u1 = this.x;
      var u2 = p.x.redMul(z2);
      var s1 = this.y;
      var s2 = p.y.redMul(z2).redMul(this.z);

      var h = u1.redSub(u2);
      var r = s1.redSub(s2);
      if (h.cmpn(0) === 0) {
        if (r.cmpn(0) !== 0)
          return this.curve.jpoint(null, null, null);
        else
          return this.dbl();
      }

      var h2 = h.redSqr();
      var h3 = h2.redMul(h);
      var v = u1.redMul(h2);

      var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
      var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
      var nz = this.z.redMul(h);

      return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.dblp = function dblp(pow) {
      if (pow === 0)
        return this;
      if (this.isInfinity())
        return this;
      if (!pow)
        return this.dbl();

      if (this.curve.zeroA || this.curve.threeA) {
        var r = this;
        for (var i = 0; i < pow; i++)
          r = r.dbl();
        return r;
      }

      // 1M + 2S + 1A + N * (4S + 5M + 8A)
      // N = 1 => 6M + 6S + 9A
      var a = this.curve.a;
      var tinv = this.curve.tinv;

      var jx = this.x;
      var jy = this.y;
      var jz = this.z;
      var jz4 = jz.redSqr().redSqr();

      // Reuse results
      var jyd = jy.redAdd(jy);
      for (var i = 0; i < pow; i++) {
        var jx2 = jx.redSqr();
        var jyd2 = jyd.redSqr();
        var jyd4 = jyd2.redSqr();
        var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

        var t1 = jx.redMul(jyd2);
        var nx = c.redSqr().redISub(t1.redAdd(t1));
        var t2 = t1.redISub(nx);
        var dny = c.redMul(t2);
        dny = dny.redIAdd(dny).redISub(jyd4);
        var nz = jyd.redMul(jz);
        if (i + 1 < pow)
          jz4 = jz4.redMul(jyd4);

        jx = nx;
        jz = nz;
        jyd = dny;
      }

      return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
    };

    JPoint.prototype.dbl = function dbl() {
      if (this.isInfinity())
        return this;

      if (this.curve.zeroA)
        return this._zeroDbl();
      else if (this.curve.threeA)
        return this._threeDbl();
      else
        return this._dbl();
    };

    JPoint.prototype._zeroDbl = function _zeroDbl() {
      var nx;
      var ny;
      var nz;
      // Z = 1
      if (this.zOne) {
        // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
        //     #doubling-mdbl-2007-bl
        // 1M + 5S + 14A

        // XX = X1^2
        var xx = this.x.redSqr();
        // YY = Y1^2
        var yy = this.y.redSqr();
        // YYYY = YY^2
        var yyyy = yy.redSqr();
        // S = 2 * ((X1 + YY)^2 - XX - YYYY)
        var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
        s = s.redIAdd(s);
        // M = 3 * XX + a; a = 0
        var m = xx.redAdd(xx).redIAdd(xx);
        // T = M ^ 2 - 2*S
        var t = m.redSqr().redISub(s).redISub(s);

        // 8 * YYYY
        var yyyy8 = yyyy.redIAdd(yyyy);
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
        var a = this.x.redSqr();
        // B = Y1^2
        var b = this.y.redSqr();
        // C = B^2
        var c = b.redSqr();
        // D = 2 * ((X1 + B)^2 - A - C)
        var d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
        d = d.redIAdd(d);
        // E = 3 * A
        var e = a.redAdd(a).redIAdd(a);
        // F = E^2
        var f = e.redSqr();

        // 8 * C
        var c8 = c.redIAdd(c);
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