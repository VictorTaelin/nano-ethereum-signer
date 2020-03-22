const lib_bytes = lib(() => {
    var exports = {};

    const length = a => (a.length - 2) / 2;

    const flatten = a => "0x" + a.reduce((r, s) => r + s.slice(2), "");

    const slice = (i, j, bs) => "0x" + bs.slice(i * 2 + 2, j * 2 + 2);

    const pad = (l, hex) => hex.length === l * 2 + 2 ? hex : pad(l, "0x" + "0" + hex.slice(2));

    const fromNumber = num => {
      let hex = num.toString(16);
      return hex.length % 2 === 0 ? "0x" + hex : "0x0" + hex;
    };

    const toNumber = hex => parseInt(hex.slice(2), 16);

    const concat = (a, b) => a.concat(b.slice(2));

    const fromNat = bn => bn === "0x0" ? "0x" : bn.length % 2 === 0 ? bn : "0x0" + bn.slice(2);

    const toNat = bn => bn[2] === "0" ? "0x" + bn.slice(3) : bn;

    exports = {
      length,
      flatten,
      slice,
      pad,
      fromNumber,
      toNumber,
      fromNat,
      toNat,
    };

    return exports;
  });