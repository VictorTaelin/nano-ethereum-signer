const lib_elliptic = lib(() => {
    "use strict";

    var exports = {};

    var elliptic = exports;

    elliptic.utils = lib_utils_a();
    elliptic.curves = lib_curves();

    // Protocols
    elliptic.ec = lib_elliptic_ec();

    return exports;
  });