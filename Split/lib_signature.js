const lib_signature = lib(() => {
    "use strict";

    var exports = {};
    var BN = lib_BN();

    var utils = lib_utils_a();
    var assert = utils.assert;

    function Signature(options, enc) {
      if (options instanceof Signature)
        return options;

      assert(options.r && options.s, 'Signature without r or s');
      this.r = new BN(options.r, 16);
      this.s = new BN(options.s, 16);
      if (options.recoveryParam === undefined)
        this.recoveryParam = null;
      else
        this.recoveryParam = options.recoveryParam;
    }
    exports = Signature;

    function Position() {
      this.place = 0;
    }

    return exports;
  });