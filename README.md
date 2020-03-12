Nano-Ethereum-Signer
====================

If your application needs to sign and verify messages from
Ethereum accounts, you need to include a library such as
`web3`, `ethereumjs` or `ethers.js`, which increase the size
of your builds by 300kb to 1mb+, which is wasteful if you
just want signing functionality. As such, I made this
library by aggressively, manually pruning dead code and
branches. The result is a 52K file with Ethereum signing and
verification functionality, which is the smallest I could
get so far. Further optimizations may include replacing `BN`
by native `BitInt` and more prunings.

Installing
----------

```
npm i nano-ethereum-signer
```

Functions
---------

```javascript
// Gets an Ethereum address from a Private Key
ethsig.addressFromKey(private_key : Hex) : Hex

// Signs the hash of a message
ethsig.signMessage(message : Hex, private_key : Hex) : Hex

// Given the hash of a message and signature,
// returns the signer address
ethsig.signerAddress(message : Hex, signature : Hex) : Hex

// Converts an address to the checksum format
ethsig.addressChecksum(address : Hex)

// Keccak256 of a string or array of bytes. If the string
// starts with `0x`, it is interpreted as data. Otherwise,
// it is interpreted as UTF-8. If you want to always use
// UTF-8, pass an extra `true` argument. 
ethsig.keccak(message : String | Array<Uint8>) : Hex
```

Here, `Hex` is a string on the format `"0x1234abcd..."`.
Private keys and hashes have 256 bits (64 hex digits).
Addresses have 160 bits (40 hex digits). Signatures have 520
bits (130 hex digits).

Disclaimer
----------

This is still a WIP: it needs test cases and a LICENSE, and there are still improvements to be made. If possible, we should compile a C implementation with WASM instead. If anyone is willing to start such a project I'd be glad to contribute.
