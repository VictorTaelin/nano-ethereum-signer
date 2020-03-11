const ethsig = require(".");

var message      = "Hello!";
var private_key  = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
var address      = ethsig.addressFromKey(private_key).address;
var message_hash = ethsig.keccak(message);
var signature    = ethsig.signMessage(message, private_key);
var signer       = ethsig.signerAddress(message, signature);

console.log("private_key  :", private_key);
console.log("address      :", address);
console.log("message      :", message);
console.log("message_hash :", message_hash);
console.log("signature    :", signature);
console.log("Verified?", signer === address);
