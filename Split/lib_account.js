const lib_account = lib(() => {
    var exports = {};

    /* WEBPACK VAR INJECTION */(function(Buffer) {
    const Bytes = lib_bytes();
    const BN = lib_BN();
    const elliptic = lib_elliptic();
    const secp256k1 = new elliptic.ec("secp256k1"); // eslint-disable-line
    const { keccak256 } = lib_keccak();

    const Nat = {
      fromString: str => {
        const bn = "0x" + (str.slice(0, 2) === "0x"
          ? new BN(str.slice(2), 16)
          : new BN(str, 10)).toString("hex");
        return bn === "0x0" ? "0x" : bn;
      }
    };

    const addressChecksum = address => {
      const addressHash = keccak256(address.slice(2));
      let checksumAddress = "0x";
      for (let i = 0; i < 40; i++) checksumAddress += parseInt(addressHash[i + 2], 16) > 7 ? address[i + 2].toUpperCase() : address[i + 2];
      return checksumAddress;
    };

    const addressFromKey = privateKey => {
      const buffer = Buffer.from(privateKey.slice(2), "hex");
      const ecKey = secp256k1.keyFromPrivate(buffer);
      const publicKey = "0x" + ecKey.getPublic(false, 'hex').slice(2);
      const publicHash = keccak256(publicKey);
      const address = addressChecksum("0x" + publicHash.slice(-40));
      return address;
    };

    const encodeSignature = ([v, r, s]) => Bytes.flatten([r, s, v]);

    const decodeSignature = hex => [Bytes.slice(64, Bytes.length(hex), hex), Bytes.slice(0, 32, hex), Bytes.slice(32, 64, hex)];

    const signMessage = (hash, privateKey, addToV = 27) => {
      const signature = secp256k1.keyFromPrivate(Buffer.from(privateKey.slice(2), "hex")).sign(Buffer.from(hash.slice(2), "hex"), { canonical: true });
      return encodeSignature([Nat.fromString(Bytes.fromNumber(addToV + signature.recoveryParam)), Bytes.pad(32, Bytes.fromNat("0x" + signature.r.toString(16))), Bytes.pad(32, Bytes.fromNat("0x" + signature.s.toString(16)))]);
    };

    const signerAddress = (hash, signature) => {
      const vals = decodeSignature(signature);
      const vrs = { v: Bytes.toNumber(vals[0]), r: vals[1].slice(2), s: vals[2].slice(2) };
      const ecPublicKey = secp256k1.recoverPubKey(Buffer.from(hash.slice(2), "hex"), vrs, vrs.v < 2 ? vrs.v : 1 - vrs.v % 2); // because odd vals mean v=0... sadly that means v=0 means v=1... I hate that
      const publicKey = "0x" + ecPublicKey.encode("hex", false).slice(2);
      const publicHash = keccak256(publicKey);
      const address = addressChecksum("0x" + publicHash.slice(-40));
      return address;
    };

    exports = {
      addressChecksum,
      addressFromKey,
      signMessage,
      signerAddress,
    };
    /* WEBPACK VAR INJECTION */}.call(this, lib_buffer().Buffer))

    return exports;
  });