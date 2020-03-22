const lib_assert = lib(() => {
    var exports = {};

    exports = assert;

    function assert(val, msg) {
      if (!val)
        throw new Error(msg || 'Assertion failed');
    }

    assert.equal = function assertEqual(l, r, msg) {/*NOTUSED*/};

    return exports;
  });
