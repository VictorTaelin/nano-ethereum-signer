const lib_buffer = lib(() => {
    var exports = {};

    exports.Buffer = Buffer
    exports.INSPECT_MAX_BYTES = 50

    /**
    * If `Buffer.TYPED_ARRAY_SUPPORT`:
    *   === true    Use Uint8Array implementation (fastest)
    *   === false   Use Object implementation (most compatible, even IE6)
    *
    * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
    * Opera 11.6+, iOS 4.2+.
    *
    * Due to various browser bugs, sometimes the Object implementation will be used even
    * when the browser supports typed arrays.
    *
    * Note:
    *
    *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
    *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
    *
    *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
    *
    *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
    *     incorrect length in some situations.

    * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
    * get the Object implementation, which is slower but behaves correctly.
    */
    Buffer.TYPED_ARRAY_SUPPORT = true;

    /*
    * Export kMaxLength after typed array support is determined.
    */
    exports.kMaxLength = kMaxLength()

    function typedArraySupport () {
      try {
        var arr = new Uint8Array(1)
        arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
        return arr.foo() === 42 && // typed array instances can be augmented
            typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
            arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
      } catch (e) {
        return false
      }
    }

    function kMaxLength () {
      return Buffer.TYPED_ARRAY_SUPPORT
        ? 0x7fffffff
        : 0x3fffffff
    }

    function createBuffer (that, length) {
      if (kMaxLength() < length) {
        throw new RangeError('Invalid typed array length')
      }
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        // Return an augmented `Uint8Array` instance, for best performance
        that = new Uint8Array(length)
        that.__proto__ = Buffer.prototype
      } else {
        // Fallback: Return an object instance of the Buffer class
        if (that === null) {
          that = new Buffer(length)
        }
        that.length = length
      }

      return that
    }

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

    function from (that, value, encodingOrOffset, length) {
      return fromString(that, value, encodingOrOffset)
    }

    /**
    * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
    * if value is a number.
    * Buffer.from(str[, encoding])
    * Buffer.from(array)
    * Buffer.from(buffer)
    * Buffer.from(arrayBuffer[, byteOffset[, length]])
    **/
    Buffer.from = function (value, encodingOrOffset, length) {
      return from(null, value, encodingOrOffset, length)
    }

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      Buffer.prototype.__proto__ = Uint8Array.prototype
      Buffer.__proto__ = Uint8Array
      if (typeof Symbol !== 'undefined' && Symbol.species &&
          Buffer[Symbol.species] === Buffer) {
        // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
        Object.defineProperty(Buffer, Symbol.species, {
          value: null,
          configurable: true
        })
      }
    }

    function fromString (that, string, encoding) {
      var length = byteLength(string, encoding) | 0
      that = createBuffer(that, length)
      var actual = that.write(string, encoding)
      if (actual !== length) {
        that = that.slice(0, actual)
      }
      return that
    }

    Buffer.isBuffer = function isBuffer (b) {
      return !!(b != null && b._isBuffer)
    }

    function byteLength (string, encoding) {
      return string.length >>> 1;
    }
    Buffer.byteLength = byteLength

    // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
    // Buffer instances.
    Buffer.prototype._isBuffer = true

    function hexWrite (buf, string, offset, length) {
      offset = Number(offset) || 0
      var remaining = buf.length - offset
      if (!length) {
        length = remaining
      } else {
        length = Number(length)
        if (length > remaining) {
          length = remaining
        }
      }

      // must be an even number of digits
      var strLen = string.length
      if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

      if (length > strLen / 2) {
        length = strLen / 2
      }
      for (var i = 0; i < length; ++i) {
        var parsed = parseInt(string.substr(i * 2, 2), 16)
        if (isNaN(parsed)) return i
        buf[offset + i] = parsed
      }
      return i
    }

    Buffer.prototype.write = function write (string, offset, length, encoding) {
      return hexWrite(this, string, 0, this.length);
    }

    return exports;
  });