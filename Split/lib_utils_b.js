const lib_utils_b = lib(() => {
    "use strict";

    var exports = {};

    var assert = lib_assert();
    var inherits = lib_inherits();

    exports.inherits = inherits;

    function isSurrogatePair(msg, i) {/*NOTUSED*/}

    function toArray(msg, enc) {
      if (Array.isArray(msg))
        return msg.slice();
      if (!msg)
        return [];
      var res = [];
      if (typeof msg === 'string') {
        if (!enc) {
          // Inspired by stringToUtf8ByteArray() in closure-library by Google
          // https://github.com/google/closure-library/blob/8598d87242af59aac233270742c8984e2b2bdbe0/closure/goog/crypt/crypt.js#L117-L143
          // Apache License 2.0
          // https://github.com/google/closure-library/blob/master/LICENSE
          var p = 0;
          for (var i = 0; i < msg.length; i++) {
            var c = msg.charCodeAt(i);
            if (c < 128) {
              res[p++] = c;
            } else if (c < 2048) {
              res[p++] = (c >> 6) | 192;
              res[p++] = (c & 63) | 128;
            } else if (isSurrogatePair(msg, i)) {
              c = 0x10000 + ((c & 0x03FF) << 10) + (msg.charCodeAt(++i) & 0x03FF);
              res[p++] = (c >> 18) | 240;
              res[p++] = ((c >> 12) & 63) | 128;
              res[p++] = ((c >> 6) & 63) | 128;
              res[p++] = (c & 63) | 128;
            } else {
              res[p++] = (c >> 12) | 224;
              res[p++] = ((c >> 6) & 63) | 128;
              res[p++] = (c & 63) | 128;
            }
          }
        } else if (enc === 'hex') {
          msg = msg.replace(/[^a-z0-9]+/ig, '');
          if (msg.length % 2 !== 0)
            msg = '0' + msg;
          for (i = 0; i < msg.length; i += 2)
            res.push(parseInt(msg[i] + msg[i + 1], 16));
        }
      } else {
        for (i = 0; i < msg.length; i++)
          res[i] = msg[i] | 0;
      }
      return res;
    }
    exports.toArray = toArray;

    function join32(msg, start, end, endian) {
      var len = end - start;
      assert(len % 4 === 0);
      var res = new Array(len / 4);
      for (var i = 0, k = start; i < res.length; i++, k += 4) {
        var w;
        if (endian === 'big')
          w = (msg[k] << 24) | (msg[k + 1] << 16) | (msg[k + 2] << 8) | msg[k + 3];
        else
          w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
        res[i] = w >>> 0;
      }
      return res;
    }
    exports.join32 = join32;

    function split32(msg, endian) {
      var res = new Array(msg.length * 4);
      for (var i = 0, k = 0; i < msg.length; i++, k += 4) {
        var m = msg[i];
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
    exports.split32 = split32;

    function rotr32(w, b) {
      return (w >>> b) | (w << (32 - b));
    }
    exports.rotr32 = rotr32;

    function sum32(a, b) {
      return (a + b) >>> 0;
    }
    exports.sum32 = sum32;

    function sum32_4(a, b, c, d) {
      return (a + b + c + d) >>> 0;
    }
    exports.sum32_4 = sum32_4;

    function sum32_5(a, b, c, d, e) {
      return (a + b + c + d + e) >>> 0;
    }
    exports.sum32_5 = sum32_5;

    return exports;
  });