const lib_hash = lib(() => {
    var exports = {};

    var hash = exports;
    hash.utils = lib_utils_b();
    hash.common = lib_hash_common();
    hash.sha = {sha256: lib_sha()};
    hash.hmac = lib_hmac();
    hash.sha256 = hash.sha.sha256;

    return exports;
  });