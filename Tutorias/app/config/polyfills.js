import 'react-native-get-random-values';
import { decode as atobDecode, encode as btoaEncode } from 'base-64';

if (typeof global.self === 'undefined') {
  global.self = global;
}

if (!global.btoa) {
  global.btoa = btoaEncode;
}

if (!global.atob) {
  global.atob = atobDecode;
}

if (!global.Buffer) {
  global.Buffer = require('buffer').Buffer;
}
