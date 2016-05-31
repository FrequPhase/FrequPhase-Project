
// modules are defined as an array
// [ module function, map of requireuires ]
//
// map of requireuires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the requireuire for previous bundles

(function outer (modules, cache, entry) {
    // Save the require from previous bundle to this closure if any
    var previousRequire = typeof require == "function" && require;

    function newRequire(name, jumped){
        if(!cache[name]) {
            if(!modules[name]) {
                // if we cannot find the module within our internal map or
                // cache jump to the current global require ie. the last bundle
                // that was added to the page.
                var currentRequire = typeof require == "function" && require;
                if (!jumped && currentRequire) return currentRequire(name, true);

                // If there are other bundles on this page the require from the
                // previous one is saved to 'previousRequire'. Repeat this as
                // many times as there are bundles until the module is found or
                // we exhaust the require chain.
                if (previousRequire) return previousRequire(name, true);
                var err = new Error('Cannot find module \'' + name + '\'');
                err.code = 'MODULE_NOT_FOUND';
                throw err;
            }
            var m = cache[name] = {exports:{}};
            modules[name][0].call(m.exports, function(x){
                var id = modules[name][1][x];
                return newRequire(id ? id : x);
            },m,m.exports,outer,modules,cache,entry);
        }
        return cache[name].exports;
    }
    for(var i=0;i<entry.length;i++) newRequire(entry[i]);

    // Override the current require with this new one
    return newRequire;
})
({1:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
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
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
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

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
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

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; i++) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = 0; byteOffset + i < arrLength; i++) {
    if (read(arr, byteOffset + i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return (byteOffset + foundIndex) * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }
  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

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
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; i++) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; i++) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":2,"ieee754":3,"isarray":4}],2:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
/**
 * Bit twiddling hacks for JavaScript.
 *
 * Author: Mikola Lysenko
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 */

"use strict"; "use restrict";

//Number of bits in an integer
var INT_BITS = 32;

//Constants
exports.INT_BITS  = INT_BITS;
exports.INT_MAX   =  0x7fffffff;
exports.INT_MIN   = -1<<(INT_BITS-1);

//Returns -1, 0, +1 depending on sign of x
exports.sign = function(v) {
  return (v > 0) - (v < 0);
}

//Computes absolute value of integer
exports.abs = function(v) {
  var mask = v >> (INT_BITS-1);
  return (v ^ mask) - mask;
}

//Computes minimum of integers x and y
exports.min = function(x, y) {
  return y ^ ((x ^ y) & -(x < y));
}

//Computes maximum of integers x and y
exports.max = function(x, y) {
  return x ^ ((x ^ y) & -(x < y));
}

//Checks if a number is a power of two
exports.isPow2 = function(v) {
  return !(v & (v-1)) && (!!v);
}

//Computes log base 2 of v
exports.log2 = function(v) {
  var r, shift;
  r =     (v > 0xFFFF) << 4; v >>>= r;
  shift = (v > 0xFF  ) << 3; v >>>= shift; r |= shift;
  shift = (v > 0xF   ) << 2; v >>>= shift; r |= shift;
  shift = (v > 0x3   ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

//Computes log base 10 of v
exports.log10 = function(v) {
  return  (v >= 1000000000) ? 9 : (v >= 100000000) ? 8 : (v >= 10000000) ? 7 :
          (v >= 1000000) ? 6 : (v >= 100000) ? 5 : (v >= 10000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

//Counts number of bits
exports.popCount = function(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

//Counts number of trailing zeros
function countTrailingZeros(v) {
  var c = 32;
  v &= -v;
  if (v) c--;
  if (v & 0x0000FFFF) c -= 16;
  if (v & 0x00FF00FF) c -= 8;
  if (v & 0x0F0F0F0F) c -= 4;
  if (v & 0x33333333) c -= 2;
  if (v & 0x55555555) c -= 1;
  return c;
}
exports.countTrailingZeros = countTrailingZeros;

//Rounds to next power of 2
exports.nextPow2 = function(v) {
  v += v === 0;
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

//Rounds down to previous power of 2
exports.prevPow2 = function(v) {
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v - (v>>>1);
}

//Computes parity of word
exports.parity = function(v) {
  v ^= v >>> 16;
  v ^= v >>> 8;
  v ^= v >>> 4;
  v &= 0xf;
  return (0x6996 >>> v) & 1;
}

var REVERSE_TABLE = new Array(256);

(function(tab) {
  for(var i=0; i<256; ++i) {
    var v = i, r = i, s = 7;
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    tab[i] = (r << s) & 0xff;
  }
})(REVERSE_TABLE);

//Reverse bits in a 32 bit word
exports.reverse = function(v) {
  return  (REVERSE_TABLE[ v         & 0xff] << 24) |
          (REVERSE_TABLE[(v >>> 8)  & 0xff] << 16) |
          (REVERSE_TABLE[(v >>> 16) & 0xff] << 8)  |
           REVERSE_TABLE[(v >>> 24) & 0xff];
}

//Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes
exports.interleave2 = function(x, y) {
  x &= 0xFFFF;
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;

  y &= 0xFFFF;
  y = (y | (y << 8)) & 0x00FF00FF;
  y = (y | (y << 4)) & 0x0F0F0F0F;
  y = (y | (y << 2)) & 0x33333333;
  y = (y | (y << 1)) & 0x55555555;

  return x | (y << 1);
}

//Extracts the nth interleaved component
exports.deinterleave2 = function(v, n) {
  v = (v >>> n) & 0x55555555;
  v = (v | (v >>> 1))  & 0x33333333;
  v = (v | (v >>> 2))  & 0x0F0F0F0F;
  v = (v | (v >>> 4))  & 0x00FF00FF;
  v = (v | (v >>> 16)) & 0x000FFFF;
  return (v << 16) >> 16;
}


//Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes
exports.interleave3 = function(x, y, z) {
  x &= 0x3FF;
  x  = (x | (x<<16)) & 4278190335;
  x  = (x | (x<<8))  & 251719695;
  x  = (x | (x<<4))  & 3272356035;
  x  = (x | (x<<2))  & 1227133513;

  y &= 0x3FF;
  y  = (y | (y<<16)) & 4278190335;
  y  = (y | (y<<8))  & 251719695;
  y  = (y | (y<<4))  & 3272356035;
  y  = (y | (y<<2))  & 1227133513;
  x |= (y << 1);
  
  z &= 0x3FF;
  z  = (z | (z<<16)) & 4278190335;
  z  = (z | (z<<8))  & 251719695;
  z  = (z | (z<<4))  & 3272356035;
  z  = (z | (z<<2))  & 1227133513;
  
  return x | (z << 2);
}

//Extracts nth interleaved component of a 3-tuple
exports.deinterleave3 = function(v, n) {
  v = (v >>> n)       & 1227133513;
  v = (v | (v>>>2))   & 3272356035;
  v = (v | (v>>>4))   & 251719695;
  v = (v | (v>>>8))   & 4278190335;
  v = (v | (v>>>16))  & 0x3FF;
  return (v<<22)>>22;
}

//Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page)
exports.nextCombination = function(v) {
  var t = v | (v - 1);
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1));
}


},{}],6:[function(require,module,exports){
"use strict"

var ops = require("ndarray-ops")
var cwise = require("cwise")
var ndarray = require("ndarray")
var fftm = require("./lib/fft-matrix.js")
var pool = require("typedarray-pool")

function ndfft(dir, x, y) {
  var shape = x.shape
    , d = shape.length
    , size = 1
    , stride = new Array(d)
    , pad = 0
    , i, j
  for(i=d-1; i>=0; --i) {
    stride[i] = size
    size *= shape[i]
    pad = Math.max(pad, fftm.scratchMemory(shape[i]))
    if(x.shape[i] !== y.shape[i]) {
      throw new Error("Shape mismatch, real and imaginary arrays must have same size")
    }
  }
  var buffer = pool.malloc(4 * size + pad, "double")
  var x1 = ndarray(buffer, shape.slice(0), stride, 0)
    , y1 = ndarray(buffer, shape.slice(0), stride.slice(0), size)
    , x2 = ndarray(buffer, shape.slice(0), stride.slice(0), 2*size)
    , y2 = ndarray(buffer, shape.slice(0), stride.slice(0), 3*size)
    , tmp, n, s1, s2
    , scratch_ptr = 4 * size
  
  //Copy into x1/y1
  ops.assign(x1, x)
  ops.assign(y1, y)
  
  for(i=d-1; i>=0; --i) {
    fftm(dir, size/shape[i], shape[i], buffer, x1.offset, y1.offset, scratch_ptr)
    if(i === 0) {
      break
    }
    
    //Compute new stride for x2/y2
    n = 1
    s1 = x2.stride
    s2 = y2.stride
    for(j=i-1; j<d; ++j) {
      s2[j] = s1[j] = n
      n *= shape[j]
    }
    for(j=i-2; j>=0; --j) {
      s2[j] = s1[j] = n
      n *= shape[j]
    }
    
    //Transpose
    ops.assign(x2, x1)
    ops.assign(y2, y1)
    
    //Swap buffers
    tmp = x1
    x1 = x2
    x2 = tmp
    tmp = y1
    y1 = y2
    y2 = tmp
  }
  
  //Copy result back into x
  ops.assign(x, x1)
  ops.assign(y, y1)
  
  pool.free(buffer)
}

module.exports = ndfft

},{"./lib/fft-matrix.js":7,"cwise":8,"ndarray":23,"ndarray-ops":16,"typedarray-pool":15}],7:[function(require,module,exports){
var bits = require("bit-twiddle")

function fft(dir, nrows, ncols, buffer, x_ptr, y_ptr, scratch_ptr) {
  dir |= 0
  nrows |= 0
  ncols |= 0
  x_ptr |= 0
  y_ptr |= 0
  if(bits.isPow2(ncols)) {
    fftRadix2(dir, nrows, ncols, buffer, x_ptr, y_ptr)
  } else {
    fftBluestein(dir, nrows, ncols, buffer, x_ptr, y_ptr, scratch_ptr)
  }
}
module.exports = fft

function scratchMemory(n) {
  if(bits.isPow2(n)) {
    return 0
  }
  return 2 * n + 4 * bits.nextPow2(2*n + 1)
}
module.exports.scratchMemory = scratchMemory


//Radix 2 FFT Adapted from Paul Bourke's C Implementation
function fftRadix2(dir, nrows, ncols, buffer, x_ptr, y_ptr) {
  dir |= 0
  nrows |= 0
  ncols |= 0
  x_ptr |= 0
  y_ptr |= 0
  var nn,i,i1,j,k,i2,l,l1,l2
  var c1,c2,t,t1,t2,u1,u2,z,row,a,b,c,d,k1,k2,k3
  
  // Calculate the number of points
  nn = ncols
  m = bits.log2(nn)
  
  for(row=0; row<nrows; ++row) {  
    // Do the bit reversal
    i2 = nn >> 1;
    j = 0;
    for(i=0;i<nn-1;i++) {
      if(i < j) {
        t = buffer[x_ptr+i]
        buffer[x_ptr+i] = buffer[x_ptr+j]
        buffer[x_ptr+j] = t
        t = buffer[y_ptr+i]
        buffer[y_ptr+i] = buffer[y_ptr+j]
        buffer[y_ptr+j] = t
      }
      k = i2
      while(k <= j) {
        j -= k
        k >>= 1
      }
      j += k
    }
    
    // Compute the FFT
    c1 = -1.0
    c2 = 0.0
    l2 = 1
    for(l=0;l<m;l++) {
      l1 = l2
      l2 <<= 1
      u1 = 1.0
      u2 = 0.0
      for(j=0;j<l1;j++) {
        for(i=j;i<nn;i+=l2) {
          i1 = i + l1
          a = buffer[x_ptr+i1]
          b = buffer[y_ptr+i1]
          c = buffer[x_ptr+i]
          d = buffer[y_ptr+i]
          k1 = u1 * (a + b)
          k2 = a * (u2 - u1)
          k3 = b * (u1 + u2)
          t1 = k1 - k3
          t2 = k1 + k2
          buffer[x_ptr+i1] = c - t1
          buffer[y_ptr+i1] = d - t2
          buffer[x_ptr+i] += t1
          buffer[y_ptr+i] += t2
        }
        k1 = c1 * (u1 + u2)
        k2 = u1 * (c2 - c1)
        k3 = u2 * (c1 + c2)
        u1 = k1 - k3
        u2 = k1 + k2
      }
      c2 = Math.sqrt((1.0 - c1) / 2.0)
      if(dir < 0) {
        c2 = -c2
      }
      c1 = Math.sqrt((1.0 + c1) / 2.0)
    }
    
    // Scaling for inverse transform
    if(dir < 0) {
      var scale_f = 1.0 / nn
      for(i=0;i<nn;i++) {
        buffer[x_ptr+i] *= scale_f
        buffer[y_ptr+i] *= scale_f
      }
    }
    
    // Advance pointers
    x_ptr += ncols
    y_ptr += ncols
  }
}

// Use Bluestein algorithm for npot FFTs
// Scratch memory required:  2 * ncols + 4 * bits.nextPow2(2*ncols + 1)
function fftBluestein(dir, nrows, ncols, buffer, x_ptr, y_ptr, scratch_ptr) {
  dir |= 0
  nrows |= 0
  ncols |= 0
  x_ptr |= 0
  y_ptr |= 0
  scratch_ptr |= 0

  // Initialize tables
  var m = bits.nextPow2(2 * ncols + 1)
    , cos_ptr = scratch_ptr
    , sin_ptr = cos_ptr + ncols
    , xs_ptr  = sin_ptr + ncols
    , ys_ptr  = xs_ptr  + m
    , cft_ptr = ys_ptr  + m
    , sft_ptr = cft_ptr + m
    , w = -dir * Math.PI / ncols
    , row, a, b, c, d, k1, k2, k3
    , i
  for(i=0; i<ncols; ++i) {
    a = w * ((i * i) % (ncols * 2))
    c = Math.cos(a)
    d = Math.sin(a)
    buffer[cft_ptr+(m-i)] = buffer[cft_ptr+i] = buffer[cos_ptr+i] = c
    buffer[sft_ptr+(m-i)] = buffer[sft_ptr+i] = buffer[sin_ptr+i] = d
  }
  for(i=ncols; i<=m-ncols; ++i) {
    buffer[cft_ptr+i] = 0.0
  }
  for(i=ncols; i<=m-ncols; ++i) {
    buffer[sft_ptr+i] = 0.0
  }

  fftRadix2(1, 1, m, buffer, cft_ptr, sft_ptr)
  
  //Compute scale factor
  if(dir < 0) {
    w = 1.0 / ncols
  } else {
    w = 1.0
  }
  
  //Handle direction
  for(row=0; row<nrows; ++row) {
  
    // Copy row into scratch memory, multiply weights
    for(i=0; i<ncols; ++i) {
      a = buffer[x_ptr+i]
      b = buffer[y_ptr+i]
      c = buffer[cos_ptr+i]
      d = -buffer[sin_ptr+i]
      k1 = c * (a + b)
      k2 = a * (d - c)
      k3 = b * (c + d)
      buffer[xs_ptr+i] = k1 - k3
      buffer[ys_ptr+i] = k1 + k2
    }
    //Zero out the rest
    for(i=ncols; i<m; ++i) {
      buffer[xs_ptr+i] = 0.0
    }
    for(i=ncols; i<m; ++i) {
      buffer[ys_ptr+i] = 0.0
    }
    
    // FFT buffer
    fftRadix2(1, 1, m, buffer, xs_ptr, ys_ptr)
    
    // Apply multiplier
    for(i=0; i<m; ++i) {
      a = buffer[xs_ptr+i]
      b = buffer[ys_ptr+i]
      c = buffer[cft_ptr+i]
      d = buffer[sft_ptr+i]
      k1 = c * (a + b)
      k2 = a * (d - c)
      k3 = b * (c + d)
      buffer[xs_ptr+i] = k1 - k3
      buffer[ys_ptr+i] = k1 + k2
    }
    
    // Inverse FFT buffer
    fftRadix2(-1, 1, m, buffer, xs_ptr, ys_ptr)
    
    // Copy result back into x/y
    for(i=0; i<ncols; ++i) {
      a = buffer[xs_ptr+i]
      b = buffer[ys_ptr+i]
      c = buffer[cos_ptr+i]
      d = -buffer[sin_ptr+i]
      k1 = c * (a + b)
      k2 = a * (d - c)
      k3 = b * (c + d)
      buffer[x_ptr+i] = w * (k1 - k3)
      buffer[y_ptr+i] = w * (k1 + k2)
    }
    
    x_ptr += ncols
    y_ptr += ncols
  }
}

},{"bit-twiddle":5}],8:[function(require,module,exports){
"use strict"

var Parser = require("./lib/parser.js")
  , createShim = require("./lib/shim.js")

var REQUIRED_FIELDS = [ "args", "body" ]
var OPTIONAL_FIELDS = [ "pre", "post", "printCode" ]

function CompiledProcedure() {
  this.numArgs = 0
  this.numArrayArgs = 0
  this.numScalarArgs = 0
  this.hasIndex = false
  this.hasShape = false
  this.hasReturn = false
  this.pre = ""
  this.body = ""
  this.post = ""
  this.unroll = 1
  this.printCode = false
}

function compile(user_args) {
  for(var id in user_args) {
    if(REQUIRED_FIELDS.indexOf(id) < 0 &&
       OPTIONAL_FIELDS.indexOf(id) < 0) {
      throw new Error("Unknown argument '"+id+"' passed to expression compiler")
    }
  }
  for(var i=0; i<REQUIRED_FIELDS.length; ++i) {
    if(!user_args[REQUIRED_FIELDS[i]]) {
      throw new Error("Missing argument: " + REQUIRED_FIELDS[i])
    }
  }
  //Parse arguments
  var proc = new CompiledProcedure()
  var proc_args = user_args.args.slice(0)
  var shim_args = []
  for(var i=0; i<proc_args.length; ++i) {
    switch(proc_args[i]) {
      case "array":
        shim_args.push("array" + proc.numArrayArgs)
        proc_args[i] += (proc.numArrayArgs++)
      break
      case "scalar":
        shim_args.push("scalar" + proc.numScalarArgs)
        proc_args[i] += (proc.numScalarArgs++)
      break
      case "index":
        proc.hasIndex = true
      break
      case "shape":
        proc.hasShape = true
      break
      default:
        throw new Error("Unknown argument types")
    }
  }
  if(proc.numArrayArgs <= 0) {
    throw new Error("No array arguments specified")
  }
  
  //Parse blocks
  var parser = new Parser(proc_args)
    , pre = user_args.pre || null
    , body = user_args.body
    , post = user_args.post || null
  parser.preprocess(pre)
  parser.preprocess(body)
  parser.preprocess(post)
  proc.pre  = parser.preBlock() + "\n" + parser.process(pre)
  proc.body = parser.process(body)
  proc.post = parser.process(post) + "\n" + parser.postBlock()
  proc.hasReturn = parser.hasReturn
  
  //Parse options
  proc.printCode = user_args.printCode || false
  
  //Assemble shim
  return createShim(shim_args, proc)
}

module.exports = compile

},{"./lib/parser.js":10,"./lib/shim.js":11}],9:[function(require,module,exports){
"use strict"

var RECURSION_LIMIT = 32

function innerFill(order, procedure) {
  var dimension = order.length
    , nargs = procedure.numArrayArgs
    , has_index = procedure.hasIndex
    , code = []
    , idx=0, pidx=0, i, j
  for(i=0; i<dimension; ++i) {
    code.push("var i"+i+"=0;")
  }
  //Compute scan deltas
  for(j=0; j<nargs; ++j) {
    for(i=0; i<dimension; ++i) {
      pidx = idx
      idx = order[i]
      if(i === 0) {
        code.push("var d"+j+"s"+i+"=stride"+j+"["+idx+"]|0;")
      } else {
        code.push("var d"+j+"s"+i+"=(stride"+j+"["+idx+"]-shape["+pidx+"]*stride"+j+"["+pidx+"])|0;")
      }
    }
  }
  //Outer scan loop
  for(i=dimension-1; i>=0; --i) {
    idx = order[i]
    code.push("for(i"+i+"=shape["+idx+"]|0;--i"+i+">=0;){")
  }
  //Push body of inner loop
  code.push(procedure.body)
  //Advance scan pointers
  for(i=0; i<dimension; ++i) {
    pidx = idx
    idx = order[i]
    for(j=0; j<nargs; ++j) {
      code.push("ptr"+j+"+=d"+j+"s"+i)
    }
    if(has_index) {
      if(i > 0) {
        code.push("index["+pidx+"]-=shape["+pidx+"]")
      }
      code.push("++index["+idx+"]")
    }
    code.push("}")
  }
  return code.join("\n")
}

function outerFill(matched, order, procedure) {
  var dimension = order.length
    , nargs = procedure.numArrayArgs
    , has_index = procedure.hasIndex
    , code = []
    , static_args = dimension
    , index_start = nargs + static_args
    , frame_size = index_start + (has_index ? dimension : 0)
    , i
  
  //Initiaize variables
  code.push("var i=0,l=0,v=0,d=0,sp=0")
  
  //Begin recursion
  code.push("while(true){")
    
    //Walk over runs to get bounds
    code.push("l="+RECURSION_LIMIT)
    code.push("v="+RECURSION_LIMIT)
    code.push("d="+matched)
  
    for(i=matched; i<dimension; ++i) {
      code.push("if(shape["+i+"]>l){")
        code.push("v=l|0")
        code.push("l=shape["+i+"]|0")
        code.push("d="+i+"|0")
      code.push("}else if(shape["+i+"]>v){")
        code.push("v=shape["+i+"]|0")
      code.push("}")
    }
  
    code.push("if(l<="+RECURSION_LIMIT+"){")
      code.push(innerFill(order, procedure))
    code.push("} else {")
  
      //Round v to previous power of 2
      code.push("v=(v>>>1)-1")
      code.push("for(i=1;i<=16;i<<=1){v|=v>>>i}")
      code.push("++v")
      code.push("if(v<"+RECURSION_LIMIT+") v="+RECURSION_LIMIT)
  
      //Set shape
      code.push("i=shape[d]")
      code.push("shape[d]=v")
  
      //Fill across row
      code.push("for(;i>=v;i-=v){")
        for(i=0; i<dimension; ++i) {
          code.push("STACK[sp+"+i+"]=shape["+i+"]")
        }
        for(i=0; i<nargs; ++i) {
          code.push("STACK[sp+"+(i+static_args)+"]=ptr"+i+"|0")
        }
        if(has_index) {
          for(i=0; i<dimension; ++i) {
            code.push("STACK[sp+"+(i+index_start)+"]=index["+i+"]")
          }
          code.push("index[d]+=v")
        }
        for(i=0; i<nargs; ++i) {
          code.push("ptr"+i+"+=(v*stride"+i+"[d])|0")
        }
        code.push("sp+="+frame_size)
      code.push("}")
  
      //Handle edge case
      code.push("if(i>0){")
        code.push("shape[d]=i")
        for(i=0; i<dimension; ++i) {
          code.push("STACK[sp+"+i+"]=shape["+i+"]")
        }
        for(i=0; i<nargs; ++i) {
          code.push("STACK[sp+"+(i+static_args)+"]=ptr"+i+"|0")
        }
        if(has_index) {
          for(i=0; i<dimension; ++i) {
            code.push("STACK[sp+"+(i+index_start)+"]=index["+i+"]")
          }
        }
        code.push("sp+="+frame_size)
      code.push("}")
    code.push("}")
  
    //Pop previous state
    code.push("if(sp<=0){")
      code.push("break")
    code.push("}")
    code.push("sp-="+frame_size)
    for(i=0; i<dimension; ++i) {
      code.push("shape["+i+"]=STACK[sp+"+i+"]")
    }
    for(i=0; i<nargs; ++i) {
      code.push("ptr"+i+"=STACK[sp+"+(i+static_args)+"]")
    }
    if(has_index) {
      for(i=0; i<dimension; ++i) {
        code.push("index["+i+"]=STACK[sp+"+(i+index_start)+"]")
      }
    }
 code.push("}")
 return code.join("\n")
}

function majorOrder(orders) {
  return orders[0]
}

function generate(orders, procedure) {
  var order = majorOrder(orders)
    , dimension = orders[0].length
    , nargs = procedure.numArrayArgs
    , code = ['"use strict"']
    , matched, i, j
    , arglist = [ "STACK", "shape" ]
  //Create procedure arguments
  for(i = 0; i<nargs; ++i) {
    arglist.push("arr" + i)
    arglist.push("ptr" + i)
    arglist.push("stride" + i)
    code.push("ptr"+i+"|=0")
    for(j = 0; j<dimension; ++j) {
      code.push("stride"+i+"["+j+"]|=0")
    }
  }
  for(i = 0; i<dimension; ++i) {
    code.push("shape["+i+"]|=0")
  }
  for(i = 0; i<procedure.numScalarArgs; ++i) {
    arglist.push("scalar"+i)
  }
  if(procedure.hasIndex) {
    code.push("var index=[")
    for(i=0; i<dimension; ++i) {
      code.push((i > 0) ? ",0":"0")
    }
    code.push("]")
  }
  if(procedure.hasShape) {
    code.push("var inline_shape=shape.slice(0)")
  }
  //Compute number of matching orders
  matched = 0;
matched_loop:
  while(matched < dimension) {
    for(j=1; j<nargs; ++j) {
      if(orders[j][matched] !== orders[0][matched]) {
        break matched_loop;
      }
    }
    ++matched;
  }
  //Generate code
  code.push(procedure.pre)
  if(matched === dimension) {
    code.push(innerFill(order, procedure))
  } else {
    code.push(outerFill(matched, order, procedure))
  }
  code.push(procedure.post)
  arglist.push(code.join("\n"))
  //Return result
  var result = Function.apply(null, arglist)
  if(procedure.printCode) {
    console.log("For order:", orders, "Generated code: \n", result+"")
  }
  return result
}

module.exports = generate
},{}],10:[function(require,module,exports){
"use strict"

var falafel = require("falafel")

function isGlobal(identifier) {
  if(typeof(window) !== "undefined") {
    return identifier in window
  } else if(typeof(GLOBAL) !== "undefined") {
    return identifier in GLOBAL
  } else {
    return false
  }
}

function getArgs(src) {
  var args = []
  falafel(src, function(node) {
    var i
    if(node.type === "FunctionExpression" &&
       node.parent.parent.parent.type === "Program") {
      args = new Array(node.params.length)
      for(i=0; i<node.params.length; ++i) {
        args[i] = node.params[i].name
      }
    }
  })
  return args
}

function Parser(args) {
  this.args = args
  this.this_vars = []
  this.computed_this = false
  this.prefix_count = 0
  this.hasReturn = false
}

//Preprocessing pass is needed to explode the "this" object
Parser.prototype.preprocess = function(func) {
  if(!func || this.computed_this) {
    return
  }
  var src = "(" + func + ")()"
    , this_vars = this.this_vars
    , computed_this = this.computed_this
  falafel(src, function(node) {
    var n
    if(node.type === "ThisExpression") {
      if(node.parent.type === "MemberExpression" && !node.parent.computed) {
        n = node.parent.property.name
        if(this_vars.indexOf(n) < 0) {
          this_vars.push(n)
        }
      } else {
        computed_this = true
      }
    }
  })
  if(computed_this) {
    this.this_vars = []
  }
  this.computed_this = computed_this
}

Parser.prototype.process = function(func) {
  if(!func) {
    return ""
  }
  var label = this.prefix_count++
    , src = "(" + func + ")()"
    , block_args = getArgs(src)
    , proc_args = this.args
    , result = ""
    , inline_prefix = "inline" + label + "_"
    , hasReturn = this.hasReturn
  falafel(src, function(node) {
    var n, i, j
    if(node.type === "FunctionExpression" &&
       node.parent.parent.parent.type === "Program") {
      result = node.body.source()
    } else if(node.type === "Identifier") {
      if(node.parent.type === "MemberExpression") {
        if((node.parent.property === node && !node.parent.computed) ||
           node.parent.object.type === "ThisExpression") {
          return
        }
      }
      n = node.name
      i = block_args.indexOf(n)
      if(i >= 0) {
        if(i < proc_args.length) {
          if(proc_args[i].indexOf("array") === 0) {
            j = parseInt(proc_args[i].substr(5))
            node.update("arr"+j+"[ptr"+j+"]")
          } else if(proc_args[i] === "shape") {
            node.update("inline_shape")
          } else {
            node.update(proc_args[i])
          }
        } else {
          node.update(inline_prefix + node.source())
        }
      } else if(isGlobal(n)) {
        return
      } else {
        node.update(inline_prefix + node.source())
      }
    } else if(node.type === "MemberExpression") {
      if(node.object.type === "ThisExpression") {
        node.update("this_" + node.property.source().trimLeft())
      }
    } else if(node.type === "ThisExpression") {
      if(node.parent.type !== "MemberExpression") {
        node.update("this_")
      }
    } else if(node.type === "ReturnStatement") {
      hasReturn = true
    }
  })
  this.hasReturn = hasReturn
  var prefix = ""
  for(var i=this.args.length; i<block_args.length; ++i) {
    prefix += "var " + block_args[i] + "\n"
  }
  return prefix + result
}

Parser.prototype.preBlock = function() {
  if(this.computed_this) {
    return "var this_={}"
  } else if(this.this_vars.length > 0) {
    return "var this_" + this.this_vars.join(",this_")
  } else {
    return ""
  }
}

Parser.prototype.postBlock = function() {
  return ""
}

module.exports = Parser
},{"falafel":12}],11:[function(require,module,exports){
"use strict"

var generate = require("./generate.js")

//Reuse stack across all shims
var STACK = new Int32Array(1024)

function Shim(procedure) {
  this.memoized = {}
  this.procedure = procedure
}

Shim.prototype.checkShape = function(a, b) {
  if(a.length !== b.length) {
    throw new Error("Shape mismatch")
  }
  for(var i=a.length-1; i>=0; --i) {
    if(a[i] !== b[i]) {
      throw new Error("Shape mismatch")
    }
  }
}

Shim.prototype.getStack = function(size) {
  if(size < STACK.length) {
    return STACK
  }
  STACK = new Int32Array(size)
  return STACK
}

function compare1st(a,b) { return a[0] - b[0]; }

Shim.prototype.getOrder = function(stride) {
  var zipped = new Array(stride.length)
  for(var i=0; i<stride.length; ++i) {
    zipped[i] = [Math.abs(stride[i]), i]
  }
  zipped.sort(compare1st)
  var unzipped = new Array(stride.length)
  for(var i=0; i<stride.length; ++i) {
    unzipped[i] = zipped[i][1]
  }
  return unzipped
}

Shim.prototype.getProc = function(orders) {
  var proc_name = orders.join("|")
    , proc = this.memoized[proc_name]
  if(!proc) {
    proc = generate(orders, this.procedure)
    this.memoized[proc_name] = proc
  }
  return proc
}

function createShim(shim_args, procedure) {
  var code = ["\"use strict\""], i
  //Check shapes
  for(i=1; i<procedure.numArrayArgs; ++i) {
    code.push("this.checkShape(array0.shape,array"+i+".shape)")
  }
  //Load/lazily generate procedure based on array ordering
  code.push("var proc = this.getProc([")
  for(i=0; i<procedure.numArrayArgs; ++i) {
    code.push((i>0 ? "," : "") + "this.getOrder(array"+i+".stride)")
  }
  code.push("])")
  //Call procedure
  if(procedure.hasReturn) {
    code.push("return proc(")
  } else {
    code.push("proc(")
  }
  code.push("this.getStack(" + procedure.numArrayArgs + "*(array0.shape.length*32)), array0.shape.slice(0)")
  //Bind array arguments
  for(i=0; i<procedure.numArrayArgs; ++i) {
    code.push(",array" + i + ".data")
    code.push(",array" + i + ".offset")
    code.push(",array" + i + ".stride")
  }
  //Bind scalar arguments
  for(var i=0; i<procedure.numScalarArgs; ++i) {
    code.push(",scalar"+i)
  }
  code.push(")")
  if(!procedure.hasReturn) {
    code.push("return array0")
  }
  //Create the shim
  shim_args.push(code.join("\n"))
  var result = Function.apply(null, shim_args)
  if(procedure.printCode) {
    console.log("Generated shim:", result + "")
  }
  return result.bind(new Shim(procedure))
}

module.exports = createShim


},{"./generate.js":9}],12:[function(require,module,exports){
var parse = require('esprima').parse;
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};
var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn);
    for (var i = 0; i < xs.length; i++) {
        fn.call(xs, xs[i], i, xs);
    }
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

module.exports = function (src, opts, fn) {
    if (typeof opts === 'function') {
        fn = opts;
        opts = {};
    }
    if (typeof src === 'object') {
        opts = src;
        src = opts.source;
        delete opts.source;
    }
    src = src === undefined ? opts.source : src;
    opts.range = true;
    if (typeof src !== 'string') src = String(src);
    
    var ast = parse(src, opts);
    
    var result = {
        chunks : src.split(''),
        toString : function () { return result.chunks.join('') },
        inspect : function () { return result.toString() }
    };
    var index = 0;
    
    (function walk (node, parent) {
        insertHelpers(node, parent, result.chunks);
        
        forEach(objectKeys(node), function (key) {
            if (key === 'parent') return;
            
            var child = node[key];
            if (isArray(child)) {
                forEach(child, function (c) {
                    if (c && typeof c.type === 'string') {
                        walk(c, node);
                    }
                });
            }
            else if (child && typeof child.type === 'string') {
                insertHelpers(child, node, result.chunks);
                walk(child, node);
            }
        });
        fn(node);
    })(ast, undefined);
    
    return result;
};
 
function insertHelpers (node, parent, chunks) {
    if (!node.range) return;
    
    node.parent = parent;
    
    node.source = function () {
        return chunks.slice(
            node.range[0], node.range[1]
        ).join('');
    };
    
    if (node.update && typeof node.update === 'object') {
        var prev = node.update;
        forEach(objectKeys(prev), function (key) {
            update[key] = prev[key];
        });
        node.update = update;
    }
    else {
        node.update = update;
    }
    
    function update (s) {
        chunks[node.range[0]] = s;
        for (var i = node.range[0] + 1; i < node.range[1]; i++) {
            chunks[i] = '';
        }
    };
}

},{"esprima":13}],13:[function(require,module,exports){
/*
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwError: true, createLiteral: true, generateStatement: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        buffer,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function sliceSource(from, to) {
        return source.slice(from, to);
    }

    if (typeof 'esprima'[0] === 'undefined') {
        sliceSource = function sliceArraySource(from, to) {
            return source.slice(from, to).join('');
        };
    }

    function isDecimalDigit(ch) {
        return '0123456789'.indexOf(ch) >= 0;
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === ' ') || (ch === '\u0009') || (ch === '\u000B') ||
            (ch === '\u000C') || (ch === '\u00A0') ||
            (ch.charCodeAt(0) >= 0x1680 &&
             '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(ch) >= 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029');
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === '$') || (ch === '_') || (ch === '\\') ||
            (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
            ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierStart.test(ch));
    }

    function isIdentifierPart(ch) {
        return (ch === '$') || (ch === '_') || (ch === '\\') ||
            (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
            ((ch >= '0') && (ch <= '9')) ||
            ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierPart.test(ch));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {

        // Future reserved words.
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        }

        return false;
    }

    function isStrictModeReservedWord(id) {
        switch (id) {

        // Strict Mode reserved words.
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        }

        return false;
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        var keyword = false;
        switch (id.length) {
        case 2:
            keyword = (id === 'if') || (id === 'in') || (id === 'do');
            break;
        case 3:
            keyword = (id === 'var') || (id === 'for') || (id === 'new') || (id === 'try');
            break;
        case 4:
            keyword = (id === 'this') || (id === 'else') || (id === 'case') || (id === 'void') || (id === 'with');
            break;
        case 5:
            keyword = (id === 'while') || (id === 'break') || (id === 'catch') || (id === 'throw');
            break;
        case 6:
            keyword = (id === 'return') || (id === 'typeof') || (id === 'delete') || (id === 'switch');
            break;
        case 7:
            keyword = (id === 'default') || (id === 'finally');
            break;
        case 8:
            keyword = (id === 'function') || (id === 'continue') || (id === 'debugger');
            break;
        case 10:
            keyword = (id === 'instanceof');
            break;
        }

        if (keyword) {
            return true;
        }

        switch (id) {
        // Future reserved words.
        // 'const' is specialized as Keyword in V8.
        case 'const':
            return true;

        // For compatiblity to SpiderMonkey and ES.next
        case 'yield':
        case 'let':
            return true;
        }

        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        return isFutureReservedWord(id);
    }

    // 7.4 Comments

    function skipComment() {
        var ch, blockComment, lineComment;

        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch)) {
                    lineComment = false;
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === '\r' && source[index + 1] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            ++index;
                            blockComment = false;
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    index += 2;
                    lineComment = true;
                } else if (ch === '*') {
                    index += 2;
                    blockComment = true;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function scanIdentifier() {
        var ch, start, id, restore;

        ch = source[index];
        if (!isIdentifierStart(ch)) {
            return;
        }

        start = index;
        if (ch === '\\') {
            ++index;
            if (source[index] !== 'u') {
                return;
            }
            ++index;
            restore = index;
            ch = scanHexEscape('u');
            if (ch) {
                if (ch === '\\' || !isIdentifierStart(ch)) {
                    return;
                }
                id = ch;
            } else {
                index = restore;
                id = 'u';
            }
        } else {
            id = source[index++];
        }

        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch)) {
                break;
            }
            if (ch === '\\') {
                ++index;
                if (source[index] !== 'u') {
                    return;
                }
                ++index;
                restore = index;
                ch = scanHexEscape('u');
                if (ch) {
                    if (ch === '\\' || !isIdentifierPart(ch)) {
                        return;
                    }
                    id += ch;
                } else {
                    index = restore;
                    id += 'u';
                }
            } else {
                id += source[index++];
            }
        }

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            return {
                type: Token.Identifier,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (isKeyword(id)) {
            return {
                type: Token.Keyword,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.8.1 Null Literals

        if (id === 'null') {
            return {
                type: Token.NullLiteral,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.8.2 Boolean Literals

        if (id === 'true' || id === 'false') {
            return {
                type: Token.BooleanLiteral,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        return {
            type: Token.Identifier,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        // Check for most common single-character punctuators.

        if (ch1 === ';' || ch1 === '{' || ch1 === '}') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === ',' || ch1 === '(' || ch1 === ')') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Dot (.) can also start a floating-point number, hence the need
        // to check the next character.

        ch2 = source[index + 1];
        if (ch1 === '.' && !isDecimalDigit(ch2)) {
            return {
                type: Token.Punctuator,
                value: source[index++],
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Peek more characters.

        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '=' && ch2 === '=' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '===',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '!' && ch2 === '=' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '!==',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 2-character punctuators: <= >= == != ++ -- << >> && ||
        // += -= *= %= &= |= ^= /=

        if (ch2 === '=') {
            if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
                index += 2;
                return {
                    type: Token.Punctuator,
                    value: ch1 + ch2,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            if ('+-<>&|'.indexOf(ch2) >= 0) {
                index += 2;
                return {
                    type: Token.Punctuator,
                    value: ch1 + ch2,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // The remaining 1-character punctuators.

        if ('[]<>+-*%&|^!~?:=/'.indexOf(ch1) >= 0) {
            return {
                type: Token.Punctuator,
                value: source[index++],
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
    }

    // 7.8.3 Numeric Literals

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    number += source[index++];
                    while (index < length) {
                        ch = source[index];
                        if (!isHexDigit(ch)) {
                            break;
                        }
                        number += source[index++];
                    }

                    if (number.length <= 2) {
                        // only 0x
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }

                    if (index < length) {
                        ch = source[index];
                        if (isIdentifierStart(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 16),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                } else if (isOctalDigit(ch)) {
                    number += source[index++];
                    while (index < length) {
                        ch = source[index];
                        if (!isOctalDigit(ch)) {
                            break;
                        }
                        number += source[index++];
                    }

                    if (index < length) {
                        ch = source[index];
                        if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 8),
                        octal: true,
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (isDecimalDigit(ch)) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (index < length) {
                ch = source[index];
                if (!isDecimalDigit(ch)) {
                    break;
                }
                number += source[index++];
            }
        }

        if (ch === '.') {
            number += source[index++];
            while (index < length) {
                ch = source[index];
                if (!isDecimalDigit(ch)) {
                    break;
                }
                number += source[index++];
            }
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }

            ch = source[index];
            if (isDecimalDigit(ch)) {
                number += source[index++];
                while (index < length) {
                    ch = source[index];
                    if (!isDecimalDigit(ch)) {
                        break;
                    }
                    number += source[index++];
                }
            } else {
                ch = 'character ' + ch;
                if (index >= length) {
                    ch = '<end>';
                }
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (index < length) {
            ch = source[index];
            if (isIdentifierStart(ch)) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!isLineTerminator(ch)) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                }
            } else if (isLineTerminator(ch)) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false;

        buffer = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (ch === '\\') {
                ch = source[index++];
                // ECMA-262 7.8.5
                if (isLineTerminator(ch)) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
                str += ch;
            } else if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                } else if (isLineTerminator(ch)) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch)) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        str += '\\u';
                        for (; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }

        return {
            literal: str,
            value: value,
            range: [start, index]
        };
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advance() {
        var ch, token;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        token = scanPunctuator();
        if (typeof token !== 'undefined') {
            return token;
        }

        ch = source[index];

        if (ch === '\'' || ch === '"') {
            return scanStringLiteral();
        }

        if (ch === '.' || isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        token = scanIdentifier();
        if (typeof token !== 'undefined') {
            return token;
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function lex() {
        var token;

        if (buffer) {
            index = buffer.range[1];
            lineNumber = buffer.lineNumber;
            lineStart = buffer.lineStart;
            token = buffer;
            buffer = null;
            return token;
        }

        buffer = null;
        return advance();
    }

    function lookahead() {
        var pos, line, start;

        if (buffer !== null) {
            return buffer;
        }

        pos = index;
        line = lineNumber;
        start = lineStart;
        buffer = advance();
        index = pos;
        lineNumber = line;
        lineStart = start;

        return buffer;
    }

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    return args[index] || '';
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        var token = lookahead();
        return token.type === Token.Punctuator && token.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        var token = lookahead();
        return token.type === Token.Keyword && token.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var token = lookahead(),
            op = token.value;

        if (token.type !== Token.Punctuator) {
            return false;
        }
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var token, line;

        // Catch the very common case first.
        if (source[index] === ';') {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        token = lookahead();
        if (token.type !== Token.EOF && !match('}')) {
            throwUnexpected(token);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [];

        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        expect(']');

        return {
            type: Syntax.ArrayExpression,
            elements: elements
        };
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body;

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionExpression,
            id: null,
            params: param,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    function parseObjectPropertyKey() {
        var token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return createLiteral(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseObjectProperty() {
        var token, key, id, param;

        token = lookahead();

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                return {
                    type: Syntax.Property,
                    key: key,
                    value: parsePropertyFunction([]),
                    kind: 'get'
                };
            } else if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead();
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction([]),
                        kind: 'set'
                    };
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction(param, token),
                        kind: 'set'
                    };
                }
            } else {
                expect(':');
                return {
                    type: Syntax.Property,
                    key: id,
                    value: parseAssignmentExpression(),
                    kind: 'init'
                };
            }
        } else if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            return {
                type: Syntax.Property,
                key: key,
                value: parseAssignmentExpression(),
                kind: 'init'
            };
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, kind, map = {}, toString = String;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;
            if (Object.prototype.hasOwnProperty.call(map, name)) {
                if (map[name] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[name] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[name] |= kind;
            } else {
                map[name] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return {
            type: Syntax.ObjectExpression,
            properties: properties
        };
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var token = lookahead(),
            type = token.type;

        if (type === Token.Identifier) {
            return {
                type: Syntax.Identifier,
                name: lex().value
            };
        }

        if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return createLiteral(lex());
        }

        if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                lex();
                return {
                    type: Syntax.ThisExpression
                };
            }

            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }
        }

        if (type === Token.BooleanLiteral) {
            lex();
            token.value = (token.value === 'true');
            return createLiteral(token);
        }

        if (type === Token.NullLiteral) {
            lex();
            token.value = null;
            return createLiteral(token);
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('/') || match('/=')) {
            return createLiteral(scanRegExp());
        }

        return throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var expr;

        expectKeyword('new');

        expr = {
            type: Syntax.NewExpression,
            callee: parseLeftHandSideExpression(),
            'arguments': []
        };

        if (match('(')) {
            expr['arguments'] = parseArguments();
        }

        return expr;
    }

    function parseLeftHandSideExpressionAllowCall() {
        var expr;

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                expr = {
                    type: Syntax.CallExpression,
                    callee: expr,
                    'arguments': parseArguments()
                };
            } else if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
            }
        }

        return expr;
    }


    function parseLeftHandSideExpression() {
        var expr;

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr = parseLeftHandSideExpressionAllowCall(), token;

        token = lookahead();
        if (token.type !== Token.Punctuator) {
            return expr;
        }

        if ((match('++') || match('--')) && !peekLineTerminator()) {
            // 11.3.1, 11.3.2
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPostfix);
            }
            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            expr = {
                type: Syntax.UpdateExpression,
                operator: lex().value,
                argument: expr,
                prefix: false
            };
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr;

        token = lookahead();
        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return parsePostfixExpression();
        }

        if (match('++') || match('--')) {
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            expr = {
                type: Syntax.UpdateExpression,
                operator: token.value,
                argument: expr,
                prefix: true
            };
            return expr;
        }

        if (match('+') || match('-') || match('~') || match('!')) {
            expr = {
                type: Syntax.UnaryExpression,
                operator: lex().value,
                argument: parseUnaryExpression(),
                prefix: true
            };
            return expr;
        }

        if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            expr = {
                type: Syntax.UnaryExpression,
                operator: lex().value,
                argument: parseUnaryExpression(),
                prefix: true
            };
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
            return expr;
        }

        return parsePostfixExpression();
    }

    // 11.5 Multiplicative Operators

    function parseMultiplicativeExpression() {
        var expr = parseUnaryExpression();

        while (match('*') || match('/') || match('%')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseUnaryExpression()
            };
        }

        return expr;
    }

    // 11.6 Additive Operators

    function parseAdditiveExpression() {
        var expr = parseMultiplicativeExpression();

        while (match('+') || match('-')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseMultiplicativeExpression()
            };
        }

        return expr;
    }

    // 11.7 Bitwise Shift Operators

    function parseShiftExpression() {
        var expr = parseAdditiveExpression();

        while (match('<<') || match('>>') || match('>>>')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseAdditiveExpression()
            };
        }

        return expr;
    }
    // 11.8 Relational Operators

    function parseRelationalExpression() {
        var expr, previousAllowIn;

        previousAllowIn = state.allowIn;
        state.allowIn = true;

        expr = parseShiftExpression();

        while (match('<') || match('>') || match('<=') || match('>=') || (previousAllowIn && matchKeyword('in')) || matchKeyword('instanceof')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseShiftExpression()
            };
        }

        state.allowIn = previousAllowIn;
        return expr;
    }

    // 11.9 Equality Operators

    function parseEqualityExpression() {
        var expr = parseRelationalExpression();

        while (match('==') || match('!=') || match('===') || match('!==')) {
            expr = {
                type: Syntax.BinaryExpression,
                operator: lex().value,
                left: expr,
                right: parseRelationalExpression()
            };
        }

        return expr;
    }

    // 11.10 Binary Bitwise Operators

    function parseBitwiseANDExpression() {
        var expr = parseEqualityExpression();

        while (match('&')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '&',
                left: expr,
                right: parseEqualityExpression()
            };
        }

        return expr;
    }

    function parseBitwiseXORExpression() {
        var expr = parseBitwiseANDExpression();

        while (match('^')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '^',
                left: expr,
                right: parseBitwiseANDExpression()
            };
        }

        return expr;
    }

    function parseBitwiseORExpression() {
        var expr = parseBitwiseXORExpression();

        while (match('|')) {
            lex();
            expr = {
                type: Syntax.BinaryExpression,
                operator: '|',
                left: expr,
                right: parseBitwiseXORExpression()
            };
        }

        return expr;
    }

    // 11.11 Binary Logical Operators

    function parseLogicalANDExpression() {
        var expr = parseBitwiseORExpression();

        while (match('&&')) {
            lex();
            expr = {
                type: Syntax.LogicalExpression,
                operator: '&&',
                left: expr,
                right: parseBitwiseORExpression()
            };
        }

        return expr;
    }

    function parseLogicalORExpression() {
        var expr = parseLogicalANDExpression();

        while (match('||')) {
            lex();
            expr = {
                type: Syntax.LogicalExpression,
                operator: '||',
                left: expr,
                right: parseLogicalANDExpression()
            };
        }

        return expr;
    }

    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent;

        expr = parseLogicalORExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');

            expr = {
                type: Syntax.ConditionalExpression,
                test: expr,
                consequent: consequent,
                alternate: parseAssignmentExpression()
            };
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, expr;

        token = lookahead();
        expr = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            expr = {
                type: Syntax.AssignmentExpression,
                operator: lex().value,
                left: expr,
                right: parseAssignmentExpression()
            };
        }

        return expr;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr = parseAssignmentExpression();

        if (match(',')) {
            expr = {
                type: Syntax.SequenceExpression,
                expressions: [ expr ]
            };

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }

        }
        return expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block;

        expect('{');

        block = parseStatementList();

        expect('}');

        return {
            type: Syntax.BlockStatement,
            body: block
        };
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return {
            type: Syntax.Identifier,
            name: token.value
        };
    }

    function parseVariableDeclaration(kind) {
        var id = parseVariableIdentifier(),
            init = null;

        // 12.2.1
        if (strict && isRestrictedWord(id.name)) {
            throwErrorTolerant({}, Messages.StrictVarName);
        }

        if (kind === 'const') {
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return {
            type: Syntax.VariableDeclarator,
            id: id,
            init: init
        };
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations;

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return {
            type: Syntax.VariableDeclaration,
            declarations: declarations,
            kind: 'var'
        };
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations;

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return {
            type: Syntax.VariableDeclaration,
            declarations: declarations,
            kind: kind
        };
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        expect(';');

        return {
            type: Syntax.EmptyStatement
        };
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();

        consumeSemicolon();

        return {
            type: Syntax.ExpressionStatement,
            expression: expr
        };
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate;

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return {
            type: Syntax.IfStatement,
            test: test,
            consequent: consequent,
            alternate: alternate
        };
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration;

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return {
            type: Syntax.DoWhileStatement,
            body: body,
            test: test
        };
    }

    function parseWhileStatement() {
        var test, body, oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return {
            type: Syntax.WhileStatement,
            test: test,
            body: body
        };
    }

    function parseForVariableDeclaration() {
        var token = lex();

        return {
            type: Syntax.VariableDeclaration,
            declarations: parseVariableDeclarationList(),
            kind: token.value
        };
    }

    function parseForStatement() {
        var init, test, update, left, right, body, oldInIteration;

        init = test = update = null;

        expectKeyword('for');

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1 && matchKeyword('in')) {
                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isLeftHandSide(init)) {
                        throwErrorTolerant({}, Messages.InvalidLHSInForIn);
                    }

                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        if (typeof left === 'undefined') {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        }

        return {
            type: Syntax.ForInStatement,
            left: left,
            right: right,
            body: body,
            each: false
        };
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var token, label = null;

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source[index] === ';') {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return {
                type: Syntax.ContinueStatement,
                label: null
            };
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return {
                type: Syntax.ContinueStatement,
                label: null
            };
        }

        token = lookahead();
        if (token.type === Token.Identifier) {
            label = parseVariableIdentifier();

            if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return {
            type: Syntax.ContinueStatement,
            label: label
        };
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var token, label = null;

        expectKeyword('break');

        // Optimize the most common form: 'break;'.
        if (source[index] === ';') {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return {
                type: Syntax.BreakStatement,
                label: null
            };
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return {
                type: Syntax.BreakStatement,
                label: null
            };
        }

        token = lookahead();
        if (token.type === Token.Identifier) {
            label = parseVariableIdentifier();

            if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return {
            type: Syntax.BreakStatement,
            label: label
        };
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var token, argument = null;

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source[index] === ' ') {
            if (isIdentifierStart(source[index + 1])) {
                argument = parseExpression();
                consumeSemicolon();
                return {
                    type: Syntax.ReturnStatement,
                    argument: argument
                };
            }
        }

        if (peekLineTerminator()) {
            return {
                type: Syntax.ReturnStatement,
                argument: null
            };
        }

        if (!match(';')) {
            token = lookahead();
            if (!match('}') && token.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return {
            type: Syntax.ReturnStatement,
            argument: argument
        };
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body;

        if (strict) {
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return {
            type: Syntax.WithStatement,
            object: object,
            body: body
        };
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test,
            consequent = [],
            statement;

        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            statement = parseStatement();
            if (typeof statement === 'undefined') {
                break;
            }
            consequent.push(statement);
        }

        return {
            type: Syntax.SwitchCase,
            test: test,
            consequent: consequent
        };
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound;

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        cases = [];

        if (match('}')) {
            lex();
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        }

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return {
            type: Syntax.SwitchStatement,
            discriminant: discriminant,
            cases: cases
        };
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument;

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return {
            type: Syntax.ThrowStatement,
            argument: argument
        };
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param;

        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead());
        }

        param = parseVariableIdentifier();
        // 12.14.1
        if (strict && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');

        return {
            type: Syntax.CatchClause,
            param: param,
            body: parseBlock()
        };
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null;

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return {
            type: Syntax.TryStatement,
            block: block,
            guardedHandlers: [],
            handlers: handlers,
            finalizer: finalizer
        };
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        expectKeyword('debugger');

        consumeSemicolon();

        return {
            type: Syntax.DebuggerStatement
        };
    }

    // 12 Statements

    function parseStatement() {
        var token = lookahead(),
            expr,
            labeledBody;

        if (token.type === Token.EOF) {
            throwUnexpected(token);
        }

        if (token.type === Token.Punctuator) {
            switch (token.value) {
            case ';':
                return parseEmptyStatement();
            case '{':
                return parseBlock();
            case '(':
                return parseExpressionStatement();
            default:
                break;
            }
        }

        if (token.type === Token.Keyword) {
            switch (token.value) {
            case 'break':
                return parseBreakStatement();
            case 'continue':
                return parseContinueStatement();
            case 'debugger':
                return parseDebuggerStatement();
            case 'do':
                return parseDoWhileStatement();
            case 'for':
                return parseForStatement();
            case 'function':
                return parseFunctionDeclaration();
            case 'if':
                return parseIfStatement();
            case 'return':
                return parseReturnStatement();
            case 'switch':
                return parseSwitchStatement();
            case 'throw':
                return parseThrowStatement();
            case 'try':
                return parseTryStatement();
            case 'var':
                return parseVariableStatement();
            case 'while':
                return parseWhileStatement();
            case 'with':
                return parseWithStatement();
            default:
                break;
            }
        }

        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            if (Object.prototype.hasOwnProperty.call(state.labelSet, expr.name)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[expr.name] = true;
            labeledBody = parseStatement();
            delete state.labelSet[expr.name];

            return {
                type: Syntax.LabeledStatement,
                label: expr,
                body: labeledBody
            };
        }

        consumeSemicolon();

        return {
            type: Syntax.ExpressionStatement,
            expression: expr
        };
    }

    // 13 Function Definition

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody;

        expect('{');

        while (index < length) {
            token = lookahead();
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;

        return {
            type: Syntax.BlockStatement,
            body: sourceElements
        };
    }

    function parseFunctionDeclaration() {
        var id, param, params = [], body, token, stricted, firstRestricted, message, previousStrict, paramSet;

        expectKeyword('function');
        token = lookahead();
        id = parseVariableIdentifier();
        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead();
                param = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[param.name] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionDeclaration,
            id: id,
            params: params,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    function parseFunctionExpression() {
        var token, id = null, stricted, firstRestricted, message, param, params = [], body, previousStrict, paramSet;

        expectKeyword('function');

        if (!match('(')) {
            token = lookahead();
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead();
                param = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[param.name] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return {
            type: Syntax.FunctionExpression,
            id: id,
            params: params,
            defaults: [],
            body: body,
            rest: null,
            generator: false,
            expression: false
        };
    }

    // 14 Program

    function parseSourceElement() {
        var token = lookahead();

        if (token.type === Token.Keyword) {
            switch (token.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(token.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (token.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead();
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var program;
        strict = false;
        program = {
            type: Syntax.Program,
            body: parseSourceElements()
        };
        return program;
    }

    // The following functions are needed only when the option to preserve
    // the comments is active.

    function addComment(type, value, start, end, loc) {
        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (extra.comments.length > 0) {
            if (extra.comments[extra.comments.length - 1].range[1] > start) {
                return;
            }
        }

        extra.comments.push({
            type: type,
            value: value,
            range: [start, end],
            loc: loc
        });
    }

    function scanComment() {
        var comment, ch, loc, start, blockComment, lineComment;

        comment = '';
        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch)) {
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    lineComment = false;
                    addComment('Line', comment, start, index - 1, loc);
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    comment = '';
                } else if (index >= length) {
                    lineComment = false;
                    comment += ch;
                    loc.end = {
                        line: lineNumber,
                        column: length - lineStart
                    };
                    addComment('Line', comment, start, length, loc);
                } else {
                    comment += ch;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === '\r' && source[index + 1] === '\n') {
                        ++index;
                        comment += '\r\n';
                    } else {
                        comment += ch;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    comment += ch;
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            comment = comment.substr(0, comment.length - 1);
                            blockComment = false;
                            ++index;
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            addComment('Block', comment, start, index, loc);
                            comment = '';
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart
                        }
                    };
                    start = index;
                    index += 2;
                    lineComment = true;
                    if (index >= length) {
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        lineComment = false;
                        addComment('Line', comment, start, index, loc);
                    }
                } else if (ch === '*') {
                    start = index;
                    index += 2;
                    blockComment = true;
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart - 2
                        }
                    };
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function filterCommentLocation() {
        var i, entry, comment, comments = [];

        for (i = 0; i < extra.comments.length; ++i) {
            entry = extra.comments[i];
            comment = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                comment.range = entry.range;
            }
            if (extra.loc) {
                comment.loc = entry.loc;
            }
            comments.push(comment);
        }

        extra.comments = comments;
    }

    function collectToken() {
        var start, loc, token, range, value;

        skipComment();
        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = extra.advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = sliceSource(token.range[0], token.range[1]);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            });
        }

        return token;
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = extra.scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        // Pop the previous token, which is likely '/' or '/='
        if (extra.tokens.length > 0) {
            token = extra.tokens[extra.tokens.length - 1];
            if (token.range[0] === pos && token.type === 'Punctuator') {
                if (token.value === '/' || token.value === '/=') {
                    extra.tokens.pop();
                }
            }
        }

        extra.tokens.push({
            type: 'RegularExpression',
            value: regex.literal,
            range: [pos, index],
            loc: loc
        });

        return regex;
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function createLiteral(token) {
        return {
            type: Syntax.Literal,
            value: token.value
        };
    }

    function createRawLiteral(token) {
        return {
            type: Syntax.Literal,
            value: token.value,
            raw: sliceSource(token.range[0], token.range[1])
        };
    }

    function createLocationMarker() {
        var marker = {};

        marker.range = [index, index];
        marker.loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            },
            end: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        marker.end = function () {
            this.range[1] = index;
            this.loc.end.line = lineNumber;
            this.loc.end.column = index - lineStart;
        };

        marker.applyGroup = function (node) {
            if (extra.range) {
                node.groupRange = [this.range[0], this.range[1]];
            }
            if (extra.loc) {
                node.groupLoc = {
                    start: {
                        line: this.loc.start.line,
                        column: this.loc.start.column
                    },
                    end: {
                        line: this.loc.end.line,
                        column: this.loc.end.column
                    }
                };
            }
        };

        marker.apply = function (node) {
            if (extra.range) {
                node.range = [this.range[0], this.range[1]];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: this.loc.start.line,
                        column: this.loc.start.column
                    },
                    end: {
                        line: this.loc.end.line,
                        column: this.loc.end.column
                    }
                };
            }
        };

        return marker;
    }

    function trackGroupExpression() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();
        expect('(');

        expr = parseExpression();

        expect(')');

        marker.end();
        marker.applyGroup(expr);

        return expr;
    }

    function trackLeftHandSideExpression() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
                marker.end();
                marker.apply(expr);
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function trackLeftHandSideExpressionAllowCall() {
        var marker, expr;

        skipComment();
        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                expr = {
                    type: Syntax.CallExpression,
                    callee: expr,
                    'arguments': parseArguments()
                };
                marker.end();
                marker.apply(expr);
            } else if (match('[')) {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: true,
                    object: expr,
                    property: parseComputedMember()
                };
                marker.end();
                marker.apply(expr);
            } else {
                expr = {
                    type: Syntax.MemberExpression,
                    computed: false,
                    object: expr,
                    property: parseNonComputedMember()
                };
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function filterGroup(node) {
        var n, i, entry;

        n = (Object.prototype.toString.apply(node) === '[object Array]') ? [] : {};
        for (i in node) {
            if (node.hasOwnProperty(i) && i !== 'groupRange' && i !== 'groupLoc') {
                entry = node[i];
                if (entry === null || typeof entry !== 'object' || entry instanceof RegExp) {
                    n[i] = entry;
                } else {
                    n[i] = filterGroup(entry);
                }
            }
        }
        return n;
    }

    function wrapTrackingFunction(range, loc) {

        return function (parseFunction) {

            function isBinary(node) {
                return node.type === Syntax.LogicalExpression ||
                    node.type === Syntax.BinaryExpression;
            }

            function visit(node) {
                var start, end;

                if (isBinary(node.left)) {
                    visit(node.left);
                }
                if (isBinary(node.right)) {
                    visit(node.right);
                }

                if (range) {
                    if (node.left.groupRange || node.right.groupRange) {
                        start = node.left.groupRange ? node.left.groupRange[0] : node.left.range[0];
                        end = node.right.groupRange ? node.right.groupRange[1] : node.right.range[1];
                        node.range = [start, end];
                    } else if (typeof node.range === 'undefined') {
                        start = node.left.range[0];
                        end = node.right.range[1];
                        node.range = [start, end];
                    }
                }
                if (loc) {
                    if (node.left.groupLoc || node.right.groupLoc) {
                        start = node.left.groupLoc ? node.left.groupLoc.start : node.left.loc.start;
                        end = node.right.groupLoc ? node.right.groupLoc.end : node.right.loc.end;
                        node.loc = {
                            start: start,
                            end: end
                        };
                    } else if (typeof node.loc === 'undefined') {
                        node.loc = {
                            start: node.left.loc.start,
                            end: node.right.loc.end
                        };
                    }
                }
            }

            return function () {
                var marker, node;

                skipComment();

                marker = createLocationMarker();
                node = parseFunction.apply(null, arguments);
                marker.end();

                if (range && typeof node.range === 'undefined') {
                    marker.apply(node);
                }

                if (loc && typeof node.loc === 'undefined') {
                    marker.apply(node);
                }

                if (isBinary(node)) {
                    visit(node);
                }

                return node;
            };
        };
    }

    function patch() {

        var wrapTracking;

        if (extra.comments) {
            extra.skipComment = skipComment;
            skipComment = scanComment;
        }

        if (extra.raw) {
            extra.createLiteral = createLiteral;
            createLiteral = createRawLiteral;
        }

        if (extra.range || extra.loc) {

            extra.parseGroupExpression = parseGroupExpression;
            extra.parseLeftHandSideExpression = parseLeftHandSideExpression;
            extra.parseLeftHandSideExpressionAllowCall = parseLeftHandSideExpressionAllowCall;
            parseGroupExpression = trackGroupExpression;
            parseLeftHandSideExpression = trackLeftHandSideExpression;
            parseLeftHandSideExpressionAllowCall = trackLeftHandSideExpressionAllowCall;

            wrapTracking = wrapTrackingFunction(extra.range, extra.loc);

            extra.parseAdditiveExpression = parseAdditiveExpression;
            extra.parseAssignmentExpression = parseAssignmentExpression;
            extra.parseBitwiseANDExpression = parseBitwiseANDExpression;
            extra.parseBitwiseORExpression = parseBitwiseORExpression;
            extra.parseBitwiseXORExpression = parseBitwiseXORExpression;
            extra.parseBlock = parseBlock;
            extra.parseFunctionSourceElements = parseFunctionSourceElements;
            extra.parseCatchClause = parseCatchClause;
            extra.parseComputedMember = parseComputedMember;
            extra.parseConditionalExpression = parseConditionalExpression;
            extra.parseConstLetDeclaration = parseConstLetDeclaration;
            extra.parseEqualityExpression = parseEqualityExpression;
            extra.parseExpression = parseExpression;
            extra.parseForVariableDeclaration = parseForVariableDeclaration;
            extra.parseFunctionDeclaration = parseFunctionDeclaration;
            extra.parseFunctionExpression = parseFunctionExpression;
            extra.parseLogicalANDExpression = parseLogicalANDExpression;
            extra.parseLogicalORExpression = parseLogicalORExpression;
            extra.parseMultiplicativeExpression = parseMultiplicativeExpression;
            extra.parseNewExpression = parseNewExpression;
            extra.parseNonComputedProperty = parseNonComputedProperty;
            extra.parseObjectProperty = parseObjectProperty;
            extra.parseObjectPropertyKey = parseObjectPropertyKey;
            extra.parsePostfixExpression = parsePostfixExpression;
            extra.parsePrimaryExpression = parsePrimaryExpression;
            extra.parseProgram = parseProgram;
            extra.parsePropertyFunction = parsePropertyFunction;
            extra.parseRelationalExpression = parseRelationalExpression;
            extra.parseStatement = parseStatement;
            extra.parseShiftExpression = parseShiftExpression;
            extra.parseSwitchCase = parseSwitchCase;
            extra.parseUnaryExpression = parseUnaryExpression;
            extra.parseVariableDeclaration = parseVariableDeclaration;
            extra.parseVariableIdentifier = parseVariableIdentifier;

            parseAdditiveExpression = wrapTracking(extra.parseAdditiveExpression);
            parseAssignmentExpression = wrapTracking(extra.parseAssignmentExpression);
            parseBitwiseANDExpression = wrapTracking(extra.parseBitwiseANDExpression);
            parseBitwiseORExpression = wrapTracking(extra.parseBitwiseORExpression);
            parseBitwiseXORExpression = wrapTracking(extra.parseBitwiseXORExpression);
            parseBlock = wrapTracking(extra.parseBlock);
            parseFunctionSourceElements = wrapTracking(extra.parseFunctionSourceElements);
            parseCatchClause = wrapTracking(extra.parseCatchClause);
            parseComputedMember = wrapTracking(extra.parseComputedMember);
            parseConditionalExpression = wrapTracking(extra.parseConditionalExpression);
            parseConstLetDeclaration = wrapTracking(extra.parseConstLetDeclaration);
            parseEqualityExpression = wrapTracking(extra.parseEqualityExpression);
            parseExpression = wrapTracking(extra.parseExpression);
            parseForVariableDeclaration = wrapTracking(extra.parseForVariableDeclaration);
            parseFunctionDeclaration = wrapTracking(extra.parseFunctionDeclaration);
            parseFunctionExpression = wrapTracking(extra.parseFunctionExpression);
            parseLeftHandSideExpression = wrapTracking(parseLeftHandSideExpression);
            parseLogicalANDExpression = wrapTracking(extra.parseLogicalANDExpression);
            parseLogicalORExpression = wrapTracking(extra.parseLogicalORExpression);
            parseMultiplicativeExpression = wrapTracking(extra.parseMultiplicativeExpression);
            parseNewExpression = wrapTracking(extra.parseNewExpression);
            parseNonComputedProperty = wrapTracking(extra.parseNonComputedProperty);
            parseObjectProperty = wrapTracking(extra.parseObjectProperty);
            parseObjectPropertyKey = wrapTracking(extra.parseObjectPropertyKey);
            parsePostfixExpression = wrapTracking(extra.parsePostfixExpression);
            parsePrimaryExpression = wrapTracking(extra.parsePrimaryExpression);
            parseProgram = wrapTracking(extra.parseProgram);
            parsePropertyFunction = wrapTracking(extra.parsePropertyFunction);
            parseRelationalExpression = wrapTracking(extra.parseRelationalExpression);
            parseStatement = wrapTracking(extra.parseStatement);
            parseShiftExpression = wrapTracking(extra.parseShiftExpression);
            parseSwitchCase = wrapTracking(extra.parseSwitchCase);
            parseUnaryExpression = wrapTracking(extra.parseUnaryExpression);
            parseVariableDeclaration = wrapTracking(extra.parseVariableDeclaration);
            parseVariableIdentifier = wrapTracking(extra.parseVariableIdentifier);
        }

        if (typeof extra.tokens !== 'undefined') {
            extra.advance = advance;
            extra.scanRegExp = scanRegExp;

            advance = collectToken;
            scanRegExp = collectRegex;
        }
    }

    function unpatch() {
        if (typeof extra.skipComment === 'function') {
            skipComment = extra.skipComment;
        }

        if (extra.raw) {
            createLiteral = extra.createLiteral;
        }

        if (extra.range || extra.loc) {
            parseAdditiveExpression = extra.parseAdditiveExpression;
            parseAssignmentExpression = extra.parseAssignmentExpression;
            parseBitwiseANDExpression = extra.parseBitwiseANDExpression;
            parseBitwiseORExpression = extra.parseBitwiseORExpression;
            parseBitwiseXORExpression = extra.parseBitwiseXORExpression;
            parseBlock = extra.parseBlock;
            parseFunctionSourceElements = extra.parseFunctionSourceElements;
            parseCatchClause = extra.parseCatchClause;
            parseComputedMember = extra.parseComputedMember;
            parseConditionalExpression = extra.parseConditionalExpression;
            parseConstLetDeclaration = extra.parseConstLetDeclaration;
            parseEqualityExpression = extra.parseEqualityExpression;
            parseExpression = extra.parseExpression;
            parseForVariableDeclaration = extra.parseForVariableDeclaration;
            parseFunctionDeclaration = extra.parseFunctionDeclaration;
            parseFunctionExpression = extra.parseFunctionExpression;
            parseGroupExpression = extra.parseGroupExpression;
            parseLeftHandSideExpression = extra.parseLeftHandSideExpression;
            parseLeftHandSideExpressionAllowCall = extra.parseLeftHandSideExpressionAllowCall;
            parseLogicalANDExpression = extra.parseLogicalANDExpression;
            parseLogicalORExpression = extra.parseLogicalORExpression;
            parseMultiplicativeExpression = extra.parseMultiplicativeExpression;
            parseNewExpression = extra.parseNewExpression;
            parseNonComputedProperty = extra.parseNonComputedProperty;
            parseObjectProperty = extra.parseObjectProperty;
            parseObjectPropertyKey = extra.parseObjectPropertyKey;
            parsePrimaryExpression = extra.parsePrimaryExpression;
            parsePostfixExpression = extra.parsePostfixExpression;
            parseProgram = extra.parseProgram;
            parsePropertyFunction = extra.parsePropertyFunction;
            parseRelationalExpression = extra.parseRelationalExpression;
            parseStatement = extra.parseStatement;
            parseShiftExpression = extra.parseShiftExpression;
            parseSwitchCase = extra.parseSwitchCase;
            parseUnaryExpression = extra.parseUnaryExpression;
            parseVariableDeclaration = extra.parseVariableDeclaration;
            parseVariableIdentifier = extra.parseVariableIdentifier;
        }

        if (typeof extra.scanRegExp === 'function') {
            advance = extra.advance;
            scanRegExp = extra.scanRegExp;
        }
    }

    function stringToArray(str) {
        var length = str.length,
            result = [],
            i;
        for (i = 0; i < length; ++i) {
            result[i] = str.charAt(i);
        }
        return result;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        buffer = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.raw = (typeof options.raw === 'boolean') && options.raw;
            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }

                // Force accessing the characters via an array.
                if (typeof source[0] === 'undefined') {
                    source = stringToArray(code);
                }
            }
        }

        patch();
        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                filterCommentLocation();
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
            if (extra.range || extra.loc) {
                program.body = filterGroup(program.body);
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }

        return program;
    }

    // Sync with package.json.
    exports.version = '1.0.4';

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],14:[function(require,module,exports){
"use strict"

function dupe_array(count, value, i) {
  var c = count[i]|0
  if(c <= 0) {
    return []
  }
  var result = new Array(c), j
  if(i === count.length-1) {
    for(j=0; j<c; ++j) {
      result[j] = value
    }
  } else {
    for(j=0; j<c; ++j) {
      result[j] = dupe_array(count, value, i+1)
    }
  }
  return result
}

function dupe_number(count, value) {
  var result, i
  result = new Array(count)
  for(i=0; i<count; ++i) {
    result[i] = value
  }
  return result
}

function dupe(count, value) {
  if(typeof value === "undefined") {
    value = 0
  }
  switch(typeof count) {
    case "number":
      if(count > 0) {
        return dupe_number(count|0, value)
      }
    break
    case "object":
      if(typeof (count.length) === "number") {
        return dupe_array(count, value, 0)
      }
    break
  }
  return []
}

module.exports = dupe
},{}],15:[function(require,module,exports){
(function (global){
"use strict"

var bits = require("bit-twiddle")
var dup = require("dup")
if(!global.__TYPEDARRAY_POOL) {
  global.__TYPEDARRAY_POOL = {
      UINT8   : dup([32, 0])
    , UINT16  : dup([32, 0])
    , UINT32  : dup([32, 0])
    , INT8    : dup([32, 0])
    , INT16   : dup([32, 0])
    , INT32   : dup([32, 0])
    , FLOAT   : dup([32, 0])
    , DOUBLE  : dup([32, 0])
    , DATA    : dup([32, 0])
  }
}
var POOL = global.__TYPEDARRAY_POOL
var UINT8   = POOL.UINT8
  , UINT16  = POOL.UINT16
  , UINT32  = POOL.UINT32
  , INT8    = POOL.INT8
  , INT16   = POOL.INT16
  , INT32   = POOL.INT32
  , FLOAT   = POOL.FLOAT
  , DOUBLE  = POOL.DOUBLE
  , DATA    = POOL.DATA

function free(array) {
  if(array instanceof ArrayBuffer) {
    var n = array.byteLength|0
      , log_n = bits.log2(n)
    if(n < 32) {
      return
    }
    DATA[log_n].push(array)
  } else {
    var n = array.length|0
      , log_n = bits.log2(n)
    if(n < 32) {
      return
    }
    if(array instanceof Uint8Array) {
      UINT8[log_n].push(array)
    } else if(array instanceof Uint16Array) {
      UINT16[log_n].push(array)
    } else if(array instanceof Uint32Array) {
      UINT32[log_n].push(array)
    } else if(array instanceof Int8Array) {
      INT8[log_n].push(array)
    } else if(array instanceof Int16Array) {
      INT16[log_n].push(array)
    } else if(array instanceof Int32Array) {
      INT32[log_n].push(array)
    } else if(array instanceof Float32Array) {
      FLOAT[log_n].push(array)
    } else if(array instanceof Float64Array) {
      DOUBLE[log_n].push(array)
    }
  }
}
exports.free = free

function malloc(n, dtype) {
  n = Math.max(bits.nextPow2(n), 32)
  var log_n = bits.log2(n)
  if(dtype === undefined) {
    var d = DATA[log_n]
    if(d.length > 0) {
      var r = d[d.length-1]
      d.pop()
      return r
    }
    return new ArrayBuffer(n)
  } else {
    switch(dtype) {
      case "uint8":
        var u8 = UINT8[log_n]
        if(u8.length > 0) {
          var r8 = u8[u8.length-1]
          u8.pop()
          return r8
        }
        return new Uint8Array(n)
      break
      
      case "uint16":
        var u16 = UINT16[log_n]
        if(u16.length > 0) {
          var r16 = u16[u16.length-1]
          u16.pop()
          return r16
        }
        return new Uint16Array(n)
      break
      
      case "uint32":
        var u32 = UINT32[log_n]
        if(u32.length > 0) {
          var r32 = u32[u32.length-1]
          u32.pop()
          return r32
        }
        return new Uint32Array(n)
      break
      
      case "int8":
        var i8 = INT8[log_n]
        if(i8.length > 0) {
          var s8 = i8[i8.length-1]
          i8.pop()
          return s8
        }
        return new Int8Array(n)
      break
      
      case "int16":
        var i16 = INT16[log_n]
        if(i16.length > 0) {
          var s16 = i16[i16.length-1]
          i16.pop()
          return s16
        }
        return new Int16Array(n)
      break
      
      case "int32":
        var i32 = INT32[log_n]
        if(i32.length > 0) {
          var s32 = i32[i32.length-1]
          i32.pop()
          return s32
        }
        return new Int32Array(n)
      break
      
      case "float":
      case "float32":
        var f = FLOAT[log_n]
        if(f.length > 0) {
          var q = f[f.length-1]
          f.pop()
          return q
        }
        return new Float32Array(n)
      break
      
      case "double":
      case "float64":
        var dd = DOUBLE[log_n]
        if(dd.length > 0) {
          var p = dd[dd.length-1]
          dd.pop()
          return p
        }
        return new Float64Array(n)
      break
      
      default:
        return null
    }
  }
  return null
}
exports.malloc = malloc


function clearCache() {
  for(var i=0; i<32; ++i) {
    UINT8[i].length = 0
    UINT16[i].length = 0
    UINT32[i].length = 0
    INT8[i].length = 0
    INT16[i].length = 0
    INT32[i].length = 0
    FLOAT[i].length = 0
    DOUBLE[i].length = 0
    DATA[i].length = 0
  }
}
exports.clearCache = clearCache
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"bit-twiddle":5,"dup":14}],16:[function(require,module,exports){
var cwise = require("cwise")
var ndarray = require("ndarray")

var assign_ops = {
  add:  "+",
  sub:  "-",
  mul:  "*",
  div:  "/",
  mod:  "%",
  band: "&",
  bor:  "|",
  bxor: "^",
  lshift: "<<",
  rshift: ">>",
  rrshift: ">>>"
};

(function(){
  for(var id in assign_ops) {
    var op = assign_ops[id]
    exports[id] = cwise({
      args: ["array","array","array"],
      body: Function("a","b","c","a=b"+op+"c")
    })
    exports[id+"eq"] = cwise({
      args: ["array","array"],
      body: Function("a","b","a"+op+"=b")
    })
    exports[id+"s"] = cwise({
      args: ["array", "array", "scalar"],
      body: Function("a","b","s","a=b"+op+"s")
    })
    exports[id+"seq"] = cwise({
      args: ["array","scalar"],
      body: Function("a","s","a"+op+"=s")
    })
  }
})()

var unary_ops = {
  not: "!",
  bnot: "~",
  neg: "-",
  recip: "1.0/"
};

(function(){
  for(var id in unary_ops) {
    var op = unary_ops[id]
    exports[id] = cwise({
      args: ["array", "array"],
      body: Function("a","b","a="+op+"b")
    })
    exports[id+"eq"] = cwise({
      args: ["array"],
      body: Function("a","a="+op+"a")
    })
  }
})()

var binary_ops = {
  and: "&&",
  or: "||",
  eq: "===",
  neq: "!==",
  lt: "<",
  gt: ">",
  leq: "<=",
  geq: ">="
};

(function() {
  for(var id in binary_ops) {
    var op = binary_ops[id]
    exports[id] = cwise({
      args: ["array","array","array"],
      body: Function("a", "b", "c", "a=b"+op+"c")
    })
    exports[id+"s"] = cwise({
      args: ["array","array","scalar"],
      body: Function("a", "b", "s", "a=b"+op+"s")
    })
    exports[id+"eq"] = cwise({
      args: ["array", "array"],
      body: Function("a", "b", "a=a"+op+"b")
    })
    exports[id+"seq"] = cwise({
      args: ["array", "scalar"],
      body: Function("a", "s", "a=a"+op+"s")
    })
  }
})()

var math_unary = [
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "floor",
  "log",
  "round",
  "sin",
  "sqrt",
  "tan"
];

(function() {
  for(var i=0; i<math_unary.length; ++i) {
    var f = math_unary[i]
    exports[f] = cwise({
                    args: ["array", "array"],
                    pre: Function("this.func=Math."+f),
                    body: function(a,b) {
                      a = this.func(b)
                    }
                  })
    exports[f+"eq"] = cwise({
                      args: ["array"],
                      pre: Function("this.func=Math."+f),
                      body: function(a) {
                        a = this.func(a)
                      }
                    })
  }
})()

var math_comm = [
  "max",
  "min"
];
(function(){
  for(var i=0; i<math_comm.length; ++i) {
    var f= math_comm[i]
 
    exports[f] = cwise({
                  args:["array", "array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(b,c)
                  }
                })
    exports[f+"s"] = cwise({
                  args:["array", "array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(b,c)
                  }})
    exports[f+"eq"] = cwise({ args:["array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(a,b)
                  }})
 
    exports[f+"seq"] = cwise({ args:["array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(a,b)
                  }})
  }
})()

var math_noncomm = [
  "atan2",
  "pow"
];

(function(){
  for(var i=0; i<math_noncomm.length; ++i) {
    var f= math_noncomm[i]
    exports[f] = cwise({ args:["array", "array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(b,c)
                  }})
                  
    exports[f+"s"] = cwise({ args:["array", "array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(b,c)
                  }})
                  
    exports[f+"eq"] = cwise({ args:["array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(a,b)
                  }})
                  
    exports[f+"seq"] = cwise({ args:["array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(a,b)
                  }})
                  
    exports[f+"op"] = cwise({ args:["array", "array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(c,b)
                  }})
                  
    exports[f+"ops"] = cwise({ args:["array", "array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b,c) {
                    a = this.func(c,b)
                  }})
                  
    exports[f+"opeq"] = cwise({ args:["array", "array"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(b,a)
                  }})
                  
    exports[f+"opseq"] = cwise({ args:["array", "scalar"],
                  pre: Function("this.func=Math."+f),
                  body: function(a,b) {
                    a = this.func(b,a)
                  }})
                  
  }
})()

exports.any = cwise({ args:["array"],
  body: function(a) {
    if(a) {
      return true
    }
  },
  post: function() {
    return false
  }})
  

exports.all = cwise({ args:["array"],
  body: function(a) {
    if(!a) {
      return false
    }
  },
  post: function() {
    return true
  }})
  

exports.sum = cwise({ args:["array"],
  pre: function() {
    this.sum = 0
  },
  body: function(a) {
    this.sum += a
  },
  post: function() {
    return this.sum
  }})
  

exports.prod = cwise({ args:["array"],
  pre: function() {
    this.prod = 1
  },
  body: function(a) {
    this.prod *= a
  },
  post: function() {
    return this.prod
  }})
  

exports.norm2squared = cwise({ args:["array"],
  pre: function() {
    this.sum = 0
  },
  body: function(a) {
    this.sum += a*a
  },
  post: function() {
    return this.sum
  }})
  


exports.norm2 = cwise({ args:["array"],
  pre: function() {
    this.sum = 0
  },
  body: function(a) {
    this.sum += a*a
  },
  post: function() {
    return Math.sqrt(this.sum)
  }})
  

exports.norminf = cwise({ args:["array"],
  pre: function() {
    this.n = 0
  },
  body: function(a) {
    if(a<0){
      if(-a<this.n){
        this.n=-a
      }
    } else if(a>this.n){
      s=a
    }
  },
  post: function() {
    return this.n
  }})
  

exports.norm1 = cwise({ args:["array"],
  pre: function() {
    this.sum = 0
  },
  body: function(a) {
    this.sum += a < 0 ? -a : a
  },
  post: function() {
    return this.sum
  }})


exports.sup = cwise({ args:["array"],
  pre: function() {
    this.hi = Number.NEGATIVE_INFINITY
  },
  body: function(a) {
    if(a > this.hi) {
      this.hi = a
    }
  },
  post: function() {
    return this.hi
  }})
  

exports.inf = cwise({ args:["array"],
  pre: function() {
    this.lo = Number.POSITIVE_INFINITY
  },
  body: function(a) {
    if(a < this.lo) {
      this.lo = a
    }
  },
  post: function() {
    return this.lo
  }})
  

exports.argmin = cwise({ args:["index", "array"],
  pre: function(i) {
    this.min_v = Number.POSITIVE_INFINITY
    this.min_i = i.slice(0)
  },
  body: function(i, a) {
    if(a < this.min_v) {
      this.min_v = a
      for(var k=0; k<i.length; ++k) {
        this.min_i[k] = i[k]
      }
    }
  },
  post: function() {
    return this.min_i
  }})
  

exports.argmax = cwise({ args:["index", "array"],
  pre: function(i) {
    this.max_v = Number.NEGATIVE_INFINITY
    this.max_i = i.slice(0)
  },
  body: function(i, a) {
    if(a > this.max_v) {
      this.max_v = a
      for(var k=0; k<i.length; ++k) {
        this.max_i[k] = i[k]
      }
    }
  },
  post: function() {
    return this.max_i
  }})
  

exports.random = cwise({ args:["array"],
  pre: function() {
    this.rnd = Math.random
  },
  body: function(a) {
    a = this.rnd()
  }})
  

exports.assign = cwise({ args:["array", "array"],
  body: function(a,b) {
    a = b
  }})

exports.assigns = cwise({ args:["array", "scalar"],
  body: function(a,b) {
    a = b
  }})

exports.clone = function(array) {
  var stride = new Array(array.shape.length)
  var tsz = 1;
  for(var i=array.shape.length-1; i>=0; --i) {
    stride[i] = tsz
    tsz *= array.shape[i]
  }
  var ndata = new array.data.constructor(array.data.slice(0, tsz*array.data.BYTES_PER_ELEMENT))
  var result = ndarray(ndata, array.shape.slice(0), stride, 0)
  return exports.assign(result, array)
}

},{"cwise":17,"ndarray":23}],17:[function(require,module,exports){
arguments[4][8][0].apply(exports,arguments)
},{"./lib/parser.js":19,"./lib/shim.js":20,"dup":8}],18:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"dup":9}],19:[function(require,module,exports){
arguments[4][10][0].apply(exports,arguments)
},{"dup":10,"falafel":21}],20:[function(require,module,exports){
arguments[4][11][0].apply(exports,arguments)
},{"./generate.js":18,"dup":11}],21:[function(require,module,exports){
arguments[4][12][0].apply(exports,arguments)
},{"dup":12,"esprima":22}],22:[function(require,module,exports){
arguments[4][13][0].apply(exports,arguments)
},{"dup":13}],23:[function(require,module,exports){
"use strict"

var tools = require("./lib/tools.js")
var makeView = require("./lib/viewn.js")

function arrayDType(data) {
  if(data instanceof Float64Array) {
    return "float64";
  } else if(data instanceof Float32Array) {
    return "float32"
  } else if(data instanceof Int32Array) {
    return "int32"
  } else if(data instanceof Uint32Array) {
    return "uint32"
  } else if(data instanceof Uint8Array) {
    return "uint8"
  } else if(data instanceof Uint16Array) {
    return "uint16"
  } else if(data instanceof Int16Array) {
    return "int16"
  } else if(data instanceof Int8Array) {
    return "int8"
  }
  return null
}

function eor(shape, stride, offset) {
  for(var i=0; i<shape.length; ++i) {
    if(shape[i] === 0) {
      return 0
    }
    offset += (shape[i]-1) * stride[i]
  }
  return offset
}

//Wraps a typed array as an ndarray
function wrap(tarray, shape, stride, offset) {
  if(!arrayDType(tarray)) {
    throw new Error("Input is not a typed array")
  }
  if(!shape) {
    shape = [ tarray.length ]
  } else {
    var tsz = 1
    for(var i=0; i<shape.length; ++i) {
      tsz *= shape[i]
    }
    if(tsz > tarray.length) {
      throw new Error("Array shape out of bounds")
    }
  }
  if(!stride) {
    stride = new Array(shape.length)
    var sz = 1
    for(var i=shape.length-1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  } else if(stride.length !== shape.length) {
    throw new Error("Bad stride length")
  }
  if(!offset) {
    offset = 0
  }
  if(tarray.length > 0) {
    if(offset < 0 || offset >= tarray.length) {
      throw new Error("Offset out of range")
    }
    var e = eor(shape, stride, offset)
    if(e < 0 || e >= tarray.length) {
      throw new Error("Array shape out of bounds")
    }
  } else {
    offset = 0
  }
  return makeView(tarray, shape, stride, offset)
}

function dtype(view) {
  return arrayDType(view.data)
}

function zeros(shape, dtype, order) {
  if(!dtype) {
    dtype = "float64"
  }
  //Default row-major order
  if(!order) {
    order = new Array(shape.length)
    for(var i=shape.length-1, j=0; i>=0; --i, ++j) {
      order[j] = i
    }
  }
  var stride =  new Array(shape.length)
  var size = 1
  for(var i=0; i<shape.length; ++i) {
    stride[order[i]] = size
    size *= shape[order[i]]
  }
  var buf
  switch(dtype) {
    case "int8":
      buf = new Int8Array(size)
    break
    case "int16":
      buf = new Int16Array(size)
    break
    case "int32":
      buf = new Int32Array(size)
    break
    case "uint8":
      buf = new Uint8Array(size)
    break
    case "uint16":
      buf = new Uint16Array(size)
    break
    case "uint32":
      buf = new Uint32Array(size)
    break
    case "float32":
      buf = new Float32Array(size)
    break
    case "float64":
      buf = new Float64Array(size)
    break
    default:
      throw new Error("Invalid data type")
    break
  }
  return makeView(buf, shape, stride, 0)
}

function order(view) {
  return tools.order(view.stride)
}

function size(view) {
  var shape = view.shape
    , d = shape.length
    , r = 1, i
  if(d === 0) {
    return 0
  }
  for(i=0; i<d; ++i) {
    r *= shape[i]
  }
  return r
}

function pstride(shape, order) {
  var i = 0, d = shape.length
  var result = new Array(d), s = 1
  if(order) {
    for(i=0; i<d; ++i) {
      result[order[i]] = s
      s *= shape[order[i]]
    }
  } else {
    for(var i=d-1; i>=0; --i) {
      stride[i] = s
      s *= shape[i]
    }
  }
  return result
}

module.exports = wrap
module.exports.zeros    = zeros
module.exports.dtype    = dtype
module.exports.order    = order
module.exports.size     = size
module.exports.stride   = pstride
module.exports.ctor     = makeView
},{"./lib/tools.js":24,"./lib/viewn.js":25}],24:[function(require,module,exports){

function compare1st(a, b) {
  return a[0] - b[0];
}

function order(stride) {
  var terms = new Array(stride.length);
  for(var i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i];
  }
  terms.sort(compare1st);
  var result = new Array(terms.length);
  for(var i=0; i<result.length; ++i) {
    result[i] = terms[i][1];
  }
  return result;
}

exports.order = order;


},{}],25:[function(require,module,exports){
"use strict"

var tools = require("./tools.js")

var RECURSION_LIMIT = 32

function ViewN(data, shape, stride, offset) {
  this.data = data
  this.shape = shape
  this.stride = stride
  this.offset = offset
}

ViewN.prototype.get = function() {
  var ptr = this.offset
  for(var i=0; i<this.shape.length; ++i) {
    ptr += arguments[i] * this.stride[i]
  }
  return this.data[ptr]
}
ViewN.prototype.set = function() {
  var ptr = this.offset
  for(var i=0; i<this.shape.length; ++i) {
    ptr += arguments[i] * this.stride[i]
  }
  var v = arguments[this.shape.length]
  this.data[ptr] = v
  return v
}
ViewN.prototype.lo = function() {
  var nshape = this.shape.slice(0)
  var nstride = this.stride.slice(0)
  var noffset = this.offset
  for(var i=0; i<nshape.length; ++i) {
    var x = arguments[i]
    if(typeof x === "number") {
      x |= 0
      if(x < 0) {
        x = nshape[i] + x
      }
      noffset += x * nstride[i]
      nshape[i] -= x
    }
  }
  return new this.constructor(this.data, nshape, nstride, noffset)
}
ViewN.prototype.hi = function() {
  var nshape = new Array(this.shape.length)
  for(var i=0; i<nshape.length; ++i) {
    var x = arguments[i]
    if(typeof x === "number") {
      x |= 0
      if(x < 0) {
        x = this.shape[i] + x
      }
      nshape[i] = x
    } else {
      nshape[i] = this.shape[i]
    }
  }
  return new this.constructor(this.data, nshape, this.stride.slice(0), this.offset)
}
ViewN.prototype.step = function() {
  var nshape = this.shape.slice(0)
  var nstride = this.stride.slice(0)
  var noffset = this.offset
  for(var i=0; i<nshape.length; ++i) {
    var s = arguments[i]
    nstride[i] *= s
    if(s < 0) {
      noffset += this.stride[i] * (this.shape[i] - 1)
      nshape[i] = Math.ceil(-this.shape[i] / s)
    } else if(s > 0) {
      nshape[i] = Math.ceil(this.shape[i] / s)
    }
  }
  return new this.constructor(this.data, nshape, nstride, noffset)
}
ViewN.prototype.transpose = function() {
  var nshape = this.shape.slice(0)
  var nstride = this.stride.slice(0)
  var noffset = this.offset
  for(var i=0; i<nshape.length; ++i) {
    var ord = arguments[i]
    nshape[i] = this.shape[ord]
    nstride[i] = this.stride[ord]
  }
  return new this.constructor(this.data, nshape, nstride, noffset)
}
ViewN.prototype.pick = function() {
  var nshape = []
  var nstride = []
  var noffset = this.offset
  for(var i=0; i<this.shape.length; ++i) {
    if(arguments[i] >= 0) {
      noffset += this.stride[i] * arguments[i]
    } else {
      nshape.push(this.shape[i])
      nstride.push(this.stride[i])
    }
  }
  return CTOR(this.data, nshape, nstride, noffset)
}

ViewN.prototype.toString = function() {
  var buffer = []
  var index = new Array(this.shape.length)
  for(var i=0; i<index.length; ++i) {
    index[i] = 0
  }
  var ptr = this.offset
  while(true) {
    for(var i=index.length-1; i>=0; --i) {
      if(index[i] === 0) {
        buffer.push("[")
      } else {
        break
      }
    }
    var i = this.shape.length-1
    buffer.push(this.data[ptr])
    while(i>=0) {
      ptr += this.stride[i]
      ++index[i]
      if(index[i] >= this.shape[i]) {
        buffer.push("]")
        if(i === 0) {
          return buffer.join("")
        }
        ptr -= this.stride[i] * this.shape[i]
        index[i--] = 0
      } else {
        buffer.push(",")
        break
      }
    }
  }
}

function View0(data) {
  this.data = data
  this.shape = []
  this.stride = []
  this.offset = 0
}
View0.prototype.get =
View0.prototype.set = function() {
  return Number.NaN
}
View0.prototype.lo =
View0.prototype.hi =
View0.prototype.step =
View0.prototype.transpose =
View0.prototype.pick = function() {
  return new View0(this.data)
}
View0.prototype.toString = function() {
  return "[]"
}


function View1(data, shape, stride, offset) {
  this.data = data
  this.shape = shape
  this.stride = stride
  this.offset = offset
}
View1.prototype.get = function(i) {
  return this.data[i * this.stride[0] + this.offset]
}
View1.prototype.set = function(i, v) {
  this.data[i * this.stride[0] + this.offset] = v
  return v
}
View1.prototype.lo = ViewN.prototype.lo
View1.prototype.hi = ViewN.prototype.hi
View1.prototype.step = ViewN.prototype.step
View1.prototype.transpose = ViewN.prototype.transpose
View1.prototype.pick = ViewN.prototype.pick
View1.prototype.toString = ViewN.prototype.toString


function View2(data, shape, stride, offset) {
  this.data = data
  this.shape = shape
  this.stride = stride
  this.offset = offset
}
View2.prototype.get = function(i, j) {
  return this.data[this.offset + i * this.stride[0] + j * this.stride[1]]
}
View2.prototype.set = function(i, j, v) {
  return this.data[this.offset + i * this.stride[0] + j * this.stride[1]] = v
}
View2.prototype.hi = ViewN.prototype.hi
View2.prototype.lo = ViewN.prototype.lo
View2.prototype.step = ViewN.prototype.step
View2.prototype.transpose = ViewN.prototype.transpose
View2.prototype.pick = ViewN.prototype.pick
View2.prototype.toString = ViewN.prototype.toString


function View3(data, shape, stride, offset) {
  this.data = data
  this.shape = shape
  this.stride = stride
  this.offset = offset
}
View3.prototype.get = function(i, j, k) {
  return this.data[this.offset + i * this.stride[0] + j * this.stride[1] + k * this.stride[2]]
}
View3.prototype.set = function(i, j, k, v) {
  return this.data[this.offset + i * this.stride[0] + j * this.stride[1] + k * this.stride[2]] = v
}
View3.prototype.hi = ViewN.prototype.hi
View3.prototype.lo = ViewN.prototype.lo
View3.prototype.step = ViewN.prototype.step
View3.prototype.transpose = ViewN.prototype.transpose
View3.prototype.pick = ViewN.prototype.pick
View3.prototype.toString = ViewN.prototype.toString


function CTOR(data, shape, stride, offset) {
  switch(shape.length) {
    case 0:   return new View0(data)
    case 1:   return new View1(data, shape, stride, offset)
    case 2:   return new View2(data, shape, stride, offset)
    case 3:   return new View3(data, shape, stride, offset)
    default:  return new ViewN(data, shape, stride, offset)
  }
}

module.exports = CTOR

},{"./tools.js":24}],26:[function(require,module,exports){
"use strict"

var bits = require("bit-twiddle")
var pool = require("typedarray-pool")
var ndarray = require("ndarray")
var ops = require("ndarray-ops")
var fft = require("ndarray-fft")

function zero(arr, lo, hi) {
  for(var i=lo; i<hi; ++i) {
    arr[i] = 0.0
  }
}

function square(x, y) {
  var n = x.length, n2 = Math.ceil(0.5*n)|0
  x[0] = y[0] = 0.0
  for(var i=1; i<n2; ++i) {
    var a = x[i], b = y[i]
    x[n-i] = x[i] = a*a + b*b
    y[n-i] = y[i] = 0.0
  }
}

function findPeriod(x, lo, hi, scale_f) {
  //1st pass compute best val
  var loc_m = 0.0
  for(var i=lo; i<hi; ++i) {
    loc_m = Math.max(loc_m, x[i])
  }
  //2nd pass compute max
  var threshold = loc_m * scale_f
  for(var i=lo; i<hi; ++i) {
    if(x[i] > threshold) {
      var best = x[i]
      var r = i
      for(var j=i; j < hi && x[j] > threshold; ++j) {
        if(x[j] > best) {
          best = x[j]
          r = j
        }
      }
      var y0 = x[r-1], y1 = x[r], y2 = x[r+1]
      var denom = y2 - y1 + y0
      if(Math.abs(denom) < 1e-6) {
        return r
      }
      var numer = y0 - y2
      return r + 0.5 * numer / denom
    }
  }
  return 0
}

function detectPitch(signal, options) {
  options = options || {}
  var xs
  if(signal.shape) {
    xs = signal.shape[0]
  } else {
    xs = signal.length
  }
  
  var i, j, k
  var n = bits.nextPow2(2*xs)
  var re_arr = pool.mallocFloat(n)
  var im_arr = pool.mallocFloat(n)
  var X = ndarray.ctor(re_arr, [n], [1], 0)
  var Y = ndarray.ctor(im_arr, [n], [1], 0)
  
  //Initialize array depending on if it is a typed array
  if(signal.shape) {
    X.shape[0] = xs
    ops.assign(X, signal)
    X.shape[0] = n
  } else {
    re_arr.set(signal)
  }
  zero(re_arr, xs, n)
  zero(im_arr, 0, n)
  
  //Autocorrelate
  fft(1, X, Y)
  square(re_arr, im_arr)
  fft(-1, X, Y)
  
  //Detect pitch
  var threshold = options.threshold || 0.9
  var period = findPeriod(
          re_arr,
          options.start_bin || 16,
          xs>>>1,
          threshold)
  
  //Free temporary arrays
  pool.freeFloat(re_arr)
  pool.freeFloat(im_arr)
  
  return period
}
module.exports = detectPitch
},{"bit-twiddle":5,"ndarray":23,"ndarray-fft":6,"ndarray-ops":16,"typedarray-pool":31}],27:[function(require,module,exports){
"use strict"

// Slices a stream of frames into a stream of overlapping windows
// The size of each frame is the same as the size o
function createHopStream(frame_size, hop_size, onFrame, max_data_size) {
  if(hop_size > frame_size) {
    throw new Error("Hop size must be smaller than frame size")
  }
  max_data_size     = max_data_size || frame_size
  var buffer        = new Float32Array(frame_size + max_data_size)
  var ptr           = 0
  var frame_slices  = []
  for(var j=0; j+frame_size<=buffer.length; j+=hop_size) {
    frame_slices.push(buffer.subarray(j, j+frame_size))
  }
  return function processHopData(data) {
    var i, j, k
    buffer.set(data, ptr)
    ptr += data.length
    for(i=0, j=0; j+frame_size<=ptr; ++i, j+=hop_size) {
      onFrame(frame_slices[i])
    }
    for(k=0; j<ptr; ) {
      buffer.set(frame_slices[i], k)
      var nhops = Math.ceil((k+frame_size) / hop_size)|0
      var nptr  = nhops * hop_size
      if(nptr !== k+frame_size) {
        nhops -= 1
        nptr -= hop_size
      }
      i += nhops
      j += (nptr - k)
      k  = nptr
    }
    ptr += k - j
  }
}

module.exports = createHopStream

},{}],28:[function(require,module,exports){
"use strict"

function overlapAdd(frame_size, hop_size, onFrame) {
  if(hop_size > frame_size) {
    throw new Error("Hop size must be smaller than frame size")
  }
  var buffer = new Float32Array(2 * frame_size)
  var first_slice = buffer.subarray(0, frame_size)
  var second_slice = buffer.subarray(frame_size)
  var sptr = 0, eptr = 0
  return function processOverlapAdd(data) {
    var n = frame_size
    var i, j, k
    var B = buffer
    
    //Add data to frame
    k = eptr
    for(i=0, j=sptr; j<k && i<n; ++i, ++j) {
      B[j] += data[i]
    }
    for(; i<n; ++i, ++j) {
      B[j] = data[i]
    }
    sptr += hop_size
    eptr = j
    
    //Emit frame if necessary
    if(sptr >= frame_size) {
      onFrame(first_slice)
      first_slice.set(second_slice)
      sptr -= frame_size
      eptr -= frame_size
    }
  }
}

module.exports = overlapAdd
},{}],29:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],30:[function(require,module,exports){
arguments[4][14][0].apply(exports,arguments)
},{"dup":14}],31:[function(require,module,exports){
(function (global){
"use strict"

var bits = require("bit-twiddle")
var dup = require("dup")
if(!global.__TYPEDARRAY_POOL) {
  global.__TYPEDARRAY_POOL = {
      UINT8   : dup([32, 0])
    , UINT16  : dup([32, 0])
    , UINT32  : dup([32, 0])
    , INT8    : dup([32, 0])
    , INT16   : dup([32, 0])
    , INT32   : dup([32, 0])
    , FLOAT   : dup([32, 0])
    , DOUBLE  : dup([32, 0])
    , DATA    : dup([32, 0])
  }
}
var POOL = global.__TYPEDARRAY_POOL
var UINT8   = POOL.UINT8
  , UINT16  = POOL.UINT16
  , UINT32  = POOL.UINT32
  , INT8    = POOL.INT8
  , INT16   = POOL.INT16
  , INT32   = POOL.INT32
  , FLOAT   = POOL.FLOAT
  , DOUBLE  = POOL.DOUBLE
  , DATA    = POOL.DATA

exports.free = function free(array) {
  if(array instanceof ArrayBuffer) {
    var n = array.byteLength|0
      , log_n = bits.log2(n)
    DATA[log_n].push(array)
  } else {
    var n = array.length|0
      , log_n = bits.log2(n)
    if(array instanceof Uint8Array) {
      UINT8[log_n].push(array)
    } else if(array instanceof Uint16Array) {
      UINT16[log_n].push(array)
    } else if(array instanceof Uint32Array) {
      UINT32[log_n].push(array)
    } else if(array instanceof Int8Array) {
      INT8[log_n].push(array)
    } else if(array instanceof Int16Array) {
      INT16[log_n].push(array)
    } else if(array instanceof Int32Array) {
      INT32[log_n].push(array)
    } else if(array instanceof Float32Array) {
      FLOAT[log_n].push(array)
    } else if(array instanceof Float64Array) {
      DOUBLE[log_n].push(array)
    }
  }
}

exports.freeUint8 = function freeUint8(array) {
  UINT8[bits.log2(array.length)].push(array)
}

exports.freeUint16 = function freeUint16(array) {
  UINT16[bits.log2(array.length)].push(array)
}

exports.freeUint32 = function freeUint32(array) {
  UINT32[bits.log2(array.length)].push(array)
}

exports.freeInt8 = function freeInt8(array) {
  INT8[bits.log2(array.length)].push(array)
}

exports.freeInt16 = function freeInt16(array) {
  INT16[bits.log2(array.length)].push(array)
}

exports.freeInt32 = function freeInt32(array) {
  INT32[bits.log2(array.length)].push(array)
}

exports.freeFloat32 = exports.freeFloat = function freeFloat(array) {
  FLOAT[bits.log2(array.length)].push(array)
}

exports.freeFloat64 = exports.freeDouble = function freeDouble(array) {
  DOUBLE[bits.log2(array.length)].push(array)
}

exports.freeArrayBuffer = function freeArrayBuffer(array) {
  DATA[bits.log2(array.length)].push(array)
}

exports.malloc = function malloc(n, dtype) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  if(dtype === undefined) {
    var d = DATA[log_n]
    if(d.length > 0) {
      var r = d[d.length-1]
      d.pop()
      return r
    }
    return new ArrayBuffer(n)
  } else {
    switch(dtype) {
      case "uint8":
        var u8 = UINT8[log_n]
        if(u8.length > 0) {
          return u8.pop()
        }
        return new Uint8Array(n)
      break

      case "uint16":
        var u16 = UINT16[log_n]
        if(u16.length > 0) {
          return u16.pop()
        }
        return new Uint16Array(n)
      break

      case "uint32":
        var u32 = UINT32[log_n]
        if(u32.length > 0) {
          return u32.pop()
        }
        return new Uint32Array(n)
      break

      case "int8":
        var i8 = INT8[log_n]
        if(i8.length > 0) {
          return i8.pop()
        }
        return new Int8Array(n)
      break

      case "int16":
        var i16 = INT16[log_n]
        if(i16.length > 0) {
          return i16.pop()
        }
        return new Int16Array(n)
      break

      case "int32":
        var i32 = INT32[log_n]
        if(i32.length > 0) {
          return i32.pop()
        }
        return new Int32Array(n)
      break

      case "float":
      case "float32":
        var f = FLOAT[log_n]
        if(f.length > 0) {
          return f.pop()
        }
        return new Float32Array(n)
      break

      case "double":
      case "float64":
        var dd = DOUBLE[log_n]
        if(dd.length > 0) {
          return dd.pop()
        }
        return new Float64Array(n)
      break

      default:
        return null
    }
  }
  return null
}

exports.mallocUint8 = function mallocUint8(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = UINT8[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Uint8Array(n)
}

exports.mallocUint16 = function mallocUint16(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = UINT16[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Uint16Array(n)
}

exports.mallocUint32 = function mallocUint32(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = UINT32[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Uint32Array(n)
}

exports.mallocInt8 = function mallocInt8(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = INT8[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Int8Array(n)
}

exports.mallocInt16 = function mallocInt16(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = INT16[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Int16Array(n)
}

exports.mallocInt32 = function mallocInt32(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = INT32[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Int32Array(n)
}

exports.mallocFloat32 = exports.mallocFloat = function mallocFloat(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = FLOAT[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Float32Array(n)
}

exports.mallocFloat64 = exports.mallocDouble = function mallocDouble(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = DOUBLE[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Float64Array(n)
}

exports.mallocArrayBuffer = function mallocArrayBuffer(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = DATA[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new ArrayBuffer(n)
}

exports.clearCache = function clearCache() {
  for(var i=0; i<32; ++i) {
    UINT8[i].length = 0
    UINT16[i].length = 0
    UINT32[i].length = 0
    INT8[i].length = 0
    INT16[i].length = 0
    INT32[i].length = 0
    FLOAT[i].length = 0
    DOUBLE[i].length = 0
    DATA[i].length = 0
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"bit-twiddle":29,"dup":30}],32:[function(require,module,exports){
"use strict"

var frameHop = require("frame-hop")
var overlapAdd = require("overlap-add")
var detectPitch = require("detect-pitch")
var pool = require("typedarray-pool")

function createWindow(n) {
  var result = new Float32Array(n)
  for(var i=0; i<n; ++i) {
    var t = i / (n-1)
    result[i] = 0.5 * (1.0 - Math.cos(2.0*Math.PI * t))
  }
  return result
}

function normalizeWindow(w, hop_size) {
  var n = w.length
  var nh = (n / hop_size)|0
  var scale = pool.mallocFloat32(n)
  for(var i=0; i<n; ++i) {
    var s = 0.0
    for(var j=0; j<nh; ++j) {
      s += w[(i + j*hop_size)%n]
    }
    scale[i] = s
  }
  for(var i=0; i<n; ++i) {
    w[i] /= scale[i]
  }
  pool.freeFloat32(scale)
}

//Applies window to signal
function applyWindow(X, W, frame) {
  var i, n = frame.length
  for(i=0; i<n; ++i) {
    X[i] = W[i] * frame[i]
  }
}

//Performs the actual pitch scaling
function scalePitch(out, x, nx, period, scale, shift, w) {
  var no = out.length
  for(var i=0; i<no; ++i) {
    var t  = i * scale + shift
    var ti = Math.floor(t)|0
    var tf = t - ti
    var x1 = x[ti%nx]
    var x2 = x[(ti+1)%nx]
    var v = (1.0 - tf) * x1 + tf * x2
    out[i] = w[i] * v
  }
}

//Match start/end points of signal to avoid popping artefacts
function findMatch(x, start, step) {
  var a = x[0], b = x[step], c = x[2*step]
  var n = x.length
  var best_d = 8
  var best_i = start
  for(var i=start; i<n-2*step; ++i) {
    var s = x[i]-a, t = x[i+step]-b, u=x[i+2*step]-c
    var d = s*s + t*t + u*u
    if( d < best_d ) {
      best_d = d
      best_i = i
    }
  }
  return best_i
}

function pitchShift(onData, onTune, options) {
  options = options || {}
  
  var frame_size  = options.frameSize || 2048
  var hop_size    = options.hopSize || (frame_size>>>2)
  var sample_rate = options.sampleRate || 44100
  var data_size   = options.maxDataSize || undefined
  var a_window    = options.analysisWindow || createWindow(frame_size)
  var s_window    = options.synthesisWindow || createWindow(frame_size)
  var threshold   = options.freqThreshold || 0.9
  var start_bin   = options.minPeriod || Math.min(hop_size, Math.max(16, Math.round(sample_rate / 400)))|0
  
  var detect_params = {
    threshold: threshold,
    start_bin: start_bin
  }
  
  var t           = 0
  var cur         = new Float32Array(frame_size)
  
  if(frame_size % hop_size !== 0) {
    throw new Error("Hop size must divide frame size")
  }
  
  //Normalize synthesis window
  normalizeWindow(s_window, hop_size)
  
  var addFrame = overlapAdd(frame_size, hop_size, onData)
  var delay = 0
  
  function doPitchShift(frame) {

    //Apply window
    applyWindow(cur, a_window, frame)
    
    //Compute pitch, period and sample rate
    var period = detectPitch(cur, detect_params)
    var pitch = 0.0
    if(period > 0) {
      pitch = sample_rate / period
    }
    var scale_f = onTune(t / sample_rate, pitch)
    
    //Calculate frame size
    var fsize = frame_size>>1
    if(period > 0) {
      fsize = (Math.max(1, Math.floor(0.5*frame_size/period)) * period)|0
    }    
    fsize = findMatch(frame, fsize|0, Math.max(1, period/20)|0)
    
    //Apply scaling
    delay = ((delay % fsize) + fsize) % fsize
    scalePitch(cur, frame, fsize, period|0, scale_f, delay, s_window)
    
    //Update counters
    delay += hop_size * (scale_f - 1.0)
    t += hop_size
    
    //Add frame
    addFrame(cur)
  }
  
  return frameHop(frame_size, hop_size, doPitchShift, data_size)
}
module.exports = pitchShift

},{"detect-pitch":26,"frame-hop":27,"overlap-add":28,"typedarray-pool":31}],33:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],34:[function(require,module,exports){
arguments[4][14][0].apply(exports,arguments)
},{"dup":14}],35:[function(require,module,exports){
(function (global,Buffer){
'use strict'

var bits = require('bit-twiddle')
var dup = require('dup')

//Legacy pool support
if(!global.__TYPEDARRAY_POOL) {
  global.__TYPEDARRAY_POOL = {
      UINT8   : dup([32, 0])
    , UINT16  : dup([32, 0])
    , UINT32  : dup([32, 0])
    , INT8    : dup([32, 0])
    , INT16   : dup([32, 0])
    , INT32   : dup([32, 0])
    , FLOAT   : dup([32, 0])
    , DOUBLE  : dup([32, 0])
    , DATA    : dup([32, 0])
    , UINT8C  : dup([32, 0])
    , BUFFER  : dup([32, 0])
  }
}

var hasUint8C = (typeof Uint8ClampedArray) !== 'undefined'
var POOL = global.__TYPEDARRAY_POOL

//Upgrade pool
if(!POOL.UINT8C) {
  POOL.UINT8C = dup([32, 0])
}
if(!POOL.BUFFER) {
  POOL.BUFFER = dup([32, 0])
}

//New technique: Only allocate from ArrayBufferView and Buffer
var DATA    = POOL.DATA
  , BUFFER  = POOL.BUFFER

exports.free = function free(array) {
  if(Buffer.isBuffer(array)) {
    BUFFER[bits.log2(array.length)].push(array)
  } else {
    if(Object.prototype.toString.call(array) !== '[object ArrayBuffer]') {
      array = array.buffer
    }
    if(!array) {
      return
    }
    var n = array.length || array.byteLength
    var log_n = bits.log2(n)|0
    DATA[log_n].push(array)
  }
}

function freeArrayBuffer(buffer) {
  if(!buffer) {
    return
  }
  var n = buffer.length || buffer.byteLength
  var log_n = bits.log2(n)
  DATA[log_n].push(buffer)
}

function freeTypedArray(array) {
  freeArrayBuffer(array.buffer)
}

exports.freeUint8 =
exports.freeUint16 =
exports.freeUint32 =
exports.freeInt8 =
exports.freeInt16 =
exports.freeInt32 =
exports.freeFloat32 = 
exports.freeFloat =
exports.freeFloat64 = 
exports.freeDouble = 
exports.freeUint8Clamped = 
exports.freeDataView = freeTypedArray

exports.freeArrayBuffer = freeArrayBuffer

exports.freeBuffer = function freeBuffer(array) {
  BUFFER[bits.log2(array.length)].push(array)
}

exports.malloc = function malloc(n, dtype) {
  if(dtype === undefined || dtype === 'arraybuffer') {
    return mallocArrayBuffer(n)
  } else {
    switch(dtype) {
      case 'uint8':
        return mallocUint8(n)
      case 'uint16':
        return mallocUint16(n)
      case 'uint32':
        return mallocUint32(n)
      case 'int8':
        return mallocInt8(n)
      case 'int16':
        return mallocInt16(n)
      case 'int32':
        return mallocInt32(n)
      case 'float':
      case 'float32':
        return mallocFloat(n)
      case 'double':
      case 'float64':
        return mallocDouble(n)
      case 'uint8_clamped':
        return mallocUint8Clamped(n)
      case 'buffer':
        return mallocBuffer(n)
      case 'data':
      case 'dataview':
        return mallocDataView(n)

      default:
        return null
    }
  }
  return null
}

function mallocArrayBuffer(n) {
  var n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var d = DATA[log_n]
  if(d.length > 0) {
    return d.pop()
  }
  return new ArrayBuffer(n)
}
exports.mallocArrayBuffer = mallocArrayBuffer

function mallocUint8(n) {
  return new Uint8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocUint8 = mallocUint8

function mallocUint16(n) {
  return new Uint16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocUint16 = mallocUint16

function mallocUint32(n) {
  return new Uint32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocUint32 = mallocUint32

function mallocInt8(n) {
  return new Int8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocInt8 = mallocInt8

function mallocInt16(n) {
  return new Int16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocInt16 = mallocInt16

function mallocInt32(n) {
  return new Int32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocInt32 = mallocInt32

function mallocFloat(n) {
  return new Float32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocFloat32 = exports.mallocFloat = mallocFloat

function mallocDouble(n) {
  return new Float64Array(mallocArrayBuffer(8*n), 0, n)
}
exports.mallocFloat64 = exports.mallocDouble = mallocDouble

function mallocUint8Clamped(n) {
  if(hasUint8C) {
    return new Uint8ClampedArray(mallocArrayBuffer(n), 0, n)
  } else {
    return mallocUint8(n)
  }
}
exports.mallocUint8Clamped = mallocUint8Clamped

function mallocDataView(n) {
  return new DataView(mallocArrayBuffer(n), 0, n)
}
exports.mallocDataView = mallocDataView

function mallocBuffer(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = BUFFER[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Buffer(n)
}
exports.mallocBuffer = mallocBuffer

exports.clearCache = function clearCache() {
  for(var i=0; i<32; ++i) {
    POOL.UINT8[i].length = 0
    POOL.UINT16[i].length = 0
    POOL.UINT32[i].length = 0
    POOL.INT8[i].length = 0
    POOL.INT16[i].length = 0
    POOL.INT32[i].length = 0
    POOL.FLOAT[i].length = 0
    POOL.DOUBLE[i].length = 0
    POOL.UINT8C[i].length = 0
    DATA[i].length = 0
    BUFFER[i].length = 0
  }
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"bit-twiddle":33,"buffer":1,"dup":34}],36:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var AbstractCanvas = exports.AbstractCanvas = function AbstractCanvas(identifier) {
    _classCallCheck(this, AbstractCanvas);

    this.canvas = document.getElementById(identifier);
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
};

},{}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.dopplerShift = dopplerShift;
function dopplerShift(relVelO, relVelS, vSound) {
    var FreMult = (vSound + relVelO) / (vSound - relVelS);
    return FreMult;
}

},{}],38:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FrequencyShifter = undefined;

var _createClass = function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
}();

var _pitchShift = require("pitch-shift");

var _pitchShift2 = _interopRequireDefault(_pitchShift);

var _typedarrayPool = require("typedarray-pool");

var _typedarrayPool2 = _interopRequireDefault(_typedarrayPool);

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var FRAME_SIZE = 2048;

var FrequencyShifter = exports.FrequencyShifter = function () {
    function FrequencyShifter(context, inputNode, outputNode) {
        var _this = this;

        _classCallCheck(this, FrequencyShifter);

        this.audioContext = context;
        this.processorNode = this.audioContext.createScriptProcessor(FRAME_SIZE, 1, 1);
        //this.shifter = new Pitchshift(4096, this.audioContext.sampleRate, "FFT");
        this.queue = [];
        this.shifter = (0, _pitchShift2.default)(function (data) {
            return _this.useData(data);
        }, function () {
            return _this.getShift();
        }, {
            frameSize: FRAME_SIZE
        });
        //Add some bogus data so it doesn't run out of stuff
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.processorNode.onaudioprocess = function (event) {
            return _this.processAudio(event);
        };
        this.shiftMultiplier = 1;
        inputNode.connect(this.processorNode);
        this.processorNode.connect(outputNode);
        this.inputNode = inputNode;
    }

    _createClass(FrequencyShifter, [{
        key: "useData",
        value: function useData(data) {
            var buf = _typedarrayPool2.default.mallocFloat32(data.length);
            buf.set(data);
            this.queue.push(buf);
        }
    }, {
        key: "setShift",
        value: function setShift(mul) {
            this.shiftMultiplier = mul;
        }
    }, {
        key: "getShift",
        value: function getShift() {
            return this.shiftMultiplier || 1;
        }
    }, {
        key: "stop",
        value: function stop() {
            this.processorNode.disconnect();
            this.inputNode.disconnect();
            this.audioContext.close();
        }
    }, {
        key: "processAudio",
        value: function processAudio(event) {
            this.shifter(event.inputBuffer.getChannelData(0));
            var out = event.outputBuffer.getChannelData(0);
            var q = this.queue[0];
            this.queue.shift();
            out.set(q);
            _typedarrayPool2.default.freeFloat32(q);

            /*
            let outputBuffer = event.outputBuffer;
            let inputBuffer = event.inputBuffer;
              for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                let inputData = inputBuffer.getChannelData(channel);
                let outputData = outputBuffer.getChannelData(channel);
                this.shifter.process(this.shiftMultiplier, inputData.length, 4, inputData);
                for (let i = 0; i < outputData.length; ++i) {
                    outputData[i] = this.shifter.outdata[i];
                }
            } */
        }
    }]);

    return FrequencyShifter;
}();

},{"pitch-shift":32,"typedarray-pool":35}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
}();

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var RotatingImage = exports.RotatingImage = function () {
    function RotatingImage(img, centerX, centerY, canvas) {
        _classCallCheck(this, RotatingImage);

        this.angularLoc = 0;
        this.image = img;
        this.center = { "x": centerX, "y": centerY };
        this.canvas = canvas;
        this.isFirstTime = true;
        this.lastDrawTime = 0;
    }

    _createClass(RotatingImage, [{
        key: "updateImage",
        value: function updateImage(angularVelocity) {
            var offset = this.isFirstTime === true ? 0 : angularVelocity * ((Date.now() - this.lastDrawTime) / 1000);
            var rotation = this.angularLoc + offset;
            this.isFirstTime = false;
            this.canvas.ctx.save();
            this.canvas.ctx.translate(this.center.x, this.center.y);
            this.canvas.ctx.rotate(rotation);
            this.canvas.ctx.drawImage(this.image, -this.image.width / 2, -this.image.height / 2);
            this.canvas.ctx.restore();
            this.lastDrawTime = Date.now();
            this.angularLoc = rotation;
        }
    }]);

    return RotatingImage;
}();

},{}],40:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.RotatingTranslatedImage = undefined;

var _createClass = function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
}();

var _RotatingImage2 = require("./RotatingImage");

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

function _possibleConstructorReturn(self, call) {
    if (!self) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }return call && ((typeof call === "undefined" ? "undefined" : _typeof(call)) === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function, not " + (typeof superClass === "undefined" ? "undefined" : _typeof(superClass)));
    }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var RotatingTranslatedImage = exports.RotatingTranslatedImage = function (_RotatingImage) {
    _inherits(RotatingTranslatedImage, _RotatingImage);

    function RotatingTranslatedImage(img, centerX, centerY, canvas, radius) {
        _classCallCheck(this, RotatingTranslatedImage);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(RotatingTranslatedImage).call(this, img, centerX, centerY, canvas));

        _this.radius = radius;
        return _this;
    }

    _createClass(RotatingTranslatedImage, [{
        key: "updateImage",
        value: function updateImage(angularVelocity) {
            var offset = this.isFirstTime === true ? 0 : angularVelocity * ((Date.now() - this.lastDrawTime) / 1000);
            var rotation = this.angularLoc + offset;
            this.isFirstTime = false;
            this.lastDrawTime = Date.now();
            this.angularLoc = rotation;
            var positionX = this.radius * Math.cos(rotation) + this.center.x - 0.5 * this.image.width;
            var positionY = this.radius * Math.sin(rotation) + this.center.y - 0.5 * this.image.height;
            this.canvas.ctx.drawImage(this.image, positionX, positionY);
        }
    }]);

    return RotatingTranslatedImage;
}(_RotatingImage2.RotatingImage);

},{"./RotatingImage":39}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
}();

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var Vector = exports.Vector = function () {
    function Vector(x, y) {
        _classCallCheck(this, Vector);

        this.x = x;
        this.y = y;
    }

    _createClass(Vector, [{
        key: "magnitude",
        value: function magnitude() {
            return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
        }
    }, {
        key: "direction",
        value: function direction() {
            return Math.atan2(this.x, this.y);
        }
    }, {
        key: "dot",
        value: function dot(otherVec) {
            return otherVec.x * this.x + otherVec.y * this.y;
        }
    }, {
        key: "sub",
        value: function sub(otherVec) {
            return new Vector(this.x - otherVec.x, this.y - otherVec.y);
        }
    }, {
        key: "component",
        value: function component(otherVec) {
            return this.dot(otherVec) / otherVec.magnitude();
        }
    }]);

    return Vector;
}();

},{}],42:[function(require,module,exports){
"use strict";

var _createClass = function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
}();

var _AbstractCanvas = require("./AbstractCanvas");

var _RotatingImage = require("./RotatingImage");

var _Vector = require("./Vector");

var _DopplerShift = require("./DopplerShift");

var _RotatingTranslatedImage = require("./RotatingTranslatedImage");

var _FrequencyShifter = require("./FrequencyShifter");

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var SPEAKER_ANGULAR_VELOCITY = 1;
var SCALE = 0.01;

var Main = function () {
    function Main() {
        var _this = this;

        _classCallCheck(this, Main);

        this.mainCanvas = new _AbstractCanvas.AbstractCanvas("main-canvas");
        this.gradBase = 0;
        this.images = {
            "pinwheel": this.loadImage("img/pinwheel.png"),
            "backPinwheel": this.loadImage("img/BackPinwheel.png"),
            "rick": this.loadImage('img/rick.png'),
            "person": this.loadImage('img/person.png'),
            "speaker": this.loadImage('img/speaker.png')
        };

        this.images.pinwheel.onload = function () {
            _this.wheel = new _RotatingImage.RotatingImage(_this.images.pinwheel, _this.mainCanvas.width / 2, _this.mainCanvas.height / 2, _this.mainCanvas);
            _this.backWheel = new _RotatingImage.RotatingImage(_this.images.backPinwheel, _this.mainCanvas.width / 2, _this.mainCanvas.height / 2, _this.mainCanvas);
            _this.speaker = new _RotatingTranslatedImage.RotatingTranslatedImage(_this.images.speaker, _this.mainCanvas.width / 2, _this.mainCanvas.height / 2, _this.mainCanvas, _this.images.backPinwheel.width / 2 - 46);
            _this.obs = new _RotatingTranslatedImage.RotatingTranslatedImage(_this.images.person, _this.mainCanvas.width / 2, _this.mainCanvas.height / 2, _this.mainCanvas, _this.images.pinwheel.width / 2 - 50);
            document.getElementById("tone-button").onclick = function () {
                return _this.setOutputTypeTone();
            };
            document.getElementById("mp3-button").onclick = function () {
                return _this.setOutputTypeMp3();
            };

            _this.konami = new Konami(function () {
                return _this.rickroll();
            });

            _this.rickrolled = false;

            _this.shifter = undefined;

            window.requestAnimationFrame(function () {
                return _this.render();
            });
        };
    }

    _createClass(Main, [{
        key: "rickroll",
        value: function rickroll() {
            this.rickrolled = true;
            this.speaker.image = this.images.rick;
            this.createMusicNodeAndShifter("https://ia800805.us.archive.org/27/items/NeverGonnaGiveYouUp/jocofullinterview41.mp3");
        }
    }, {
        key: "loadImage",
        value: function loadImage(url) {
            var img = void 0;
            img = new Image();
            img.src = url;
            return img;
        }
    }, {
        key: "render",
        value: function render() {
            var _this2 = this;

            this.mainCanvas.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
            this.backWheel.updateImage(this.getSpeakerAngularVelocity());
            this.wheel.updateImage(this.getObserverAngularVelocity());
            this.obs.updateImage(this.getObserverAngularVelocity());
            this.speaker.updateImage(this.getSpeakerAngularVelocity());
            if (this.inputNode && this.inputNode.frequency) {
                this.inputNode.frequency.value = this.getFrequency();
            }
            if (this.shifter) {
                this.shifter.setShift(this.dopplerScale());
            }
            window.requestAnimationFrame(function () {
                return _this2.render();
            });
        }
    }, {
        key: "setOutputTypeTone",
        value: function setOutputTypeTone() {
            if (!this.rickrolled) {
                if (this.shifter) {
                    this.shifter.stop();
                }
                var context = new AudioContext();
                this.inputNode = context.createOscillator();
                this.inputNode.frequency.value = this.getFrequency();
                this.inputNode.start();
                this.shifter = new _FrequencyShifter.FrequencyShifter(context, this.inputNode, context.destination);
                this.audio = undefined;
            }
        }
    }, {
        key: "setOutputTypeMp3",
        value: function setOutputTypeMp3() {
            if (!this.rickrolled) {
                this.createMusicNodeAndShifter(this.getMp3Url());
            }
        }
    }, {
        key: "createMusicNodeAndShifter",
        value: function createMusicNodeAndShifter(url) {
            var _this3 = this;

            if (this.shifter) {
                this.shifter.stop();
            }
            var context = new AudioContext();
            this.audio = new Audio(url);
            this.audio.onerror = function () {
                _this3.setOutputTypeTone();
            };
            this.audio.crossOrigin = "anonymous";
            this.audio.autoplay = true;
            this.audio.loop = true;
            this.audio.play();
            this.inputNode = context.createMediaElementSource(this.audio);
            this.shifter = new _FrequencyShifter.FrequencyShifter(context, this.inputNode, context.destination);
        }
    }, {
        key: "getSpeakerAngularVelocity",
        value: function getSpeakerAngularVelocity() {
            return SPEAKER_ANGULAR_VELOCITY * +document.getElementById("speaker-velocity").value;
        }
    }, {
        key: "getObserverAngularVelocity",
        value: function getObserverAngularVelocity() {
            return SPEAKER_ANGULAR_VELOCITY * +document.getElementById("observer-velocity").value;
        }
    }, {
        key: "getMp3Url",
        value: function getMp3Url() {
            return document.getElementById("url-text").value;
        }
    }, {
        key: "getFrequency",
        value: function getFrequency() {
            return +document.getElementById("origin-frequency").value;
        }
    }, {
        key: "dopplerScale",
        value: function dopplerScale() {
            var startX = this.images.pinwheel.width / 2 * Math.cos(this.wheel.angularLoc);
            var startY = this.images.pinwheel.height / 2 * Math.sin(this.wheel.angularLoc);
            var speakerVelocity = this.getSpeakerAngularVelocity() * this.mainCanvas.width / 2;
            var speakerVel = new _Vector.Vector(speakerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2), speakerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
            var observerVelocity = this.getObserverAngularVelocity() * this.mainCanvas.width / 2;
            var observerVel = new _Vector.Vector(observerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2), observerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
            var observerVec = new _Vector.Vector(Math.cos(this.obs.angularLoc) * this.obs.radius + this.mainCanvas.width / 2, Math.sin(this.obs.angularLoc) * this.obs.radius + this.mainCanvas.height / 2);
            var speakerVec = new _Vector.Vector(Math.cos(this.speaker.angularLoc) * this.speaker.radius + this.mainCanvas.width / 2, Math.sin(this.speaker.angularLoc) * this.speaker.radius + this.mainCanvas.height / 2);
            var posVec = observerVec.sub(speakerVec);
            var posVec2 = speakerVec.sub(observerVec);
            return (0, _DopplerShift.dopplerShift)(observerVel.component(posVec2) * SCALE, speakerVel.component(posVec) * SCALE, 343);
        }
    }]);

    return Main;
}();

new Main();

},{"./AbstractCanvas":36,"./DopplerShift":37,"./FrequencyShifter":38,"./RotatingImage":39,"./RotatingTranslatedImage":40,"./Vector":41}]},{},[42])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJyb3dzZXJpZnktcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9kZXRlY3QtcGl0Y2gvbm9kZV9tb2R1bGVzL2JpdC10d2lkZGxlL3R3aWRkbGUuanMiLCJub2RlX21vZHVsZXMvcGl0Y2gtc2hpZnQvbm9kZV9tb2R1bGVzL2RldGVjdC1waXRjaC9ub2RlX21vZHVsZXMvbmRhcnJheS1mZnQvZmZ0LmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9kZXRlY3QtcGl0Y2gvbm9kZV9tb2R1bGVzL25kYXJyYXktZmZ0L2xpYi9mZnQtbWF0cml4LmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9kZXRlY3QtcGl0Y2gvbm9kZV9tb2R1bGVzL25kYXJyYXktZmZ0L25vZGVfbW9kdWxlcy9jd2lzZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL25vZGVfbW9kdWxlcy9uZGFycmF5LWZmdC9ub2RlX21vZHVsZXMvY3dpc2UvbGliL2dlbmVyYXRlLmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9kZXRlY3QtcGl0Y2gvbm9kZV9tb2R1bGVzL25kYXJyYXktZmZ0L25vZGVfbW9kdWxlcy9jd2lzZS9saWIvcGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9kZXRlY3QtcGl0Y2gvbm9kZV9tb2R1bGVzL25kYXJyYXktZmZ0L25vZGVfbW9kdWxlcy9jd2lzZS9saWIvc2hpbS5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL25vZGVfbW9kdWxlcy9uZGFycmF5LWZmdC9ub2RlX21vZHVsZXMvY3dpc2Uvbm9kZV9tb2R1bGVzL2ZhbGFmZWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcGl0Y2gtc2hpZnQvbm9kZV9tb2R1bGVzL2RldGVjdC1waXRjaC9ub2RlX21vZHVsZXMvbmRhcnJheS1mZnQvbm9kZV9tb2R1bGVzL2N3aXNlL25vZGVfbW9kdWxlcy9mYWxhZmVsL25vZGVfbW9kdWxlcy9lc3ByaW1hL2VzcHJpbWEuanMiLCJub2RlX21vZHVsZXMvcGl0Y2gtc2hpZnQvbm9kZV9tb2R1bGVzL2RldGVjdC1waXRjaC9ub2RlX21vZHVsZXMvbmRhcnJheS1mZnQvbm9kZV9tb2R1bGVzL3R5cGVkYXJyYXktcG9vbC9ub2RlX21vZHVsZXMvZHVwL2R1cC5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL25vZGVfbW9kdWxlcy9uZGFycmF5LWZmdC9ub2RlX21vZHVsZXMvdHlwZWRhcnJheS1wb29sL3Bvb2wuanMiLCJub2RlX21vZHVsZXMvcGl0Y2gtc2hpZnQvbm9kZV9tb2R1bGVzL2RldGVjdC1waXRjaC9ub2RlX21vZHVsZXMvbmRhcnJheS1vcHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcGl0Y2gtc2hpZnQvbm9kZV9tb2R1bGVzL2RldGVjdC1waXRjaC9ub2RlX21vZHVsZXMvbmRhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL25vZGVfbW9kdWxlcy9uZGFycmF5L2xpYi90b29scy5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL25vZGVfbW9kdWxlcy9uZGFycmF5L2xpYi92aWV3bi5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9ub2RlX21vZHVsZXMvZGV0ZWN0LXBpdGNoL3BpdGNoLmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9mcmFtZS1ob3AvaG9wLmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy9vdmVybGFwLWFkZC9vdmVybGFwLmpzIiwibm9kZV9tb2R1bGVzL3BpdGNoLXNoaWZ0L25vZGVfbW9kdWxlcy90eXBlZGFycmF5LXBvb2wvcG9vbC5qcyIsIm5vZGVfbW9kdWxlcy9waXRjaC1zaGlmdC9waXRjaHNoaWZ0LmpzIiwibm9kZV9tb2R1bGVzL3R5cGVkYXJyYXktcG9vbC9wb29sLmpzIiwic3JjXFxBYnN0cmFjdENhbnZhcy5qcyIsInNyY1xcRG9wcGxlclNoaWZ0LmpzIiwic3JjXFxGcmVxdWVuY3lTaGlmdGVyLmpzIiwic3JjXFxSb3RhdGluZ0ltYWdlLmpzIiwic3JjXFxSb3RhdGluZ1RyYW5zbGF0ZWRJbWFnZS5qcyIsInNyY1xcVmVjdG9yLmpzIiwic3JjXFxtYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9xREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3AwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7OztBQ2xhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDelJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7OztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7OztJLEFDcE5hLHlCLEFBQUEsaUJBQ1Qsd0JBQUEsQUFBWSxZQUFZOzBCQUNwQjs7U0FBQSxBQUFLLFNBQVMsU0FBQSxBQUFTLGVBQXZCLEFBQWMsQUFBd0IsQUFDdEM7U0FBQSxBQUFLLE1BQU0sS0FBQSxBQUFLLE9BQUwsQUFBWSxXQUF2QixBQUFXLEFBQXVCLEFBQ2xDO1NBQUEsQUFBSyxRQUFRLEtBQUEsQUFBSyxPQUFsQixBQUF5QixBQUN6QjtTQUFBLEFBQUssU0FBUyxLQUFBLEFBQUssT0FBbkIsQUFBMEIsQUFDN0I7QTs7Ozs7Ozs7USxBQ05XLGUsQUFBQTtBQUFULFNBQUEsQUFBUyxhQUFULEFBQXNCLFNBQXRCLEFBQStCLFNBQS9CLEFBQXdDLFFBQVEsQUFDbkQ7UUFBSSxVQUFVLENBQUMsU0FBRCxBQUFVLFlBQVksU0FBcEMsQUFBYyxBQUErQixBQUM3QztXQUFBLEFBQU8sQUFDVjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDSkQ7Ozs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7QUFFQSxJQUFNLGFBQU4sQUFBbUI7O0ksQUFFTiwyQixBQUFBLCtCQUNUOzhCQUFBLEFBQVksU0FBWixBQUFxQixXQUFyQixBQUFnQyxZQUFZO29CQUFBOzs4QkFDeEM7O2FBQUEsQUFBSyxlQUFMLEFBQW9CLEFBQ3BCO2FBQUEsQUFBSyxnQkFBZ0IsS0FBQSxBQUFLLGFBQUwsQUFBa0Isc0JBQWxCLEFBQXdDLFlBQXhDLEFBQW9ELEdBQXpFLEFBQXFCLEFBQXVELEFBRTVFOzthQUFBLEFBQUssUUFBTCxBQUFhLEFBQ2I7YUFBQSxBQUFLLG9DQUF5QixVQUFBLEFBQUMsTUFBRDttQkFBVSxNQUFBLEFBQUssUUFBZixBQUFVLEFBQWE7QUFBdEMsU0FBQSxFQUE2QyxZQUFBO21CQUFNLE1BQU4sQUFBTSxBQUFLO0FBQXhEO3VCQUFmLEFBQWUsQUFBb0UsQUFDaEUsQUFHbkI7QUFKbUYsQUFDM0U7O2FBR1IsQUFBSyxRQUFRLElBQUEsQUFBSSxhQUFqQixBQUFhLEFBQWlCLEFBQzlCO2FBQUEsQUFBSyxRQUFRLElBQUEsQUFBSSxhQUFqQixBQUFhLEFBQWlCLEFBQzlCO2FBQUEsQUFBSyxRQUFRLElBQUEsQUFBSSxhQUFqQixBQUFhLEFBQWlCLEFBQzlCO2FBQUEsQUFBSyxRQUFRLElBQUEsQUFBSSxhQUFqQixBQUFhLEFBQWlCLEFBQzlCO2FBQUEsQUFBSyxRQUFRLElBQUEsQUFBSSxhQUFqQixBQUFhLEFBQWlCLEFBQzlCO2FBQUEsQUFBSyxjQUFMLEFBQW1CLGlCQUFrQixVQUFBLEFBQUMsT0FBRDttQkFBVyxNQUFBLEFBQUssYUFBaEIsQUFBVyxBQUFrQjtBQUFsRSxBQUNBO2FBQUEsQUFBSyxrQkFBTCxBQUF1QixBQUN2QjtrQkFBQSxBQUFVLFFBQVEsS0FBbEIsQUFBdUIsQUFDdkI7YUFBQSxBQUFLLGNBQUwsQUFBbUIsUUFBbkIsQUFBMkIsQUFDM0I7YUFBQSxBQUFLLFlBQUwsQUFBaUIsQUFDcEI7Ozs7O2dDLEFBRU8sTUFBTSxBQUNWO2dCQUFJLE1BQU0seUJBQUEsQUFBSyxjQUFjLEtBQTdCLEFBQVUsQUFBd0IsQUFDbEM7Z0JBQUEsQUFBSSxJQUFKLEFBQVEsQUFDUjtpQkFBQSxBQUFLLE1BQUwsQUFBVyxLQUFYLEFBQWdCLEFBQ25COzs7O2lDLEFBRVEsS0FBSyxBQUNWO2lCQUFBLEFBQUssa0JBQUwsQUFBdUIsQUFDMUI7Ozs7bUNBRVUsQUFDUDttQkFBTyxLQUFBLEFBQUssbUJBQVosQUFBK0IsQUFDbEM7Ozs7K0JBRU0sQUFDSDtpQkFBQSxBQUFLLGNBQUwsQUFBbUIsQUFDbkI7aUJBQUEsQUFBSyxVQUFMLEFBQWUsQUFDZjtpQkFBQSxBQUFLLGFBQUwsQUFBa0IsQUFDckI7Ozs7cUMsQUFFWSxPQUFPLEFBQ2hCO2lCQUFBLEFBQUssUUFBUSxNQUFBLEFBQU0sWUFBTixBQUFrQixlQUEvQixBQUFhLEFBQWlDLEFBQzlDO2dCQUFJLE1BQU0sTUFBQSxBQUFNLGFBQU4sQUFBbUIsZUFBN0IsQUFBVSxBQUFrQyxBQUM1QztnQkFBSSxJQUFJLEtBQUEsQUFBSyxNQUFiLEFBQVEsQUFBVyxBQUNuQjtpQkFBQSxBQUFLLE1BQUwsQUFBVyxBQUNYO2dCQUFBLEFBQUksSUFBSixBQUFRLEFBQ1I7cUNBQUEsQUFBSyxZQUFMLEFBQWlCLEFBY3BCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SSxBQ25FUSx3QixBQUFBLDRCQUVUOzJCQUFBLEFBQVksS0FBWixBQUFpQixTQUFqQixBQUEwQixTQUExQixBQUFtQyxRQUFPOzhCQUN0Qzs7YUFBQSxBQUFLLGFBQUwsQUFBa0IsQUFDbEI7YUFBQSxBQUFLLFFBQUwsQUFBYSxBQUNiO2FBQUEsQUFBSyxTQUFTLEVBQUMsS0FBRCxBQUFNLFNBQVMsS0FBN0IsQUFBYyxBQUFvQixBQUNsQzthQUFBLEFBQUssU0FBTCxBQUFjLEFBQ2Q7YUFBQSxBQUFLLGNBQUwsQUFBbUIsQUFDbkI7YUFBQSxBQUFLLGVBQUwsQUFBb0IsQUFDdkI7Ozs7O29DLEFBRVcsaUJBQWlCLEFBQ3pCO2dCQUFJLFNBQVUsS0FBQSxBQUFLLGdCQUFOLEFBQXNCLE9BQXRCLEFBQThCLElBQUssbUJBQW1CLENBQUMsS0FBQSxBQUFLLFFBQVEsS0FBZCxBQUFtQixnQkFBdEYsQUFBZ0QsQUFBc0QsQUFDdEc7Z0JBQUksV0FBVyxLQUFBLEFBQUssYUFBcEIsQUFBaUMsQUFDakM7aUJBQUEsQUFBSyxjQUFMLEFBQW1CLEFBQ25CO2lCQUFBLEFBQUssT0FBTCxBQUFZLElBQVosQUFBZ0IsQUFDaEI7aUJBQUEsQUFBSyxPQUFMLEFBQVksSUFBWixBQUFnQixVQUFVLEtBQUEsQUFBSyxPQUEvQixBQUFzQyxHQUFHLEtBQUEsQUFBSyxPQUE5QyxBQUFxRCxBQUNyRDtpQkFBQSxBQUFLLE9BQUwsQUFBWSxJQUFaLEFBQWdCLE9BQWhCLEFBQXVCLEFBQ3ZCO2lCQUFBLEFBQUssT0FBTCxBQUFZLElBQVosQUFBZ0IsVUFBVSxLQUExQixBQUErQixPQUFPLENBQUMsS0FBQSxBQUFLLE1BQU4sQUFBWSxRQUFsRCxBQUEwRCxHQUFHLENBQUMsS0FBQSxBQUFLLE1BQU4sQUFBWSxTQUF6RSxBQUFrRixBQUNsRjtpQkFBQSxBQUFLLE9BQUwsQUFBWSxJQUFaLEFBQWdCLEFBQ2hCO2lCQUFBLEFBQUssZUFBZSxLQUFwQixBQUFvQixBQUFLLEFBQ3pCO2lCQUFBLEFBQUssYUFBTCxBQUFrQixBQUNyQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdEJMOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJLEFBRWEsa0MsQUFBQTt1Q0FFVDs7cUNBQUEsQUFBWSxLQUFaLEFBQWlCLFNBQWpCLEFBQTBCLFNBQTFCLEFBQW1DLFFBQW5DLEFBQTJDLFFBQVE7OEJBQUE7OytHQUFBLEFBQ3pDLEtBRHlDLEFBQ3BDLFNBRG9DLEFBQzNCLFNBRDJCLEFBQ2xCLEFBQzdCOztjQUFBLEFBQUssU0FGMEMsQUFFL0MsQUFBYztlQUNqQjs7Ozs7b0MsQUFFVyxpQkFBaUIsQUFDekI7Z0JBQUksU0FBVSxLQUFBLEFBQUssZ0JBQU4sQUFBc0IsT0FBdEIsQUFBOEIsSUFBSyxtQkFBbUIsQ0FBQyxLQUFBLEFBQUssUUFBUSxLQUFkLEFBQW1CLGdCQUF0RixBQUFnRCxBQUFzRCxBQUN0RztnQkFBSSxXQUFXLEtBQUEsQUFBSyxhQUFwQixBQUFpQyxBQUNqQztpQkFBQSxBQUFLLGNBQUwsQUFBbUIsQUFDbkI7aUJBQUEsQUFBSyxlQUFlLEtBQXBCLEFBQW9CLEFBQUssQUFDekI7aUJBQUEsQUFBSyxhQUFMLEFBQWtCLEFBQ2xCO2dCQUFJLFlBQVksS0FBQSxBQUFLLFNBQVMsS0FBQSxBQUFLLElBQW5CLEFBQWMsQUFBUyxZQUFZLEtBQUEsQUFBSyxPQUF4QyxBQUErQyxJQUFLLE1BQU0sS0FBQSxBQUFLLE1BQS9FLEFBQXFGLEFBQ3JGO2dCQUFJLFlBQVksS0FBQSxBQUFLLFNBQVMsS0FBQSxBQUFLLElBQW5CLEFBQWMsQUFBUyxZQUFZLEtBQUEsQUFBSyxPQUF4QyxBQUErQyxJQUFLLE1BQU0sS0FBQSxBQUFLLE1BQS9FLEFBQXFGLEFBQ3JGO2lCQUFBLEFBQUssT0FBTCxBQUFZLElBQVosQUFBZ0IsVUFBVSxLQUExQixBQUErQixPQUEvQixBQUFzQyxXQUF0QyxBQUFpRCxBQUVwRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0ksQUNsQlEsaUIsQUFBQSxxQkFFVDtvQkFBQSxBQUFZLEdBQVosQUFBZSxHQUFFOzhCQUNiOzthQUFBLEFBQUssSUFBTCxBQUFTLEFBQ1Q7YUFBQSxBQUFLLElBQUwsQUFBUyxBQUVaOzs7OztvQ0FFVyxBQUNSO21CQUFPLEtBQUEsQUFBSyxLQUFLLEtBQUEsQUFBSyxJQUFJLEtBQVQsQUFBYyxHQUFkLEFBQWlCLEtBQUssS0FBQSxBQUFLLElBQUksS0FBVCxBQUFjLEdBQXJELEFBQU8sQUFBZ0MsQUFBaUIsQUFDM0Q7Ozs7b0NBRVUsQUFDUDttQkFBTyxLQUFBLEFBQUssTUFBTSxLQUFYLEFBQWdCLEdBQUcsS0FBMUIsQUFBTyxBQUF3QixBQUNsQzs7Ozs0QixBQUVHLFVBQVUsQUFDVjttQkFBUSxTQUFBLEFBQVMsSUFBSSxLQUFkLEFBQW1CLElBQU0sU0FBQSxBQUFTLElBQUksS0FBN0MsQUFBa0QsQUFDckQ7Ozs7NEIsQUFFRyxVQUFVLEFBQ1Y7bUJBQU8sSUFBQSxBQUFJLE9BQU8sS0FBQSxBQUFLLElBQUksU0FBcEIsQUFBNkIsR0FBRyxLQUFBLEFBQUssSUFBSSxTQUFoRCxBQUFPLEFBQWtELEFBQzVEOzs7O2tDLEFBRVMsVUFBVSxBQUNoQjttQkFBUSxLQUFBLEFBQUssSUFBTCxBQUFTLFlBQVksU0FBN0IsQUFBNkIsQUFBUyxBQUN6Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUMzQkw7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7Ozs7O0FBRUEsSUFBTSwyQkFBTixBQUFpQztBQUNqQyxJQUFNLFFBQU4sQUFBYzs7SSxBQUVSLG1CQUNGO29CQUFjO29CQUFBOzs4QkFDVjs7YUFBQSxBQUFLLGFBQWEsbUNBQWxCLEFBQWtCLEFBQW1CLEFBQ3JDO2FBQUEsQUFBSyxXQUFMLEFBQWdCLEFBQ2hCO2FBQUEsQUFBSzt3QkFDVyxLQUFBLEFBQUssVUFEUCxBQUNFLEFBQWUsQUFDM0I7NEJBQWdCLEtBQUEsQUFBSyxVQUZYLEFBRU0sQUFBZSxBQUMvQjtvQkFBUSxLQUFBLEFBQUssVUFISCxBQUdGLEFBQWUsQUFDdkI7c0JBQVUsS0FBQSxBQUFLLFVBSkwsQUFJQSxBQUFlLEFBQ3pCO3VCQUFXLEtBQUEsQUFBSyxVQUxwQixBQUFjLEFBS0MsQUFBZSxBQUk5QjtBQVRjLEFBQ1Y7O2FBUUosQUFBSyxPQUFMLEFBQVksU0FBWixBQUFxQixTQUFTLFlBQU0sQUFDaEM7a0JBQUEsQUFBSyxRQUFRLGlDQUFrQixNQUFBLEFBQUssT0FBdkIsQUFBOEIsVUFDdkMsTUFBQSxBQUFLLFdBQUwsQUFBZ0IsUUFEUCxBQUNlLEdBQUcsTUFBQSxBQUFLLFdBQUwsQUFBZ0IsU0FEbEMsQUFDMkMsR0FBRyxNQUQzRCxBQUFhLEFBQ21ELEFBQ2hFO2tCQUFBLEFBQUssWUFBWSxpQ0FBa0IsTUFBQSxBQUFLLE9BQXZCLEFBQThCLGNBQzNDLE1BQUEsQUFBSyxXQUFMLEFBQWdCLFFBREgsQUFDVyxHQUFHLE1BQUEsQUFBSyxXQUFMLEFBQWdCLFNBRDlCLEFBQ3VDLEdBQUcsTUFEM0QsQUFBaUIsQUFDK0MsQUFDaEU7a0JBQUEsQUFBSyxVQUFVLHFEQUE0QixNQUFBLEFBQUssT0FBakMsQUFBd0MsU0FDbkQsTUFBQSxBQUFLLFdBQUwsQUFBZ0IsUUFETCxBQUNhLEdBQUcsTUFBQSxBQUFLLFdBQUwsQUFBZ0IsU0FEaEMsQUFDeUMsR0FDcEQsTUFGVyxBQUVOLFlBQWEsTUFBQSxBQUFLLE9BQUwsQUFBWSxhQUFaLEFBQXlCLFFBQTFCLEFBQWtDLElBRnZELEFBQWUsQUFFNkMsQUFDNUQ7a0JBQUEsQUFBSyxNQUFNLHFEQUE0QixNQUFBLEFBQUssT0FBakMsQUFBd0MsUUFDL0MsTUFBQSxBQUFLLFdBQUwsQUFBZ0IsUUFEVCxBQUNpQixHQUFHLE1BQUEsQUFBSyxXQUFMLEFBQWdCLFNBRHBDLEFBQzZDLEdBQ3BELE1BRk8sQUFFRixZQUFhLE1BQUEsQUFBSyxPQUFMLEFBQVksU0FBWixBQUFxQixRQUF0QixBQUE4QixJQUZuRCxBQUFXLEFBRTZDLEFBQ3hEO3FCQUFBLEFBQVMsZUFBVCxBQUF3QixlQUF4QixBQUF1QyxVQUFVLFlBQUE7dUJBQU0sTUFBTixBQUFNLEFBQUs7QUFBNUQsQUFDQTtxQkFBQSxBQUFTLGVBQVQsQUFBd0IsY0FBeEIsQUFBc0MsVUFBVSxZQUFBO3VCQUFNLE1BQU4sQUFBTSxBQUFLO0FBQTNELEFBRUE7O2tCQUFBLEFBQUssYUFBUyxBQUFJLE9BQU8sWUFBQTt1QkFBTSxNQUFOLEFBQU0sQUFBSztBQUFwQyxBQUFjLEFBRWQsYUFGYzs7a0JBRWQsQUFBSyxhQUFMLEFBQWtCLEFBRWxCOztrQkFBQSxBQUFLLFVBQUwsQUFBZSxBQUVmOzttQkFBQSxBQUFPLHNCQUFzQixZQUFBO3VCQUFNLE1BQU4sQUFBTSxBQUFLO0FBQXhDLEFBQ0g7QUFyQkQsQUFzQkg7Ozs7O21DQUVVLEFBQ1A7aUJBQUEsQUFBSyxhQUFMLEFBQWtCLEFBQ2xCO2lCQUFBLEFBQUssUUFBTCxBQUFhLFFBQVEsS0FBQSxBQUFLLE9BQTFCLEFBQWlDLEFBQ2pDO2lCQUFBLEFBQUssMEJBQUwsQUFBK0IsQUFDbEM7Ozs7a0MsQUFFUyxLQUFLLEFBQ1A7Z0JBQUksV0FBSixBQUNBO2tCQUFNLElBQU4sQUFBTSxBQUFJLEFBQ1Y7Z0JBQUEsQUFBSSxNQUFKLEFBQVUsQUFDVjttQkFBQSxBQUFPLEFBQ2Q7Ozs7aUNBRVE7eUJBQ0w7O2lCQUFBLEFBQUssV0FBTCxBQUFnQixJQUFoQixBQUFvQixVQUFwQixBQUE4QixHQUE5QixBQUFpQyxHQUFHLEtBQUEsQUFBSyxXQUF6QyxBQUFvRCxPQUFPLEtBQUEsQUFBSyxXQUFoRSxBQUEyRSxBQUMzRTtpQkFBQSxBQUFLLFVBQUwsQUFBZSxZQUFZLEtBQTNCLEFBQTJCLEFBQUssQUFDaEM7aUJBQUEsQUFBSyxNQUFMLEFBQVcsWUFBWSxLQUF2QixBQUF1QixBQUFLLEFBQzVCO2lCQUFBLEFBQUssSUFBTCxBQUFTLFlBQVksS0FBckIsQUFBcUIsQUFBSyxBQUMxQjtpQkFBQSxBQUFLLFFBQUwsQUFBYSxZQUFZLEtBQXpCLEFBQXlCLEFBQUssQUFDOUI7Z0JBQUksS0FBQSxBQUFLLGFBQWEsS0FBQSxBQUFLLFVBQTNCLEFBQXFDLFdBQVcsQUFDNUM7cUJBQUEsQUFBSyxVQUFMLEFBQWUsVUFBZixBQUF5QixRQUFRLEtBQWpDLEFBQWlDLEFBQUssQUFDekM7QUFDRDtnQkFBSSxLQUFKLEFBQVMsU0FBUyxBQUNkO3FCQUFBLEFBQUssUUFBTCxBQUFhLFNBQVMsS0FBdEIsQUFBc0IsQUFBSyxBQUM5QjtBQUNEO21CQUFBLEFBQU8sc0JBQXNCLFlBQUE7dUJBQU0sT0FBTixBQUFNLEFBQUs7QUFBeEMsQUFDSDs7Ozs0Q0FFbUIsQUFDaEI7Z0JBQUksQ0FBQyxLQUFMLEFBQVUsWUFBWSxBQUNsQjtvQkFBSSxLQUFKLEFBQVMsU0FBUyxBQUNkO3lCQUFBLEFBQUssUUFBTCxBQUFhLEFBQ2hCO0FBQ0Q7b0JBQUksVUFBVSxJQUFkLEFBQWMsQUFBSSxBQUNsQjtxQkFBQSxBQUFLLFlBQVksUUFBakIsQUFBaUIsQUFBUSxBQUN6QjtxQkFBQSxBQUFLLFVBQUwsQUFBZSxVQUFmLEFBQXlCLFFBQVEsS0FBakMsQUFBaUMsQUFBSyxBQUN0QztxQkFBQSxBQUFLLFVBQUwsQUFBZSxBQUNmO3FCQUFBLEFBQUssVUFBVSx1Q0FBQSxBQUFxQixTQUFTLEtBQTlCLEFBQW1DLFdBQVcsUUFBN0QsQUFBZSxBQUFzRCxBQUNyRTtxQkFBQSxBQUFLLFFBQUwsQUFBYSxBQUNoQjtBQUNKOzs7OzJDQUVrQixBQUNmO2dCQUFJLENBQUMsS0FBTCxBQUFVLFlBQVksQUFDbEI7cUJBQUEsQUFBSywwQkFBMEIsS0FBL0IsQUFBK0IsQUFBSyxBQUN2QztBQUNKOzs7O2tELEFBRXlCLEtBQUs7eUJBQzNCOztnQkFBSSxLQUFKLEFBQVMsU0FBUyxBQUNkO3FCQUFBLEFBQUssUUFBTCxBQUFhLEFBQ2hCO0FBQ0Q7Z0JBQUksVUFBVSxJQUFkLEFBQWMsQUFBSSxBQUNsQjtpQkFBQSxBQUFLLFFBQVEsSUFBQSxBQUFJLE1BQWpCLEFBQWEsQUFBVSxBQUN2QjtpQkFBQSxBQUFLLE1BQUwsQUFBVyxVQUFVLFlBQU0sQUFDdkI7dUJBQUEsQUFBSyxBQUNSO0FBRkQsQUFHQTtpQkFBQSxBQUFLLE1BQUwsQUFBVyxjQUFYLEFBQXlCLEFBQ3pCO2lCQUFBLEFBQUssTUFBTCxBQUFXLFdBQVgsQUFBc0IsQUFDdEI7aUJBQUEsQUFBSyxNQUFMLEFBQVcsT0FBWCxBQUFrQixBQUNsQjtpQkFBQSxBQUFLLE1BQUwsQUFBVyxBQUNYO2lCQUFBLEFBQUssWUFBWSxRQUFBLEFBQVEseUJBQXlCLEtBQWxELEFBQWlCLEFBQXNDLEFBQ3ZEO2lCQUFBLEFBQUssVUFBVSx1Q0FBQSxBQUFxQixTQUFTLEtBQTlCLEFBQW1DLFdBQVcsUUFBN0QsQUFBZSxBQUFzRCxBQUN4RTs7OztvREFFMkIsQUFDeEI7bUJBQU8sMkJBQTRCLENBQUMsU0FBQSxBQUFTLGVBQVQsQUFBd0Isb0JBQTVELEFBQWdGLEFBQ25GOzs7O3FEQUU0QixBQUN6QjttQkFBTywyQkFBNEIsQ0FBQyxTQUFBLEFBQVMsZUFBVCxBQUF3QixxQkFBNUQsQUFBaUYsQUFDcEY7Ozs7b0NBRVcsQUFDUjttQkFBTyxTQUFBLEFBQVMsZUFBVCxBQUF3QixZQUEvQixBQUEyQyxBQUM5Qzs7Ozt1Q0FFYyxBQUNYO21CQUFRLENBQUMsU0FBQSxBQUFTLGVBQVQsQUFBd0Isb0JBQWpDLEFBQXFELEFBQ3hEOzs7O3VDQUVjLEFBQ1g7Z0JBQUksU0FBVSxLQUFBLEFBQUssT0FBTCxBQUFZLFNBQVosQUFBcUIsUUFBdEIsQUFBOEIsSUFBSyxLQUFBLEFBQUssSUFBSSxLQUFBLEFBQUssTUFBOUQsQUFBZ0QsQUFBb0IsQUFDcEU7Z0JBQUksU0FBVSxLQUFBLEFBQUssT0FBTCxBQUFZLFNBQVosQUFBcUIsU0FBdEIsQUFBK0IsSUFBSyxLQUFBLEFBQUssSUFBSSxLQUFBLEFBQUssTUFBL0QsQUFBaUQsQUFBb0IsQUFDckU7Z0JBQUksa0JBQWtCLEtBQUEsQUFBSyw4QkFBOEIsS0FBQSxBQUFLLFdBQXhDLEFBQW1ELFFBQXpFLEFBQWlGLEFBQ2pGO2dCQUFJLGFBQWEsbUJBQVcsa0JBQWtCLEtBQUEsQUFBSyxJQUFJLEtBQUEsQUFBSyxNQUFMLEFBQVcsYUFBYSxLQUFBLEFBQUssS0FBbkUsQUFBNkIsQUFBMkMsSUFDckYsa0JBQWtCLEtBQUEsQUFBSyxJQUFJLEtBQUEsQUFBSyxNQUFMLEFBQVcsYUFBYSxLQUFBLEFBQUssS0FENUQsQUFBaUIsQUFDSyxBQUEyQyxBQUNqRTtnQkFBSSxtQkFBbUIsS0FBQSxBQUFLLCtCQUErQixLQUFBLEFBQUssV0FBekMsQUFBb0QsUUFBM0UsQUFBbUYsQUFDbkY7Z0JBQUksY0FBYyxtQkFBVyxtQkFBbUIsS0FBQSxBQUFLLElBQUksS0FBQSxBQUFLLE1BQUwsQUFBVyxhQUFhLEtBQUEsQUFBSyxLQUFwRSxBQUE4QixBQUEyQyxJQUN2RixtQkFBbUIsS0FBQSxBQUFLLElBQUksS0FBQSxBQUFLLE1BQUwsQUFBVyxhQUFhLEtBQUEsQUFBSyxLQUQ3RCxBQUFrQixBQUNLLEFBQTJDLEFBQ2xFO2dCQUFJLGNBQWMsbUJBQVksS0FBQSxBQUFLLElBQUksS0FBQSxBQUFLLElBQWQsQUFBa0IsY0FBYyxLQUFBLEFBQUssSUFBdEMsQUFBMEMsU0FBVyxLQUFBLEFBQUssV0FBTCxBQUFnQixRQUFoRixBQUF3RixHQUFLLEtBQUEsQUFBSyxJQUFJLEtBQUEsQUFBSyxJQUFkLEFBQWtCLGNBQWMsS0FBQSxBQUFLLElBQXRDLEFBQTBDLFNBQVcsS0FBQSxBQUFLLFdBQUwsQUFBZ0IsU0FBbkwsQUFBa0IsQUFBMEssQUFDNUw7Z0JBQUksYUFBYSxtQkFBWSxLQUFBLEFBQUssSUFBSSxLQUFBLEFBQUssUUFBZCxBQUFzQixjQUFjLEtBQUEsQUFBSyxRQUExQyxBQUFrRCxTQUFXLEtBQUEsQUFBSyxXQUFMLEFBQWdCLFFBQXhGLEFBQWdHLEdBQUssS0FBQSxBQUFLLElBQUksS0FBQSxBQUFLLFFBQWQsQUFBc0IsY0FBYyxLQUFBLEFBQUssUUFBMUMsQUFBa0QsU0FBVyxLQUFBLEFBQUssV0FBTCxBQUFnQixTQUFsTSxBQUFpQixBQUEwTCxBQUMzTTtnQkFBSSxTQUFTLFlBQUEsQUFBWSxJQUF6QixBQUFhLEFBQWdCLEFBQzdCO2dCQUFJLFVBQVUsV0FBQSxBQUFXLElBQXpCLEFBQWMsQUFBZSxBQUM3QjttQkFBTyxnQ0FBYSxZQUFBLEFBQVksVUFBWixBQUFzQixXQUFuQyxBQUE4QyxPQUFPLFdBQUEsQUFBVyxVQUFYLEFBQXFCLFVBQTFFLEFBQW9GLE9BQTNGLEFBQU8sQUFBMkYsQUFDckc7Ozs7Ozs7QUFHTCxJQUFBLEFBQUkiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIlxuLy8gbW9kdWxlcyBhcmUgZGVmaW5lZCBhcyBhbiBhcnJheVxuLy8gWyBtb2R1bGUgZnVuY3Rpb24sIG1hcCBvZiByZXF1aXJldWlyZXMgXVxuLy9cbi8vIG1hcCBvZiByZXF1aXJldWlyZXMgaXMgc2hvcnQgcmVxdWlyZSBuYW1lIC0+IG51bWVyaWMgcmVxdWlyZVxuLy9cbi8vIGFueXRoaW5nIGRlZmluZWQgaW4gYSBwcmV2aW91cyBidW5kbGUgaXMgYWNjZXNzZWQgdmlhIHRoZVxuLy8gb3JpZyBtZXRob2Qgd2hpY2ggaXMgdGhlIHJlcXVpcmV1aXJlIGZvciBwcmV2aW91cyBidW5kbGVzXG5cbihmdW5jdGlvbiBvdXRlciAobW9kdWxlcywgY2FjaGUsIGVudHJ5KSB7XG4gICAgLy8gU2F2ZSB0aGUgcmVxdWlyZSBmcm9tIHByZXZpb3VzIGJ1bmRsZSB0byB0aGlzIGNsb3N1cmUgaWYgYW55XG4gICAgdmFyIHByZXZpb3VzUmVxdWlyZSA9IHR5cGVvZiByZXF1aXJlID09IFwiZnVuY3Rpb25cIiAmJiByZXF1aXJlO1xuXG4gICAgZnVuY3Rpb24gbmV3UmVxdWlyZShuYW1lLCBqdW1wZWQpe1xuICAgICAgICBpZighY2FjaGVbbmFtZV0pIHtcbiAgICAgICAgICAgIGlmKCFtb2R1bGVzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgd2UgY2Fubm90IGZpbmQgdGhlIG1vZHVsZSB3aXRoaW4gb3VyIGludGVybmFsIG1hcCBvclxuICAgICAgICAgICAgICAgIC8vIGNhY2hlIGp1bXAgdG8gdGhlIGN1cnJlbnQgZ2xvYmFsIHJlcXVpcmUgaWUuIHRoZSBsYXN0IGJ1bmRsZVxuICAgICAgICAgICAgICAgIC8vIHRoYXQgd2FzIGFkZGVkIHRvIHRoZSBwYWdlLlxuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50UmVxdWlyZSA9IHR5cGVvZiByZXF1aXJlID09IFwiZnVuY3Rpb25cIiAmJiByZXF1aXJlO1xuICAgICAgICAgICAgICAgIGlmICghanVtcGVkICYmIGN1cnJlbnRSZXF1aXJlKSByZXR1cm4gY3VycmVudFJlcXVpcmUobmFtZSwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgb3RoZXIgYnVuZGxlcyBvbiB0aGlzIHBhZ2UgdGhlIHJlcXVpcmUgZnJvbSB0aGVcbiAgICAgICAgICAgICAgICAvLyBwcmV2aW91cyBvbmUgaXMgc2F2ZWQgdG8gJ3ByZXZpb3VzUmVxdWlyZScuIFJlcGVhdCB0aGlzIGFzXG4gICAgICAgICAgICAgICAgLy8gbWFueSB0aW1lcyBhcyB0aGVyZSBhcmUgYnVuZGxlcyB1bnRpbCB0aGUgbW9kdWxlIGlzIGZvdW5kIG9yXG4gICAgICAgICAgICAgICAgLy8gd2UgZXhoYXVzdCB0aGUgcmVxdWlyZSBjaGFpbi5cbiAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZXF1aXJlKSByZXR1cm4gcHJldmlvdXNSZXF1aXJlKG5hbWUsIHRydWUpO1xuICAgICAgICAgICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nhbm5vdCBmaW5kIG1vZHVsZSBcXCcnICsgbmFtZSArICdcXCcnKTtcbiAgICAgICAgICAgICAgICBlcnIuY29kZSA9ICdNT0RVTEVfTk9UX0ZPVU5EJztcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbSA9IGNhY2hlW25hbWVdID0ge2V4cG9ydHM6e319O1xuICAgICAgICAgICAgbW9kdWxlc1tuYW1lXVswXS5jYWxsKG0uZXhwb3J0cywgZnVuY3Rpb24oeCl7XG4gICAgICAgICAgICAgICAgdmFyIGlkID0gbW9kdWxlc1tuYW1lXVsxXVt4XTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3UmVxdWlyZShpZCA/IGlkIDogeCk7XG4gICAgICAgICAgICB9LG0sbS5leHBvcnRzLG91dGVyLG1vZHVsZXMsY2FjaGUsZW50cnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZVtuYW1lXS5leHBvcnRzO1xuICAgIH1cbiAgICBmb3IodmFyIGk9MDtpPGVudHJ5Lmxlbmd0aDtpKyspIG5ld1JlcXVpcmUoZW50cnlbaV0pO1xuXG4gICAgLy8gT3ZlcnJpZGUgdGhlIGN1cnJlbnQgcmVxdWlyZSB3aXRoIHRoaXMgbmV3IG9uZVxuICAgIHJldHVybiBuZXdSZXF1aXJlO1xufSlcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG4vKlxuICogRXhwb3J0IGtNYXhMZW5ndGggYWZ0ZXIgdHlwZWQgYXJyYXkgc3VwcG9ydCBpcyBkZXRlcm1pbmVkLlxuICovXG5leHBvcnRzLmtNYXhMZW5ndGggPSBrTWF4TGVuZ3RoKClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKGtNYXhMZW5ndGgoKSA8IGxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgaWYgKHRoYXQgPT09IG51bGwpIHtcbiAgICAgIHRoYXQgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgICB9XG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZnVuY3Rpb24gQnVmZmVyIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdJZiBlbmNvZGluZyBpcyBzcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZydcbiAgICAgIClcbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jVW5zYWZlKHRoaXMsIGFyZylcbiAgfVxuICByZXR1cm4gZnJvbSh0aGlzLCBhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb20gKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh0aGF0LCB2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbShudWxsLCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRTaXplIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAodGhhdCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2MobnVsbCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlICh0aGF0LCBzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJlbmNvZGluZ1wiIG11c3QgYmUgYSB2YWxpZCBzdHJpbmcgZW5jb2RpbmcnKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ29mZnNldFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnbGVuZ3RoXFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldClcbiAgfSBlbHNlIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gYXJyYXlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21BcnJheUxpa2UodGhhdCwgYXJyYXkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuKVxuXG4gICAgaWYgKHRoYXQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhhdFxuICAgIH1cblxuICAgIG9iai5jb3B5KHRoYXQsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gdGhhdFxuICB9XG5cbiAgaWYgKG9iaikge1xuICAgIGlmICgodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICBvYmouYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHx8ICdsZW5ndGgnIGluIG9iaikge1xuICAgICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBpc25hbihvYmoubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIDApXG4gICAgICB9XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmopXG4gICAgfVxuXG4gICAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iai5kYXRhKSkge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqLmRhdGEpXG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZywgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQXJyYXksIG9yIGFycmF5LWxpa2Ugb2JqZWN0LicpXG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAobGVuZ3RoKSB7XG4gIGlmICgrbGVuZ3RoICE9IGxlbmd0aCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxuICAgIGxlbmd0aCA9IDBcbiAgfVxuICByZXR1cm4gQnVmZmVyLmFsbG9jKCtsZW5ndGgpXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBCdWZmZXIuYWxsb2MoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ1ZiA9IGxpc3RbaV1cbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICAgIH1cbiAgICBidWYuY29weShidWZmZXIsIHBvcylcbiAgICBwb3MgKz0gYnVmLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZmZXJcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBBcnJheUJ1ZmZlci5pc1ZpZXcgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIChBcnJheUJ1ZmZlci5pc1ZpZXcoc3RyaW5nKSB8fCBzdHJpbmcgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcbiAgICByZXR1cm4gc3RyaW5nLmJ5dGVMZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICBzdHJpbmcgPSAnJyArIHN0cmluZ1xuICB9XG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAodGFyZ2V0LCBzdGFydCwgZW5kLCB0aGlzU3RhcnQsIHRoaXNFbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgZm9yICh2YXIgaSA9IDA7IGJ5dGVPZmZzZXQgKyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocmVhZChhcnIsIGJ5dGVPZmZzZXQgKyBpKSA9PT0gcmVhZCh2YWwsIGZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4KSkge1xuICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gKGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4KSAqIGluZGV4U2l6ZVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgIH1cbiAgfVxuICByZXR1cm4gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGJ5dGVPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBieXRlT2Zmc2V0XG4gICAgYnl0ZU9mZnNldCA9IDBcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikge1xuICAgIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSB7XG4gICAgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIH1cbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWwgPSBCdWZmZXIuZnJvbSh2YWwsIGVuY29kaW5nKVxuICB9XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgLy8gc3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcvYnVmZmVyIGFsd2F5cyBmYWlsc1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0LCBlbmNvZGluZylcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiYnVmZmVyXCIgYXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpIC0gMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKGNvZGUgPCAyNTYpIHtcbiAgICAgICAgdmFsID0gY29kZVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDI1NVxuICB9XG5cbiAgLy8gSW52YWxpZCByYW5nZXMgYXJlIG5vdCBzZXQgdG8gYSBkZWZhdWx0LCBzbyBjYW4gcmFuZ2UgY2hlY2sgZWFybHkuXG4gIGlmIChzdGFydCA8IDAgfHwgdGhpcy5sZW5ndGggPCBzdGFydCB8fCB0aGlzLmxlbmd0aCA8IGVuZCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIXZhbCkgdmFsID0gMFxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWxcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmlzQnVmZmVyKHZhbClcbiAgICAgID8gdmFsXG4gICAgICA6IHV0ZjhUb0J5dGVzKG5ldyBCdWZmZXIodmFsLCBlbmNvZGluZykudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyBpKyspIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gaXNuYW4gKHZhbCkge1xuICByZXR1cm4gdmFsICE9PSB2YWwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1zZWxmLWNvbXBhcmVcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxuZnVuY3Rpb24gaW5pdCAoKSB7XG4gIHZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbG9va3VwW2ldID0gY29kZVtpXVxuICAgIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxuICB9XG5cbiAgcmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG4gIHJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xufVxuXG5pbml0KClcblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICBwbGFjZUhvbGRlcnMgPSBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG5cbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLyoqXG4gKiBCaXQgdHdpZGRsaW5nIGhhY2tzIGZvciBKYXZhU2NyaXB0LlxuICpcbiAqIEF1dGhvcjogTWlrb2xhIEx5c2Vua29cbiAqXG4gKiBQb3J0ZWQgZnJvbSBTdGFuZm9yZCBiaXQgdHdpZGRsaW5nIGhhY2sgbGlicmFyeTpcbiAqICAgIGh0dHA6Ly9ncmFwaGljcy5zdGFuZm9yZC5lZHUvfnNlYW5kZXIvYml0aGFja3MuaHRtbFxuICovXG5cblwidXNlIHN0cmljdFwiOyBcInVzZSByZXN0cmljdFwiO1xuXG4vL051bWJlciBvZiBiaXRzIGluIGFuIGludGVnZXJcbnZhciBJTlRfQklUUyA9IDMyO1xuXG4vL0NvbnN0YW50c1xuZXhwb3J0cy5JTlRfQklUUyAgPSBJTlRfQklUUztcbmV4cG9ydHMuSU5UX01BWCAgID0gIDB4N2ZmZmZmZmY7XG5leHBvcnRzLklOVF9NSU4gICA9IC0xPDwoSU5UX0JJVFMtMSk7XG5cbi8vUmV0dXJucyAtMSwgMCwgKzEgZGVwZW5kaW5nIG9uIHNpZ24gb2YgeFxuZXhwb3J0cy5zaWduID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gKHYgPiAwKSAtICh2IDwgMCk7XG59XG5cbi8vQ29tcHV0ZXMgYWJzb2x1dGUgdmFsdWUgb2YgaW50ZWdlclxuZXhwb3J0cy5hYnMgPSBmdW5jdGlvbih2KSB7XG4gIHZhciBtYXNrID0gdiA+PiAoSU5UX0JJVFMtMSk7XG4gIHJldHVybiAodiBeIG1hc2spIC0gbWFzaztcbn1cblxuLy9Db21wdXRlcyBtaW5pbXVtIG9mIGludGVnZXJzIHggYW5kIHlcbmV4cG9ydHMubWluID0gZnVuY3Rpb24oeCwgeSkge1xuICByZXR1cm4geSBeICgoeCBeIHkpICYgLSh4IDwgeSkpO1xufVxuXG4vL0NvbXB1dGVzIG1heGltdW0gb2YgaW50ZWdlcnMgeCBhbmQgeVxuZXhwb3J0cy5tYXggPSBmdW5jdGlvbih4LCB5KSB7XG4gIHJldHVybiB4IF4gKCh4IF4geSkgJiAtKHggPCB5KSk7XG59XG5cbi8vQ2hlY2tzIGlmIGEgbnVtYmVyIGlzIGEgcG93ZXIgb2YgdHdvXG5leHBvcnRzLmlzUG93MiA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuICEodiAmICh2LTEpKSAmJiAoISF2KTtcbn1cblxuLy9Db21wdXRlcyBsb2cgYmFzZSAyIG9mIHZcbmV4cG9ydHMubG9nMiA9IGZ1bmN0aW9uKHYpIHtcbiAgdmFyIHIsIHNoaWZ0O1xuICByID0gICAgICh2ID4gMHhGRkZGKSA8PCA0OyB2ID4+Pj0gcjtcbiAgc2hpZnQgPSAodiA+IDB4RkYgICkgPDwgMzsgdiA+Pj49IHNoaWZ0OyByIHw9IHNoaWZ0O1xuICBzaGlmdCA9ICh2ID4gMHhGICAgKSA8PCAyOyB2ID4+Pj0gc2hpZnQ7IHIgfD0gc2hpZnQ7XG4gIHNoaWZ0ID0gKHYgPiAweDMgICApIDw8IDE7IHYgPj4+PSBzaGlmdDsgciB8PSBzaGlmdDtcbiAgcmV0dXJuIHIgfCAodiA+PiAxKTtcbn1cblxuLy9Db21wdXRlcyBsb2cgYmFzZSAxMCBvZiB2XG5leHBvcnRzLmxvZzEwID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gICh2ID49IDEwMDAwMDAwMDApID8gOSA6ICh2ID49IDEwMDAwMDAwMCkgPyA4IDogKHYgPj0gMTAwMDAwMDApID8gNyA6XG4gICAgICAgICAgKHYgPj0gMTAwMDAwMCkgPyA2IDogKHYgPj0gMTAwMDAwKSA/IDUgOiAodiA+PSAxMDAwMCkgPyA0IDpcbiAgICAgICAgICAodiA+PSAxMDAwKSA/IDMgOiAodiA+PSAxMDApID8gMiA6ICh2ID49IDEwKSA/IDEgOiAwO1xufVxuXG4vL0NvdW50cyBudW1iZXIgb2YgYml0c1xuZXhwb3J0cy5wb3BDb3VudCA9IGZ1bmN0aW9uKHYpIHtcbiAgdiA9IHYgLSAoKHYgPj4+IDEpICYgMHg1NTU1NTU1NSk7XG4gIHYgPSAodiAmIDB4MzMzMzMzMzMpICsgKCh2ID4+PiAyKSAmIDB4MzMzMzMzMzMpO1xuICByZXR1cm4gKCh2ICsgKHYgPj4+IDQpICYgMHhGMEYwRjBGKSAqIDB4MTAxMDEwMSkgPj4+IDI0O1xufVxuXG4vL0NvdW50cyBudW1iZXIgb2YgdHJhaWxpbmcgemVyb3NcbmZ1bmN0aW9uIGNvdW50VHJhaWxpbmdaZXJvcyh2KSB7XG4gIHZhciBjID0gMzI7XG4gIHYgJj0gLXY7XG4gIGlmICh2KSBjLS07XG4gIGlmICh2ICYgMHgwMDAwRkZGRikgYyAtPSAxNjtcbiAgaWYgKHYgJiAweDAwRkYwMEZGKSBjIC09IDg7XG4gIGlmICh2ICYgMHgwRjBGMEYwRikgYyAtPSA0O1xuICBpZiAodiAmIDB4MzMzMzMzMzMpIGMgLT0gMjtcbiAgaWYgKHYgJiAweDU1NTU1NTU1KSBjIC09IDE7XG4gIHJldHVybiBjO1xufVxuZXhwb3J0cy5jb3VudFRyYWlsaW5nWmVyb3MgPSBjb3VudFRyYWlsaW5nWmVyb3M7XG5cbi8vUm91bmRzIHRvIG5leHQgcG93ZXIgb2YgMlxuZXhwb3J0cy5uZXh0UG93MiA9IGZ1bmN0aW9uKHYpIHtcbiAgdiArPSB2ID09PSAwO1xuICAtLXY7XG4gIHYgfD0gdiA+Pj4gMTtcbiAgdiB8PSB2ID4+PiAyO1xuICB2IHw9IHYgPj4+IDQ7XG4gIHYgfD0gdiA+Pj4gODtcbiAgdiB8PSB2ID4+PiAxNjtcbiAgcmV0dXJuIHYgKyAxO1xufVxuXG4vL1JvdW5kcyBkb3duIHRvIHByZXZpb3VzIHBvd2VyIG9mIDJcbmV4cG9ydHMucHJldlBvdzIgPSBmdW5jdGlvbih2KSB7XG4gIHYgfD0gdiA+Pj4gMTtcbiAgdiB8PSB2ID4+PiAyO1xuICB2IHw9IHYgPj4+IDQ7XG4gIHYgfD0gdiA+Pj4gODtcbiAgdiB8PSB2ID4+PiAxNjtcbiAgcmV0dXJuIHYgLSAodj4+PjEpO1xufVxuXG4vL0NvbXB1dGVzIHBhcml0eSBvZiB3b3JkXG5leHBvcnRzLnBhcml0eSA9IGZ1bmN0aW9uKHYpIHtcbiAgdiBePSB2ID4+PiAxNjtcbiAgdiBePSB2ID4+PiA4O1xuICB2IF49IHYgPj4+IDQ7XG4gIHYgJj0gMHhmO1xuICByZXR1cm4gKDB4Njk5NiA+Pj4gdikgJiAxO1xufVxuXG52YXIgUkVWRVJTRV9UQUJMRSA9IG5ldyBBcnJheSgyNTYpO1xuXG4oZnVuY3Rpb24odGFiKSB7XG4gIGZvcih2YXIgaT0wOyBpPDI1NjsgKytpKSB7XG4gICAgdmFyIHYgPSBpLCByID0gaSwgcyA9IDc7XG4gICAgZm9yICh2ID4+Pj0gMTsgdjsgdiA+Pj49IDEpIHtcbiAgICAgIHIgPDw9IDE7XG4gICAgICByIHw9IHYgJiAxO1xuICAgICAgLS1zO1xuICAgIH1cbiAgICB0YWJbaV0gPSAociA8PCBzKSAmIDB4ZmY7XG4gIH1cbn0pKFJFVkVSU0VfVEFCTEUpO1xuXG4vL1JldmVyc2UgYml0cyBpbiBhIDMyIGJpdCB3b3JkXG5leHBvcnRzLnJldmVyc2UgPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiAgKFJFVkVSU0VfVEFCTEVbIHYgICAgICAgICAmIDB4ZmZdIDw8IDI0KSB8XG4gICAgICAgICAgKFJFVkVSU0VfVEFCTEVbKHYgPj4+IDgpICAmIDB4ZmZdIDw8IDE2KSB8XG4gICAgICAgICAgKFJFVkVSU0VfVEFCTEVbKHYgPj4+IDE2KSAmIDB4ZmZdIDw8IDgpICB8XG4gICAgICAgICAgIFJFVkVSU0VfVEFCTEVbKHYgPj4+IDI0KSAmIDB4ZmZdO1xufVxuXG4vL0ludGVybGVhdmUgYml0cyBvZiAyIGNvb3JkaW5hdGVzIHdpdGggMTYgYml0cy4gIFVzZWZ1bCBmb3IgZmFzdCBxdWFkdHJlZSBjb2Rlc1xuZXhwb3J0cy5pbnRlcmxlYXZlMiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgeCAmPSAweEZGRkY7XG4gIHggPSAoeCB8ICh4IDw8IDgpKSAmIDB4MDBGRjAwRkY7XG4gIHggPSAoeCB8ICh4IDw8IDQpKSAmIDB4MEYwRjBGMEY7XG4gIHggPSAoeCB8ICh4IDw8IDIpKSAmIDB4MzMzMzMzMzM7XG4gIHggPSAoeCB8ICh4IDw8IDEpKSAmIDB4NTU1NTU1NTU7XG5cbiAgeSAmPSAweEZGRkY7XG4gIHkgPSAoeSB8ICh5IDw8IDgpKSAmIDB4MDBGRjAwRkY7XG4gIHkgPSAoeSB8ICh5IDw8IDQpKSAmIDB4MEYwRjBGMEY7XG4gIHkgPSAoeSB8ICh5IDw8IDIpKSAmIDB4MzMzMzMzMzM7XG4gIHkgPSAoeSB8ICh5IDw8IDEpKSAmIDB4NTU1NTU1NTU7XG5cbiAgcmV0dXJuIHggfCAoeSA8PCAxKTtcbn1cblxuLy9FeHRyYWN0cyB0aGUgbnRoIGludGVybGVhdmVkIGNvbXBvbmVudFxuZXhwb3J0cy5kZWludGVybGVhdmUyID0gZnVuY3Rpb24odiwgbikge1xuICB2ID0gKHYgPj4+IG4pICYgMHg1NTU1NTU1NTtcbiAgdiA9ICh2IHwgKHYgPj4+IDEpKSAgJiAweDMzMzMzMzMzO1xuICB2ID0gKHYgfCAodiA+Pj4gMikpICAmIDB4MEYwRjBGMEY7XG4gIHYgPSAodiB8ICh2ID4+PiA0KSkgICYgMHgwMEZGMDBGRjtcbiAgdiA9ICh2IHwgKHYgPj4+IDE2KSkgJiAweDAwMEZGRkY7XG4gIHJldHVybiAodiA8PCAxNikgPj4gMTY7XG59XG5cblxuLy9JbnRlcmxlYXZlIGJpdHMgb2YgMyBjb29yZGluYXRlcywgZWFjaCB3aXRoIDEwIGJpdHMuICBVc2VmdWwgZm9yIGZhc3Qgb2N0cmVlIGNvZGVzXG5leHBvcnRzLmludGVybGVhdmUzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICB4ICY9IDB4M0ZGO1xuICB4ICA9ICh4IHwgKHg8PDE2KSkgJiA0Mjc4MTkwMzM1O1xuICB4ICA9ICh4IHwgKHg8PDgpKSAgJiAyNTE3MTk2OTU7XG4gIHggID0gKHggfCAoeDw8NCkpICAmIDMyNzIzNTYwMzU7XG4gIHggID0gKHggfCAoeDw8MikpICAmIDEyMjcxMzM1MTM7XG5cbiAgeSAmPSAweDNGRjtcbiAgeSAgPSAoeSB8ICh5PDwxNikpICYgNDI3ODE5MDMzNTtcbiAgeSAgPSAoeSB8ICh5PDw4KSkgICYgMjUxNzE5Njk1O1xuICB5ICA9ICh5IHwgKHk8PDQpKSAgJiAzMjcyMzU2MDM1O1xuICB5ICA9ICh5IHwgKHk8PDIpKSAgJiAxMjI3MTMzNTEzO1xuICB4IHw9ICh5IDw8IDEpO1xuICBcbiAgeiAmPSAweDNGRjtcbiAgeiAgPSAoeiB8ICh6PDwxNikpICYgNDI3ODE5MDMzNTtcbiAgeiAgPSAoeiB8ICh6PDw4KSkgICYgMjUxNzE5Njk1O1xuICB6ICA9ICh6IHwgKHo8PDQpKSAgJiAzMjcyMzU2MDM1O1xuICB6ICA9ICh6IHwgKHo8PDIpKSAgJiAxMjI3MTMzNTEzO1xuICBcbiAgcmV0dXJuIHggfCAoeiA8PCAyKTtcbn1cblxuLy9FeHRyYWN0cyBudGggaW50ZXJsZWF2ZWQgY29tcG9uZW50IG9mIGEgMy10dXBsZVxuZXhwb3J0cy5kZWludGVybGVhdmUzID0gZnVuY3Rpb24odiwgbikge1xuICB2ID0gKHYgPj4+IG4pICAgICAgICYgMTIyNzEzMzUxMztcbiAgdiA9ICh2IHwgKHY+Pj4yKSkgICAmIDMyNzIzNTYwMzU7XG4gIHYgPSAodiB8ICh2Pj4+NCkpICAgJiAyNTE3MTk2OTU7XG4gIHYgPSAodiB8ICh2Pj4+OCkpICAgJiA0Mjc4MTkwMzM1O1xuICB2ID0gKHYgfCAodj4+PjE2KSkgICYgMHgzRkY7XG4gIHJldHVybiAodjw8MjIpPj4yMjtcbn1cblxuLy9Db21wdXRlcyBuZXh0IGNvbWJpbmF0aW9uIGluIGNvbGV4aWNvZ3JhcGhpYyBvcmRlciAodGhpcyBpcyBtaXN0YWtlbmx5IGNhbGxlZCBuZXh0UGVybXV0YXRpb24gb24gdGhlIGJpdCB0d2lkZGxpbmcgaGFja3MgcGFnZSlcbmV4cG9ydHMubmV4dENvbWJpbmF0aW9uID0gZnVuY3Rpb24odikge1xuICB2YXIgdCA9IHYgfCAodiAtIDEpO1xuICByZXR1cm4gKHQgKyAxKSB8ICgoKH50ICYgLX50KSAtIDEpID4+PiAoY291bnRUcmFpbGluZ1plcm9zKHYpICsgMSkpO1xufVxuXG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgb3BzID0gcmVxdWlyZShcIm5kYXJyYXktb3BzXCIpXG52YXIgY3dpc2UgPSByZXF1aXJlKFwiY3dpc2VcIilcbnZhciBuZGFycmF5ID0gcmVxdWlyZShcIm5kYXJyYXlcIilcbnZhciBmZnRtID0gcmVxdWlyZShcIi4vbGliL2ZmdC1tYXRyaXguanNcIilcbnZhciBwb29sID0gcmVxdWlyZShcInR5cGVkYXJyYXktcG9vbFwiKVxuXG5mdW5jdGlvbiBuZGZmdChkaXIsIHgsIHkpIHtcbiAgdmFyIHNoYXBlID0geC5zaGFwZVxuICAgICwgZCA9IHNoYXBlLmxlbmd0aFxuICAgICwgc2l6ZSA9IDFcbiAgICAsIHN0cmlkZSA9IG5ldyBBcnJheShkKVxuICAgICwgcGFkID0gMFxuICAgICwgaSwgalxuICBmb3IoaT1kLTE7IGk+PTA7IC0taSkge1xuICAgIHN0cmlkZVtpXSA9IHNpemVcbiAgICBzaXplICo9IHNoYXBlW2ldXG4gICAgcGFkID0gTWF0aC5tYXgocGFkLCBmZnRtLnNjcmF0Y2hNZW1vcnkoc2hhcGVbaV0pKVxuICAgIGlmKHguc2hhcGVbaV0gIT09IHkuc2hhcGVbaV0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlNoYXBlIG1pc21hdGNoLCByZWFsIGFuZCBpbWFnaW5hcnkgYXJyYXlzIG11c3QgaGF2ZSBzYW1lIHNpemVcIilcbiAgICB9XG4gIH1cbiAgdmFyIGJ1ZmZlciA9IHBvb2wubWFsbG9jKDQgKiBzaXplICsgcGFkLCBcImRvdWJsZVwiKVxuICB2YXIgeDEgPSBuZGFycmF5KGJ1ZmZlciwgc2hhcGUuc2xpY2UoMCksIHN0cmlkZSwgMClcbiAgICAsIHkxID0gbmRhcnJheShidWZmZXIsIHNoYXBlLnNsaWNlKDApLCBzdHJpZGUuc2xpY2UoMCksIHNpemUpXG4gICAgLCB4MiA9IG5kYXJyYXkoYnVmZmVyLCBzaGFwZS5zbGljZSgwKSwgc3RyaWRlLnNsaWNlKDApLCAyKnNpemUpXG4gICAgLCB5MiA9IG5kYXJyYXkoYnVmZmVyLCBzaGFwZS5zbGljZSgwKSwgc3RyaWRlLnNsaWNlKDApLCAzKnNpemUpXG4gICAgLCB0bXAsIG4sIHMxLCBzMlxuICAgICwgc2NyYXRjaF9wdHIgPSA0ICogc2l6ZVxuICBcbiAgLy9Db3B5IGludG8geDEveTFcbiAgb3BzLmFzc2lnbih4MSwgeClcbiAgb3BzLmFzc2lnbih5MSwgeSlcbiAgXG4gIGZvcihpPWQtMTsgaT49MDsgLS1pKSB7XG4gICAgZmZ0bShkaXIsIHNpemUvc2hhcGVbaV0sIHNoYXBlW2ldLCBidWZmZXIsIHgxLm9mZnNldCwgeTEub2Zmc2V0LCBzY3JhdGNoX3B0cilcbiAgICBpZihpID09PSAwKSB7XG4gICAgICBicmVha1xuICAgIH1cbiAgICBcbiAgICAvL0NvbXB1dGUgbmV3IHN0cmlkZSBmb3IgeDIveTJcbiAgICBuID0gMVxuICAgIHMxID0geDIuc3RyaWRlXG4gICAgczIgPSB5Mi5zdHJpZGVcbiAgICBmb3Ioaj1pLTE7IGo8ZDsgKytqKSB7XG4gICAgICBzMltqXSA9IHMxW2pdID0gblxuICAgICAgbiAqPSBzaGFwZVtqXVxuICAgIH1cbiAgICBmb3Ioaj1pLTI7IGo+PTA7IC0taikge1xuICAgICAgczJbal0gPSBzMVtqXSA9IG5cbiAgICAgIG4gKj0gc2hhcGVbal1cbiAgICB9XG4gICAgXG4gICAgLy9UcmFuc3Bvc2VcbiAgICBvcHMuYXNzaWduKHgyLCB4MSlcbiAgICBvcHMuYXNzaWduKHkyLCB5MSlcbiAgICBcbiAgICAvL1N3YXAgYnVmZmVyc1xuICAgIHRtcCA9IHgxXG4gICAgeDEgPSB4MlxuICAgIHgyID0gdG1wXG4gICAgdG1wID0geTFcbiAgICB5MSA9IHkyXG4gICAgeTIgPSB0bXBcbiAgfVxuICBcbiAgLy9Db3B5IHJlc3VsdCBiYWNrIGludG8geFxuICBvcHMuYXNzaWduKHgsIHgxKVxuICBvcHMuYXNzaWduKHksIHkxKVxuICBcbiAgcG9vbC5mcmVlKGJ1ZmZlcilcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBuZGZmdFxuIiwidmFyIGJpdHMgPSByZXF1aXJlKFwiYml0LXR3aWRkbGVcIilcblxuZnVuY3Rpb24gZmZ0KGRpciwgbnJvd3MsIG5jb2xzLCBidWZmZXIsIHhfcHRyLCB5X3B0ciwgc2NyYXRjaF9wdHIpIHtcbiAgZGlyIHw9IDBcbiAgbnJvd3MgfD0gMFxuICBuY29scyB8PSAwXG4gIHhfcHRyIHw9IDBcbiAgeV9wdHIgfD0gMFxuICBpZihiaXRzLmlzUG93MihuY29scykpIHtcbiAgICBmZnRSYWRpeDIoZGlyLCBucm93cywgbmNvbHMsIGJ1ZmZlciwgeF9wdHIsIHlfcHRyKVxuICB9IGVsc2Uge1xuICAgIGZmdEJsdWVzdGVpbihkaXIsIG5yb3dzLCBuY29scywgYnVmZmVyLCB4X3B0ciwgeV9wdHIsIHNjcmF0Y2hfcHRyKVxuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGZmdFxuXG5mdW5jdGlvbiBzY3JhdGNoTWVtb3J5KG4pIHtcbiAgaWYoYml0cy5pc1BvdzIobikpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIHJldHVybiAyICogbiArIDQgKiBiaXRzLm5leHRQb3cyKDIqbiArIDEpXG59XG5tb2R1bGUuZXhwb3J0cy5zY3JhdGNoTWVtb3J5ID0gc2NyYXRjaE1lbW9yeVxuXG5cbi8vUmFkaXggMiBGRlQgQWRhcHRlZCBmcm9tIFBhdWwgQm91cmtlJ3MgQyBJbXBsZW1lbnRhdGlvblxuZnVuY3Rpb24gZmZ0UmFkaXgyKGRpciwgbnJvd3MsIG5jb2xzLCBidWZmZXIsIHhfcHRyLCB5X3B0cikge1xuICBkaXIgfD0gMFxuICBucm93cyB8PSAwXG4gIG5jb2xzIHw9IDBcbiAgeF9wdHIgfD0gMFxuICB5X3B0ciB8PSAwXG4gIHZhciBubixpLGkxLGosayxpMixsLGwxLGwyXG4gIHZhciBjMSxjMix0LHQxLHQyLHUxLHUyLHoscm93LGEsYixjLGQsazEsazIsazNcbiAgXG4gIC8vIENhbGN1bGF0ZSB0aGUgbnVtYmVyIG9mIHBvaW50c1xuICBubiA9IG5jb2xzXG4gIG0gPSBiaXRzLmxvZzIobm4pXG4gIFxuICBmb3Iocm93PTA7IHJvdzxucm93czsgKytyb3cpIHsgIFxuICAgIC8vIERvIHRoZSBiaXQgcmV2ZXJzYWxcbiAgICBpMiA9IG5uID4+IDE7XG4gICAgaiA9IDA7XG4gICAgZm9yKGk9MDtpPG5uLTE7aSsrKSB7XG4gICAgICBpZihpIDwgaikge1xuICAgICAgICB0ID0gYnVmZmVyW3hfcHRyK2ldXG4gICAgICAgIGJ1ZmZlclt4X3B0citpXSA9IGJ1ZmZlclt4X3B0citqXVxuICAgICAgICBidWZmZXJbeF9wdHIral0gPSB0XG4gICAgICAgIHQgPSBidWZmZXJbeV9wdHIraV1cbiAgICAgICAgYnVmZmVyW3lfcHRyK2ldID0gYnVmZmVyW3lfcHRyK2pdXG4gICAgICAgIGJ1ZmZlclt5X3B0citqXSA9IHRcbiAgICAgIH1cbiAgICAgIGsgPSBpMlxuICAgICAgd2hpbGUoayA8PSBqKSB7XG4gICAgICAgIGogLT0ga1xuICAgICAgICBrID4+PSAxXG4gICAgICB9XG4gICAgICBqICs9IGtcbiAgICB9XG4gICAgXG4gICAgLy8gQ29tcHV0ZSB0aGUgRkZUXG4gICAgYzEgPSAtMS4wXG4gICAgYzIgPSAwLjBcbiAgICBsMiA9IDFcbiAgICBmb3IobD0wO2w8bTtsKyspIHtcbiAgICAgIGwxID0gbDJcbiAgICAgIGwyIDw8PSAxXG4gICAgICB1MSA9IDEuMFxuICAgICAgdTIgPSAwLjBcbiAgICAgIGZvcihqPTA7ajxsMTtqKyspIHtcbiAgICAgICAgZm9yKGk9ajtpPG5uO2krPWwyKSB7XG4gICAgICAgICAgaTEgPSBpICsgbDFcbiAgICAgICAgICBhID0gYnVmZmVyW3hfcHRyK2kxXVxuICAgICAgICAgIGIgPSBidWZmZXJbeV9wdHIraTFdXG4gICAgICAgICAgYyA9IGJ1ZmZlclt4X3B0citpXVxuICAgICAgICAgIGQgPSBidWZmZXJbeV9wdHIraV1cbiAgICAgICAgICBrMSA9IHUxICogKGEgKyBiKVxuICAgICAgICAgIGsyID0gYSAqICh1MiAtIHUxKVxuICAgICAgICAgIGszID0gYiAqICh1MSArIHUyKVxuICAgICAgICAgIHQxID0gazEgLSBrM1xuICAgICAgICAgIHQyID0gazEgKyBrMlxuICAgICAgICAgIGJ1ZmZlclt4X3B0citpMV0gPSBjIC0gdDFcbiAgICAgICAgICBidWZmZXJbeV9wdHIraTFdID0gZCAtIHQyXG4gICAgICAgICAgYnVmZmVyW3hfcHRyK2ldICs9IHQxXG4gICAgICAgICAgYnVmZmVyW3lfcHRyK2ldICs9IHQyXG4gICAgICAgIH1cbiAgICAgICAgazEgPSBjMSAqICh1MSArIHUyKVxuICAgICAgICBrMiA9IHUxICogKGMyIC0gYzEpXG4gICAgICAgIGszID0gdTIgKiAoYzEgKyBjMilcbiAgICAgICAgdTEgPSBrMSAtIGszXG4gICAgICAgIHUyID0gazEgKyBrMlxuICAgICAgfVxuICAgICAgYzIgPSBNYXRoLnNxcnQoKDEuMCAtIGMxKSAvIDIuMClcbiAgICAgIGlmKGRpciA8IDApIHtcbiAgICAgICAgYzIgPSAtYzJcbiAgICAgIH1cbiAgICAgIGMxID0gTWF0aC5zcXJ0KCgxLjAgKyBjMSkgLyAyLjApXG4gICAgfVxuICAgIFxuICAgIC8vIFNjYWxpbmcgZm9yIGludmVyc2UgdHJhbnNmb3JtXG4gICAgaWYoZGlyIDwgMCkge1xuICAgICAgdmFyIHNjYWxlX2YgPSAxLjAgLyBublxuICAgICAgZm9yKGk9MDtpPG5uO2krKykge1xuICAgICAgICBidWZmZXJbeF9wdHIraV0gKj0gc2NhbGVfZlxuICAgICAgICBidWZmZXJbeV9wdHIraV0gKj0gc2NhbGVfZlxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBBZHZhbmNlIHBvaW50ZXJzXG4gICAgeF9wdHIgKz0gbmNvbHNcbiAgICB5X3B0ciArPSBuY29sc1xuICB9XG59XG5cbi8vIFVzZSBCbHVlc3RlaW4gYWxnb3JpdGhtIGZvciBucG90IEZGVHNcbi8vIFNjcmF0Y2ggbWVtb3J5IHJlcXVpcmVkOiAgMiAqIG5jb2xzICsgNCAqIGJpdHMubmV4dFBvdzIoMipuY29scyArIDEpXG5mdW5jdGlvbiBmZnRCbHVlc3RlaW4oZGlyLCBucm93cywgbmNvbHMsIGJ1ZmZlciwgeF9wdHIsIHlfcHRyLCBzY3JhdGNoX3B0cikge1xuICBkaXIgfD0gMFxuICBucm93cyB8PSAwXG4gIG5jb2xzIHw9IDBcbiAgeF9wdHIgfD0gMFxuICB5X3B0ciB8PSAwXG4gIHNjcmF0Y2hfcHRyIHw9IDBcblxuICAvLyBJbml0aWFsaXplIHRhYmxlc1xuICB2YXIgbSA9IGJpdHMubmV4dFBvdzIoMiAqIG5jb2xzICsgMSlcbiAgICAsIGNvc19wdHIgPSBzY3JhdGNoX3B0clxuICAgICwgc2luX3B0ciA9IGNvc19wdHIgKyBuY29sc1xuICAgICwgeHNfcHRyICA9IHNpbl9wdHIgKyBuY29sc1xuICAgICwgeXNfcHRyICA9IHhzX3B0ciAgKyBtXG4gICAgLCBjZnRfcHRyID0geXNfcHRyICArIG1cbiAgICAsIHNmdF9wdHIgPSBjZnRfcHRyICsgbVxuICAgICwgdyA9IC1kaXIgKiBNYXRoLlBJIC8gbmNvbHNcbiAgICAsIHJvdywgYSwgYiwgYywgZCwgazEsIGsyLCBrM1xuICAgICwgaVxuICBmb3IoaT0wOyBpPG5jb2xzOyArK2kpIHtcbiAgICBhID0gdyAqICgoaSAqIGkpICUgKG5jb2xzICogMikpXG4gICAgYyA9IE1hdGguY29zKGEpXG4gICAgZCA9IE1hdGguc2luKGEpXG4gICAgYnVmZmVyW2NmdF9wdHIrKG0taSldID0gYnVmZmVyW2NmdF9wdHIraV0gPSBidWZmZXJbY29zX3B0citpXSA9IGNcbiAgICBidWZmZXJbc2Z0X3B0cisobS1pKV0gPSBidWZmZXJbc2Z0X3B0citpXSA9IGJ1ZmZlcltzaW5fcHRyK2ldID0gZFxuICB9XG4gIGZvcihpPW5jb2xzOyBpPD1tLW5jb2xzOyArK2kpIHtcbiAgICBidWZmZXJbY2Z0X3B0citpXSA9IDAuMFxuICB9XG4gIGZvcihpPW5jb2xzOyBpPD1tLW5jb2xzOyArK2kpIHtcbiAgICBidWZmZXJbc2Z0X3B0citpXSA9IDAuMFxuICB9XG5cbiAgZmZ0UmFkaXgyKDEsIDEsIG0sIGJ1ZmZlciwgY2Z0X3B0ciwgc2Z0X3B0cilcbiAgXG4gIC8vQ29tcHV0ZSBzY2FsZSBmYWN0b3JcbiAgaWYoZGlyIDwgMCkge1xuICAgIHcgPSAxLjAgLyBuY29sc1xuICB9IGVsc2Uge1xuICAgIHcgPSAxLjBcbiAgfVxuICBcbiAgLy9IYW5kbGUgZGlyZWN0aW9uXG4gIGZvcihyb3c9MDsgcm93PG5yb3dzOyArK3Jvdykge1xuICBcbiAgICAvLyBDb3B5IHJvdyBpbnRvIHNjcmF0Y2ggbWVtb3J5LCBtdWx0aXBseSB3ZWlnaHRzXG4gICAgZm9yKGk9MDsgaTxuY29sczsgKytpKSB7XG4gICAgICBhID0gYnVmZmVyW3hfcHRyK2ldXG4gICAgICBiID0gYnVmZmVyW3lfcHRyK2ldXG4gICAgICBjID0gYnVmZmVyW2Nvc19wdHIraV1cbiAgICAgIGQgPSAtYnVmZmVyW3Npbl9wdHIraV1cbiAgICAgIGsxID0gYyAqIChhICsgYilcbiAgICAgIGsyID0gYSAqIChkIC0gYylcbiAgICAgIGszID0gYiAqIChjICsgZClcbiAgICAgIGJ1ZmZlclt4c19wdHIraV0gPSBrMSAtIGszXG4gICAgICBidWZmZXJbeXNfcHRyK2ldID0gazEgKyBrMlxuICAgIH1cbiAgICAvL1plcm8gb3V0IHRoZSByZXN0XG4gICAgZm9yKGk9bmNvbHM7IGk8bTsgKytpKSB7XG4gICAgICBidWZmZXJbeHNfcHRyK2ldID0gMC4wXG4gICAgfVxuICAgIGZvcihpPW5jb2xzOyBpPG07ICsraSkge1xuICAgICAgYnVmZmVyW3lzX3B0citpXSA9IDAuMFxuICAgIH1cbiAgICBcbiAgICAvLyBGRlQgYnVmZmVyXG4gICAgZmZ0UmFkaXgyKDEsIDEsIG0sIGJ1ZmZlciwgeHNfcHRyLCB5c19wdHIpXG4gICAgXG4gICAgLy8gQXBwbHkgbXVsdGlwbGllclxuICAgIGZvcihpPTA7IGk8bTsgKytpKSB7XG4gICAgICBhID0gYnVmZmVyW3hzX3B0citpXVxuICAgICAgYiA9IGJ1ZmZlclt5c19wdHIraV1cbiAgICAgIGMgPSBidWZmZXJbY2Z0X3B0citpXVxuICAgICAgZCA9IGJ1ZmZlcltzZnRfcHRyK2ldXG4gICAgICBrMSA9IGMgKiAoYSArIGIpXG4gICAgICBrMiA9IGEgKiAoZCAtIGMpXG4gICAgICBrMyA9IGIgKiAoYyArIGQpXG4gICAgICBidWZmZXJbeHNfcHRyK2ldID0gazEgLSBrM1xuICAgICAgYnVmZmVyW3lzX3B0citpXSA9IGsxICsgazJcbiAgICB9XG4gICAgXG4gICAgLy8gSW52ZXJzZSBGRlQgYnVmZmVyXG4gICAgZmZ0UmFkaXgyKC0xLCAxLCBtLCBidWZmZXIsIHhzX3B0ciwgeXNfcHRyKVxuICAgIFxuICAgIC8vIENvcHkgcmVzdWx0IGJhY2sgaW50byB4L3lcbiAgICBmb3IoaT0wOyBpPG5jb2xzOyArK2kpIHtcbiAgICAgIGEgPSBidWZmZXJbeHNfcHRyK2ldXG4gICAgICBiID0gYnVmZmVyW3lzX3B0citpXVxuICAgICAgYyA9IGJ1ZmZlcltjb3NfcHRyK2ldXG4gICAgICBkID0gLWJ1ZmZlcltzaW5fcHRyK2ldXG4gICAgICBrMSA9IGMgKiAoYSArIGIpXG4gICAgICBrMiA9IGEgKiAoZCAtIGMpXG4gICAgICBrMyA9IGIgKiAoYyArIGQpXG4gICAgICBidWZmZXJbeF9wdHIraV0gPSB3ICogKGsxIC0gazMpXG4gICAgICBidWZmZXJbeV9wdHIraV0gPSB3ICogKGsxICsgazIpXG4gICAgfVxuICAgIFxuICAgIHhfcHRyICs9IG5jb2xzXG4gICAgeV9wdHIgKz0gbmNvbHNcbiAgfVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIFBhcnNlciA9IHJlcXVpcmUoXCIuL2xpYi9wYXJzZXIuanNcIilcbiAgLCBjcmVhdGVTaGltID0gcmVxdWlyZShcIi4vbGliL3NoaW0uanNcIilcblxudmFyIFJFUVVJUkVEX0ZJRUxEUyA9IFsgXCJhcmdzXCIsIFwiYm9keVwiIF1cbnZhciBPUFRJT05BTF9GSUVMRFMgPSBbIFwicHJlXCIsIFwicG9zdFwiLCBcInByaW50Q29kZVwiIF1cblxuZnVuY3Rpb24gQ29tcGlsZWRQcm9jZWR1cmUoKSB7XG4gIHRoaXMubnVtQXJncyA9IDBcbiAgdGhpcy5udW1BcnJheUFyZ3MgPSAwXG4gIHRoaXMubnVtU2NhbGFyQXJncyA9IDBcbiAgdGhpcy5oYXNJbmRleCA9IGZhbHNlXG4gIHRoaXMuaGFzU2hhcGUgPSBmYWxzZVxuICB0aGlzLmhhc1JldHVybiA9IGZhbHNlXG4gIHRoaXMucHJlID0gXCJcIlxuICB0aGlzLmJvZHkgPSBcIlwiXG4gIHRoaXMucG9zdCA9IFwiXCJcbiAgdGhpcy51bnJvbGwgPSAxXG4gIHRoaXMucHJpbnRDb2RlID0gZmFsc2Vcbn1cblxuZnVuY3Rpb24gY29tcGlsZSh1c2VyX2FyZ3MpIHtcbiAgZm9yKHZhciBpZCBpbiB1c2VyX2FyZ3MpIHtcbiAgICBpZihSRVFVSVJFRF9GSUVMRFMuaW5kZXhPZihpZCkgPCAwICYmXG4gICAgICAgT1BUSU9OQUxfRklFTERTLmluZGV4T2YoaWQpIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBhcmd1bWVudCAnXCIraWQrXCInIHBhc3NlZCB0byBleHByZXNzaW9uIGNvbXBpbGVyXCIpXG4gICAgfVxuICB9XG4gIGZvcih2YXIgaT0wOyBpPFJFUVVJUkVEX0ZJRUxEUy5sZW5ndGg7ICsraSkge1xuICAgIGlmKCF1c2VyX2FyZ3NbUkVRVUlSRURfRklFTERTW2ldXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyBhcmd1bWVudDogXCIgKyBSRVFVSVJFRF9GSUVMRFNbaV0pXG4gICAgfVxuICB9XG4gIC8vUGFyc2UgYXJndW1lbnRzXG4gIHZhciBwcm9jID0gbmV3IENvbXBpbGVkUHJvY2VkdXJlKClcbiAgdmFyIHByb2NfYXJncyA9IHVzZXJfYXJncy5hcmdzLnNsaWNlKDApXG4gIHZhciBzaGltX2FyZ3MgPSBbXVxuICBmb3IodmFyIGk9MDsgaTxwcm9jX2FyZ3MubGVuZ3RoOyArK2kpIHtcbiAgICBzd2l0Y2gocHJvY19hcmdzW2ldKSB7XG4gICAgICBjYXNlIFwiYXJyYXlcIjpcbiAgICAgICAgc2hpbV9hcmdzLnB1c2goXCJhcnJheVwiICsgcHJvYy5udW1BcnJheUFyZ3MpXG4gICAgICAgIHByb2NfYXJnc1tpXSArPSAocHJvYy5udW1BcnJheUFyZ3MrKylcbiAgICAgIGJyZWFrXG4gICAgICBjYXNlIFwic2NhbGFyXCI6XG4gICAgICAgIHNoaW1fYXJncy5wdXNoKFwic2NhbGFyXCIgKyBwcm9jLm51bVNjYWxhckFyZ3MpXG4gICAgICAgIHByb2NfYXJnc1tpXSArPSAocHJvYy5udW1TY2FsYXJBcmdzKyspXG4gICAgICBicmVha1xuICAgICAgY2FzZSBcImluZGV4XCI6XG4gICAgICAgIHByb2MuaGFzSW5kZXggPSB0cnVlXG4gICAgICBicmVha1xuICAgICAgY2FzZSBcInNoYXBlXCI6XG4gICAgICAgIHByb2MuaGFzU2hhcGUgPSB0cnVlXG4gICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBhcmd1bWVudCB0eXBlc1wiKVxuICAgIH1cbiAgfVxuICBpZihwcm9jLm51bUFycmF5QXJncyA8PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gYXJyYXkgYXJndW1lbnRzIHNwZWNpZmllZFwiKVxuICB9XG4gIFxuICAvL1BhcnNlIGJsb2Nrc1xuICB2YXIgcGFyc2VyID0gbmV3IFBhcnNlcihwcm9jX2FyZ3MpXG4gICAgLCBwcmUgPSB1c2VyX2FyZ3MucHJlIHx8IG51bGxcbiAgICAsIGJvZHkgPSB1c2VyX2FyZ3MuYm9keVxuICAgICwgcG9zdCA9IHVzZXJfYXJncy5wb3N0IHx8IG51bGxcbiAgcGFyc2VyLnByZXByb2Nlc3MocHJlKVxuICBwYXJzZXIucHJlcHJvY2Vzcyhib2R5KVxuICBwYXJzZXIucHJlcHJvY2Vzcyhwb3N0KVxuICBwcm9jLnByZSAgPSBwYXJzZXIucHJlQmxvY2soKSArIFwiXFxuXCIgKyBwYXJzZXIucHJvY2VzcyhwcmUpXG4gIHByb2MuYm9keSA9IHBhcnNlci5wcm9jZXNzKGJvZHkpXG4gIHByb2MucG9zdCA9IHBhcnNlci5wcm9jZXNzKHBvc3QpICsgXCJcXG5cIiArIHBhcnNlci5wb3N0QmxvY2soKVxuICBwcm9jLmhhc1JldHVybiA9IHBhcnNlci5oYXNSZXR1cm5cbiAgXG4gIC8vUGFyc2Ugb3B0aW9uc1xuICBwcm9jLnByaW50Q29kZSA9IHVzZXJfYXJncy5wcmludENvZGUgfHwgZmFsc2VcbiAgXG4gIC8vQXNzZW1ibGUgc2hpbVxuICByZXR1cm4gY3JlYXRlU2hpbShzaGltX2FyZ3MsIHByb2MpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gY29tcGlsZVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIFJFQ1VSU0lPTl9MSU1JVCA9IDMyXG5cbmZ1bmN0aW9uIGlubmVyRmlsbChvcmRlciwgcHJvY2VkdXJlKSB7XG4gIHZhciBkaW1lbnNpb24gPSBvcmRlci5sZW5ndGhcbiAgICAsIG5hcmdzID0gcHJvY2VkdXJlLm51bUFycmF5QXJnc1xuICAgICwgaGFzX2luZGV4ID0gcHJvY2VkdXJlLmhhc0luZGV4XG4gICAgLCBjb2RlID0gW11cbiAgICAsIGlkeD0wLCBwaWR4PTAsIGksIGpcbiAgZm9yKGk9MDsgaTxkaW1lbnNpb247ICsraSkge1xuICAgIGNvZGUucHVzaChcInZhciBpXCIraStcIj0wO1wiKVxuICB9XG4gIC8vQ29tcHV0ZSBzY2FuIGRlbHRhc1xuICBmb3Ioaj0wOyBqPG5hcmdzOyArK2opIHtcbiAgICBmb3IoaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgICBwaWR4ID0gaWR4XG4gICAgICBpZHggPSBvcmRlcltpXVxuICAgICAgaWYoaSA9PT0gMCkge1xuICAgICAgICBjb2RlLnB1c2goXCJ2YXIgZFwiK2orXCJzXCIraStcIj1zdHJpZGVcIitqK1wiW1wiK2lkeCtcIl18MDtcIilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvZGUucHVzaChcInZhciBkXCIraitcInNcIitpK1wiPShzdHJpZGVcIitqK1wiW1wiK2lkeCtcIl0tc2hhcGVbXCIrcGlkeCtcIl0qc3RyaWRlXCIraitcIltcIitwaWR4K1wiXSl8MDtcIilcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy9PdXRlciBzY2FuIGxvb3BcbiAgZm9yKGk9ZGltZW5zaW9uLTE7IGk+PTA7IC0taSkge1xuICAgIGlkeCA9IG9yZGVyW2ldXG4gICAgY29kZS5wdXNoKFwiZm9yKGlcIitpK1wiPXNoYXBlW1wiK2lkeCtcIl18MDstLWlcIitpK1wiPj0wOyl7XCIpXG4gIH1cbiAgLy9QdXNoIGJvZHkgb2YgaW5uZXIgbG9vcFxuICBjb2RlLnB1c2gocHJvY2VkdXJlLmJvZHkpXG4gIC8vQWR2YW5jZSBzY2FuIHBvaW50ZXJzXG4gIGZvcihpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICBwaWR4ID0gaWR4XG4gICAgaWR4ID0gb3JkZXJbaV1cbiAgICBmb3Ioaj0wOyBqPG5hcmdzOyArK2opIHtcbiAgICAgIGNvZGUucHVzaChcInB0clwiK2orXCIrPWRcIitqK1wic1wiK2kpXG4gICAgfVxuICAgIGlmKGhhc19pbmRleCkge1xuICAgICAgaWYoaSA+IDApIHtcbiAgICAgICAgY29kZS5wdXNoKFwiaW5kZXhbXCIrcGlkeCtcIl0tPXNoYXBlW1wiK3BpZHgrXCJdXCIpXG4gICAgICB9XG4gICAgICBjb2RlLnB1c2goXCIrK2luZGV4W1wiK2lkeCtcIl1cIilcbiAgICB9XG4gICAgY29kZS5wdXNoKFwifVwiKVxuICB9XG4gIHJldHVybiBjb2RlLmpvaW4oXCJcXG5cIilcbn1cblxuZnVuY3Rpb24gb3V0ZXJGaWxsKG1hdGNoZWQsIG9yZGVyLCBwcm9jZWR1cmUpIHtcbiAgdmFyIGRpbWVuc2lvbiA9IG9yZGVyLmxlbmd0aFxuICAgICwgbmFyZ3MgPSBwcm9jZWR1cmUubnVtQXJyYXlBcmdzXG4gICAgLCBoYXNfaW5kZXggPSBwcm9jZWR1cmUuaGFzSW5kZXhcbiAgICAsIGNvZGUgPSBbXVxuICAgICwgc3RhdGljX2FyZ3MgPSBkaW1lbnNpb25cbiAgICAsIGluZGV4X3N0YXJ0ID0gbmFyZ3MgKyBzdGF0aWNfYXJnc1xuICAgICwgZnJhbWVfc2l6ZSA9IGluZGV4X3N0YXJ0ICsgKGhhc19pbmRleCA/IGRpbWVuc2lvbiA6IDApXG4gICAgLCBpXG4gIFxuICAvL0luaXRpYWl6ZSB2YXJpYWJsZXNcbiAgY29kZS5wdXNoKFwidmFyIGk9MCxsPTAsdj0wLGQ9MCxzcD0wXCIpXG4gIFxuICAvL0JlZ2luIHJlY3Vyc2lvblxuICBjb2RlLnB1c2goXCJ3aGlsZSh0cnVlKXtcIilcbiAgICBcbiAgICAvL1dhbGsgb3ZlciBydW5zIHRvIGdldCBib3VuZHNcbiAgICBjb2RlLnB1c2goXCJsPVwiK1JFQ1VSU0lPTl9MSU1JVClcbiAgICBjb2RlLnB1c2goXCJ2PVwiK1JFQ1VSU0lPTl9MSU1JVClcbiAgICBjb2RlLnB1c2goXCJkPVwiK21hdGNoZWQpXG4gIFxuICAgIGZvcihpPW1hdGNoZWQ7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICAgIGNvZGUucHVzaChcImlmKHNoYXBlW1wiK2krXCJdPmwpe1wiKVxuICAgICAgICBjb2RlLnB1c2goXCJ2PWx8MFwiKVxuICAgICAgICBjb2RlLnB1c2goXCJsPXNoYXBlW1wiK2krXCJdfDBcIilcbiAgICAgICAgY29kZS5wdXNoKFwiZD1cIitpK1wifDBcIilcbiAgICAgIGNvZGUucHVzaChcIn1lbHNlIGlmKHNoYXBlW1wiK2krXCJdPnYpe1wiKVxuICAgICAgICBjb2RlLnB1c2goXCJ2PXNoYXBlW1wiK2krXCJdfDBcIilcbiAgICAgIGNvZGUucHVzaChcIn1cIilcbiAgICB9XG4gIFxuICAgIGNvZGUucHVzaChcImlmKGw8PVwiK1JFQ1VSU0lPTl9MSU1JVCtcIil7XCIpXG4gICAgICBjb2RlLnB1c2goaW5uZXJGaWxsKG9yZGVyLCBwcm9jZWR1cmUpKVxuICAgIGNvZGUucHVzaChcIn0gZWxzZSB7XCIpXG4gIFxuICAgICAgLy9Sb3VuZCB2IHRvIHByZXZpb3VzIHBvd2VyIG9mIDJcbiAgICAgIGNvZGUucHVzaChcInY9KHY+Pj4xKS0xXCIpXG4gICAgICBjb2RlLnB1c2goXCJmb3IoaT0xO2k8PTE2O2k8PD0xKXt2fD12Pj4+aX1cIilcbiAgICAgIGNvZGUucHVzaChcIisrdlwiKVxuICAgICAgY29kZS5wdXNoKFwiaWYodjxcIitSRUNVUlNJT05fTElNSVQrXCIpIHY9XCIrUkVDVVJTSU9OX0xJTUlUKVxuICBcbiAgICAgIC8vU2V0IHNoYXBlXG4gICAgICBjb2RlLnB1c2goXCJpPXNoYXBlW2RdXCIpXG4gICAgICBjb2RlLnB1c2goXCJzaGFwZVtkXT12XCIpXG4gIFxuICAgICAgLy9GaWxsIGFjcm9zcyByb3dcbiAgICAgIGNvZGUucHVzaChcImZvcig7aT49djtpLT12KXtcIilcbiAgICAgICAgZm9yKGk9MDsgaTxkaW1lbnNpb247ICsraSkge1xuICAgICAgICAgIGNvZGUucHVzaChcIlNUQUNLW3NwK1wiK2krXCJdPXNoYXBlW1wiK2krXCJdXCIpXG4gICAgICAgIH1cbiAgICAgICAgZm9yKGk9MDsgaTxuYXJnczsgKytpKSB7XG4gICAgICAgICAgY29kZS5wdXNoKFwiU1RBQ0tbc3ArXCIrKGkrc3RhdGljX2FyZ3MpK1wiXT1wdHJcIitpK1wifDBcIilcbiAgICAgICAgfVxuICAgICAgICBpZihoYXNfaW5kZXgpIHtcbiAgICAgICAgICBmb3IoaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgICAgICAgICBjb2RlLnB1c2goXCJTVEFDS1tzcCtcIisoaStpbmRleF9zdGFydCkrXCJdPWluZGV4W1wiK2krXCJdXCIpXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvZGUucHVzaChcImluZGV4W2RdKz12XCIpXG4gICAgICAgIH1cbiAgICAgICAgZm9yKGk9MDsgaTxuYXJnczsgKytpKSB7XG4gICAgICAgICAgY29kZS5wdXNoKFwicHRyXCIraStcIis9KHYqc3RyaWRlXCIraStcIltkXSl8MFwiKVxuICAgICAgICB9XG4gICAgICAgIGNvZGUucHVzaChcInNwKz1cIitmcmFtZV9zaXplKVxuICAgICAgY29kZS5wdXNoKFwifVwiKVxuICBcbiAgICAgIC8vSGFuZGxlIGVkZ2UgY2FzZVxuICAgICAgY29kZS5wdXNoKFwiaWYoaT4wKXtcIilcbiAgICAgICAgY29kZS5wdXNoKFwic2hhcGVbZF09aVwiKVxuICAgICAgICBmb3IoaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgICAgICAgY29kZS5wdXNoKFwiU1RBQ0tbc3ArXCIraStcIl09c2hhcGVbXCIraStcIl1cIilcbiAgICAgICAgfVxuICAgICAgICBmb3IoaT0wOyBpPG5hcmdzOyArK2kpIHtcbiAgICAgICAgICBjb2RlLnB1c2goXCJTVEFDS1tzcCtcIisoaStzdGF0aWNfYXJncykrXCJdPXB0clwiK2krXCJ8MFwiKVxuICAgICAgICB9XG4gICAgICAgIGlmKGhhc19pbmRleCkge1xuICAgICAgICAgIGZvcihpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICAgICAgICAgIGNvZGUucHVzaChcIlNUQUNLW3NwK1wiKyhpK2luZGV4X3N0YXJ0KStcIl09aW5kZXhbXCIraStcIl1cIilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29kZS5wdXNoKFwic3ArPVwiK2ZyYW1lX3NpemUpXG4gICAgICBjb2RlLnB1c2goXCJ9XCIpXG4gICAgY29kZS5wdXNoKFwifVwiKVxuICBcbiAgICAvL1BvcCBwcmV2aW91cyBzdGF0ZVxuICAgIGNvZGUucHVzaChcImlmKHNwPD0wKXtcIilcbiAgICAgIGNvZGUucHVzaChcImJyZWFrXCIpXG4gICAgY29kZS5wdXNoKFwifVwiKVxuICAgIGNvZGUucHVzaChcInNwLT1cIitmcmFtZV9zaXplKVxuICAgIGZvcihpPTA7IGk8ZGltZW5zaW9uOyArK2kpIHtcbiAgICAgIGNvZGUucHVzaChcInNoYXBlW1wiK2krXCJdPVNUQUNLW3NwK1wiK2krXCJdXCIpXG4gICAgfVxuICAgIGZvcihpPTA7IGk8bmFyZ3M7ICsraSkge1xuICAgICAgY29kZS5wdXNoKFwicHRyXCIraStcIj1TVEFDS1tzcCtcIisoaStzdGF0aWNfYXJncykrXCJdXCIpXG4gICAgfVxuICAgIGlmKGhhc19pbmRleCkge1xuICAgICAgZm9yKGk9MDsgaTxkaW1lbnNpb247ICsraSkge1xuICAgICAgICBjb2RlLnB1c2goXCJpbmRleFtcIitpK1wiXT1TVEFDS1tzcCtcIisoaStpbmRleF9zdGFydCkrXCJdXCIpXG4gICAgICB9XG4gICAgfVxuIGNvZGUucHVzaChcIn1cIilcbiByZXR1cm4gY29kZS5qb2luKFwiXFxuXCIpXG59XG5cbmZ1bmN0aW9uIG1ham9yT3JkZXIob3JkZXJzKSB7XG4gIHJldHVybiBvcmRlcnNbMF1cbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGUob3JkZXJzLCBwcm9jZWR1cmUpIHtcbiAgdmFyIG9yZGVyID0gbWFqb3JPcmRlcihvcmRlcnMpXG4gICAgLCBkaW1lbnNpb24gPSBvcmRlcnNbMF0ubGVuZ3RoXG4gICAgLCBuYXJncyA9IHByb2NlZHVyZS5udW1BcnJheUFyZ3NcbiAgICAsIGNvZGUgPSBbJ1widXNlIHN0cmljdFwiJ11cbiAgICAsIG1hdGNoZWQsIGksIGpcbiAgICAsIGFyZ2xpc3QgPSBbIFwiU1RBQ0tcIiwgXCJzaGFwZVwiIF1cbiAgLy9DcmVhdGUgcHJvY2VkdXJlIGFyZ3VtZW50c1xuICBmb3IoaSA9IDA7IGk8bmFyZ3M7ICsraSkge1xuICAgIGFyZ2xpc3QucHVzaChcImFyclwiICsgaSlcbiAgICBhcmdsaXN0LnB1c2goXCJwdHJcIiArIGkpXG4gICAgYXJnbGlzdC5wdXNoKFwic3RyaWRlXCIgKyBpKVxuICAgIGNvZGUucHVzaChcInB0clwiK2krXCJ8PTBcIilcbiAgICBmb3IoaiA9IDA7IGo8ZGltZW5zaW9uOyArK2opIHtcbiAgICAgIGNvZGUucHVzaChcInN0cmlkZVwiK2krXCJbXCIraitcIl18PTBcIilcbiAgICB9XG4gIH1cbiAgZm9yKGkgPSAwOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgY29kZS5wdXNoKFwic2hhcGVbXCIraStcIl18PTBcIilcbiAgfVxuICBmb3IoaSA9IDA7IGk8cHJvY2VkdXJlLm51bVNjYWxhckFyZ3M7ICsraSkge1xuICAgIGFyZ2xpc3QucHVzaChcInNjYWxhclwiK2kpXG4gIH1cbiAgaWYocHJvY2VkdXJlLmhhc0luZGV4KSB7XG4gICAgY29kZS5wdXNoKFwidmFyIGluZGV4PVtcIilcbiAgICBmb3IoaT0wOyBpPGRpbWVuc2lvbjsgKytpKSB7XG4gICAgICBjb2RlLnB1c2goKGkgPiAwKSA/IFwiLDBcIjpcIjBcIilcbiAgICB9XG4gICAgY29kZS5wdXNoKFwiXVwiKVxuICB9XG4gIGlmKHByb2NlZHVyZS5oYXNTaGFwZSkge1xuICAgIGNvZGUucHVzaChcInZhciBpbmxpbmVfc2hhcGU9c2hhcGUuc2xpY2UoMClcIilcbiAgfVxuICAvL0NvbXB1dGUgbnVtYmVyIG9mIG1hdGNoaW5nIG9yZGVyc1xuICBtYXRjaGVkID0gMDtcbm1hdGNoZWRfbG9vcDpcbiAgd2hpbGUobWF0Y2hlZCA8IGRpbWVuc2lvbikge1xuICAgIGZvcihqPTE7IGo8bmFyZ3M7ICsraikge1xuICAgICAgaWYob3JkZXJzW2pdW21hdGNoZWRdICE9PSBvcmRlcnNbMF1bbWF0Y2hlZF0pIHtcbiAgICAgICAgYnJlYWsgbWF0Y2hlZF9sb29wO1xuICAgICAgfVxuICAgIH1cbiAgICArK21hdGNoZWQ7XG4gIH1cbiAgLy9HZW5lcmF0ZSBjb2RlXG4gIGNvZGUucHVzaChwcm9jZWR1cmUucHJlKVxuICBpZihtYXRjaGVkID09PSBkaW1lbnNpb24pIHtcbiAgICBjb2RlLnB1c2goaW5uZXJGaWxsKG9yZGVyLCBwcm9jZWR1cmUpKVxuICB9IGVsc2Uge1xuICAgIGNvZGUucHVzaChvdXRlckZpbGwobWF0Y2hlZCwgb3JkZXIsIHByb2NlZHVyZSkpXG4gIH1cbiAgY29kZS5wdXNoKHByb2NlZHVyZS5wb3N0KVxuICBhcmdsaXN0LnB1c2goY29kZS5qb2luKFwiXFxuXCIpKVxuICAvL1JldHVybiByZXN1bHRcbiAgdmFyIHJlc3VsdCA9IEZ1bmN0aW9uLmFwcGx5KG51bGwsIGFyZ2xpc3QpXG4gIGlmKHByb2NlZHVyZS5wcmludENvZGUpIHtcbiAgICBjb25zb2xlLmxvZyhcIkZvciBvcmRlcjpcIiwgb3JkZXJzLCBcIkdlbmVyYXRlZCBjb2RlOiBcXG5cIiwgcmVzdWx0K1wiXCIpXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdlbmVyYXRlIiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIGZhbGFmZWwgPSByZXF1aXJlKFwiZmFsYWZlbFwiKVxuXG5mdW5jdGlvbiBpc0dsb2JhbChpZGVudGlmaWVyKSB7XG4gIGlmKHR5cGVvZih3aW5kb3cpICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgaW4gd2luZG93XG4gIH0gZWxzZSBpZih0eXBlb2YoR0xPQkFMKSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHJldHVybiBpZGVudGlmaWVyIGluIEdMT0JBTFxuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldEFyZ3Moc3JjKSB7XG4gIHZhciBhcmdzID0gW11cbiAgZmFsYWZlbChzcmMsIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgaVxuICAgIGlmKG5vZGUudHlwZSA9PT0gXCJGdW5jdGlvbkV4cHJlc3Npb25cIiAmJlxuICAgICAgIG5vZGUucGFyZW50LnBhcmVudC5wYXJlbnQudHlwZSA9PT0gXCJQcm9ncmFtXCIpIHtcbiAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobm9kZS5wYXJhbXMubGVuZ3RoKVxuICAgICAgZm9yKGk9MDsgaTxub2RlLnBhcmFtcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBhcmdzW2ldID0gbm9kZS5wYXJhbXNbaV0ubmFtZVxuICAgICAgfVxuICAgIH1cbiAgfSlcbiAgcmV0dXJuIGFyZ3Ncbn1cblxuZnVuY3Rpb24gUGFyc2VyKGFyZ3MpIHtcbiAgdGhpcy5hcmdzID0gYXJnc1xuICB0aGlzLnRoaXNfdmFycyA9IFtdXG4gIHRoaXMuY29tcHV0ZWRfdGhpcyA9IGZhbHNlXG4gIHRoaXMucHJlZml4X2NvdW50ID0gMFxuICB0aGlzLmhhc1JldHVybiA9IGZhbHNlXG59XG5cbi8vUHJlcHJvY2Vzc2luZyBwYXNzIGlzIG5lZWRlZCB0byBleHBsb2RlIHRoZSBcInRoaXNcIiBvYmplY3RcblBhcnNlci5wcm90b3R5cGUucHJlcHJvY2VzcyA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgaWYoIWZ1bmMgfHwgdGhpcy5jb21wdXRlZF90aGlzKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgdmFyIHNyYyA9IFwiKFwiICsgZnVuYyArIFwiKSgpXCJcbiAgICAsIHRoaXNfdmFycyA9IHRoaXMudGhpc192YXJzXG4gICAgLCBjb21wdXRlZF90aGlzID0gdGhpcy5jb21wdXRlZF90aGlzXG4gIGZhbGFmZWwoc3JjLCBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5cbiAgICBpZihub2RlLnR5cGUgPT09IFwiVGhpc0V4cHJlc3Npb25cIikge1xuICAgICAgaWYobm9kZS5wYXJlbnQudHlwZSA9PT0gXCJNZW1iZXJFeHByZXNzaW9uXCIgJiYgIW5vZGUucGFyZW50LmNvbXB1dGVkKSB7XG4gICAgICAgIG4gPSBub2RlLnBhcmVudC5wcm9wZXJ0eS5uYW1lXG4gICAgICAgIGlmKHRoaXNfdmFycy5pbmRleE9mKG4pIDwgMCkge1xuICAgICAgICAgIHRoaXNfdmFycy5wdXNoKG4pXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbXB1dGVkX3RoaXMgPSB0cnVlXG4gICAgICB9XG4gICAgfVxuICB9KVxuICBpZihjb21wdXRlZF90aGlzKSB7XG4gICAgdGhpcy50aGlzX3ZhcnMgPSBbXVxuICB9XG4gIHRoaXMuY29tcHV0ZWRfdGhpcyA9IGNvbXB1dGVkX3RoaXNcbn1cblxuUGFyc2VyLnByb3RvdHlwZS5wcm9jZXNzID0gZnVuY3Rpb24oZnVuYykge1xuICBpZighZnVuYykge1xuICAgIHJldHVybiBcIlwiXG4gIH1cbiAgdmFyIGxhYmVsID0gdGhpcy5wcmVmaXhfY291bnQrK1xuICAgICwgc3JjID0gXCIoXCIgKyBmdW5jICsgXCIpKClcIlxuICAgICwgYmxvY2tfYXJncyA9IGdldEFyZ3Moc3JjKVxuICAgICwgcHJvY19hcmdzID0gdGhpcy5hcmdzXG4gICAgLCByZXN1bHQgPSBcIlwiXG4gICAgLCBpbmxpbmVfcHJlZml4ID0gXCJpbmxpbmVcIiArIGxhYmVsICsgXCJfXCJcbiAgICAsIGhhc1JldHVybiA9IHRoaXMuaGFzUmV0dXJuXG4gIGZhbGFmZWwoc3JjLCBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG4sIGksIGpcbiAgICBpZihub2RlLnR5cGUgPT09IFwiRnVuY3Rpb25FeHByZXNzaW9uXCIgJiZcbiAgICAgICBub2RlLnBhcmVudC5wYXJlbnQucGFyZW50LnR5cGUgPT09IFwiUHJvZ3JhbVwiKSB7XG4gICAgICByZXN1bHQgPSBub2RlLmJvZHkuc291cmNlKClcbiAgICB9IGVsc2UgaWYobm9kZS50eXBlID09PSBcIklkZW50aWZpZXJcIikge1xuICAgICAgaWYobm9kZS5wYXJlbnQudHlwZSA9PT0gXCJNZW1iZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgICAgaWYoKG5vZGUucGFyZW50LnByb3BlcnR5ID09PSBub2RlICYmICFub2RlLnBhcmVudC5jb21wdXRlZCkgfHxcbiAgICAgICAgICAgbm9kZS5wYXJlbnQub2JqZWN0LnR5cGUgPT09IFwiVGhpc0V4cHJlc3Npb25cIikge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBuID0gbm9kZS5uYW1lXG4gICAgICBpID0gYmxvY2tfYXJncy5pbmRleE9mKG4pXG4gICAgICBpZihpID49IDApIHtcbiAgICAgICAgaWYoaSA8IHByb2NfYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICBpZihwcm9jX2FyZ3NbaV0uaW5kZXhPZihcImFycmF5XCIpID09PSAwKSB7XG4gICAgICAgICAgICBqID0gcGFyc2VJbnQocHJvY19hcmdzW2ldLnN1YnN0cig1KSlcbiAgICAgICAgICAgIG5vZGUudXBkYXRlKFwiYXJyXCIraitcIltwdHJcIitqK1wiXVwiKVxuICAgICAgICAgIH0gZWxzZSBpZihwcm9jX2FyZ3NbaV0gPT09IFwic2hhcGVcIikge1xuICAgICAgICAgICAgbm9kZS51cGRhdGUoXCJpbmxpbmVfc2hhcGVcIilcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS51cGRhdGUocHJvY19hcmdzW2ldKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBub2RlLnVwZGF0ZShpbmxpbmVfcHJlZml4ICsgbm9kZS5zb3VyY2UoKSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKGlzR2xvYmFsKG4pKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS51cGRhdGUoaW5saW5lX3ByZWZpeCArIG5vZGUuc291cmNlKCkpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmKG5vZGUudHlwZSA9PT0gXCJNZW1iZXJFeHByZXNzaW9uXCIpIHtcbiAgICAgIGlmKG5vZGUub2JqZWN0LnR5cGUgPT09IFwiVGhpc0V4cHJlc3Npb25cIikge1xuICAgICAgICBub2RlLnVwZGF0ZShcInRoaXNfXCIgKyBub2RlLnByb3BlcnR5LnNvdXJjZSgpLnRyaW1MZWZ0KCkpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmKG5vZGUudHlwZSA9PT0gXCJUaGlzRXhwcmVzc2lvblwiKSB7XG4gICAgICBpZihub2RlLnBhcmVudC50eXBlICE9PSBcIk1lbWJlckV4cHJlc3Npb25cIikge1xuICAgICAgICBub2RlLnVwZGF0ZShcInRoaXNfXCIpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmKG5vZGUudHlwZSA9PT0gXCJSZXR1cm5TdGF0ZW1lbnRcIikge1xuICAgICAgaGFzUmV0dXJuID0gdHJ1ZVxuICAgIH1cbiAgfSlcbiAgdGhpcy5oYXNSZXR1cm4gPSBoYXNSZXR1cm5cbiAgdmFyIHByZWZpeCA9IFwiXCJcbiAgZm9yKHZhciBpPXRoaXMuYXJncy5sZW5ndGg7IGk8YmxvY2tfYXJncy5sZW5ndGg7ICsraSkge1xuICAgIHByZWZpeCArPSBcInZhciBcIiArIGJsb2NrX2FyZ3NbaV0gKyBcIlxcblwiXG4gIH1cbiAgcmV0dXJuIHByZWZpeCArIHJlc3VsdFxufVxuXG5QYXJzZXIucHJvdG90eXBlLnByZUJsb2NrID0gZnVuY3Rpb24oKSB7XG4gIGlmKHRoaXMuY29tcHV0ZWRfdGhpcykge1xuICAgIHJldHVybiBcInZhciB0aGlzXz17fVwiXG4gIH0gZWxzZSBpZih0aGlzLnRoaXNfdmFycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIFwidmFyIHRoaXNfXCIgKyB0aGlzLnRoaXNfdmFycy5qb2luKFwiLHRoaXNfXCIpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFwiXCJcbiAgfVxufVxuXG5QYXJzZXIucHJvdG90eXBlLnBvc3RCbG9jayA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJcIlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlciIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBnZW5lcmF0ZSA9IHJlcXVpcmUoXCIuL2dlbmVyYXRlLmpzXCIpXG5cbi8vUmV1c2Ugc3RhY2sgYWNyb3NzIGFsbCBzaGltc1xudmFyIFNUQUNLID0gbmV3IEludDMyQXJyYXkoMTAyNClcblxuZnVuY3Rpb24gU2hpbShwcm9jZWR1cmUpIHtcbiAgdGhpcy5tZW1vaXplZCA9IHt9XG4gIHRoaXMucHJvY2VkdXJlID0gcHJvY2VkdXJlXG59XG5cblNoaW0ucHJvdG90eXBlLmNoZWNrU2hhcGUgPSBmdW5jdGlvbihhLCBiKSB7XG4gIGlmKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlNoYXBlIG1pc21hdGNoXCIpXG4gIH1cbiAgZm9yKHZhciBpPWEubGVuZ3RoLTE7IGk+PTA7IC0taSkge1xuICAgIGlmKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlNoYXBlIG1pc21hdGNoXCIpXG4gICAgfVxuICB9XG59XG5cblNoaW0ucHJvdG90eXBlLmdldFN0YWNrID0gZnVuY3Rpb24oc2l6ZSkge1xuICBpZihzaXplIDwgU1RBQ0subGVuZ3RoKSB7XG4gICAgcmV0dXJuIFNUQUNLXG4gIH1cbiAgU1RBQ0sgPSBuZXcgSW50MzJBcnJheShzaXplKVxuICByZXR1cm4gU1RBQ0tcbn1cblxuZnVuY3Rpb24gY29tcGFyZTFzdChhLGIpIHsgcmV0dXJuIGFbMF0gLSBiWzBdOyB9XG5cblNoaW0ucHJvdG90eXBlLmdldE9yZGVyID0gZnVuY3Rpb24oc3RyaWRlKSB7XG4gIHZhciB6aXBwZWQgPSBuZXcgQXJyYXkoc3RyaWRlLmxlbmd0aClcbiAgZm9yKHZhciBpPTA7IGk8c3RyaWRlLmxlbmd0aDsgKytpKSB7XG4gICAgemlwcGVkW2ldID0gW01hdGguYWJzKHN0cmlkZVtpXSksIGldXG4gIH1cbiAgemlwcGVkLnNvcnQoY29tcGFyZTFzdClcbiAgdmFyIHVuemlwcGVkID0gbmV3IEFycmF5KHN0cmlkZS5sZW5ndGgpXG4gIGZvcih2YXIgaT0wOyBpPHN0cmlkZS5sZW5ndGg7ICsraSkge1xuICAgIHVuemlwcGVkW2ldID0gemlwcGVkW2ldWzFdXG4gIH1cbiAgcmV0dXJuIHVuemlwcGVkXG59XG5cblNoaW0ucHJvdG90eXBlLmdldFByb2MgPSBmdW5jdGlvbihvcmRlcnMpIHtcbiAgdmFyIHByb2NfbmFtZSA9IG9yZGVycy5qb2luKFwifFwiKVxuICAgICwgcHJvYyA9IHRoaXMubWVtb2l6ZWRbcHJvY19uYW1lXVxuICBpZighcHJvYykge1xuICAgIHByb2MgPSBnZW5lcmF0ZShvcmRlcnMsIHRoaXMucHJvY2VkdXJlKVxuICAgIHRoaXMubWVtb2l6ZWRbcHJvY19uYW1lXSA9IHByb2NcbiAgfVxuICByZXR1cm4gcHJvY1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTaGltKHNoaW1fYXJncywgcHJvY2VkdXJlKSB7XG4gIHZhciBjb2RlID0gW1wiXFxcInVzZSBzdHJpY3RcXFwiXCJdLCBpXG4gIC8vQ2hlY2sgc2hhcGVzXG4gIGZvcihpPTE7IGk8cHJvY2VkdXJlLm51bUFycmF5QXJnczsgKytpKSB7XG4gICAgY29kZS5wdXNoKFwidGhpcy5jaGVja1NoYXBlKGFycmF5MC5zaGFwZSxhcnJheVwiK2krXCIuc2hhcGUpXCIpXG4gIH1cbiAgLy9Mb2FkL2xhemlseSBnZW5lcmF0ZSBwcm9jZWR1cmUgYmFzZWQgb24gYXJyYXkgb3JkZXJpbmdcbiAgY29kZS5wdXNoKFwidmFyIHByb2MgPSB0aGlzLmdldFByb2MoW1wiKVxuICBmb3IoaT0wOyBpPHByb2NlZHVyZS5udW1BcnJheUFyZ3M7ICsraSkge1xuICAgIGNvZGUucHVzaCgoaT4wID8gXCIsXCIgOiBcIlwiKSArIFwidGhpcy5nZXRPcmRlcihhcnJheVwiK2krXCIuc3RyaWRlKVwiKVxuICB9XG4gIGNvZGUucHVzaChcIl0pXCIpXG4gIC8vQ2FsbCBwcm9jZWR1cmVcbiAgaWYocHJvY2VkdXJlLmhhc1JldHVybikge1xuICAgIGNvZGUucHVzaChcInJldHVybiBwcm9jKFwiKVxuICB9IGVsc2Uge1xuICAgIGNvZGUucHVzaChcInByb2MoXCIpXG4gIH1cbiAgY29kZS5wdXNoKFwidGhpcy5nZXRTdGFjayhcIiArIHByb2NlZHVyZS5udW1BcnJheUFyZ3MgKyBcIiooYXJyYXkwLnNoYXBlLmxlbmd0aCozMikpLCBhcnJheTAuc2hhcGUuc2xpY2UoMClcIilcbiAgLy9CaW5kIGFycmF5IGFyZ3VtZW50c1xuICBmb3IoaT0wOyBpPHByb2NlZHVyZS5udW1BcnJheUFyZ3M7ICsraSkge1xuICAgIGNvZGUucHVzaChcIixhcnJheVwiICsgaSArIFwiLmRhdGFcIilcbiAgICBjb2RlLnB1c2goXCIsYXJyYXlcIiArIGkgKyBcIi5vZmZzZXRcIilcbiAgICBjb2RlLnB1c2goXCIsYXJyYXlcIiArIGkgKyBcIi5zdHJpZGVcIilcbiAgfVxuICAvL0JpbmQgc2NhbGFyIGFyZ3VtZW50c1xuICBmb3IodmFyIGk9MDsgaTxwcm9jZWR1cmUubnVtU2NhbGFyQXJnczsgKytpKSB7XG4gICAgY29kZS5wdXNoKFwiLHNjYWxhclwiK2kpXG4gIH1cbiAgY29kZS5wdXNoKFwiKVwiKVxuICBpZighcHJvY2VkdXJlLmhhc1JldHVybikge1xuICAgIGNvZGUucHVzaChcInJldHVybiBhcnJheTBcIilcbiAgfVxuICAvL0NyZWF0ZSB0aGUgc2hpbVxuICBzaGltX2FyZ3MucHVzaChjb2RlLmpvaW4oXCJcXG5cIikpXG4gIHZhciByZXN1bHQgPSBGdW5jdGlvbi5hcHBseShudWxsLCBzaGltX2FyZ3MpXG4gIGlmKHByb2NlZHVyZS5wcmludENvZGUpIHtcbiAgICBjb25zb2xlLmxvZyhcIkdlbmVyYXRlZCBzaGltOlwiLCByZXN1bHQgKyBcIlwiKVxuICB9XG4gIHJldHVybiByZXN1bHQuYmluZChuZXcgU2hpbShwcm9jZWR1cmUpKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVNoaW1cblxuIiwidmFyIHBhcnNlID0gcmVxdWlyZSgnZXNwcmltYScpLnBhcnNlO1xudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbn07XG52YXIgZm9yRWFjaCA9IGZ1bmN0aW9uICh4cywgZm4pIHtcbiAgICBpZiAoeHMuZm9yRWFjaCkgcmV0dXJuIHhzLmZvckVhY2goZm4pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm4uY2FsbCh4cywgeHNbaV0sIGksIHhzKTtcbiAgICB9XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzcmMsIG9wdHMsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZuID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHNyYyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IHNyYztcbiAgICAgICAgc3JjID0gb3B0cy5zb3VyY2U7XG4gICAgICAgIGRlbGV0ZSBvcHRzLnNvdXJjZTtcbiAgICB9XG4gICAgc3JjID0gc3JjID09PSB1bmRlZmluZWQgPyBvcHRzLnNvdXJjZSA6IHNyYztcbiAgICBvcHRzLnJhbmdlID0gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIHNyYyAhPT0gJ3N0cmluZycpIHNyYyA9IFN0cmluZyhzcmMpO1xuICAgIFxuICAgIHZhciBhc3QgPSBwYXJzZShzcmMsIG9wdHMpO1xuICAgIFxuICAgIHZhciByZXN1bHQgPSB7XG4gICAgICAgIGNodW5rcyA6IHNyYy5zcGxpdCgnJyksXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkgeyByZXR1cm4gcmVzdWx0LmNodW5rcy5qb2luKCcnKSB9LFxuICAgICAgICBpbnNwZWN0IDogZnVuY3Rpb24gKCkgeyByZXR1cm4gcmVzdWx0LnRvU3RyaW5nKCkgfVxuICAgIH07XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBcbiAgICAoZnVuY3Rpb24gd2FsayAobm9kZSwgcGFyZW50KSB7XG4gICAgICAgIGluc2VydEhlbHBlcnMobm9kZSwgcGFyZW50LCByZXN1bHQuY2h1bmtzKTtcbiAgICAgICAgXG4gICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyhub2RlKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ3BhcmVudCcpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGNoaWxkID0gbm9kZVtrZXldO1xuICAgICAgICAgICAgaWYgKGlzQXJyYXkoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgZm9yRWFjaChjaGlsZCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGMgJiYgdHlwZW9mIGMudHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhbGsoYywgbm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoaWxkICYmIHR5cGVvZiBjaGlsZC50eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGluc2VydEhlbHBlcnMoY2hpbGQsIG5vZGUsIHJlc3VsdC5jaHVua3MpO1xuICAgICAgICAgICAgICAgIHdhbGsoY2hpbGQsIG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZm4obm9kZSk7XG4gICAgfSkoYXN0LCB1bmRlZmluZWQpO1xuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuIFxuZnVuY3Rpb24gaW5zZXJ0SGVscGVycyAobm9kZSwgcGFyZW50LCBjaHVua3MpIHtcbiAgICBpZiAoIW5vZGUucmFuZ2UpIHJldHVybjtcbiAgICBcbiAgICBub2RlLnBhcmVudCA9IHBhcmVudDtcbiAgICBcbiAgICBub2RlLnNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGNodW5rcy5zbGljZShcbiAgICAgICAgICAgIG5vZGUucmFuZ2VbMF0sIG5vZGUucmFuZ2VbMV1cbiAgICAgICAgKS5qb2luKCcnKTtcbiAgICB9O1xuICAgIFxuICAgIGlmIChub2RlLnVwZGF0ZSAmJiB0eXBlb2Ygbm9kZS51cGRhdGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHZhciBwcmV2ID0gbm9kZS51cGRhdGU7XG4gICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyhwcmV2KSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgdXBkYXRlW2tleV0gPSBwcmV2W2tleV07XG4gICAgICAgIH0pO1xuICAgICAgICBub2RlLnVwZGF0ZSA9IHVwZGF0ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIG5vZGUudXBkYXRlID0gdXBkYXRlO1xuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiB1cGRhdGUgKHMpIHtcbiAgICAgICAgY2h1bmtzW25vZGUucmFuZ2VbMF1dID0gcztcbiAgICAgICAgZm9yICh2YXIgaSA9IG5vZGUucmFuZ2VbMF0gKyAxOyBpIDwgbm9kZS5yYW5nZVsxXTsgaSsrKSB7XG4gICAgICAgICAgICBjaHVua3NbaV0gPSAnJztcbiAgICAgICAgfVxuICAgIH07XG59XG4iLCIvKlxuICBDb3B5cmlnaHQgKEMpIDIwMTIgQXJpeWEgSGlkYXlhdCA8YXJpeWEuaGlkYXlhdEBnbWFpbC5jb20+XG4gIENvcHlyaWdodCAoQykgMjAxMiBNYXRoaWFzIEJ5bmVucyA8bWF0aGlhc0BxaXdpLmJlPlxuICBDb3B5cmlnaHQgKEMpIDIwMTIgSm9vc3QtV2ltIEJvZWtlc3RlaWpuIDxqb29zdC13aW1AYm9la2VzdGVpam4ubmw+XG4gIENvcHlyaWdodCAoQykgMjAxMiBLcmlzIEtvd2FsIDxrcmlzLmtvd2FsQGNpeGFyLmNvbT5cbiAgQ29weXJpZ2h0IChDKSAyMDEyIFl1c3VrZSBTdXp1a2kgPHV0YXRhbmUudGVhQGdtYWlsLmNvbT5cbiAgQ29weXJpZ2h0IChDKSAyMDEyIEFycGFkIEJvcnNvcyA8YXJwYWQuYm9yc29zQGdvb2dsZW1haWwuY29tPlxuICBDb3B5cmlnaHQgKEMpIDIwMTEgQXJpeWEgSGlkYXlhdCA8YXJpeWEuaGlkYXlhdEBnbWFpbC5jb20+XG5cbiAgUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICAgKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICAgICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICAgICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAgICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGVcbiAgICAgIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAgVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCJcbiAgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRVxuICBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRVxuICBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IEJFIExJQUJMRSBGT1IgQU5ZXG4gIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4gIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUztcbiAgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EXG4gIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4gIChJTkNMVURJTkcgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRlxuICBUSElTIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuKi9cblxuLypqc2xpbnQgYml0d2lzZTp0cnVlIHBsdXNwbHVzOnRydWUgKi9cbi8qZ2xvYmFsIGVzcHJpbWE6dHJ1ZSwgZGVmaW5lOnRydWUsIGV4cG9ydHM6dHJ1ZSwgd2luZG93OiB0cnVlLFxudGhyb3dFcnJvcjogdHJ1ZSwgY3JlYXRlTGl0ZXJhbDogdHJ1ZSwgZ2VuZXJhdGVTdGF0ZW1lbnQ6IHRydWUsXG5wYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uOiB0cnVlLCBwYXJzZUJsb2NrOiB0cnVlLCBwYXJzZUV4cHJlc3Npb246IHRydWUsXG5wYXJzZUZ1bmN0aW9uRGVjbGFyYXRpb246IHRydWUsIHBhcnNlRnVuY3Rpb25FeHByZXNzaW9uOiB0cnVlLFxucGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzOiB0cnVlLCBwYXJzZVZhcmlhYmxlSWRlbnRpZmllcjogdHJ1ZSxcbnBhcnNlTGVmdEhhbmRTaWRlRXhwcmVzc2lvbjogdHJ1ZSxcbnBhcnNlU3RhdGVtZW50OiB0cnVlLCBwYXJzZVNvdXJjZUVsZW1lbnQ6IHRydWUgKi9cblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gVW5pdmVyc2FsIE1vZHVsZSBEZWZpbml0aW9uIChVTUQpIHRvIHN1cHBvcnQgQU1ELCBDb21tb25KUy9Ob2RlLmpzLFxuICAgIC8vIFJoaW5vLCBhbmQgcGxhaW4gYnJvd3NlciBsb2FkaW5nLlxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFsnZXhwb3J0cyddLCBmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBmYWN0b3J5KGV4cG9ydHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZhY3RvcnkoKHJvb3QuZXNwcmltYSA9IHt9KSk7XG4gICAgfVxufSh0aGlzLCBmdW5jdGlvbiAoZXhwb3J0cykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBUb2tlbixcbiAgICAgICAgVG9rZW5OYW1lLFxuICAgICAgICBTeW50YXgsXG4gICAgICAgIFByb3BlcnR5S2luZCxcbiAgICAgICAgTWVzc2FnZXMsXG4gICAgICAgIFJlZ2V4LFxuICAgICAgICBzb3VyY2UsXG4gICAgICAgIHN0cmljdCxcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGxpbmVOdW1iZXIsXG4gICAgICAgIGxpbmVTdGFydCxcbiAgICAgICAgbGVuZ3RoLFxuICAgICAgICBidWZmZXIsXG4gICAgICAgIHN0YXRlLFxuICAgICAgICBleHRyYTtcblxuICAgIFRva2VuID0ge1xuICAgICAgICBCb29sZWFuTGl0ZXJhbDogMSxcbiAgICAgICAgRU9GOiAyLFxuICAgICAgICBJZGVudGlmaWVyOiAzLFxuICAgICAgICBLZXl3b3JkOiA0LFxuICAgICAgICBOdWxsTGl0ZXJhbDogNSxcbiAgICAgICAgTnVtZXJpY0xpdGVyYWw6IDYsXG4gICAgICAgIFB1bmN0dWF0b3I6IDcsXG4gICAgICAgIFN0cmluZ0xpdGVyYWw6IDhcbiAgICB9O1xuXG4gICAgVG9rZW5OYW1lID0ge307XG4gICAgVG9rZW5OYW1lW1Rva2VuLkJvb2xlYW5MaXRlcmFsXSA9ICdCb29sZWFuJztcbiAgICBUb2tlbk5hbWVbVG9rZW4uRU9GXSA9ICc8ZW5kPic7XG4gICAgVG9rZW5OYW1lW1Rva2VuLklkZW50aWZpZXJdID0gJ0lkZW50aWZpZXInO1xuICAgIFRva2VuTmFtZVtUb2tlbi5LZXl3b3JkXSA9ICdLZXl3b3JkJztcbiAgICBUb2tlbk5hbWVbVG9rZW4uTnVsbExpdGVyYWxdID0gJ051bGwnO1xuICAgIFRva2VuTmFtZVtUb2tlbi5OdW1lcmljTGl0ZXJhbF0gPSAnTnVtZXJpYyc7XG4gICAgVG9rZW5OYW1lW1Rva2VuLlB1bmN0dWF0b3JdID0gJ1B1bmN0dWF0b3InO1xuICAgIFRva2VuTmFtZVtUb2tlbi5TdHJpbmdMaXRlcmFsXSA9ICdTdHJpbmcnO1xuXG4gICAgU3ludGF4ID0ge1xuICAgICAgICBBc3NpZ25tZW50RXhwcmVzc2lvbjogJ0Fzc2lnbm1lbnRFeHByZXNzaW9uJyxcbiAgICAgICAgQXJyYXlFeHByZXNzaW9uOiAnQXJyYXlFeHByZXNzaW9uJyxcbiAgICAgICAgQmxvY2tTdGF0ZW1lbnQ6ICdCbG9ja1N0YXRlbWVudCcsXG4gICAgICAgIEJpbmFyeUV4cHJlc3Npb246ICdCaW5hcnlFeHByZXNzaW9uJyxcbiAgICAgICAgQnJlYWtTdGF0ZW1lbnQ6ICdCcmVha1N0YXRlbWVudCcsXG4gICAgICAgIENhbGxFeHByZXNzaW9uOiAnQ2FsbEV4cHJlc3Npb24nLFxuICAgICAgICBDYXRjaENsYXVzZTogJ0NhdGNoQ2xhdXNlJyxcbiAgICAgICAgQ29uZGl0aW9uYWxFeHByZXNzaW9uOiAnQ29uZGl0aW9uYWxFeHByZXNzaW9uJyxcbiAgICAgICAgQ29udGludWVTdGF0ZW1lbnQ6ICdDb250aW51ZVN0YXRlbWVudCcsXG4gICAgICAgIERvV2hpbGVTdGF0ZW1lbnQ6ICdEb1doaWxlU3RhdGVtZW50JyxcbiAgICAgICAgRGVidWdnZXJTdGF0ZW1lbnQ6ICdEZWJ1Z2dlclN0YXRlbWVudCcsXG4gICAgICAgIEVtcHR5U3RhdGVtZW50OiAnRW1wdHlTdGF0ZW1lbnQnLFxuICAgICAgICBFeHByZXNzaW9uU3RhdGVtZW50OiAnRXhwcmVzc2lvblN0YXRlbWVudCcsXG4gICAgICAgIEZvclN0YXRlbWVudDogJ0ZvclN0YXRlbWVudCcsXG4gICAgICAgIEZvckluU3RhdGVtZW50OiAnRm9ySW5TdGF0ZW1lbnQnLFxuICAgICAgICBGdW5jdGlvbkRlY2xhcmF0aW9uOiAnRnVuY3Rpb25EZWNsYXJhdGlvbicsXG4gICAgICAgIEZ1bmN0aW9uRXhwcmVzc2lvbjogJ0Z1bmN0aW9uRXhwcmVzc2lvbicsXG4gICAgICAgIElkZW50aWZpZXI6ICdJZGVudGlmaWVyJyxcbiAgICAgICAgSWZTdGF0ZW1lbnQ6ICdJZlN0YXRlbWVudCcsXG4gICAgICAgIExpdGVyYWw6ICdMaXRlcmFsJyxcbiAgICAgICAgTGFiZWxlZFN0YXRlbWVudDogJ0xhYmVsZWRTdGF0ZW1lbnQnLFxuICAgICAgICBMb2dpY2FsRXhwcmVzc2lvbjogJ0xvZ2ljYWxFeHByZXNzaW9uJyxcbiAgICAgICAgTWVtYmVyRXhwcmVzc2lvbjogJ01lbWJlckV4cHJlc3Npb24nLFxuICAgICAgICBOZXdFeHByZXNzaW9uOiAnTmV3RXhwcmVzc2lvbicsXG4gICAgICAgIE9iamVjdEV4cHJlc3Npb246ICdPYmplY3RFeHByZXNzaW9uJyxcbiAgICAgICAgUHJvZ3JhbTogJ1Byb2dyYW0nLFxuICAgICAgICBQcm9wZXJ0eTogJ1Byb3BlcnR5JyxcbiAgICAgICAgUmV0dXJuU3RhdGVtZW50OiAnUmV0dXJuU3RhdGVtZW50JyxcbiAgICAgICAgU2VxdWVuY2VFeHByZXNzaW9uOiAnU2VxdWVuY2VFeHByZXNzaW9uJyxcbiAgICAgICAgU3dpdGNoU3RhdGVtZW50OiAnU3dpdGNoU3RhdGVtZW50JyxcbiAgICAgICAgU3dpdGNoQ2FzZTogJ1N3aXRjaENhc2UnLFxuICAgICAgICBUaGlzRXhwcmVzc2lvbjogJ1RoaXNFeHByZXNzaW9uJyxcbiAgICAgICAgVGhyb3dTdGF0ZW1lbnQ6ICdUaHJvd1N0YXRlbWVudCcsXG4gICAgICAgIFRyeVN0YXRlbWVudDogJ1RyeVN0YXRlbWVudCcsXG4gICAgICAgIFVuYXJ5RXhwcmVzc2lvbjogJ1VuYXJ5RXhwcmVzc2lvbicsXG4gICAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdVcGRhdGVFeHByZXNzaW9uJyxcbiAgICAgICAgVmFyaWFibGVEZWNsYXJhdGlvbjogJ1ZhcmlhYmxlRGVjbGFyYXRpb24nLFxuICAgICAgICBWYXJpYWJsZURlY2xhcmF0b3I6ICdWYXJpYWJsZURlY2xhcmF0b3InLFxuICAgICAgICBXaGlsZVN0YXRlbWVudDogJ1doaWxlU3RhdGVtZW50JyxcbiAgICAgICAgV2l0aFN0YXRlbWVudDogJ1dpdGhTdGF0ZW1lbnQnXG4gICAgfTtcblxuICAgIFByb3BlcnR5S2luZCA9IHtcbiAgICAgICAgRGF0YTogMSxcbiAgICAgICAgR2V0OiAyLFxuICAgICAgICBTZXQ6IDRcbiAgICB9O1xuXG4gICAgLy8gRXJyb3IgbWVzc2FnZXMgc2hvdWxkIGJlIGlkZW50aWNhbCB0byBWOC5cbiAgICBNZXNzYWdlcyA9IHtcbiAgICAgICAgVW5leHBlY3RlZFRva2VuOiAgJ1VuZXhwZWN0ZWQgdG9rZW4gJTAnLFxuICAgICAgICBVbmV4cGVjdGVkTnVtYmVyOiAgJ1VuZXhwZWN0ZWQgbnVtYmVyJyxcbiAgICAgICAgVW5leHBlY3RlZFN0cmluZzogICdVbmV4cGVjdGVkIHN0cmluZycsXG4gICAgICAgIFVuZXhwZWN0ZWRJZGVudGlmaWVyOiAgJ1VuZXhwZWN0ZWQgaWRlbnRpZmllcicsXG4gICAgICAgIFVuZXhwZWN0ZWRSZXNlcnZlZDogICdVbmV4cGVjdGVkIHJlc2VydmVkIHdvcmQnLFxuICAgICAgICBVbmV4cGVjdGVkRU9TOiAgJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0JyxcbiAgICAgICAgTmV3bGluZUFmdGVyVGhyb3c6ICAnSWxsZWdhbCBuZXdsaW5lIGFmdGVyIHRocm93JyxcbiAgICAgICAgSW52YWxpZFJlZ0V4cDogJ0ludmFsaWQgcmVndWxhciBleHByZXNzaW9uJyxcbiAgICAgICAgVW50ZXJtaW5hdGVkUmVnRXhwOiAgJ0ludmFsaWQgcmVndWxhciBleHByZXNzaW9uOiBtaXNzaW5nIC8nLFxuICAgICAgICBJbnZhbGlkTEhTSW5Bc3NpZ25tZW50OiAgJ0ludmFsaWQgbGVmdC1oYW5kIHNpZGUgaW4gYXNzaWdubWVudCcsXG4gICAgICAgIEludmFsaWRMSFNJbkZvckluOiAgJ0ludmFsaWQgbGVmdC1oYW5kIHNpZGUgaW4gZm9yLWluJyxcbiAgICAgICAgTXVsdGlwbGVEZWZhdWx0c0luU3dpdGNoOiAnTW9yZSB0aGFuIG9uZSBkZWZhdWx0IGNsYXVzZSBpbiBzd2l0Y2ggc3RhdGVtZW50JyxcbiAgICAgICAgTm9DYXRjaE9yRmluYWxseTogICdNaXNzaW5nIGNhdGNoIG9yIGZpbmFsbHkgYWZ0ZXIgdHJ5JyxcbiAgICAgICAgVW5rbm93bkxhYmVsOiAnVW5kZWZpbmVkIGxhYmVsIFxcJyUwXFwnJyxcbiAgICAgICAgUmVkZWNsYXJhdGlvbjogJyUwIFxcJyUxXFwnIGhhcyBhbHJlYWR5IGJlZW4gZGVjbGFyZWQnLFxuICAgICAgICBJbGxlZ2FsQ29udGludWU6ICdJbGxlZ2FsIGNvbnRpbnVlIHN0YXRlbWVudCcsXG4gICAgICAgIElsbGVnYWxCcmVhazogJ0lsbGVnYWwgYnJlYWsgc3RhdGVtZW50JyxcbiAgICAgICAgSWxsZWdhbFJldHVybjogJ0lsbGVnYWwgcmV0dXJuIHN0YXRlbWVudCcsXG4gICAgICAgIFN0cmljdE1vZGVXaXRoOiAgJ1N0cmljdCBtb2RlIGNvZGUgbWF5IG5vdCBpbmNsdWRlIGEgd2l0aCBzdGF0ZW1lbnQnLFxuICAgICAgICBTdHJpY3RDYXRjaFZhcmlhYmxlOiAgJ0NhdGNoIHZhcmlhYmxlIG1heSBub3QgYmUgZXZhbCBvciBhcmd1bWVudHMgaW4gc3RyaWN0IG1vZGUnLFxuICAgICAgICBTdHJpY3RWYXJOYW1lOiAgJ1ZhcmlhYmxlIG5hbWUgbWF5IG5vdCBiZSBldmFsIG9yIGFyZ3VtZW50cyBpbiBzdHJpY3QgbW9kZScsXG4gICAgICAgIFN0cmljdFBhcmFtTmFtZTogICdQYXJhbWV0ZXIgbmFtZSBldmFsIG9yIGFyZ3VtZW50cyBpcyBub3QgYWxsb3dlZCBpbiBzdHJpY3QgbW9kZScsXG4gICAgICAgIFN0cmljdFBhcmFtRHVwZTogJ1N0cmljdCBtb2RlIGZ1bmN0aW9uIG1heSBub3QgaGF2ZSBkdXBsaWNhdGUgcGFyYW1ldGVyIG5hbWVzJyxcbiAgICAgICAgU3RyaWN0RnVuY3Rpb25OYW1lOiAgJ0Z1bmN0aW9uIG5hbWUgbWF5IG5vdCBiZSBldmFsIG9yIGFyZ3VtZW50cyBpbiBzdHJpY3QgbW9kZScsXG4gICAgICAgIFN0cmljdE9jdGFsTGl0ZXJhbDogICdPY3RhbCBsaXRlcmFscyBhcmUgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGUuJyxcbiAgICAgICAgU3RyaWN0RGVsZXRlOiAgJ0RlbGV0ZSBvZiBhbiB1bnF1YWxpZmllZCBpZGVudGlmaWVyIGluIHN0cmljdCBtb2RlLicsXG4gICAgICAgIFN0cmljdER1cGxpY2F0ZVByb3BlcnR5OiAgJ0R1cGxpY2F0ZSBkYXRhIHByb3BlcnR5IGluIG9iamVjdCBsaXRlcmFsIG5vdCBhbGxvd2VkIGluIHN0cmljdCBtb2RlJyxcbiAgICAgICAgQWNjZXNzb3JEYXRhUHJvcGVydHk6ICAnT2JqZWN0IGxpdGVyYWwgbWF5IG5vdCBoYXZlIGRhdGEgYW5kIGFjY2Vzc29yIHByb3BlcnR5IHdpdGggdGhlIHNhbWUgbmFtZScsXG4gICAgICAgIEFjY2Vzc29yR2V0U2V0OiAgJ09iamVjdCBsaXRlcmFsIG1heSBub3QgaGF2ZSBtdWx0aXBsZSBnZXQvc2V0IGFjY2Vzc29ycyB3aXRoIHRoZSBzYW1lIG5hbWUnLFxuICAgICAgICBTdHJpY3RMSFNBc3NpZ25tZW50OiAgJ0Fzc2lnbm1lbnQgdG8gZXZhbCBvciBhcmd1bWVudHMgaXMgbm90IGFsbG93ZWQgaW4gc3RyaWN0IG1vZGUnLFxuICAgICAgICBTdHJpY3RMSFNQb3N0Zml4OiAgJ1Bvc3RmaXggaW5jcmVtZW50L2RlY3JlbWVudCBtYXkgbm90IGhhdmUgZXZhbCBvciBhcmd1bWVudHMgb3BlcmFuZCBpbiBzdHJpY3QgbW9kZScsXG4gICAgICAgIFN0cmljdExIU1ByZWZpeDogICdQcmVmaXggaW5jcmVtZW50L2RlY3JlbWVudCBtYXkgbm90IGhhdmUgZXZhbCBvciBhcmd1bWVudHMgb3BlcmFuZCBpbiBzdHJpY3QgbW9kZScsXG4gICAgICAgIFN0cmljdFJlc2VydmVkV29yZDogICdVc2Ugb2YgZnV0dXJlIHJlc2VydmVkIHdvcmQgaW4gc3RyaWN0IG1vZGUnXG4gICAgfTtcblxuICAgIC8vIFNlZSBhbHNvIHRvb2xzL2dlbmVyYXRlLXVuaWNvZGUtcmVnZXgucHkuXG4gICAgUmVnZXggPSB7XG4gICAgICAgIE5vbkFzY2lpSWRlbnRpZmllclN0YXJ0OiBuZXcgUmVnRXhwKCdbXFx4YWFcXHhiNVxceGJhXFx4YzAtXFx4ZDZcXHhkOC1cXHhmNlxceGY4LVxcdTAyYzFcXHUwMmM2LVxcdTAyZDFcXHUwMmUwLVxcdTAyZTRcXHUwMmVjXFx1MDJlZVxcdTAzNzAtXFx1MDM3NFxcdTAzNzZcXHUwMzc3XFx1MDM3YS1cXHUwMzdkXFx1MDM4NlxcdTAzODgtXFx1MDM4YVxcdTAzOGNcXHUwMzhlLVxcdTAzYTFcXHUwM2EzLVxcdTAzZjVcXHUwM2Y3LVxcdTA0ODFcXHUwNDhhLVxcdTA1MjdcXHUwNTMxLVxcdTA1NTZcXHUwNTU5XFx1MDU2MS1cXHUwNTg3XFx1MDVkMC1cXHUwNWVhXFx1MDVmMC1cXHUwNWYyXFx1MDYyMC1cXHUwNjRhXFx1MDY2ZVxcdTA2NmZcXHUwNjcxLVxcdTA2ZDNcXHUwNmQ1XFx1MDZlNVxcdTA2ZTZcXHUwNmVlXFx1MDZlZlxcdTA2ZmEtXFx1MDZmY1xcdTA2ZmZcXHUwNzEwXFx1MDcxMi1cXHUwNzJmXFx1MDc0ZC1cXHUwN2E1XFx1MDdiMVxcdTA3Y2EtXFx1MDdlYVxcdTA3ZjRcXHUwN2Y1XFx1MDdmYVxcdTA4MDAtXFx1MDgxNVxcdTA4MWFcXHUwODI0XFx1MDgyOFxcdTA4NDAtXFx1MDg1OFxcdTA4YTBcXHUwOGEyLVxcdTA4YWNcXHUwOTA0LVxcdTA5MzlcXHUwOTNkXFx1MDk1MFxcdTA5NTgtXFx1MDk2MVxcdTA5NzEtXFx1MDk3N1xcdTA5NzktXFx1MDk3ZlxcdTA5ODUtXFx1MDk4Y1xcdTA5OGZcXHUwOTkwXFx1MDk5My1cXHUwOWE4XFx1MDlhYS1cXHUwOWIwXFx1MDliMlxcdTA5YjYtXFx1MDliOVxcdTA5YmRcXHUwOWNlXFx1MDlkY1xcdTA5ZGRcXHUwOWRmLVxcdTA5ZTFcXHUwOWYwXFx1MDlmMVxcdTBhMDUtXFx1MGEwYVxcdTBhMGZcXHUwYTEwXFx1MGExMy1cXHUwYTI4XFx1MGEyYS1cXHUwYTMwXFx1MGEzMlxcdTBhMzNcXHUwYTM1XFx1MGEzNlxcdTBhMzhcXHUwYTM5XFx1MGE1OS1cXHUwYTVjXFx1MGE1ZVxcdTBhNzItXFx1MGE3NFxcdTBhODUtXFx1MGE4ZFxcdTBhOGYtXFx1MGE5MVxcdTBhOTMtXFx1MGFhOFxcdTBhYWEtXFx1MGFiMFxcdTBhYjJcXHUwYWIzXFx1MGFiNS1cXHUwYWI5XFx1MGFiZFxcdTBhZDBcXHUwYWUwXFx1MGFlMVxcdTBiMDUtXFx1MGIwY1xcdTBiMGZcXHUwYjEwXFx1MGIxMy1cXHUwYjI4XFx1MGIyYS1cXHUwYjMwXFx1MGIzMlxcdTBiMzNcXHUwYjM1LVxcdTBiMzlcXHUwYjNkXFx1MGI1Y1xcdTBiNWRcXHUwYjVmLVxcdTBiNjFcXHUwYjcxXFx1MGI4M1xcdTBiODUtXFx1MGI4YVxcdTBiOGUtXFx1MGI5MFxcdTBiOTItXFx1MGI5NVxcdTBiOTlcXHUwYjlhXFx1MGI5Y1xcdTBiOWVcXHUwYjlmXFx1MGJhM1xcdTBiYTRcXHUwYmE4LVxcdTBiYWFcXHUwYmFlLVxcdTBiYjlcXHUwYmQwXFx1MGMwNS1cXHUwYzBjXFx1MGMwZS1cXHUwYzEwXFx1MGMxMi1cXHUwYzI4XFx1MGMyYS1cXHUwYzMzXFx1MGMzNS1cXHUwYzM5XFx1MGMzZFxcdTBjNThcXHUwYzU5XFx1MGM2MFxcdTBjNjFcXHUwYzg1LVxcdTBjOGNcXHUwYzhlLVxcdTBjOTBcXHUwYzkyLVxcdTBjYThcXHUwY2FhLVxcdTBjYjNcXHUwY2I1LVxcdTBjYjlcXHUwY2JkXFx1MGNkZVxcdTBjZTBcXHUwY2UxXFx1MGNmMVxcdTBjZjJcXHUwZDA1LVxcdTBkMGNcXHUwZDBlLVxcdTBkMTBcXHUwZDEyLVxcdTBkM2FcXHUwZDNkXFx1MGQ0ZVxcdTBkNjBcXHUwZDYxXFx1MGQ3YS1cXHUwZDdmXFx1MGQ4NS1cXHUwZDk2XFx1MGQ5YS1cXHUwZGIxXFx1MGRiMy1cXHUwZGJiXFx1MGRiZFxcdTBkYzAtXFx1MGRjNlxcdTBlMDEtXFx1MGUzMFxcdTBlMzJcXHUwZTMzXFx1MGU0MC1cXHUwZTQ2XFx1MGU4MVxcdTBlODJcXHUwZTg0XFx1MGU4N1xcdTBlODhcXHUwZThhXFx1MGU4ZFxcdTBlOTQtXFx1MGU5N1xcdTBlOTktXFx1MGU5ZlxcdTBlYTEtXFx1MGVhM1xcdTBlYTVcXHUwZWE3XFx1MGVhYVxcdTBlYWJcXHUwZWFkLVxcdTBlYjBcXHUwZWIyXFx1MGViM1xcdTBlYmRcXHUwZWMwLVxcdTBlYzRcXHUwZWM2XFx1MGVkYy1cXHUwZWRmXFx1MGYwMFxcdTBmNDAtXFx1MGY0N1xcdTBmNDktXFx1MGY2Y1xcdTBmODgtXFx1MGY4Y1xcdTEwMDAtXFx1MTAyYVxcdTEwM2ZcXHUxMDUwLVxcdTEwNTVcXHUxMDVhLVxcdTEwNWRcXHUxMDYxXFx1MTA2NVxcdTEwNjZcXHUxMDZlLVxcdTEwNzBcXHUxMDc1LVxcdTEwODFcXHUxMDhlXFx1MTBhMC1cXHUxMGM1XFx1MTBjN1xcdTEwY2RcXHUxMGQwLVxcdTEwZmFcXHUxMGZjLVxcdTEyNDhcXHUxMjRhLVxcdTEyNGRcXHUxMjUwLVxcdTEyNTZcXHUxMjU4XFx1MTI1YS1cXHUxMjVkXFx1MTI2MC1cXHUxMjg4XFx1MTI4YS1cXHUxMjhkXFx1MTI5MC1cXHUxMmIwXFx1MTJiMi1cXHUxMmI1XFx1MTJiOC1cXHUxMmJlXFx1MTJjMFxcdTEyYzItXFx1MTJjNVxcdTEyYzgtXFx1MTJkNlxcdTEyZDgtXFx1MTMxMFxcdTEzMTItXFx1MTMxNVxcdTEzMTgtXFx1MTM1YVxcdTEzODAtXFx1MTM4ZlxcdTEzYTAtXFx1MTNmNFxcdTE0MDEtXFx1MTY2Y1xcdTE2NmYtXFx1MTY3ZlxcdTE2ODEtXFx1MTY5YVxcdTE2YTAtXFx1MTZlYVxcdTE2ZWUtXFx1MTZmMFxcdTE3MDAtXFx1MTcwY1xcdTE3MGUtXFx1MTcxMVxcdTE3MjAtXFx1MTczMVxcdTE3NDAtXFx1MTc1MVxcdTE3NjAtXFx1MTc2Y1xcdTE3NmUtXFx1MTc3MFxcdTE3ODAtXFx1MTdiM1xcdTE3ZDdcXHUxN2RjXFx1MTgyMC1cXHUxODc3XFx1MTg4MC1cXHUxOGE4XFx1MThhYVxcdTE4YjAtXFx1MThmNVxcdTE5MDAtXFx1MTkxY1xcdTE5NTAtXFx1MTk2ZFxcdTE5NzAtXFx1MTk3NFxcdTE5ODAtXFx1MTlhYlxcdTE5YzEtXFx1MTljN1xcdTFhMDAtXFx1MWExNlxcdTFhMjAtXFx1MWE1NFxcdTFhYTdcXHUxYjA1LVxcdTFiMzNcXHUxYjQ1LVxcdTFiNGJcXHUxYjgzLVxcdTFiYTBcXHUxYmFlXFx1MWJhZlxcdTFiYmEtXFx1MWJlNVxcdTFjMDAtXFx1MWMyM1xcdTFjNGQtXFx1MWM0ZlxcdTFjNWEtXFx1MWM3ZFxcdTFjZTktXFx1MWNlY1xcdTFjZWUtXFx1MWNmMVxcdTFjZjVcXHUxY2Y2XFx1MWQwMC1cXHUxZGJmXFx1MWUwMC1cXHUxZjE1XFx1MWYxOC1cXHUxZjFkXFx1MWYyMC1cXHUxZjQ1XFx1MWY0OC1cXHUxZjRkXFx1MWY1MC1cXHUxZjU3XFx1MWY1OVxcdTFmNWJcXHUxZjVkXFx1MWY1Zi1cXHUxZjdkXFx1MWY4MC1cXHUxZmI0XFx1MWZiNi1cXHUxZmJjXFx1MWZiZVxcdTFmYzItXFx1MWZjNFxcdTFmYzYtXFx1MWZjY1xcdTFmZDAtXFx1MWZkM1xcdTFmZDYtXFx1MWZkYlxcdTFmZTAtXFx1MWZlY1xcdTFmZjItXFx1MWZmNFxcdTFmZjYtXFx1MWZmY1xcdTIwNzFcXHUyMDdmXFx1MjA5MC1cXHUyMDljXFx1MjEwMlxcdTIxMDdcXHUyMTBhLVxcdTIxMTNcXHUyMTE1XFx1MjExOS1cXHUyMTFkXFx1MjEyNFxcdTIxMjZcXHUyMTI4XFx1MjEyYS1cXHUyMTJkXFx1MjEyZi1cXHUyMTM5XFx1MjEzYy1cXHUyMTNmXFx1MjE0NS1cXHUyMTQ5XFx1MjE0ZVxcdTIxNjAtXFx1MjE4OFxcdTJjMDAtXFx1MmMyZVxcdTJjMzAtXFx1MmM1ZVxcdTJjNjAtXFx1MmNlNFxcdTJjZWItXFx1MmNlZVxcdTJjZjJcXHUyY2YzXFx1MmQwMC1cXHUyZDI1XFx1MmQyN1xcdTJkMmRcXHUyZDMwLVxcdTJkNjdcXHUyZDZmXFx1MmQ4MC1cXHUyZDk2XFx1MmRhMC1cXHUyZGE2XFx1MmRhOC1cXHUyZGFlXFx1MmRiMC1cXHUyZGI2XFx1MmRiOC1cXHUyZGJlXFx1MmRjMC1cXHUyZGM2XFx1MmRjOC1cXHUyZGNlXFx1MmRkMC1cXHUyZGQ2XFx1MmRkOC1cXHUyZGRlXFx1MmUyZlxcdTMwMDUtXFx1MzAwN1xcdTMwMjEtXFx1MzAyOVxcdTMwMzEtXFx1MzAzNVxcdTMwMzgtXFx1MzAzY1xcdTMwNDEtXFx1MzA5NlxcdTMwOWQtXFx1MzA5ZlxcdTMwYTEtXFx1MzBmYVxcdTMwZmMtXFx1MzBmZlxcdTMxMDUtXFx1MzEyZFxcdTMxMzEtXFx1MzE4ZVxcdTMxYTAtXFx1MzFiYVxcdTMxZjAtXFx1MzFmZlxcdTM0MDAtXFx1NGRiNVxcdTRlMDAtXFx1OWZjY1xcdWEwMDAtXFx1YTQ4Y1xcdWE0ZDAtXFx1YTRmZFxcdWE1MDAtXFx1YTYwY1xcdWE2MTAtXFx1YTYxZlxcdWE2MmFcXHVhNjJiXFx1YTY0MC1cXHVhNjZlXFx1YTY3Zi1cXHVhNjk3XFx1YTZhMC1cXHVhNmVmXFx1YTcxNy1cXHVhNzFmXFx1YTcyMi1cXHVhNzg4XFx1YTc4Yi1cXHVhNzhlXFx1YTc5MC1cXHVhNzkzXFx1YTdhMC1cXHVhN2FhXFx1YTdmOC1cXHVhODAxXFx1YTgwMy1cXHVhODA1XFx1YTgwNy1cXHVhODBhXFx1YTgwYy1cXHVhODIyXFx1YTg0MC1cXHVhODczXFx1YTg4Mi1cXHVhOGIzXFx1YThmMi1cXHVhOGY3XFx1YThmYlxcdWE5MGEtXFx1YTkyNVxcdWE5MzAtXFx1YTk0NlxcdWE5NjAtXFx1YTk3Y1xcdWE5ODQtXFx1YTliMlxcdWE5Y2ZcXHVhYTAwLVxcdWFhMjhcXHVhYTQwLVxcdWFhNDJcXHVhYTQ0LVxcdWFhNGJcXHVhYTYwLVxcdWFhNzZcXHVhYTdhXFx1YWE4MC1cXHVhYWFmXFx1YWFiMVxcdWFhYjVcXHVhYWI2XFx1YWFiOS1cXHVhYWJkXFx1YWFjMFxcdWFhYzJcXHVhYWRiLVxcdWFhZGRcXHVhYWUwLVxcdWFhZWFcXHVhYWYyLVxcdWFhZjRcXHVhYjAxLVxcdWFiMDZcXHVhYjA5LVxcdWFiMGVcXHVhYjExLVxcdWFiMTZcXHVhYjIwLVxcdWFiMjZcXHVhYjI4LVxcdWFiMmVcXHVhYmMwLVxcdWFiZTJcXHVhYzAwLVxcdWQ3YTNcXHVkN2IwLVxcdWQ3YzZcXHVkN2NiLVxcdWQ3ZmJcXHVmOTAwLVxcdWZhNmRcXHVmYTcwLVxcdWZhZDlcXHVmYjAwLVxcdWZiMDZcXHVmYjEzLVxcdWZiMTdcXHVmYjFkXFx1ZmIxZi1cXHVmYjI4XFx1ZmIyYS1cXHVmYjM2XFx1ZmIzOC1cXHVmYjNjXFx1ZmIzZVxcdWZiNDBcXHVmYjQxXFx1ZmI0M1xcdWZiNDRcXHVmYjQ2LVxcdWZiYjFcXHVmYmQzLVxcdWZkM2RcXHVmZDUwLVxcdWZkOGZcXHVmZDkyLVxcdWZkYzdcXHVmZGYwLVxcdWZkZmJcXHVmZTcwLVxcdWZlNzRcXHVmZTc2LVxcdWZlZmNcXHVmZjIxLVxcdWZmM2FcXHVmZjQxLVxcdWZmNWFcXHVmZjY2LVxcdWZmYmVcXHVmZmMyLVxcdWZmYzdcXHVmZmNhLVxcdWZmY2ZcXHVmZmQyLVxcdWZmZDdcXHVmZmRhLVxcdWZmZGNdJyksXG4gICAgICAgIE5vbkFzY2lpSWRlbnRpZmllclBhcnQ6IG5ldyBSZWdFeHAoJ1tcXHhhYVxceGI1XFx4YmFcXHhjMC1cXHhkNlxceGQ4LVxceGY2XFx4ZjgtXFx1MDJjMVxcdTAyYzYtXFx1MDJkMVxcdTAyZTAtXFx1MDJlNFxcdTAyZWNcXHUwMmVlXFx1MDMwMC1cXHUwMzc0XFx1MDM3NlxcdTAzNzdcXHUwMzdhLVxcdTAzN2RcXHUwMzg2XFx1MDM4OC1cXHUwMzhhXFx1MDM4Y1xcdTAzOGUtXFx1MDNhMVxcdTAzYTMtXFx1MDNmNVxcdTAzZjctXFx1MDQ4MVxcdTA0ODMtXFx1MDQ4N1xcdTA0OGEtXFx1MDUyN1xcdTA1MzEtXFx1MDU1NlxcdTA1NTlcXHUwNTYxLVxcdTA1ODdcXHUwNTkxLVxcdTA1YmRcXHUwNWJmXFx1MDVjMVxcdTA1YzJcXHUwNWM0XFx1MDVjNVxcdTA1YzdcXHUwNWQwLVxcdTA1ZWFcXHUwNWYwLVxcdTA1ZjJcXHUwNjEwLVxcdTA2MWFcXHUwNjIwLVxcdTA2NjlcXHUwNjZlLVxcdTA2ZDNcXHUwNmQ1LVxcdTA2ZGNcXHUwNmRmLVxcdTA2ZThcXHUwNmVhLVxcdTA2ZmNcXHUwNmZmXFx1MDcxMC1cXHUwNzRhXFx1MDc0ZC1cXHUwN2IxXFx1MDdjMC1cXHUwN2Y1XFx1MDdmYVxcdTA4MDAtXFx1MDgyZFxcdTA4NDAtXFx1MDg1YlxcdTA4YTBcXHUwOGEyLVxcdTA4YWNcXHUwOGU0LVxcdTA4ZmVcXHUwOTAwLVxcdTA5NjNcXHUwOTY2LVxcdTA5NmZcXHUwOTcxLVxcdTA5NzdcXHUwOTc5LVxcdTA5N2ZcXHUwOTgxLVxcdTA5ODNcXHUwOTg1LVxcdTA5OGNcXHUwOThmXFx1MDk5MFxcdTA5OTMtXFx1MDlhOFxcdTA5YWEtXFx1MDliMFxcdTA5YjJcXHUwOWI2LVxcdTA5YjlcXHUwOWJjLVxcdTA5YzRcXHUwOWM3XFx1MDljOFxcdTA5Y2ItXFx1MDljZVxcdTA5ZDdcXHUwOWRjXFx1MDlkZFxcdTA5ZGYtXFx1MDllM1xcdTA5ZTYtXFx1MDlmMVxcdTBhMDEtXFx1MGEwM1xcdTBhMDUtXFx1MGEwYVxcdTBhMGZcXHUwYTEwXFx1MGExMy1cXHUwYTI4XFx1MGEyYS1cXHUwYTMwXFx1MGEzMlxcdTBhMzNcXHUwYTM1XFx1MGEzNlxcdTBhMzhcXHUwYTM5XFx1MGEzY1xcdTBhM2UtXFx1MGE0MlxcdTBhNDdcXHUwYTQ4XFx1MGE0Yi1cXHUwYTRkXFx1MGE1MVxcdTBhNTktXFx1MGE1Y1xcdTBhNWVcXHUwYTY2LVxcdTBhNzVcXHUwYTgxLVxcdTBhODNcXHUwYTg1LVxcdTBhOGRcXHUwYThmLVxcdTBhOTFcXHUwYTkzLVxcdTBhYThcXHUwYWFhLVxcdTBhYjBcXHUwYWIyXFx1MGFiM1xcdTBhYjUtXFx1MGFiOVxcdTBhYmMtXFx1MGFjNVxcdTBhYzctXFx1MGFjOVxcdTBhY2ItXFx1MGFjZFxcdTBhZDBcXHUwYWUwLVxcdTBhZTNcXHUwYWU2LVxcdTBhZWZcXHUwYjAxLVxcdTBiMDNcXHUwYjA1LVxcdTBiMGNcXHUwYjBmXFx1MGIxMFxcdTBiMTMtXFx1MGIyOFxcdTBiMmEtXFx1MGIzMFxcdTBiMzJcXHUwYjMzXFx1MGIzNS1cXHUwYjM5XFx1MGIzYy1cXHUwYjQ0XFx1MGI0N1xcdTBiNDhcXHUwYjRiLVxcdTBiNGRcXHUwYjU2XFx1MGI1N1xcdTBiNWNcXHUwYjVkXFx1MGI1Zi1cXHUwYjYzXFx1MGI2Ni1cXHUwYjZmXFx1MGI3MVxcdTBiODJcXHUwYjgzXFx1MGI4NS1cXHUwYjhhXFx1MGI4ZS1cXHUwYjkwXFx1MGI5Mi1cXHUwYjk1XFx1MGI5OVxcdTBiOWFcXHUwYjljXFx1MGI5ZVxcdTBiOWZcXHUwYmEzXFx1MGJhNFxcdTBiYTgtXFx1MGJhYVxcdTBiYWUtXFx1MGJiOVxcdTBiYmUtXFx1MGJjMlxcdTBiYzYtXFx1MGJjOFxcdTBiY2EtXFx1MGJjZFxcdTBiZDBcXHUwYmQ3XFx1MGJlNi1cXHUwYmVmXFx1MGMwMS1cXHUwYzAzXFx1MGMwNS1cXHUwYzBjXFx1MGMwZS1cXHUwYzEwXFx1MGMxMi1cXHUwYzI4XFx1MGMyYS1cXHUwYzMzXFx1MGMzNS1cXHUwYzM5XFx1MGMzZC1cXHUwYzQ0XFx1MGM0Ni1cXHUwYzQ4XFx1MGM0YS1cXHUwYzRkXFx1MGM1NVxcdTBjNTZcXHUwYzU4XFx1MGM1OVxcdTBjNjAtXFx1MGM2M1xcdTBjNjYtXFx1MGM2ZlxcdTBjODJcXHUwYzgzXFx1MGM4NS1cXHUwYzhjXFx1MGM4ZS1cXHUwYzkwXFx1MGM5Mi1cXHUwY2E4XFx1MGNhYS1cXHUwY2IzXFx1MGNiNS1cXHUwY2I5XFx1MGNiYy1cXHUwY2M0XFx1MGNjNi1cXHUwY2M4XFx1MGNjYS1cXHUwY2NkXFx1MGNkNVxcdTBjZDZcXHUwY2RlXFx1MGNlMC1cXHUwY2UzXFx1MGNlNi1cXHUwY2VmXFx1MGNmMVxcdTBjZjJcXHUwZDAyXFx1MGQwM1xcdTBkMDUtXFx1MGQwY1xcdTBkMGUtXFx1MGQxMFxcdTBkMTItXFx1MGQzYVxcdTBkM2QtXFx1MGQ0NFxcdTBkNDYtXFx1MGQ0OFxcdTBkNGEtXFx1MGQ0ZVxcdTBkNTdcXHUwZDYwLVxcdTBkNjNcXHUwZDY2LVxcdTBkNmZcXHUwZDdhLVxcdTBkN2ZcXHUwZDgyXFx1MGQ4M1xcdTBkODUtXFx1MGQ5NlxcdTBkOWEtXFx1MGRiMVxcdTBkYjMtXFx1MGRiYlxcdTBkYmRcXHUwZGMwLVxcdTBkYzZcXHUwZGNhXFx1MGRjZi1cXHUwZGQ0XFx1MGRkNlxcdTBkZDgtXFx1MGRkZlxcdTBkZjJcXHUwZGYzXFx1MGUwMS1cXHUwZTNhXFx1MGU0MC1cXHUwZTRlXFx1MGU1MC1cXHUwZTU5XFx1MGU4MVxcdTBlODJcXHUwZTg0XFx1MGU4N1xcdTBlODhcXHUwZThhXFx1MGU4ZFxcdTBlOTQtXFx1MGU5N1xcdTBlOTktXFx1MGU5ZlxcdTBlYTEtXFx1MGVhM1xcdTBlYTVcXHUwZWE3XFx1MGVhYVxcdTBlYWJcXHUwZWFkLVxcdTBlYjlcXHUwZWJiLVxcdTBlYmRcXHUwZWMwLVxcdTBlYzRcXHUwZWM2XFx1MGVjOC1cXHUwZWNkXFx1MGVkMC1cXHUwZWQ5XFx1MGVkYy1cXHUwZWRmXFx1MGYwMFxcdTBmMThcXHUwZjE5XFx1MGYyMC1cXHUwZjI5XFx1MGYzNVxcdTBmMzdcXHUwZjM5XFx1MGYzZS1cXHUwZjQ3XFx1MGY0OS1cXHUwZjZjXFx1MGY3MS1cXHUwZjg0XFx1MGY4Ni1cXHUwZjk3XFx1MGY5OS1cXHUwZmJjXFx1MGZjNlxcdTEwMDAtXFx1MTA0OVxcdTEwNTAtXFx1MTA5ZFxcdTEwYTAtXFx1MTBjNVxcdTEwYzdcXHUxMGNkXFx1MTBkMC1cXHUxMGZhXFx1MTBmYy1cXHUxMjQ4XFx1MTI0YS1cXHUxMjRkXFx1MTI1MC1cXHUxMjU2XFx1MTI1OFxcdTEyNWEtXFx1MTI1ZFxcdTEyNjAtXFx1MTI4OFxcdTEyOGEtXFx1MTI4ZFxcdTEyOTAtXFx1MTJiMFxcdTEyYjItXFx1MTJiNVxcdTEyYjgtXFx1MTJiZVxcdTEyYzBcXHUxMmMyLVxcdTEyYzVcXHUxMmM4LVxcdTEyZDZcXHUxMmQ4LVxcdTEzMTBcXHUxMzEyLVxcdTEzMTVcXHUxMzE4LVxcdTEzNWFcXHUxMzVkLVxcdTEzNWZcXHUxMzgwLVxcdTEzOGZcXHUxM2EwLVxcdTEzZjRcXHUxNDAxLVxcdTE2NmNcXHUxNjZmLVxcdTE2N2ZcXHUxNjgxLVxcdTE2OWFcXHUxNmEwLVxcdTE2ZWFcXHUxNmVlLVxcdTE2ZjBcXHUxNzAwLVxcdTE3MGNcXHUxNzBlLVxcdTE3MTRcXHUxNzIwLVxcdTE3MzRcXHUxNzQwLVxcdTE3NTNcXHUxNzYwLVxcdTE3NmNcXHUxNzZlLVxcdTE3NzBcXHUxNzcyXFx1MTc3M1xcdTE3ODAtXFx1MTdkM1xcdTE3ZDdcXHUxN2RjXFx1MTdkZFxcdTE3ZTAtXFx1MTdlOVxcdTE4MGItXFx1MTgwZFxcdTE4MTAtXFx1MTgxOVxcdTE4MjAtXFx1MTg3N1xcdTE4ODAtXFx1MThhYVxcdTE4YjAtXFx1MThmNVxcdTE5MDAtXFx1MTkxY1xcdTE5MjAtXFx1MTkyYlxcdTE5MzAtXFx1MTkzYlxcdTE5NDYtXFx1MTk2ZFxcdTE5NzAtXFx1MTk3NFxcdTE5ODAtXFx1MTlhYlxcdTE5YjAtXFx1MTljOVxcdTE5ZDAtXFx1MTlkOVxcdTFhMDAtXFx1MWExYlxcdTFhMjAtXFx1MWE1ZVxcdTFhNjAtXFx1MWE3Y1xcdTFhN2YtXFx1MWE4OVxcdTFhOTAtXFx1MWE5OVxcdTFhYTdcXHUxYjAwLVxcdTFiNGJcXHUxYjUwLVxcdTFiNTlcXHUxYjZiLVxcdTFiNzNcXHUxYjgwLVxcdTFiZjNcXHUxYzAwLVxcdTFjMzdcXHUxYzQwLVxcdTFjNDlcXHUxYzRkLVxcdTFjN2RcXHUxY2QwLVxcdTFjZDJcXHUxY2Q0LVxcdTFjZjZcXHUxZDAwLVxcdTFkZTZcXHUxZGZjLVxcdTFmMTVcXHUxZjE4LVxcdTFmMWRcXHUxZjIwLVxcdTFmNDVcXHUxZjQ4LVxcdTFmNGRcXHUxZjUwLVxcdTFmNTdcXHUxZjU5XFx1MWY1YlxcdTFmNWRcXHUxZjVmLVxcdTFmN2RcXHUxZjgwLVxcdTFmYjRcXHUxZmI2LVxcdTFmYmNcXHUxZmJlXFx1MWZjMi1cXHUxZmM0XFx1MWZjNi1cXHUxZmNjXFx1MWZkMC1cXHUxZmQzXFx1MWZkNi1cXHUxZmRiXFx1MWZlMC1cXHUxZmVjXFx1MWZmMi1cXHUxZmY0XFx1MWZmNi1cXHUxZmZjXFx1MjAwY1xcdTIwMGRcXHUyMDNmXFx1MjA0MFxcdTIwNTRcXHUyMDcxXFx1MjA3ZlxcdTIwOTAtXFx1MjA5Y1xcdTIwZDAtXFx1MjBkY1xcdTIwZTFcXHUyMGU1LVxcdTIwZjBcXHUyMTAyXFx1MjEwN1xcdTIxMGEtXFx1MjExM1xcdTIxMTVcXHUyMTE5LVxcdTIxMWRcXHUyMTI0XFx1MjEyNlxcdTIxMjhcXHUyMTJhLVxcdTIxMmRcXHUyMTJmLVxcdTIxMzlcXHUyMTNjLVxcdTIxM2ZcXHUyMTQ1LVxcdTIxNDlcXHUyMTRlXFx1MjE2MC1cXHUyMTg4XFx1MmMwMC1cXHUyYzJlXFx1MmMzMC1cXHUyYzVlXFx1MmM2MC1cXHUyY2U0XFx1MmNlYi1cXHUyY2YzXFx1MmQwMC1cXHUyZDI1XFx1MmQyN1xcdTJkMmRcXHUyZDMwLVxcdTJkNjdcXHUyZDZmXFx1MmQ3Zi1cXHUyZDk2XFx1MmRhMC1cXHUyZGE2XFx1MmRhOC1cXHUyZGFlXFx1MmRiMC1cXHUyZGI2XFx1MmRiOC1cXHUyZGJlXFx1MmRjMC1cXHUyZGM2XFx1MmRjOC1cXHUyZGNlXFx1MmRkMC1cXHUyZGQ2XFx1MmRkOC1cXHUyZGRlXFx1MmRlMC1cXHUyZGZmXFx1MmUyZlxcdTMwMDUtXFx1MzAwN1xcdTMwMjEtXFx1MzAyZlxcdTMwMzEtXFx1MzAzNVxcdTMwMzgtXFx1MzAzY1xcdTMwNDEtXFx1MzA5NlxcdTMwOTlcXHUzMDlhXFx1MzA5ZC1cXHUzMDlmXFx1MzBhMS1cXHUzMGZhXFx1MzBmYy1cXHUzMGZmXFx1MzEwNS1cXHUzMTJkXFx1MzEzMS1cXHUzMThlXFx1MzFhMC1cXHUzMWJhXFx1MzFmMC1cXHUzMWZmXFx1MzQwMC1cXHU0ZGI1XFx1NGUwMC1cXHU5ZmNjXFx1YTAwMC1cXHVhNDhjXFx1YTRkMC1cXHVhNGZkXFx1YTUwMC1cXHVhNjBjXFx1YTYxMC1cXHVhNjJiXFx1YTY0MC1cXHVhNjZmXFx1YTY3NC1cXHVhNjdkXFx1YTY3Zi1cXHVhNjk3XFx1YTY5Zi1cXHVhNmYxXFx1YTcxNy1cXHVhNzFmXFx1YTcyMi1cXHVhNzg4XFx1YTc4Yi1cXHVhNzhlXFx1YTc5MC1cXHVhNzkzXFx1YTdhMC1cXHVhN2FhXFx1YTdmOC1cXHVhODI3XFx1YTg0MC1cXHVhODczXFx1YTg4MC1cXHVhOGM0XFx1YThkMC1cXHVhOGQ5XFx1YThlMC1cXHVhOGY3XFx1YThmYlxcdWE5MDAtXFx1YTkyZFxcdWE5MzAtXFx1YTk1M1xcdWE5NjAtXFx1YTk3Y1xcdWE5ODAtXFx1YTljMFxcdWE5Y2YtXFx1YTlkOVxcdWFhMDAtXFx1YWEzNlxcdWFhNDAtXFx1YWE0ZFxcdWFhNTAtXFx1YWE1OVxcdWFhNjAtXFx1YWE3NlxcdWFhN2FcXHVhYTdiXFx1YWE4MC1cXHVhYWMyXFx1YWFkYi1cXHVhYWRkXFx1YWFlMC1cXHVhYWVmXFx1YWFmMi1cXHVhYWY2XFx1YWIwMS1cXHVhYjA2XFx1YWIwOS1cXHVhYjBlXFx1YWIxMS1cXHVhYjE2XFx1YWIyMC1cXHVhYjI2XFx1YWIyOC1cXHVhYjJlXFx1YWJjMC1cXHVhYmVhXFx1YWJlY1xcdWFiZWRcXHVhYmYwLVxcdWFiZjlcXHVhYzAwLVxcdWQ3YTNcXHVkN2IwLVxcdWQ3YzZcXHVkN2NiLVxcdWQ3ZmJcXHVmOTAwLVxcdWZhNmRcXHVmYTcwLVxcdWZhZDlcXHVmYjAwLVxcdWZiMDZcXHVmYjEzLVxcdWZiMTdcXHVmYjFkLVxcdWZiMjhcXHVmYjJhLVxcdWZiMzZcXHVmYjM4LVxcdWZiM2NcXHVmYjNlXFx1ZmI0MFxcdWZiNDFcXHVmYjQzXFx1ZmI0NFxcdWZiNDYtXFx1ZmJiMVxcdWZiZDMtXFx1ZmQzZFxcdWZkNTAtXFx1ZmQ4ZlxcdWZkOTItXFx1ZmRjN1xcdWZkZjAtXFx1ZmRmYlxcdWZlMDAtXFx1ZmUwZlxcdWZlMjAtXFx1ZmUyNlxcdWZlMzNcXHVmZTM0XFx1ZmU0ZC1cXHVmZTRmXFx1ZmU3MC1cXHVmZTc0XFx1ZmU3Ni1cXHVmZWZjXFx1ZmYxMC1cXHVmZjE5XFx1ZmYyMS1cXHVmZjNhXFx1ZmYzZlxcdWZmNDEtXFx1ZmY1YVxcdWZmNjYtXFx1ZmZiZVxcdWZmYzItXFx1ZmZjN1xcdWZmY2EtXFx1ZmZjZlxcdWZmZDItXFx1ZmZkN1xcdWZmZGEtXFx1ZmZkY10nKVxuICAgIH07XG5cbiAgICAvLyBFbnN1cmUgdGhlIGNvbmRpdGlvbiBpcyB0cnVlLCBvdGhlcndpc2UgdGhyb3cgYW4gZXJyb3IuXG4gICAgLy8gVGhpcyBpcyBvbmx5IHRvIGhhdmUgYSBiZXR0ZXIgY29udHJhY3Qgc2VtYW50aWMsIGkuZS4gYW5vdGhlciBzYWZldHkgbmV0XG4gICAgLy8gdG8gY2F0Y2ggYSBsb2dpYyBlcnJvci4gVGhlIGNvbmRpdGlvbiBzaGFsbCBiZSBmdWxmaWxsZWQgaW4gbm9ybWFsIGNhc2UuXG4gICAgLy8gRG8gTk9UIHVzZSB0aGlzIHRvIGVuZm9yY2UgYSBjZXJ0YWluIGNvbmRpdGlvbiBvbiBhbnkgdXNlciBpbnB1dC5cblxuICAgIGZ1bmN0aW9uIGFzc2VydChjb25kaXRpb24sIG1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQVNTRVJUOiAnICsgbWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzbGljZVNvdXJjZShmcm9tLCB0bykge1xuICAgICAgICByZXR1cm4gc291cmNlLnNsaWNlKGZyb20sIHRvKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mICdlc3ByaW1hJ1swXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgc2xpY2VTb3VyY2UgPSBmdW5jdGlvbiBzbGljZUFycmF5U291cmNlKGZyb20sIHRvKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlLnNsaWNlKGZyb20sIHRvKS5qb2luKCcnKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0RlY2ltYWxEaWdpdChjaCkge1xuICAgICAgICByZXR1cm4gJzAxMjM0NTY3ODknLmluZGV4T2YoY2gpID49IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNIZXhEaWdpdChjaCkge1xuICAgICAgICByZXR1cm4gJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnLmluZGV4T2YoY2gpID49IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNPY3RhbERpZ2l0KGNoKSB7XG4gICAgICAgIHJldHVybiAnMDEyMzQ1NjcnLmluZGV4T2YoY2gpID49IDA7XG4gICAgfVxuXG5cbiAgICAvLyA3LjIgV2hpdGUgU3BhY2VcblxuICAgIGZ1bmN0aW9uIGlzV2hpdGVTcGFjZShjaCkge1xuICAgICAgICByZXR1cm4gKGNoID09PSAnICcpIHx8IChjaCA9PT0gJ1xcdTAwMDknKSB8fCAoY2ggPT09ICdcXHUwMDBCJykgfHxcbiAgICAgICAgICAgIChjaCA9PT0gJ1xcdTAwMEMnKSB8fCAoY2ggPT09ICdcXHUwMEEwJykgfHxcbiAgICAgICAgICAgIChjaC5jaGFyQ29kZUF0KDApID49IDB4MTY4MCAmJlxuICAgICAgICAgICAgICdcXHUxNjgwXFx1MTgwRVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBBXFx1MjAyRlxcdTIwNUZcXHUzMDAwXFx1RkVGRicuaW5kZXhPZihjaCkgPj0gMCk7XG4gICAgfVxuXG4gICAgLy8gNy4zIExpbmUgVGVybWluYXRvcnNcblxuICAgIGZ1bmN0aW9uIGlzTGluZVRlcm1pbmF0b3IoY2gpIHtcbiAgICAgICAgcmV0dXJuIChjaCA9PT0gJ1xcbicgfHwgY2ggPT09ICdcXHInIHx8IGNoID09PSAnXFx1MjAyOCcgfHwgY2ggPT09ICdcXHUyMDI5Jyk7XG4gICAgfVxuXG4gICAgLy8gNy42IElkZW50aWZpZXIgTmFtZXMgYW5kIElkZW50aWZpZXJzXG5cbiAgICBmdW5jdGlvbiBpc0lkZW50aWZpZXJTdGFydChjaCkge1xuICAgICAgICByZXR1cm4gKGNoID09PSAnJCcpIHx8IChjaCA9PT0gJ18nKSB8fCAoY2ggPT09ICdcXFxcJykgfHxcbiAgICAgICAgICAgIChjaCA+PSAnYScgJiYgY2ggPD0gJ3onKSB8fCAoY2ggPj0gJ0EnICYmIGNoIDw9ICdaJykgfHxcbiAgICAgICAgICAgICgoY2guY2hhckNvZGVBdCgwKSA+PSAweDgwKSAmJiBSZWdleC5Ob25Bc2NpaUlkZW50aWZpZXJTdGFydC50ZXN0KGNoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNJZGVudGlmaWVyUGFydChjaCkge1xuICAgICAgICByZXR1cm4gKGNoID09PSAnJCcpIHx8IChjaCA9PT0gJ18nKSB8fCAoY2ggPT09ICdcXFxcJykgfHxcbiAgICAgICAgICAgIChjaCA+PSAnYScgJiYgY2ggPD0gJ3onKSB8fCAoY2ggPj0gJ0EnICYmIGNoIDw9ICdaJykgfHxcbiAgICAgICAgICAgICgoY2ggPj0gJzAnKSAmJiAoY2ggPD0gJzknKSkgfHxcbiAgICAgICAgICAgICgoY2guY2hhckNvZGVBdCgwKSA+PSAweDgwKSAmJiBSZWdleC5Ob25Bc2NpaUlkZW50aWZpZXJQYXJ0LnRlc3QoY2gpKTtcbiAgICB9XG5cbiAgICAvLyA3LjYuMS4yIEZ1dHVyZSBSZXNlcnZlZCBXb3Jkc1xuXG4gICAgZnVuY3Rpb24gaXNGdXR1cmVSZXNlcnZlZFdvcmQoaWQpIHtcbiAgICAgICAgc3dpdGNoIChpZCkge1xuXG4gICAgICAgIC8vIEZ1dHVyZSByZXNlcnZlZCB3b3Jkcy5cbiAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICBjYXNlICdlbnVtJzpcbiAgICAgICAgY2FzZSAnZXhwb3J0JzpcbiAgICAgICAgY2FzZSAnZXh0ZW5kcyc6XG4gICAgICAgIGNhc2UgJ2ltcG9ydCc6XG4gICAgICAgIGNhc2UgJ3N1cGVyJzpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzU3RyaWN0TW9kZVJlc2VydmVkV29yZChpZCkge1xuICAgICAgICBzd2l0Y2ggKGlkKSB7XG5cbiAgICAgICAgLy8gU3RyaWN0IE1vZGUgcmVzZXJ2ZWQgd29yZHMuXG4gICAgICAgIGNhc2UgJ2ltcGxlbWVudHMnOlxuICAgICAgICBjYXNlICdpbnRlcmZhY2UnOlxuICAgICAgICBjYXNlICdwYWNrYWdlJzpcbiAgICAgICAgY2FzZSAncHJpdmF0ZSc6XG4gICAgICAgIGNhc2UgJ3Byb3RlY3RlZCc6XG4gICAgICAgIGNhc2UgJ3B1YmxpYyc6XG4gICAgICAgIGNhc2UgJ3N0YXRpYyc6XG4gICAgICAgIGNhc2UgJ3lpZWxkJzpcbiAgICAgICAgY2FzZSAnbGV0JzpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzUmVzdHJpY3RlZFdvcmQoaWQpIHtcbiAgICAgICAgcmV0dXJuIGlkID09PSAnZXZhbCcgfHwgaWQgPT09ICdhcmd1bWVudHMnO1xuICAgIH1cblxuICAgIC8vIDcuNi4xLjEgS2V5d29yZHNcblxuICAgIGZ1bmN0aW9uIGlzS2V5d29yZChpZCkge1xuICAgICAgICB2YXIga2V5d29yZCA9IGZhbHNlO1xuICAgICAgICBzd2l0Y2ggKGlkLmxlbmd0aCkge1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBrZXl3b3JkID0gKGlkID09PSAnaWYnKSB8fCAoaWQgPT09ICdpbicpIHx8IChpZCA9PT0gJ2RvJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAga2V5d29yZCA9IChpZCA9PT0gJ3ZhcicpIHx8IChpZCA9PT0gJ2ZvcicpIHx8IChpZCA9PT0gJ25ldycpIHx8IChpZCA9PT0gJ3RyeScpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgIGtleXdvcmQgPSAoaWQgPT09ICd0aGlzJykgfHwgKGlkID09PSAnZWxzZScpIHx8IChpZCA9PT0gJ2Nhc2UnKSB8fCAoaWQgPT09ICd2b2lkJykgfHwgKGlkID09PSAnd2l0aCcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICAgIGtleXdvcmQgPSAoaWQgPT09ICd3aGlsZScpIHx8IChpZCA9PT0gJ2JyZWFrJykgfHwgKGlkID09PSAnY2F0Y2gnKSB8fCAoaWQgPT09ICd0aHJvdycpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgNjpcbiAgICAgICAgICAgIGtleXdvcmQgPSAoaWQgPT09ICdyZXR1cm4nKSB8fCAoaWQgPT09ICd0eXBlb2YnKSB8fCAoaWQgPT09ICdkZWxldGUnKSB8fCAoaWQgPT09ICdzd2l0Y2gnKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgICBrZXl3b3JkID0gKGlkID09PSAnZGVmYXVsdCcpIHx8IChpZCA9PT0gJ2ZpbmFsbHknKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgICBrZXl3b3JkID0gKGlkID09PSAnZnVuY3Rpb24nKSB8fCAoaWQgPT09ICdjb250aW51ZScpIHx8IChpZCA9PT0gJ2RlYnVnZ2VyJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxMDpcbiAgICAgICAgICAgIGtleXdvcmQgPSAoaWQgPT09ICdpbnN0YW5jZW9mJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXl3b3JkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAoaWQpIHtcbiAgICAgICAgLy8gRnV0dXJlIHJlc2VydmVkIHdvcmRzLlxuICAgICAgICAvLyAnY29uc3QnIGlzIHNwZWNpYWxpemVkIGFzIEtleXdvcmQgaW4gVjguXG4gICAgICAgIGNhc2UgJ2NvbnN0JzpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgIC8vIEZvciBjb21wYXRpYmxpdHkgdG8gU3BpZGVyTW9ua2V5IGFuZCBFUy5uZXh0XG4gICAgICAgIGNhc2UgJ3lpZWxkJzpcbiAgICAgICAgY2FzZSAnbGV0JzpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0cmljdCAmJiBpc1N0cmljdE1vZGVSZXNlcnZlZFdvcmQoaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpc0Z1dHVyZVJlc2VydmVkV29yZChpZCk7XG4gICAgfVxuXG4gICAgLy8gNy40IENvbW1lbnRzXG5cbiAgICBmdW5jdGlvbiBza2lwQ29tbWVudCgpIHtcbiAgICAgICAgdmFyIGNoLCBibG9ja0NvbW1lbnQsIGxpbmVDb21tZW50O1xuXG4gICAgICAgIGJsb2NrQ29tbWVudCA9IGZhbHNlO1xuICAgICAgICBsaW5lQ29tbWVudCA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAobGluZUNvbW1lbnQpIHtcbiAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNMaW5lVGVybWluYXRvcihjaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZUNvbW1lbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoID09PSAnXFxyJyAmJiBzb3VyY2VbaW5kZXhdID09PSAnXFxuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICArK2xpbmVOdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVTdGFydCA9IGluZGV4O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYmxvY2tDb21tZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzTGluZVRlcm1pbmF0b3IoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJ1xccicgJiYgc291cmNlW2luZGV4ICsgMV0gPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICsrbGluZU51bWJlcjtcbiAgICAgICAgICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgbGluZVN0YXJ0ID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVuZXhwZWN0ZWRUb2tlbiwgJ0lMTEVHQUwnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sICdJTExFR0FMJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibG9ja0NvbW1lbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICcvJykge1xuICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4ICsgMV07XG4gICAgICAgICAgICAgICAgaWYgKGNoID09PSAnLycpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gMjtcbiAgICAgICAgICAgICAgICAgICAgbGluZUNvbW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICcqJykge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCArPSAyO1xuICAgICAgICAgICAgICAgICAgICBibG9ja0NvbW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sICdJTExFR0FMJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzV2hpdGVTcGFjZShjaCkpIHtcbiAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0xpbmVUZXJtaW5hdG9yKGNoKSkge1xuICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgaWYgKGNoID09PSAgJ1xccicgJiYgc291cmNlW2luZGV4XSA9PT0gJ1xcbicpIHtcbiAgICAgICAgICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKytsaW5lTnVtYmVyO1xuICAgICAgICAgICAgICAgIGxpbmVTdGFydCA9IGluZGV4O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjYW5IZXhFc2NhcGUocHJlZml4KSB7XG4gICAgICAgIHZhciBpLCBsZW4sIGNoLCBjb2RlID0gMDtcblxuICAgICAgICBsZW4gPSAocHJlZml4ID09PSAndScpID8gNCA6IDI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgaWYgKGluZGV4IDwgbGVuZ3RoICYmIGlzSGV4RGlnaXQoc291cmNlW2luZGV4XSkpIHtcbiAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICBjb2RlID0gY29kZSAqIDE2ICsgJzAxMjM0NTY3ODlhYmNkZWYnLmluZGV4T2YoY2gudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY2FuSWRlbnRpZmllcigpIHtcbiAgICAgICAgdmFyIGNoLCBzdGFydCwgaWQsIHJlc3RvcmU7XG5cbiAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICBpZiAoIWlzSWRlbnRpZmllclN0YXJ0KGNoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgaWYgKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICBpZiAoc291cmNlW2luZGV4XSAhPT0gJ3UnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgIHJlc3RvcmUgPSBpbmRleDtcbiAgICAgICAgICAgIGNoID0gc2NhbkhleEVzY2FwZSgndScpO1xuICAgICAgICAgICAgaWYgKGNoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoID09PSAnXFxcXCcgfHwgIWlzSWRlbnRpZmllclN0YXJ0KGNoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlkID0gY2g7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluZGV4ID0gcmVzdG9yZTtcbiAgICAgICAgICAgICAgICBpZCA9ICd1JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlkID0gc291cmNlW2luZGV4KytdO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWlzSWRlbnRpZmllclBhcnQoY2gpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2ggPT09ICdcXFxcJykge1xuICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZVtpbmRleF0gIT09ICd1Jykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgcmVzdG9yZSA9IGluZGV4O1xuICAgICAgICAgICAgICAgIGNoID0gc2NhbkhleEVzY2FwZSgndScpO1xuICAgICAgICAgICAgICAgIGlmIChjaCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICdcXFxcJyB8fCAhaXNJZGVudGlmaWVyUGFydChjaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZCArPSBjaDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IHJlc3RvcmU7XG4gICAgICAgICAgICAgICAgICAgIGlkICs9ICd1JztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlkICs9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZXJlIGlzIG5vIGtleXdvcmQgb3IgbGl0ZXJhbCB3aXRoIG9ubHkgb25lIGNoYXJhY3Rlci5cbiAgICAgICAgLy8gVGh1cywgaXQgbXVzdCBiZSBhbiBpZGVudGlmaWVyLlxuICAgICAgICBpZiAoaWQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFRva2VuLklkZW50aWZpZXIsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGlkLFxuICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzS2V5d29yZChpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uS2V5d29yZCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogaWQsXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyA3LjguMSBOdWxsIExpdGVyYWxzXG5cbiAgICAgICAgaWYgKGlkID09PSAnbnVsbCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uTnVsbExpdGVyYWwsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGlkLFxuICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gNy44LjIgQm9vbGVhbiBMaXRlcmFsc1xuXG4gICAgICAgIGlmIChpZCA9PT0gJ3RydWUnIHx8IGlkID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFRva2VuLkJvb2xlYW5MaXRlcmFsLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBpZCxcbiAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGxpbmVTdGFydDogbGluZVN0YXJ0LFxuICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBUb2tlbi5JZGVudGlmaWVyLFxuICAgICAgICAgICAgdmFsdWU6IGlkLFxuICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgIGxpbmVTdGFydDogbGluZVN0YXJ0LFxuICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gNy43IFB1bmN0dWF0b3JzXG5cbiAgICBmdW5jdGlvbiBzY2FuUHVuY3R1YXRvcigpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gaW5kZXgsXG4gICAgICAgICAgICBjaDEgPSBzb3VyY2VbaW5kZXhdLFxuICAgICAgICAgICAgY2gyLFxuICAgICAgICAgICAgY2gzLFxuICAgICAgICAgICAgY2g0O1xuXG4gICAgICAgIC8vIENoZWNrIGZvciBtb3N0IGNvbW1vbiBzaW5nbGUtY2hhcmFjdGVyIHB1bmN0dWF0b3JzLlxuXG4gICAgICAgIGlmIChjaDEgPT09ICc7JyB8fCBjaDEgPT09ICd7JyB8fCBjaDEgPT09ICd9Jykge1xuICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uUHVuY3R1YXRvcixcbiAgICAgICAgICAgICAgICB2YWx1ZTogY2gxLFxuICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoMSA9PT0gJywnIHx8IGNoMSA9PT0gJygnIHx8IGNoMSA9PT0gJyknKSB7XG4gICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBjaDEsXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb3QgKC4pIGNhbiBhbHNvIHN0YXJ0IGEgZmxvYXRpbmctcG9pbnQgbnVtYmVyLCBoZW5jZSB0aGUgbmVlZFxuICAgICAgICAvLyB0byBjaGVjayB0aGUgbmV4dCBjaGFyYWN0ZXIuXG5cbiAgICAgICAgY2gyID0gc291cmNlW2luZGV4ICsgMV07XG4gICAgICAgIGlmIChjaDEgPT09ICcuJyAmJiAhaXNEZWNpbWFsRGlnaXQoY2gyKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBzb3VyY2VbaW5kZXgrK10sXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQZWVrIG1vcmUgY2hhcmFjdGVycy5cblxuICAgICAgICBjaDMgPSBzb3VyY2VbaW5kZXggKyAyXTtcbiAgICAgICAgY2g0ID0gc291cmNlW2luZGV4ICsgM107XG5cbiAgICAgICAgLy8gNC1jaGFyYWN0ZXIgcHVuY3R1YXRvcjogPj4+PVxuXG4gICAgICAgIGlmIChjaDEgPT09ICc+JyAmJiBjaDIgPT09ICc+JyAmJiBjaDMgPT09ICc+Jykge1xuICAgICAgICAgICAgaWYgKGNoNCA9PT0gJz0nKSB7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gNDtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJz4+Pj0nLFxuICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDMtY2hhcmFjdGVyIHB1bmN0dWF0b3JzOiA9PT0gIT09ID4+PiA8PD0gPj49XG5cbiAgICAgICAgaWYgKGNoMSA9PT0gJz0nICYmIGNoMiA9PT0gJz0nICYmIGNoMyA9PT0gJz0nKSB7XG4gICAgICAgICAgICBpbmRleCArPSAzO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAnPT09JyxcbiAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGxpbmVTdGFydDogbGluZVN0YXJ0LFxuICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaDEgPT09ICchJyAmJiBjaDIgPT09ICc9JyAmJiBjaDMgPT09ICc9Jykge1xuICAgICAgICAgICAgaW5kZXggKz0gMztcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uUHVuY3R1YXRvcixcbiAgICAgICAgICAgICAgICB2YWx1ZTogJyE9PScsXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2gxID09PSAnPicgJiYgY2gyID09PSAnPicgJiYgY2gzID09PSAnPicpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDM7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFRva2VuLlB1bmN0dWF0b3IsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICc+Pj4nLFxuICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoMSA9PT0gJzwnICYmIGNoMiA9PT0gJzwnICYmIGNoMyA9PT0gJz0nKSB7XG4gICAgICAgICAgICBpbmRleCArPSAzO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAnPDw9JyxcbiAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGxpbmVTdGFydDogbGluZVN0YXJ0LFxuICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaDEgPT09ICc+JyAmJiBjaDIgPT09ICc+JyAmJiBjaDMgPT09ICc9Jykge1xuICAgICAgICAgICAgaW5kZXggKz0gMztcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uUHVuY3R1YXRvcixcbiAgICAgICAgICAgICAgICB2YWx1ZTogJz4+PScsXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyAyLWNoYXJhY3RlciBwdW5jdHVhdG9yczogPD0gPj0gPT0gIT0gKysgLS0gPDwgPj4gJiYgfHxcbiAgICAgICAgLy8gKz0gLT0gKj0gJT0gJj0gfD0gXj0gLz1cblxuICAgICAgICBpZiAoY2gyID09PSAnPScpIHtcbiAgICAgICAgICAgIGlmICgnPD49ISstKiUmfF4vJy5pbmRleE9mKGNoMSkgPj0gMCkge1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IDI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uUHVuY3R1YXRvcixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGNoMSArIGNoMixcbiAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2gxID09PSBjaDIgJiYgKCcrLTw+JnwnLmluZGV4T2YoY2gxKSA+PSAwKSkge1xuICAgICAgICAgICAgaWYgKCcrLTw+JnwnLmluZGV4T2YoY2gyKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMjtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5QdW5jdHVhdG9yLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogY2gxICsgY2gyLFxuICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSByZW1haW5pbmcgMS1jaGFyYWN0ZXIgcHVuY3R1YXRvcnMuXG5cbiAgICAgICAgaWYgKCdbXTw+Ky0qJSZ8XiF+Pzo9LycuaW5kZXhPZihjaDEpID49IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogVG9rZW4uUHVuY3R1YXRvcixcbiAgICAgICAgICAgICAgICB2YWx1ZTogc291cmNlW2luZGV4KytdLFxuICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICAgICAgcmFuZ2U6IFtzdGFydCwgaW5kZXhdXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gNy44LjMgTnVtZXJpYyBMaXRlcmFsc1xuXG4gICAgZnVuY3Rpb24gc2Nhbk51bWVyaWNMaXRlcmFsKCkge1xuICAgICAgICB2YXIgbnVtYmVyLCBzdGFydCwgY2g7XG5cbiAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICBhc3NlcnQoaXNEZWNpbWFsRGlnaXQoY2gpIHx8IChjaCA9PT0gJy4nKSxcbiAgICAgICAgICAgICdOdW1lcmljIGxpdGVyYWwgbXVzdCBzdGFydCB3aXRoIGEgZGVjaW1hbCBkaWdpdCBvciBhIGRlY2ltYWwgcG9pbnQnKTtcblxuICAgICAgICBzdGFydCA9IGluZGV4O1xuICAgICAgICBudW1iZXIgPSAnJztcbiAgICAgICAgaWYgKGNoICE9PSAnLicpIHtcbiAgICAgICAgICAgIG51bWJlciA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcblxuICAgICAgICAgICAgLy8gSGV4IG51bWJlciBzdGFydHMgd2l0aCAnMHgnLlxuICAgICAgICAgICAgLy8gT2N0YWwgbnVtYmVyIHN0YXJ0cyB3aXRoICcwJy5cbiAgICAgICAgICAgIGlmIChudW1iZXIgPT09ICcwJykge1xuICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJ3gnIHx8IGNoID09PSAnWCcpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtYmVyICs9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzSGV4RGlnaXQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG51bWJlci5sZW5ndGggPD0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSAweFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCAnSUxMRUdBTCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCAnSUxMRUdBTCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5OdW1lcmljTGl0ZXJhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXJzZUludChudW1iZXIsIDE2KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNPY3RhbERpZ2l0KGNoKSkge1xuICAgICAgICAgICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNPY3RhbERpZ2l0KGNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtYmVyICs9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KGNoKSB8fCBpc0RlY2ltYWxEaWdpdChjaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sICdJTExFR0FMJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFRva2VuLk51bWVyaWNMaXRlcmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHBhcnNlSW50KG51bWJlciwgOCksXG4gICAgICAgICAgICAgICAgICAgICAgICBvY3RhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGRlY2ltYWwgbnVtYmVyIHN0YXJ0cyB3aXRoICcwJyBzdWNoIGFzICcwOScgaXMgaWxsZWdhbC5cbiAgICAgICAgICAgICAgICBpZiAoaXNEZWNpbWFsRGlnaXQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVuZXhwZWN0ZWRUb2tlbiwgJ0lMTEVHQUwnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRGVjaW1hbERpZ2l0KGNoKSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbnVtYmVyICs9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaCA9PT0gJy4nKSB7XG4gICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghaXNEZWNpbWFsRGlnaXQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoID09PSAnZScgfHwgY2ggPT09ICdFJykge1xuICAgICAgICAgICAgbnVtYmVyICs9IHNvdXJjZVtpbmRleCsrXTtcblxuICAgICAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGNoID09PSAnKycgfHwgY2ggPT09ICctJykge1xuICAgICAgICAgICAgICAgIG51bWJlciArPSBzb3VyY2VbaW5kZXgrK107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgICAgIGlmIChpc0RlY2ltYWxEaWdpdChjaCkpIHtcbiAgICAgICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNEZWNpbWFsRGlnaXQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBudW1iZXIgKz0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2ggPSAnY2hhcmFjdGVyICcgKyBjaDtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoID0gJzxlbmQ+JztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCAnSUxMRUdBTCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQoY2gpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCAnSUxMRUdBTCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFRva2VuLk51bWVyaWNMaXRlcmFsLFxuICAgICAgICAgICAgdmFsdWU6IHBhcnNlRmxvYXQobnVtYmVyKSxcbiAgICAgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDcuOC40IFN0cmluZyBMaXRlcmFsc1xuXG4gICAgZnVuY3Rpb24gc2NhblN0cmluZ0xpdGVyYWwoKSB7XG4gICAgICAgIHZhciBzdHIgPSAnJywgcXVvdGUsIHN0YXJ0LCBjaCwgY29kZSwgdW5lc2NhcGVkLCByZXN0b3JlLCBvY3RhbCA9IGZhbHNlO1xuXG4gICAgICAgIHF1b3RlID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgYXNzZXJ0KChxdW90ZSA9PT0gJ1xcJycgfHwgcXVvdGUgPT09ICdcIicpLFxuICAgICAgICAgICAgJ1N0cmluZyBsaXRlcmFsIG11c3Qgc3RhcnRzIHdpdGggYSBxdW90ZScpO1xuXG4gICAgICAgIHN0YXJ0ID0gaW5kZXg7XG4gICAgICAgICsraW5kZXg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcblxuICAgICAgICAgICAgaWYgKGNoID09PSBxdW90ZSkge1xuICAgICAgICAgICAgICAgIHF1b3RlID0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTGluZVRlcm1pbmF0b3IoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoY2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xcbic7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAncic6XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xccic7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xcdCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3gnOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdG9yZSA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICAgICAgdW5lc2NhcGVkID0gc2NhbkhleEVzY2FwZShjaCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodW5lc2NhcGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IHVuZXNjYXBlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSByZXN0b3JlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBjaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdiJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxiJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdmJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxmJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd2JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFx4MEInO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc09jdGFsRGlnaXQoY2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSA9ICcwMTIzNDU2NycuaW5kZXhPZihjaCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBcXDAgaXMgbm90IG9jdGFsIGVzY2FwZSBzZXF1ZW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2RlICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9jdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPCBsZW5ndGggJiYgaXNPY3RhbERpZ2l0KHNvdXJjZVtpbmRleF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9jdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSA9IGNvZGUgKiA4ICsgJzAxMjM0NTY3Jy5pbmRleE9mKHNvdXJjZVtpbmRleCsrXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gMyBkaWdpdHMgYXJlIG9ubHkgYWxsb3dlZCB3aGVuIHN0cmluZyBzdGFydHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCAwLCAxLCAyLCAzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgnMDEyMycuaW5kZXhPZihjaCkgPj0gMCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4IDwgbGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNPY3RhbERpZ2l0KHNvdXJjZVtpbmRleF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlID0gY29kZSAqIDggKyAnMDEyMzQ1NjcnLmluZGV4T2Yoc291cmNlW2luZGV4KytdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICArK2xpbmVOdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gICdcXHInICYmIHNvdXJjZVtpbmRleF0gPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0xpbmVUZXJtaW5hdG9yKGNoKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdHIgKz0gY2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVvdGUgIT09ICcnKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sICdJTExFR0FMJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogVG9rZW4uU3RyaW5nTGl0ZXJhbCxcbiAgICAgICAgICAgIHZhbHVlOiBzdHIsXG4gICAgICAgICAgICBvY3RhbDogb2N0YWwsXG4gICAgICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgbGluZVN0YXJ0OiBsaW5lU3RhcnQsXG4gICAgICAgICAgICByYW5nZTogW3N0YXJ0LCBpbmRleF1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY2FuUmVnRXhwKCkge1xuICAgICAgICB2YXIgc3RyLCBjaCwgc3RhcnQsIHBhdHRlcm4sIGZsYWdzLCB2YWx1ZSwgY2xhc3NNYXJrZXIgPSBmYWxzZSwgcmVzdG9yZSwgdGVybWluYXRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHNraXBDb21tZW50KCk7XG5cbiAgICAgICAgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXhdO1xuICAgICAgICBhc3NlcnQoY2ggPT09ICcvJywgJ1JlZ3VsYXIgZXhwcmVzc2lvbiBsaXRlcmFsIG11c3Qgc3RhcnQgd2l0aCBhIHNsYXNoJyk7XG4gICAgICAgIHN0ciA9IHNvdXJjZVtpbmRleCsrXTtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgc3RyICs9IGNoO1xuICAgICAgICAgICAgaWYgKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICAvLyBFQ01BLTI2MiA3LjguNVxuICAgICAgICAgICAgICAgIGlmIChpc0xpbmVUZXJtaW5hdG9yKGNoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbnRlcm1pbmF0ZWRSZWdFeHApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdHIgKz0gY2g7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzTWFya2VyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoID09PSAnXScpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NNYXJrZXIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlcm1pbmF0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNoID09PSAnWycpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NNYXJrZXIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNMaW5lVGVybWluYXRvcihjaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW50ZXJtaW5hdGVkUmVnRXhwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRlcm1pbmF0ZWQpIHtcbiAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVudGVybWluYXRlZFJlZ0V4cCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFeGNsdWRlIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoLlxuICAgICAgICBwYXR0ZXJuID0gc3RyLnN1YnN0cigxLCBzdHIubGVuZ3RoIC0gMik7XG5cbiAgICAgICAgZmxhZ3MgPSAnJztcbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWlzSWRlbnRpZmllclBhcnQoY2gpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICBpZiAoY2ggPT09ICdcXFxcJyAmJiBpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICd1Jykge1xuICAgICAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgICAgICAgICByZXN0b3JlID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGNoID0gc2NhbkhleEVzY2FwZSgndScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZsYWdzICs9IGNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXFxcdSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKDsgcmVzdG9yZSA8IGluZGV4OyArK3Jlc3RvcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gc291cmNlW3Jlc3RvcmVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSByZXN0b3JlO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmxhZ3MgKz0gJ3UnO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXFxcdSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xcXFwnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmxhZ3MgKz0gY2g7XG4gICAgICAgICAgICAgICAgc3RyICs9IGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhbHVlID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCBmbGFncyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLkludmFsaWRSZWdFeHApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxpdGVyYWw6IHN0cixcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGluZGV4XVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzSWRlbnRpZmllck5hbWUodG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHRva2VuLnR5cGUgPT09IFRva2VuLklkZW50aWZpZXIgfHxcbiAgICAgICAgICAgIHRva2VuLnR5cGUgPT09IFRva2VuLktleXdvcmQgfHxcbiAgICAgICAgICAgIHRva2VuLnR5cGUgPT09IFRva2VuLkJvb2xlYW5MaXRlcmFsIHx8XG4gICAgICAgICAgICB0b2tlbi50eXBlID09PSBUb2tlbi5OdWxsTGl0ZXJhbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZHZhbmNlKCkge1xuICAgICAgICB2YXIgY2gsIHRva2VuO1xuXG4gICAgICAgIHNraXBDb21tZW50KCk7XG5cbiAgICAgICAgaWYgKGluZGV4ID49IGxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbi5FT0YsXG4gICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICBsaW5lU3RhcnQ6IGxpbmVTdGFydCxcbiAgICAgICAgICAgICAgICByYW5nZTogW2luZGV4LCBpbmRleF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0b2tlbiA9IHNjYW5QdW5jdHVhdG9yKCk7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgICAgIH1cblxuICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG5cbiAgICAgICAgaWYgKGNoID09PSAnXFwnJyB8fCBjaCA9PT0gJ1wiJykge1xuICAgICAgICAgICAgcmV0dXJuIHNjYW5TdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2ggPT09ICcuJyB8fCBpc0RlY2ltYWxEaWdpdChjaCkpIHtcbiAgICAgICAgICAgIHJldHVybiBzY2FuTnVtZXJpY0xpdGVyYWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRva2VuID0gc2NhbklkZW50aWZpZXIoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB0b2tlbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVuZXhwZWN0ZWRUb2tlbiwgJ0lMTEVHQUwnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciB0b2tlbjtcblxuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgICBpbmRleCA9IGJ1ZmZlci5yYW5nZVsxXTtcbiAgICAgICAgICAgIGxpbmVOdW1iZXIgPSBidWZmZXIubGluZU51bWJlcjtcbiAgICAgICAgICAgIGxpbmVTdGFydCA9IGJ1ZmZlci5saW5lU3RhcnQ7XG4gICAgICAgICAgICB0b2tlbiA9IGJ1ZmZlcjtcbiAgICAgICAgICAgIGJ1ZmZlciA9IG51bGw7XG4gICAgICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgICAgIH1cblxuICAgICAgICBidWZmZXIgPSBudWxsO1xuICAgICAgICByZXR1cm4gYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvb2thaGVhZCgpIHtcbiAgICAgICAgdmFyIHBvcywgbGluZSwgc3RhcnQ7XG5cbiAgICAgICAgaWYgKGJ1ZmZlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvcyA9IGluZGV4O1xuICAgICAgICBsaW5lID0gbGluZU51bWJlcjtcbiAgICAgICAgc3RhcnQgPSBsaW5lU3RhcnQ7XG4gICAgICAgIGJ1ZmZlciA9IGFkdmFuY2UoKTtcbiAgICAgICAgaW5kZXggPSBwb3M7XG4gICAgICAgIGxpbmVOdW1iZXIgPSBsaW5lO1xuICAgICAgICBsaW5lU3RhcnQgPSBzdGFydDtcblxuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgIH1cblxuICAgIC8vIFJldHVybiB0cnVlIGlmIHRoZXJlIGlzIGEgbGluZSB0ZXJtaW5hdG9yIGJlZm9yZSB0aGUgbmV4dCB0b2tlbi5cblxuICAgIGZ1bmN0aW9uIHBlZWtMaW5lVGVybWluYXRvcigpIHtcbiAgICAgICAgdmFyIHBvcywgbGluZSwgc3RhcnQsIGZvdW5kO1xuXG4gICAgICAgIHBvcyA9IGluZGV4O1xuICAgICAgICBsaW5lID0gbGluZU51bWJlcjtcbiAgICAgICAgc3RhcnQgPSBsaW5lU3RhcnQ7XG4gICAgICAgIHNraXBDb21tZW50KCk7XG4gICAgICAgIGZvdW5kID0gbGluZU51bWJlciAhPT0gbGluZTtcbiAgICAgICAgaW5kZXggPSBwb3M7XG4gICAgICAgIGxpbmVOdW1iZXIgPSBsaW5lO1xuICAgICAgICBsaW5lU3RhcnQgPSBzdGFydDtcblxuICAgICAgICByZXR1cm4gZm91bmQ7XG4gICAgfVxuXG4gICAgLy8gVGhyb3cgYW4gZXhjZXB0aW9uXG5cbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKHRva2VuLCBtZXNzYWdlRm9ybWF0KSB7XG4gICAgICAgIHZhciBlcnJvcixcbiAgICAgICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLFxuICAgICAgICAgICAgbXNnID0gbWVzc2FnZUZvcm1hdC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgIC8lKFxcZCkvZyxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAod2hvbGUsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhcmdzW2luZGV4XSB8fCAnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4ubGluZU51bWJlciA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdMaW5lICcgKyB0b2tlbi5saW5lTnVtYmVyICsgJzogJyArIG1zZyk7XG4gICAgICAgICAgICBlcnJvci5pbmRleCA9IHRva2VuLnJhbmdlWzBdO1xuICAgICAgICAgICAgZXJyb3IubGluZU51bWJlciA9IHRva2VuLmxpbmVOdW1iZXI7XG4gICAgICAgICAgICBlcnJvci5jb2x1bW4gPSB0b2tlbi5yYW5nZVswXSAtIGxpbmVTdGFydCArIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignTGluZSAnICsgbGluZU51bWJlciArICc6ICcgKyBtc2cpO1xuICAgICAgICAgICAgZXJyb3IuaW5kZXggPSBpbmRleDtcbiAgICAgICAgICAgIGVycm9yLmxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyO1xuICAgICAgICAgICAgZXJyb3IuY29sdW1uID0gaW5kZXggLSBsaW5lU3RhcnQgKyAxO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvclRvbGVyYW50KCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhyb3dFcnJvci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoZXh0cmEuZXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgZXh0cmEuZXJyb3JzLnB1c2goZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vIFRocm93IGFuIGV4Y2VwdGlvbiBiZWNhdXNlIG9mIHRoZSB0b2tlbi5cblxuICAgIGZ1bmN0aW9uIHRocm93VW5leHBlY3RlZCh0b2tlbikge1xuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW4uRU9GKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yKHRva2VuLCBNZXNzYWdlcy5VbmV4cGVjdGVkRU9TKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlbi5OdW1lcmljTGl0ZXJhbCkge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih0b2tlbiwgTWVzc2FnZXMuVW5leHBlY3RlZE51bWJlcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW4uU3RyaW5nTGl0ZXJhbCkge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih0b2tlbiwgTWVzc2FnZXMuVW5leHBlY3RlZFN0cmluZyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW4uSWRlbnRpZmllcikge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih0b2tlbiwgTWVzc2FnZXMuVW5leHBlY3RlZElkZW50aWZpZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuLktleXdvcmQpIHtcbiAgICAgICAgICAgIGlmIChpc0Z1dHVyZVJlc2VydmVkV29yZCh0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHRva2VuLCBNZXNzYWdlcy5VbmV4cGVjdGVkUmVzZXJ2ZWQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdHJpY3QgJiYgaXNTdHJpY3RNb2RlUmVzZXJ2ZWRXb3JkKHRva2VuLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudCh0b2tlbiwgTWVzc2FnZXMuU3RyaWN0UmVzZXJ2ZWRXb3JkKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvd0Vycm9yKHRva2VuLCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sIHRva2VuLnZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJvb2xlYW5MaXRlcmFsLCBOdWxsTGl0ZXJhbCwgb3IgUHVuY3R1YXRvci5cbiAgICAgICAgdGhyb3dFcnJvcih0b2tlbiwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCB0b2tlbi52YWx1ZSk7XG4gICAgfVxuXG4gICAgLy8gRXhwZWN0IHRoZSBuZXh0IHRva2VuIHRvIG1hdGNoIHRoZSBzcGVjaWZpZWQgcHVuY3R1YXRvci5cbiAgICAvLyBJZiBub3QsIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHRocm93bi5cblxuICAgIGZ1bmN0aW9uIGV4cGVjdCh2YWx1ZSkge1xuICAgICAgICB2YXIgdG9rZW4gPSBsZXgoKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLlB1bmN0dWF0b3IgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aHJvd1VuZXhwZWN0ZWQodG9rZW4pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRXhwZWN0IHRoZSBuZXh0IHRva2VuIHRvIG1hdGNoIHRoZSBzcGVjaWZpZWQga2V5d29yZC5cbiAgICAvLyBJZiBub3QsIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHRocm93bi5cblxuICAgIGZ1bmN0aW9uIGV4cGVjdEtleXdvcmQoa2V5d29yZCkge1xuICAgICAgICB2YXIgdG9rZW4gPSBsZXgoKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLktleXdvcmQgfHwgdG9rZW4udmFsdWUgIT09IGtleXdvcmQpIHtcbiAgICAgICAgICAgIHRocm93VW5leHBlY3RlZCh0b2tlbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdHJ1ZSBpZiB0aGUgbmV4dCB0b2tlbiBtYXRjaGVzIHRoZSBzcGVjaWZpZWQgcHVuY3R1YXRvci5cblxuICAgIGZ1bmN0aW9uIG1hdGNoKHZhbHVlKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICByZXR1cm4gdG9rZW4udHlwZSA9PT0gVG9rZW4uUHVuY3R1YXRvciAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWU7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRydWUgaWYgdGhlIG5leHQgdG9rZW4gbWF0Y2hlcyB0aGUgc3BlY2lmaWVkIGtleXdvcmRcblxuICAgIGZ1bmN0aW9uIG1hdGNoS2V5d29yZChrZXl3b3JkKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICByZXR1cm4gdG9rZW4udHlwZSA9PT0gVG9rZW4uS2V5d29yZCAmJiB0b2tlbi52YWx1ZSA9PT0ga2V5d29yZDtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdHJ1ZSBpZiB0aGUgbmV4dCB0b2tlbiBpcyBhbiBhc3NpZ25tZW50IG9wZXJhdG9yXG5cbiAgICBmdW5jdGlvbiBtYXRjaEFzc2lnbigpIHtcbiAgICAgICAgdmFyIHRva2VuID0gbG9va2FoZWFkKCksXG4gICAgICAgICAgICBvcCA9IHRva2VuLnZhbHVlO1xuXG4gICAgICAgIGlmICh0b2tlbi50eXBlICE9PSBUb2tlbi5QdW5jdHVhdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9wID09PSAnPScgfHxcbiAgICAgICAgICAgIG9wID09PSAnKj0nIHx8XG4gICAgICAgICAgICBvcCA9PT0gJy89JyB8fFxuICAgICAgICAgICAgb3AgPT09ICclPScgfHxcbiAgICAgICAgICAgIG9wID09PSAnKz0nIHx8XG4gICAgICAgICAgICBvcCA9PT0gJy09JyB8fFxuICAgICAgICAgICAgb3AgPT09ICc8PD0nIHx8XG4gICAgICAgICAgICBvcCA9PT0gJz4+PScgfHxcbiAgICAgICAgICAgIG9wID09PSAnPj4+PScgfHxcbiAgICAgICAgICAgIG9wID09PSAnJj0nIHx8XG4gICAgICAgICAgICBvcCA9PT0gJ149JyB8fFxuICAgICAgICAgICAgb3AgPT09ICd8PSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29uc3VtZVNlbWljb2xvbigpIHtcbiAgICAgICAgdmFyIHRva2VuLCBsaW5lO1xuXG4gICAgICAgIC8vIENhdGNoIHRoZSB2ZXJ5IGNvbW1vbiBjYXNlIGZpcnN0LlxuICAgICAgICBpZiAoc291cmNlW2luZGV4XSA9PT0gJzsnKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpbmUgPSBsaW5lTnVtYmVyO1xuICAgICAgICBza2lwQ29tbWVudCgpO1xuICAgICAgICBpZiAobGluZU51bWJlciAhPT0gbGluZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1hdGNoKCc7JykpIHtcbiAgICAgICAgICAgIGxleCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9rZW4gPSBsb29rYWhlYWQoKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLkVPRiAmJiAhbWF0Y2goJ30nKSkge1xuICAgICAgICAgICAgdGhyb3dVbmV4cGVjdGVkKHRva2VuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiB0cnVlIGlmIHByb3ZpZGVkIGV4cHJlc3Npb24gaXMgTGVmdEhhbmRTaWRlRXhwcmVzc2lvblxuXG4gICAgZnVuY3Rpb24gaXNMZWZ0SGFuZFNpZGUoZXhwcikge1xuICAgICAgICByZXR1cm4gZXhwci50eXBlID09PSBTeW50YXguSWRlbnRpZmllciB8fCBleHByLnR5cGUgPT09IFN5bnRheC5NZW1iZXJFeHByZXNzaW9uO1xuICAgIH1cblxuICAgIC8vIDExLjEuNCBBcnJheSBJbml0aWFsaXNlclxuXG4gICAgZnVuY3Rpb24gcGFyc2VBcnJheUluaXRpYWxpc2VyKCkge1xuICAgICAgICB2YXIgZWxlbWVudHMgPSBbXTtcblxuICAgICAgICBleHBlY3QoJ1snKTtcblxuICAgICAgICB3aGlsZSAoIW1hdGNoKCddJykpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaCgnLCcpKSB7XG4gICAgICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaChudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaChwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKCkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFtYXRjaCgnXScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdCgnLCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdCgnXScpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguQXJyYXlFeHByZXNzaW9uLFxuICAgICAgICAgICAgZWxlbWVudHM6IGVsZW1lbnRzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gMTEuMS41IE9iamVjdCBJbml0aWFsaXNlclxuXG4gICAgZnVuY3Rpb24gcGFyc2VQcm9wZXJ0eUZ1bmN0aW9uKHBhcmFtLCBmaXJzdCkge1xuICAgICAgICB2YXIgcHJldmlvdXNTdHJpY3QsIGJvZHk7XG5cbiAgICAgICAgcHJldmlvdXNTdHJpY3QgPSBzdHJpY3Q7XG4gICAgICAgIGJvZHkgPSBwYXJzZUZ1bmN0aW9uU291cmNlRWxlbWVudHMoKTtcbiAgICAgICAgaWYgKGZpcnN0ICYmIHN0cmljdCAmJiBpc1Jlc3RyaWN0ZWRXb3JkKHBhcmFtWzBdLm5hbWUpKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoZmlyc3QsIE1lc3NhZ2VzLlN0cmljdFBhcmFtTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RyaWN0ID0gcHJldmlvdXNTdHJpY3Q7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5GdW5jdGlvbkV4cHJlc3Npb24sXG4gICAgICAgICAgICBpZDogbnVsbCxcbiAgICAgICAgICAgIHBhcmFtczogcGFyYW0sXG4gICAgICAgICAgICBkZWZhdWx0czogW10sXG4gICAgICAgICAgICBib2R5OiBib2R5LFxuICAgICAgICAgICAgcmVzdDogbnVsbCxcbiAgICAgICAgICAgIGdlbmVyYXRvcjogZmFsc2UsXG4gICAgICAgICAgICBleHByZXNzaW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlT2JqZWN0UHJvcGVydHlLZXkoKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IGxleCgpO1xuXG4gICAgICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9ubHkgZnJvbSBwYXJzZU9iamVjdFByb3BlcnR5KCksIHdoZXJlXG4gICAgICAgIC8vIEVPRiBhbmQgUHVuY3R1YXRvciB0b2tlbnMgYXJlIGFscmVhZHkgZmlsdGVyZWQgb3V0LlxuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlbi5TdHJpbmdMaXRlcmFsIHx8IHRva2VuLnR5cGUgPT09IFRva2VuLk51bWVyaWNMaXRlcmFsKSB7XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIHRva2VuLm9jdGFsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHRva2VuLCBNZXNzYWdlcy5TdHJpY3RPY3RhbExpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUxpdGVyYWwodG9rZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgbmFtZTogdG9rZW4udmFsdWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZU9iamVjdFByb3BlcnR5KCkge1xuICAgICAgICB2YXIgdG9rZW4sIGtleSwgaWQsIHBhcmFtO1xuXG4gICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG5cbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuLklkZW50aWZpZXIpIHtcblxuICAgICAgICAgICAgaWQgPSBwYXJzZU9iamVjdFByb3BlcnR5S2V5KCk7XG5cbiAgICAgICAgICAgIC8vIFByb3BlcnR5IEFzc2lnbm1lbnQ6IEdldHRlciBhbmQgU2V0dGVyLlxuXG4gICAgICAgICAgICBpZiAodG9rZW4udmFsdWUgPT09ICdnZXQnICYmICFtYXRjaCgnOicpKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gcGFyc2VPYmplY3RQcm9wZXJ0eUtleSgpO1xuICAgICAgICAgICAgICAgIGV4cGVjdCgnKCcpO1xuICAgICAgICAgICAgICAgIGV4cGVjdCgnKScpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Qcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXJzZVByb3BlcnR5RnVuY3Rpb24oW10pLFxuICAgICAgICAgICAgICAgICAgICBraW5kOiAnZ2V0J1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRva2VuLnZhbHVlID09PSAnc2V0JyAmJiAhbWF0Y2goJzonKSkge1xuICAgICAgICAgICAgICAgIGtleSA9IHBhcnNlT2JqZWN0UHJvcGVydHlLZXkoKTtcbiAgICAgICAgICAgICAgICBleHBlY3QoJygnKTtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICAgICAgICAgIGlmICh0b2tlbi50eXBlICE9PSBUb2tlbi5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdCgnKScpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQodG9rZW4sIE1lc3NhZ2VzLlVuZXhwZWN0ZWRUb2tlbiwgdG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LlByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGFyc2VQcm9wZXJ0eUZ1bmN0aW9uKFtdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdzZXQnXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW0gPSBbIHBhcnNlVmFyaWFibGVJZGVudGlmaWVyKCkgXTtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0KCcpJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguUHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXJzZVByb3BlcnR5RnVuY3Rpb24ocGFyYW0sIHRva2VuKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdzZXQnXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QoJzonKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguUHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgIGtleTogaWQsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKCksXG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdpbml0J1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW4uRU9GIHx8IHRva2VuLnR5cGUgPT09IFRva2VuLlB1bmN0dWF0b3IpIHtcbiAgICAgICAgICAgIHRocm93VW5leHBlY3RlZCh0b2tlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBrZXkgPSBwYXJzZU9iamVjdFByb3BlcnR5S2V5KCk7XG4gICAgICAgICAgICBleHBlY3QoJzonKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LlByb3BlcnR5LFxuICAgICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICAgIHZhbHVlOiBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKCksXG4gICAgICAgICAgICAgICAga2luZDogJ2luaXQnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VPYmplY3RJbml0aWFsaXNlcigpIHtcbiAgICAgICAgdmFyIHByb3BlcnRpZXMgPSBbXSwgcHJvcGVydHksIG5hbWUsIGtpbmQsIG1hcCA9IHt9LCB0b1N0cmluZyA9IFN0cmluZztcblxuICAgICAgICBleHBlY3QoJ3snKTtcblxuICAgICAgICB3aGlsZSAoIW1hdGNoKCd9JykpIHtcbiAgICAgICAgICAgIHByb3BlcnR5ID0gcGFyc2VPYmplY3RQcm9wZXJ0eSgpO1xuXG4gICAgICAgICAgICBpZiAocHJvcGVydHkua2V5LnR5cGUgPT09IFN5bnRheC5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICAgICAgbmFtZSA9IHByb3BlcnR5LmtleS5uYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gdG9TdHJpbmcocHJvcGVydHkua2V5LnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtpbmQgPSAocHJvcGVydHkua2luZCA9PT0gJ2luaXQnKSA/IFByb3BlcnR5S2luZC5EYXRhIDogKHByb3BlcnR5LmtpbmQgPT09ICdnZXQnKSA/IFByb3BlcnR5S2luZC5HZXQgOiBQcm9wZXJ0eUtpbmQuU2V0O1xuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtYXAsIG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hcFtuYW1lXSA9PT0gUHJvcGVydHlLaW5kLkRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0cmljdCAmJiBraW5kID09PSBQcm9wZXJ0eUtpbmQuRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5TdHJpY3REdXBsaWNhdGVQcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoa2luZCAhPT0gUHJvcGVydHlLaW5kLkRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudCh7fSwgTWVzc2FnZXMuQWNjZXNzb3JEYXRhUHJvcGVydHkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtpbmQgPT09IFByb3BlcnR5S2luZC5EYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoe30sIE1lc3NhZ2VzLkFjY2Vzc29yRGF0YVByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXBbbmFtZV0gJiBraW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoe30sIE1lc3NhZ2VzLkFjY2Vzc29yR2V0U2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtYXBbbmFtZV0gfD0ga2luZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWFwW25hbWVdID0ga2luZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcblxuICAgICAgICAgICAgaWYgKCFtYXRjaCgnfScpKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KCcsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3QoJ30nKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4Lk9iamVjdEV4cHJlc3Npb24sXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gMTEuMS42IFRoZSBHcm91cGluZyBPcGVyYXRvclxuXG4gICAgZnVuY3Rpb24gcGFyc2VHcm91cEV4cHJlc3Npb24oKSB7XG4gICAgICAgIHZhciBleHByO1xuXG4gICAgICAgIGV4cGVjdCgnKCcpO1xuXG4gICAgICAgIGV4cHIgPSBwYXJzZUV4cHJlc3Npb24oKTtcblxuICAgICAgICBleHBlY3QoJyknKTtcblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cblxuICAgIC8vIDExLjEgUHJpbWFyeSBFeHByZXNzaW9uc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VQcmltYXJ5RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIHRva2VuID0gbG9va2FoZWFkKCksXG4gICAgICAgICAgICB0eXBlID0gdG9rZW4udHlwZTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gVG9rZW4uSWRlbnRpZmllcikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguSWRlbnRpZmllcixcbiAgICAgICAgICAgICAgICBuYW1lOiBsZXgoKS52YWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSBUb2tlbi5TdHJpbmdMaXRlcmFsIHx8IHR5cGUgPT09IFRva2VuLk51bWVyaWNMaXRlcmFsKSB7XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIHRva2VuLm9jdGFsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHRva2VuLCBNZXNzYWdlcy5TdHJpY3RPY3RhbExpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUxpdGVyYWwobGV4KCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGUgPT09IFRva2VuLktleXdvcmQpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaEtleXdvcmQoJ3RoaXMnKSkge1xuICAgICAgICAgICAgICAgIGxleCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5UaGlzRXhwcmVzc2lvblxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRjaEtleXdvcmQoJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VGdW5jdGlvbkV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSBUb2tlbi5Cb29sZWFuTGl0ZXJhbCkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICB0b2tlbi52YWx1ZSA9ICh0b2tlbi52YWx1ZSA9PT0gJ3RydWUnKTtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVMaXRlcmFsKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSBUb2tlbi5OdWxsTGl0ZXJhbCkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICB0b2tlbi52YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlTGl0ZXJhbCh0b2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2goJ1snKSkge1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlQXJyYXlJbml0aWFsaXNlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1hdGNoKCd7JykpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZU9iamVjdEluaXRpYWxpc2VyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2goJygnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlR3JvdXBFeHByZXNzaW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2goJy8nKSB8fCBtYXRjaCgnLz0nKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUxpdGVyYWwoc2NhblJlZ0V4cCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aHJvd1VuZXhwZWN0ZWQobGV4KCkpO1xuICAgIH1cblxuICAgIC8vIDExLjIgTGVmdC1IYW5kLVNpZGUgRXhwcmVzc2lvbnNcblxuICAgIGZ1bmN0aW9uIHBhcnNlQXJndW1lbnRzKCkge1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuXG4gICAgICAgIGV4cGVjdCgnKCcpO1xuXG4gICAgICAgIGlmICghbWF0Y2goJyknKSkge1xuICAgICAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYXJncy5wdXNoKHBhcnNlQXNzaWdubWVudEV4cHJlc3Npb24oKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKCcpJykpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGV4cGVjdCgnLCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0KCcpJyk7XG5cbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VOb25Db21wdXRlZFByb3BlcnR5KCkge1xuICAgICAgICB2YXIgdG9rZW4gPSBsZXgoKTtcblxuICAgICAgICBpZiAoIWlzSWRlbnRpZmllck5hbWUodG9rZW4pKSB7XG4gICAgICAgICAgICB0aHJvd1VuZXhwZWN0ZWQodG9rZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgbmFtZTogdG9rZW4udmFsdWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZU5vbkNvbXB1dGVkTWVtYmVyKCkge1xuICAgICAgICBleHBlY3QoJy4nKTtcblxuICAgICAgICByZXR1cm4gcGFyc2VOb25Db21wdXRlZFByb3BlcnR5KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VDb21wdXRlZE1lbWJlcigpIHtcbiAgICAgICAgdmFyIGV4cHI7XG5cbiAgICAgICAgZXhwZWN0KCdbJyk7XG5cbiAgICAgICAgZXhwciA9IHBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGV4cGVjdCgnXScpO1xuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlTmV3RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHI7XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgnbmV3Jyk7XG5cbiAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5OZXdFeHByZXNzaW9uLFxuICAgICAgICAgICAgY2FsbGVlOiBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb24oKSxcbiAgICAgICAgICAgICdhcmd1bWVudHMnOiBbXVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChtYXRjaCgnKCcpKSB7XG4gICAgICAgICAgICBleHByWydhcmd1bWVudHMnXSA9IHBhcnNlQXJndW1lbnRzKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb25BbGxvd0NhbGwoKSB7XG4gICAgICAgIHZhciBleHByO1xuXG4gICAgICAgIGV4cHIgPSBtYXRjaEtleXdvcmQoJ25ldycpID8gcGFyc2VOZXdFeHByZXNzaW9uKCkgOiBwYXJzZVByaW1hcnlFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgd2hpbGUgKG1hdGNoKCcuJykgfHwgbWF0Y2goJ1snKSB8fCBtYXRjaCgnKCcpKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2goJygnKSkge1xuICAgICAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5DYWxsRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgY2FsbGVlOiBleHByLFxuICAgICAgICAgICAgICAgICAgICAnYXJndW1lbnRzJzogcGFyc2VBcmd1bWVudHMoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGNoKCdbJykpIHtcbiAgICAgICAgICAgICAgICBleHByID0ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguTWVtYmVyRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgY29tcHV0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdDogZXhwcixcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHBhcnNlQ29tcHV0ZWRNZW1iZXIoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5NZW1iZXJFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICBjb21wdXRlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdDogZXhwcixcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHBhcnNlTm9uQ29tcHV0ZWRNZW1iZXIoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIHBhcnNlTGVmdEhhbmRTaWRlRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHI7XG5cbiAgICAgICAgZXhwciA9IG1hdGNoS2V5d29yZCgnbmV3JykgPyBwYXJzZU5ld0V4cHJlc3Npb24oKSA6IHBhcnNlUHJpbWFyeUV4cHJlc3Npb24oKTtcblxuICAgICAgICB3aGlsZSAobWF0Y2goJy4nKSB8fCBtYXRjaCgnWycpKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2goJ1snKSkge1xuICAgICAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5NZW1iZXJFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICBjb21wdXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBleHByLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcGFyc2VDb21wdXRlZE1lbWJlcigpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogU3ludGF4Lk1lbWJlckV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgIGNvbXB1dGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBleHByLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcGFyc2VOb25Db21wdXRlZE1lbWJlcigpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjMgUG9zdGZpeCBFeHByZXNzaW9uc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VQb3N0Zml4RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb25BbGxvd0NhbGwoKSwgdG9rZW47XG5cbiAgICAgICAgdG9rZW4gPSBsb29rYWhlYWQoKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLlB1bmN0dWF0b3IpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChtYXRjaCgnKysnKSB8fCBtYXRjaCgnLS0nKSkgJiYgIXBlZWtMaW5lVGVybWluYXRvcigpKSB7XG4gICAgICAgICAgICAvLyAxMS4zLjEsIDExLjMuMlxuICAgICAgICAgICAgaWYgKHN0cmljdCAmJiBleHByLnR5cGUgPT09IFN5bnRheC5JZGVudGlmaWVyICYmIGlzUmVzdHJpY3RlZFdvcmQoZXhwci5uYW1lKSkge1xuICAgICAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudCh7fSwgTWVzc2FnZXMuU3RyaWN0TEhTUG9zdGZpeCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWlzTGVmdEhhbmRTaWRlKGV4cHIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5JbnZhbGlkTEhTSW5Bc3NpZ25tZW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguVXBkYXRlRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogbGV4KCkudmFsdWUsXG4gICAgICAgICAgICAgICAgYXJndW1lbnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcHJlZml4OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjQgVW5hcnkgT3BlcmF0b3JzXG5cbiAgICBmdW5jdGlvbiBwYXJzZVVuYXJ5RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIHRva2VuLCBleHByO1xuXG4gICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG4gICAgICAgIGlmICh0b2tlbi50eXBlICE9PSBUb2tlbi5QdW5jdHVhdG9yICYmIHRva2VuLnR5cGUgIT09IFRva2VuLktleXdvcmQpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZVBvc3RmaXhFeHByZXNzaW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2goJysrJykgfHwgbWF0Y2goJy0tJykpIHtcbiAgICAgICAgICAgIHRva2VuID0gbGV4KCk7XG4gICAgICAgICAgICBleHByID0gcGFyc2VVbmFyeUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgIC8vIDExLjQuNCwgMTEuNC41XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIGV4cHIudHlwZSA9PT0gU3ludGF4LklkZW50aWZpZXIgJiYgaXNSZXN0cmljdGVkV29yZChleHByLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5TdHJpY3RMSFNQcmVmaXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzTGVmdEhhbmRTaWRlKGV4cHIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5JbnZhbGlkTEhTSW5Bc3NpZ25tZW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguVXBkYXRlRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogdG9rZW4udmFsdWUsXG4gICAgICAgICAgICAgICAgYXJndW1lbnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcHJlZml4OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2goJysnKSB8fCBtYXRjaCgnLScpIHx8IG1hdGNoKCd+JykgfHwgbWF0Y2goJyEnKSkge1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguVW5hcnlFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiBsZXgoKS52YWx1ZSxcbiAgICAgICAgICAgICAgICBhcmd1bWVudDogcGFyc2VVbmFyeUV4cHJlc3Npb24oKSxcbiAgICAgICAgICAgICAgICBwcmVmaXg6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtYXRjaEtleXdvcmQoJ2RlbGV0ZScpIHx8IG1hdGNoS2V5d29yZCgndm9pZCcpIHx8IG1hdGNoS2V5d29yZCgndHlwZW9mJykpIHtcbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LlVuYXJ5RXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogbGV4KCkudmFsdWUsXG4gICAgICAgICAgICAgICAgYXJndW1lbnQ6IHBhcnNlVW5hcnlFeHByZXNzaW9uKCksXG4gICAgICAgICAgICAgICAgcHJlZml4OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHN0cmljdCAmJiBleHByLm9wZXJhdG9yID09PSAnZGVsZXRlJyAmJiBleHByLmFyZ3VtZW50LnR5cGUgPT09IFN5bnRheC5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5TdHJpY3REZWxldGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGFyc2VQb3N0Zml4RXhwcmVzc2lvbigpO1xuICAgIH1cblxuICAgIC8vIDExLjUgTXVsdGlwbGljYXRpdmUgT3BlcmF0b3JzXG5cbiAgICBmdW5jdGlvbiBwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZVVuYXJ5RXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnKicpIHx8IG1hdGNoKCcvJykgfHwgbWF0Y2goJyUnKSkge1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQmluYXJ5RXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogbGV4KCkudmFsdWUsXG4gICAgICAgICAgICAgICAgbGVmdDogZXhwcixcbiAgICAgICAgICAgICAgICByaWdodDogcGFyc2VVbmFyeUV4cHJlc3Npb24oKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjYgQWRkaXRpdmUgT3BlcmF0b3JzXG5cbiAgICBmdW5jdGlvbiBwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnKycpIHx8IG1hdGNoKCctJykpIHtcbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkJpbmFyeUV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6IGxleCgpLnZhbHVlLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnNlTXVsdGlwbGljYXRpdmVFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICAvLyAxMS43IEJpdHdpc2UgU2hpZnQgT3BlcmF0b3JzXG5cbiAgICBmdW5jdGlvbiBwYXJzZVNoaWZ0RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnPDwnKSB8fCBtYXRjaCgnPj4nKSB8fCBtYXRjaCgnPj4+JykpIHtcbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkJpbmFyeUV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6IGxleCgpLnZhbHVlLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnNlQWRkaXRpdmVFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG4gICAgLy8gMTEuOCBSZWxhdGlvbmFsIE9wZXJhdG9yc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIsIHByZXZpb3VzQWxsb3dJbjtcblxuICAgICAgICBwcmV2aW91c0FsbG93SW4gPSBzdGF0ZS5hbGxvd0luO1xuICAgICAgICBzdGF0ZS5hbGxvd0luID0gdHJ1ZTtcblxuICAgICAgICBleHByID0gcGFyc2VTaGlmdEV4cHJlc3Npb24oKTtcblxuICAgICAgICB3aGlsZSAobWF0Y2goJzwnKSB8fCBtYXRjaCgnPicpIHx8IG1hdGNoKCc8PScpIHx8IG1hdGNoKCc+PScpIHx8IChwcmV2aW91c0FsbG93SW4gJiYgbWF0Y2hLZXl3b3JkKCdpbicpKSB8fCBtYXRjaEtleXdvcmQoJ2luc3RhbmNlb2YnKSkge1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQmluYXJ5RXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogbGV4KCkudmFsdWUsXG4gICAgICAgICAgICAgICAgbGVmdDogZXhwcixcbiAgICAgICAgICAgICAgICByaWdodDogcGFyc2VTaGlmdEV4cHJlc3Npb24oKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLmFsbG93SW4gPSBwcmV2aW91c0FsbG93SW47XG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjkgRXF1YWxpdHkgT3BlcmF0b3JzXG5cbiAgICBmdW5jdGlvbiBwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZVJlbGF0aW9uYWxFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgd2hpbGUgKG1hdGNoKCc9PScpIHx8IG1hdGNoKCchPScpIHx8IG1hdGNoKCc9PT0nKSB8fCBtYXRjaCgnIT09JykpIHtcbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkJpbmFyeUV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6IGxleCgpLnZhbHVlLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb24oKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjEwIEJpbmFyeSBCaXR3aXNlIE9wZXJhdG9yc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VCaXR3aXNlQU5ERXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnJicpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkJpbmFyeUV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6ICcmJyxcbiAgICAgICAgICAgICAgICBsZWZ0OiBleHByLFxuICAgICAgICAgICAgICAgIHJpZ2h0OiBwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbigpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VCaXR3aXNlWE9SRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUJpdHdpc2VBTkRFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgd2hpbGUgKG1hdGNoKCdeJykpIHtcbiAgICAgICAgICAgIGxleCgpO1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQmluYXJ5RXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJ14nLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnNlQml0d2lzZUFOREV4cHJlc3Npb24oKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlQml0d2lzZU9SRXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUJpdHdpc2VYT1JFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgd2hpbGUgKG1hdGNoKCd8JykpIHtcbiAgICAgICAgICAgIGxleCgpO1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQmluYXJ5RXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJ3wnLFxuICAgICAgICAgICAgICAgIGxlZnQ6IGV4cHIsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IHBhcnNlQml0d2lzZVhPUkV4cHJlc3Npb24oKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDExLjExIEJpbmFyeSBMb2dpY2FsIE9wZXJhdG9yc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VMb2dpY2FsQU5ERXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIGV4cHIgPSBwYXJzZUJpdHdpc2VPUkV4cHJlc3Npb24oKTtcblxuICAgICAgICB3aGlsZSAobWF0Y2goJyYmJykpIHtcbiAgICAgICAgICAgIGxleCgpO1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguTG9naWNhbEV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6ICcmJicsXG4gICAgICAgICAgICAgICAgbGVmdDogZXhwcixcbiAgICAgICAgICAgICAgICByaWdodDogcGFyc2VCaXR3aXNlT1JFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZUxvZ2ljYWxPUkV4cHJlc3Npb24oKSB7XG4gICAgICAgIHZhciBleHByID0gcGFyc2VMb2dpY2FsQU5ERXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnfHwnKSkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICBleHByID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Mb2dpY2FsRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJ3x8JyxcbiAgICAgICAgICAgICAgICBsZWZ0OiBleHByLFxuICAgICAgICAgICAgICAgIHJpZ2h0OiBwYXJzZUxvZ2ljYWxBTkRFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICAvLyAxMS4xMiBDb25kaXRpb25hbCBPcGVyYXRvclxuXG4gICAgZnVuY3Rpb24gcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKSB7XG4gICAgICAgIHZhciBleHByLCBwcmV2aW91c0FsbG93SW4sIGNvbnNlcXVlbnQ7XG5cbiAgICAgICAgZXhwciA9IHBhcnNlTG9naWNhbE9SRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGlmIChtYXRjaCgnPycpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgIHByZXZpb3VzQWxsb3dJbiA9IHN0YXRlLmFsbG93SW47XG4gICAgICAgICAgICBzdGF0ZS5hbGxvd0luID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnNlcXVlbnQgPSBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICBzdGF0ZS5hbGxvd0luID0gcHJldmlvdXNBbGxvd0luO1xuICAgICAgICAgICAgZXhwZWN0KCc6Jyk7XG5cbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkNvbmRpdGlvbmFsRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICB0ZXN0OiBleHByLFxuICAgICAgICAgICAgICAgIGNvbnNlcXVlbnQ6IGNvbnNlcXVlbnQsXG4gICAgICAgICAgICAgICAgYWx0ZXJuYXRlOiBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICAvLyAxMS4xMyBBc3NpZ25tZW50IE9wZXJhdG9yc1xuXG4gICAgZnVuY3Rpb24gcGFyc2VBc3NpZ25tZW50RXhwcmVzc2lvbigpIHtcbiAgICAgICAgdmFyIHRva2VuLCBleHByO1xuXG4gICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG4gICAgICAgIGV4cHIgPSBwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGlmIChtYXRjaEFzc2lnbigpKSB7XG4gICAgICAgICAgICAvLyBMZWZ0SGFuZFNpZGVFeHByZXNzaW9uXG4gICAgICAgICAgICBpZiAoIWlzTGVmdEhhbmRTaWRlKGV4cHIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5JbnZhbGlkTEhTSW5Bc3NpZ25tZW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gMTEuMTMuMVxuICAgICAgICAgICAgaWYgKHN0cmljdCAmJiBleHByLnR5cGUgPT09IFN5bnRheC5JZGVudGlmaWVyICYmIGlzUmVzdHJpY3RlZFdvcmQoZXhwci5uYW1lKSkge1xuICAgICAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudCh0b2tlbiwgTWVzc2FnZXMuU3RyaWN0TEhTQXNzaWdubWVudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkFzc2lnbm1lbnRFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiBsZXgoKS52YWx1ZSxcbiAgICAgICAgICAgICAgICBsZWZ0OiBleHByLFxuICAgICAgICAgICAgICAgIHJpZ2h0OiBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICAvLyAxMS4xNCBDb21tYSBPcGVyYXRvclxuXG4gICAgZnVuY3Rpb24gcGFyc2VFeHByZXNzaW9uKCkge1xuICAgICAgICB2YXIgZXhwciA9IHBhcnNlQXNzaWdubWVudEV4cHJlc3Npb24oKTtcblxuICAgICAgICBpZiAobWF0Y2goJywnKSkge1xuICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguU2VxdWVuY2VFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgIGV4cHJlc3Npb25zOiBbIGV4cHIgXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtYXRjaCgnLCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgICAgICBleHByLmV4cHJlc3Npb25zLnB1c2gocGFyc2VBc3NpZ25tZW50RXhwcmVzc2lvbigpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHByO1xuICAgIH1cblxuICAgIC8vIDEyLjEgQmxvY2tcblxuICAgIGZ1bmN0aW9uIHBhcnNlU3RhdGVtZW50TGlzdCgpIHtcbiAgICAgICAgdmFyIGxpc3QgPSBbXSxcbiAgICAgICAgICAgIHN0YXRlbWVudDtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaCgnfScpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZW1lbnQgPSBwYXJzZVNvdXJjZUVsZW1lbnQoKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGVtZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGlzdC5wdXNoKHN0YXRlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlzdDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZUJsb2NrKCkge1xuICAgICAgICB2YXIgYmxvY2s7XG5cbiAgICAgICAgZXhwZWN0KCd7Jyk7XG5cbiAgICAgICAgYmxvY2sgPSBwYXJzZVN0YXRlbWVudExpc3QoKTtcblxuICAgICAgICBleHBlY3QoJ30nKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkJsb2NrU3RhdGVtZW50LFxuICAgICAgICAgICAgYm9keTogYmxvY2tcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMi4yIFZhcmlhYmxlIFN0YXRlbWVudFxuXG4gICAgZnVuY3Rpb24gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IGxleCgpO1xuXG4gICAgICAgIGlmICh0b2tlbi50eXBlICE9PSBUb2tlbi5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICB0aHJvd1VuZXhwZWN0ZWQodG9rZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5JZGVudGlmaWVyLFxuICAgICAgICAgICAgbmFtZTogdG9rZW4udmFsdWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZVZhcmlhYmxlRGVjbGFyYXRpb24oa2luZCkge1xuICAgICAgICB2YXIgaWQgPSBwYXJzZVZhcmlhYmxlSWRlbnRpZmllcigpLFxuICAgICAgICAgICAgaW5pdCA9IG51bGw7XG5cbiAgICAgICAgLy8gMTIuMi4xXG4gICAgICAgIGlmIChzdHJpY3QgJiYgaXNSZXN0cmljdGVkV29yZChpZC5uYW1lKSkge1xuICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5TdHJpY3RWYXJOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChraW5kID09PSAnY29uc3QnKSB7XG4gICAgICAgICAgICBleHBlY3QoJz0nKTtcbiAgICAgICAgICAgIGluaXQgPSBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uKCk7XG4gICAgICAgIH0gZWxzZSBpZiAobWF0Y2goJz0nKSkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICBpbml0ID0gcGFyc2VBc3NpZ25tZW50RXhwcmVzc2lvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5WYXJpYWJsZURlY2xhcmF0b3IsXG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBpbml0OiBpbml0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VWYXJpYWJsZURlY2xhcmF0aW9uTGlzdChraW5kKSB7XG4gICAgICAgIHZhciBsaXN0ID0gW107XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgbGlzdC5wdXNoKHBhcnNlVmFyaWFibGVEZWNsYXJhdGlvbihraW5kKSk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKCcsJykpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxleCgpO1xuICAgICAgICB9IHdoaWxlIChpbmRleCA8IGxlbmd0aCk7XG5cbiAgICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VWYXJpYWJsZVN0YXRlbWVudCgpIHtcbiAgICAgICAgdmFyIGRlY2xhcmF0aW9ucztcblxuICAgICAgICBleHBlY3RLZXl3b3JkKCd2YXInKTtcblxuICAgICAgICBkZWNsYXJhdGlvbnMgPSBwYXJzZVZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KCk7XG5cbiAgICAgICAgY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguVmFyaWFibGVEZWNsYXJhdGlvbixcbiAgICAgICAgICAgIGRlY2xhcmF0aW9uczogZGVjbGFyYXRpb25zLFxuICAgICAgICAgICAga2luZDogJ3ZhcidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBraW5kIG1heSBiZSBgY29uc3RgIG9yIGBsZXRgXG4gICAgLy8gQm90aCBhcmUgZXhwZXJpbWVudGFsIGFuZCBub3QgaW4gdGhlIHNwZWNpZmljYXRpb24geWV0LlxuICAgIC8vIHNlZSBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmNvbnN0XG4gICAgLy8gYW5kIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6bGV0XG4gICAgZnVuY3Rpb24gcGFyc2VDb25zdExldERlY2xhcmF0aW9uKGtpbmQpIHtcbiAgICAgICAgdmFyIGRlY2xhcmF0aW9ucztcblxuICAgICAgICBleHBlY3RLZXl3b3JkKGtpbmQpO1xuXG4gICAgICAgIGRlY2xhcmF0aW9ucyA9IHBhcnNlVmFyaWFibGVEZWNsYXJhdGlvbkxpc3Qoa2luZCk7XG5cbiAgICAgICAgY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguVmFyaWFibGVEZWNsYXJhdGlvbixcbiAgICAgICAgICAgIGRlY2xhcmF0aW9uczogZGVjbGFyYXRpb25zLFxuICAgICAgICAgICAga2luZDoga2luZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDEyLjMgRW1wdHkgU3RhdGVtZW50XG5cbiAgICBmdW5jdGlvbiBwYXJzZUVtcHR5U3RhdGVtZW50KCkge1xuICAgICAgICBleHBlY3QoJzsnKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkVtcHR5U3RhdGVtZW50XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gMTIuNCBFeHByZXNzaW9uIFN0YXRlbWVudFxuXG4gICAgZnVuY3Rpb24gcGFyc2VFeHByZXNzaW9uU3RhdGVtZW50KCkge1xuICAgICAgICB2YXIgZXhwciA9IHBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGNvbnN1bWVTZW1pY29sb24oKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkV4cHJlc3Npb25TdGF0ZW1lbnQsXG4gICAgICAgICAgICBleHByZXNzaW9uOiBleHByXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gMTIuNSBJZiBzdGF0ZW1lbnRcblxuICAgIGZ1bmN0aW9uIHBhcnNlSWZTdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciB0ZXN0LCBjb25zZXF1ZW50LCBhbHRlcm5hdGU7XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgnaWYnKTtcblxuICAgICAgICBleHBlY3QoJygnKTtcblxuICAgICAgICB0ZXN0ID0gcGFyc2VFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgZXhwZWN0KCcpJyk7XG5cbiAgICAgICAgY29uc2VxdWVudCA9IHBhcnNlU3RhdGVtZW50KCk7XG5cbiAgICAgICAgaWYgKG1hdGNoS2V5d29yZCgnZWxzZScpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgIGFsdGVybmF0ZSA9IHBhcnNlU3RhdGVtZW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbHRlcm5hdGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5JZlN0YXRlbWVudCxcbiAgICAgICAgICAgIHRlc3Q6IHRlc3QsXG4gICAgICAgICAgICBjb25zZXF1ZW50OiBjb25zZXF1ZW50LFxuICAgICAgICAgICAgYWx0ZXJuYXRlOiBhbHRlcm5hdGVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMi42IEl0ZXJhdGlvbiBTdGF0ZW1lbnRzXG5cbiAgICBmdW5jdGlvbiBwYXJzZURvV2hpbGVTdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciBib2R5LCB0ZXN0LCBvbGRJbkl0ZXJhdGlvbjtcblxuICAgICAgICBleHBlY3RLZXl3b3JkKCdkbycpO1xuXG4gICAgICAgIG9sZEluSXRlcmF0aW9uID0gc3RhdGUuaW5JdGVyYXRpb247XG4gICAgICAgIHN0YXRlLmluSXRlcmF0aW9uID0gdHJ1ZTtcblxuICAgICAgICBib2R5ID0gcGFyc2VTdGF0ZW1lbnQoKTtcblxuICAgICAgICBzdGF0ZS5pbkl0ZXJhdGlvbiA9IG9sZEluSXRlcmF0aW9uO1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ3doaWxlJyk7XG5cbiAgICAgICAgZXhwZWN0KCcoJyk7XG5cbiAgICAgICAgdGVzdCA9IHBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGV4cGVjdCgnKScpO1xuXG4gICAgICAgIGlmIChtYXRjaCgnOycpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguRG9XaGlsZVN0YXRlbWVudCxcbiAgICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgICB0ZXN0OiB0ZXN0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VXaGlsZVN0YXRlbWVudCgpIHtcbiAgICAgICAgdmFyIHRlc3QsIGJvZHksIG9sZEluSXRlcmF0aW9uO1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ3doaWxlJyk7XG5cbiAgICAgICAgZXhwZWN0KCcoJyk7XG5cbiAgICAgICAgdGVzdCA9IHBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGV4cGVjdCgnKScpO1xuXG4gICAgICAgIG9sZEluSXRlcmF0aW9uID0gc3RhdGUuaW5JdGVyYXRpb247XG4gICAgICAgIHN0YXRlLmluSXRlcmF0aW9uID0gdHJ1ZTtcblxuICAgICAgICBib2R5ID0gcGFyc2VTdGF0ZW1lbnQoKTtcblxuICAgICAgICBzdGF0ZS5pbkl0ZXJhdGlvbiA9IG9sZEluSXRlcmF0aW9uO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguV2hpbGVTdGF0ZW1lbnQsXG4gICAgICAgICAgICB0ZXN0OiB0ZXN0LFxuICAgICAgICAgICAgYm9keTogYm9keVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlRm9yVmFyaWFibGVEZWNsYXJhdGlvbigpIHtcbiAgICAgICAgdmFyIHRva2VuID0gbGV4KCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5WYXJpYWJsZURlY2xhcmF0aW9uLFxuICAgICAgICAgICAgZGVjbGFyYXRpb25zOiBwYXJzZVZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KCksXG4gICAgICAgICAgICBraW5kOiB0b2tlbi52YWx1ZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlRm9yU3RhdGVtZW50KCkge1xuICAgICAgICB2YXIgaW5pdCwgdGVzdCwgdXBkYXRlLCBsZWZ0LCByaWdodCwgYm9keSwgb2xkSW5JdGVyYXRpb247XG5cbiAgICAgICAgaW5pdCA9IHRlc3QgPSB1cGRhdGUgPSBudWxsO1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ2ZvcicpO1xuXG4gICAgICAgIGV4cGVjdCgnKCcpO1xuXG4gICAgICAgIGlmIChtYXRjaCgnOycpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtYXRjaEtleXdvcmQoJ3ZhcicpIHx8IG1hdGNoS2V5d29yZCgnbGV0JykpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5hbGxvd0luID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaW5pdCA9IHBhcnNlRm9yVmFyaWFibGVEZWNsYXJhdGlvbigpO1xuICAgICAgICAgICAgICAgIHN0YXRlLmFsbG93SW4gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluaXQuZGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMSAmJiBtYXRjaEtleXdvcmQoJ2luJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICAgICAgICAgIGxlZnQgPSBpbml0O1xuICAgICAgICAgICAgICAgICAgICByaWdodCA9IHBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgICBpbml0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlLmFsbG93SW4gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpbml0ID0gcGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgc3RhdGUuYWxsb3dJbiA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hLZXl3b3JkKCdpbicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExlZnRIYW5kU2lkZUV4cHJlc3Npb25cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0xlZnRIYW5kU2lkZShpbml0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHt9LCBNZXNzYWdlcy5JbnZhbGlkTEhTSW5Gb3JJbik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgICAgICAgICAgbGVmdCA9IGluaXQ7XG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0ID0gcGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIGluaXQgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBsZWZ0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdCgnOycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBsZWZ0ID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICBpZiAoIW1hdGNoKCc7JykpIHtcbiAgICAgICAgICAgICAgICB0ZXN0ID0gcGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBleHBlY3QoJzsnKTtcblxuICAgICAgICAgICAgaWYgKCFtYXRjaCgnKScpKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlID0gcGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3QoJyknKTtcblxuICAgICAgICBvbGRJbkl0ZXJhdGlvbiA9IHN0YXRlLmluSXRlcmF0aW9uO1xuICAgICAgICBzdGF0ZS5pbkl0ZXJhdGlvbiA9IHRydWU7XG5cbiAgICAgICAgYm9keSA9IHBhcnNlU3RhdGVtZW50KCk7XG5cbiAgICAgICAgc3RhdGUuaW5JdGVyYXRpb24gPSBvbGRJbkl0ZXJhdGlvbjtcblxuICAgICAgICBpZiAodHlwZW9mIGxlZnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Gb3JTdGF0ZW1lbnQsXG4gICAgICAgICAgICAgICAgaW5pdDogaW5pdCxcbiAgICAgICAgICAgICAgICB0ZXN0OiB0ZXN0LFxuICAgICAgICAgICAgICAgIHVwZGF0ZTogdXBkYXRlLFxuICAgICAgICAgICAgICAgIGJvZHk6IGJvZHlcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkZvckluU3RhdGVtZW50LFxuICAgICAgICAgICAgbGVmdDogbGVmdCxcbiAgICAgICAgICAgIHJpZ2h0OiByaWdodCxcbiAgICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgICBlYWNoOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDEyLjcgVGhlIGNvbnRpbnVlIHN0YXRlbWVudFxuXG4gICAgZnVuY3Rpb24gcGFyc2VDb250aW51ZVN0YXRlbWVudCgpIHtcbiAgICAgICAgdmFyIHRva2VuLCBsYWJlbCA9IG51bGw7XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgnY29udGludWUnKTtcblxuICAgICAgICAvLyBPcHRpbWl6ZSB0aGUgbW9zdCBjb21tb24gZm9ybTogJ2NvbnRpbnVlOycuXG4gICAgICAgIGlmIChzb3VyY2VbaW5kZXhdID09PSAnOycpIHtcbiAgICAgICAgICAgIGxleCgpO1xuXG4gICAgICAgICAgICBpZiAoIXN0YXRlLmluSXRlcmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuSWxsZWdhbENvbnRpbnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQ29udGludWVTdGF0ZW1lbnQsXG4gICAgICAgICAgICAgICAgbGFiZWw6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGVla0xpbmVUZXJtaW5hdG9yKCkpIHtcbiAgICAgICAgICAgIGlmICghc3RhdGUuaW5JdGVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5JbGxlZ2FsQ29udGludWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Db250aW51ZVN0YXRlbWVudCxcbiAgICAgICAgICAgICAgICBsYWJlbDogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlbi5JZGVudGlmaWVyKSB7XG4gICAgICAgICAgICBsYWJlbCA9IHBhcnNlVmFyaWFibGVJZGVudGlmaWVyKCk7XG5cbiAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHN0YXRlLmxhYmVsU2V0LCBsYWJlbC5uYW1lKSkge1xuICAgICAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVua25vd25MYWJlbCwgbGFiZWwubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdW1lU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgaWYgKGxhYmVsID09PSBudWxsICYmICFzdGF0ZS5pbkl0ZXJhdGlvbikge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuSWxsZWdhbENvbnRpbnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguQ29udGludWVTdGF0ZW1lbnQsXG4gICAgICAgICAgICBsYWJlbDogbGFiZWxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMi44IFRoZSBicmVhayBzdGF0ZW1lbnRcblxuICAgIGZ1bmN0aW9uIHBhcnNlQnJlYWtTdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciB0b2tlbiwgbGFiZWwgPSBudWxsO1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ2JyZWFrJyk7XG5cbiAgICAgICAgLy8gT3B0aW1pemUgdGhlIG1vc3QgY29tbW9uIGZvcm06ICdicmVhazsnLlxuICAgICAgICBpZiAoc291cmNlW2luZGV4XSA9PT0gJzsnKSB7XG4gICAgICAgICAgICBsZXgoKTtcblxuICAgICAgICAgICAgaWYgKCEoc3RhdGUuaW5JdGVyYXRpb24gfHwgc3RhdGUuaW5Td2l0Y2gpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuSWxsZWdhbEJyZWFrKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQnJlYWtTdGF0ZW1lbnQsXG4gICAgICAgICAgICAgICAgbGFiZWw6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGVla0xpbmVUZXJtaW5hdG9yKCkpIHtcbiAgICAgICAgICAgIGlmICghKHN0YXRlLmluSXRlcmF0aW9uIHx8IHN0YXRlLmluU3dpdGNoKSkge1xuICAgICAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLklsbGVnYWxCcmVhayk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LkJyZWFrU3RhdGVtZW50LFxuICAgICAgICAgICAgICAgIGxhYmVsOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdG9rZW4gPSBsb29rYWhlYWQoKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuLklkZW50aWZpZXIpIHtcbiAgICAgICAgICAgIGxhYmVsID0gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKTtcblxuICAgICAgICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc3RhdGUubGFiZWxTZXQsIGxhYmVsLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5rbm93bkxhYmVsLCBsYWJlbC5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN1bWVTZW1pY29sb24oKTtcblxuICAgICAgICBpZiAobGFiZWwgPT09IG51bGwgJiYgIShzdGF0ZS5pbkl0ZXJhdGlvbiB8fCBzdGF0ZS5pblN3aXRjaCkpIHtcbiAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLklsbGVnYWxCcmVhayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkJyZWFrU3RhdGVtZW50LFxuICAgICAgICAgICAgbGFiZWw6IGxhYmVsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gMTIuOSBUaGUgcmV0dXJuIHN0YXRlbWVudFxuXG4gICAgZnVuY3Rpb24gcGFyc2VSZXR1cm5TdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciB0b2tlbiwgYXJndW1lbnQgPSBudWxsO1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ3JldHVybicpO1xuXG4gICAgICAgIGlmICghc3RhdGUuaW5GdW5jdGlvbkJvZHkpIHtcbiAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudCh7fSwgTWVzc2FnZXMuSWxsZWdhbFJldHVybik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAncmV0dXJuJyBmb2xsb3dlZCBieSBhIHNwYWNlIGFuZCBhbiBpZGVudGlmaWVyIGlzIHZlcnkgY29tbW9uLlxuICAgICAgICBpZiAoc291cmNlW2luZGV4XSA9PT0gJyAnKSB7XG4gICAgICAgICAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQoc291cmNlW2luZGV4ICsgMV0pKSB7XG4gICAgICAgICAgICAgICAgYXJndW1lbnQgPSBwYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdW1lU2VtaWNvbG9uKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogU3ludGF4LlJldHVyblN0YXRlbWVudCxcbiAgICAgICAgICAgICAgICAgICAgYXJndW1lbnQ6IGFyZ3VtZW50XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwZWVrTGluZVRlcm1pbmF0b3IoKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguUmV0dXJuU3RhdGVtZW50LFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50OiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtYXRjaCgnOycpKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICAgICAgaWYgKCFtYXRjaCgnfScpICYmIHRva2VuLnR5cGUgIT09IFRva2VuLkVPRikge1xuICAgICAgICAgICAgICAgIGFyZ3VtZW50ID0gcGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdW1lU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5SZXR1cm5TdGF0ZW1lbnQsXG4gICAgICAgICAgICBhcmd1bWVudDogYXJndW1lbnRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMi4xMCBUaGUgd2l0aCBzdGF0ZW1lbnRcblxuICAgIGZ1bmN0aW9uIHBhcnNlV2l0aFN0YXRlbWVudCgpIHtcbiAgICAgICAgdmFyIG9iamVjdCwgYm9keTtcblxuICAgICAgICBpZiAoc3RyaWN0KSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoe30sIE1lc3NhZ2VzLlN0cmljdE1vZGVXaXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ3dpdGgnKTtcblxuICAgICAgICBleHBlY3QoJygnKTtcblxuICAgICAgICBvYmplY3QgPSBwYXJzZUV4cHJlc3Npb24oKTtcblxuICAgICAgICBleHBlY3QoJyknKTtcblxuICAgICAgICBib2R5ID0gcGFyc2VTdGF0ZW1lbnQoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LldpdGhTdGF0ZW1lbnQsXG4gICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcbiAgICAgICAgICAgIGJvZHk6IGJvZHlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMi4xMCBUaGUgc3dpdGggc3RhdGVtZW50XG5cbiAgICBmdW5jdGlvbiBwYXJzZVN3aXRjaENhc2UoKSB7XG4gICAgICAgIHZhciB0ZXN0LFxuICAgICAgICAgICAgY29uc2VxdWVudCA9IFtdLFxuICAgICAgICAgICAgc3RhdGVtZW50O1xuXG4gICAgICAgIGlmIChtYXRjaEtleXdvcmQoJ2RlZmF1bHQnKSkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICB0ZXN0ID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cGVjdEtleXdvcmQoJ2Nhc2UnKTtcbiAgICAgICAgICAgIHRlc3QgPSBwYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgICAgfVxuICAgICAgICBleHBlY3QoJzonKTtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaCgnfScpIHx8IG1hdGNoS2V5d29yZCgnZGVmYXVsdCcpIHx8IG1hdGNoS2V5d29yZCgnY2FzZScpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZW1lbnQgPSBwYXJzZVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGF0ZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zZXF1ZW50LnB1c2goc3RhdGVtZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguU3dpdGNoQ2FzZSxcbiAgICAgICAgICAgIHRlc3Q6IHRlc3QsXG4gICAgICAgICAgICBjb25zZXF1ZW50OiBjb25zZXF1ZW50XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VTd2l0Y2hTdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciBkaXNjcmltaW5hbnQsIGNhc2VzLCBjbGF1c2UsIG9sZEluU3dpdGNoLCBkZWZhdWx0Rm91bmQ7XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgnc3dpdGNoJyk7XG5cbiAgICAgICAgZXhwZWN0KCcoJyk7XG5cbiAgICAgICAgZGlzY3JpbWluYW50ID0gcGFyc2VFeHByZXNzaW9uKCk7XG5cbiAgICAgICAgZXhwZWN0KCcpJyk7XG5cbiAgICAgICAgZXhwZWN0KCd7Jyk7XG5cbiAgICAgICAgY2FzZXMgPSBbXTtcblxuICAgICAgICBpZiAobWF0Y2goJ30nKSkge1xuICAgICAgICAgICAgbGV4KCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Td2l0Y2hTdGF0ZW1lbnQsXG4gICAgICAgICAgICAgICAgZGlzY3JpbWluYW50OiBkaXNjcmltaW5hbnQsXG4gICAgICAgICAgICAgICAgY2FzZXM6IGNhc2VzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2xkSW5Td2l0Y2ggPSBzdGF0ZS5pblN3aXRjaDtcbiAgICAgICAgc3RhdGUuaW5Td2l0Y2ggPSB0cnVlO1xuICAgICAgICBkZWZhdWx0Rm91bmQgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaCgnfScpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbGF1c2UgPSBwYXJzZVN3aXRjaENhc2UoKTtcbiAgICAgICAgICAgIGlmIChjbGF1c2UudGVzdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0Rm91bmQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuTXVsdGlwbGVEZWZhdWx0c0luU3dpdGNoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVmYXVsdEZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2VzLnB1c2goY2xhdXNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLmluU3dpdGNoID0gb2xkSW5Td2l0Y2g7XG5cbiAgICAgICAgZXhwZWN0KCd9Jyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Td2l0Y2hTdGF0ZW1lbnQsXG4gICAgICAgICAgICBkaXNjcmltaW5hbnQ6IGRpc2NyaW1pbmFudCxcbiAgICAgICAgICAgIGNhc2VzOiBjYXNlc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDEyLjEzIFRoZSB0aHJvdyBzdGF0ZW1lbnRcblxuICAgIGZ1bmN0aW9uIHBhcnNlVGhyb3dTdGF0ZW1lbnQoKSB7XG4gICAgICAgIHZhciBhcmd1bWVudDtcblxuICAgICAgICBleHBlY3RLZXl3b3JkKCd0aHJvdycpO1xuXG4gICAgICAgIGlmIChwZWVrTGluZVRlcm1pbmF0b3IoKSkge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuTmV3bGluZUFmdGVyVGhyb3cpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXJndW1lbnQgPSBwYXJzZUV4cHJlc3Npb24oKTtcblxuICAgICAgICBjb25zdW1lU2VtaWNvbG9uKCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5UaHJvd1N0YXRlbWVudCxcbiAgICAgICAgICAgIGFyZ3VtZW50OiBhcmd1bWVudFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDEyLjE0IFRoZSB0cnkgc3RhdGVtZW50XG5cbiAgICBmdW5jdGlvbiBwYXJzZUNhdGNoQ2xhdXNlKCkge1xuICAgICAgICB2YXIgcGFyYW07XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgnY2F0Y2gnKTtcblxuICAgICAgICBleHBlY3QoJygnKTtcbiAgICAgICAgaWYgKG1hdGNoKCcpJykpIHtcbiAgICAgICAgICAgIHRocm93VW5leHBlY3RlZChsb29rYWhlYWQoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJhbSA9IHBhcnNlVmFyaWFibGVJZGVudGlmaWVyKCk7XG4gICAgICAgIC8vIDEyLjE0LjFcbiAgICAgICAgaWYgKHN0cmljdCAmJiBpc1Jlc3RyaWN0ZWRXb3JkKHBhcmFtLm5hbWUpKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoe30sIE1lc3NhZ2VzLlN0cmljdENhdGNoVmFyaWFibGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0KCcpJyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5DYXRjaENsYXVzZSxcbiAgICAgICAgICAgIHBhcmFtOiBwYXJhbSxcbiAgICAgICAgICAgIGJvZHk6IHBhcnNlQmxvY2soKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlVHJ5U3RhdGVtZW50KCkge1xuICAgICAgICB2YXIgYmxvY2ssIGhhbmRsZXJzID0gW10sIGZpbmFsaXplciA9IG51bGw7XG5cbiAgICAgICAgZXhwZWN0S2V5d29yZCgndHJ5Jyk7XG5cbiAgICAgICAgYmxvY2sgPSBwYXJzZUJsb2NrKCk7XG5cbiAgICAgICAgaWYgKG1hdGNoS2V5d29yZCgnY2F0Y2gnKSkge1xuICAgICAgICAgICAgaGFuZGxlcnMucHVzaChwYXJzZUNhdGNoQ2xhdXNlKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1hdGNoS2V5d29yZCgnZmluYWxseScpKSB7XG4gICAgICAgICAgICBsZXgoKTtcbiAgICAgICAgICAgIGZpbmFsaXplciA9IHBhcnNlQmxvY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDAgJiYgIWZpbmFsaXplcikge1xuICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuTm9DYXRjaE9yRmluYWxseSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LlRyeVN0YXRlbWVudCxcbiAgICAgICAgICAgIGJsb2NrOiBibG9jayxcbiAgICAgICAgICAgIGd1YXJkZWRIYW5kbGVyczogW10sXG4gICAgICAgICAgICBoYW5kbGVyczogaGFuZGxlcnMsXG4gICAgICAgICAgICBmaW5hbGl6ZXI6IGZpbmFsaXplclxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIDEyLjE1IFRoZSBkZWJ1Z2dlciBzdGF0ZW1lbnRcblxuICAgIGZ1bmN0aW9uIHBhcnNlRGVidWdnZXJTdGF0ZW1lbnQoKSB7XG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ2RlYnVnZ2VyJyk7XG5cbiAgICAgICAgY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguRGVidWdnZXJTdGF0ZW1lbnRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMiBTdGF0ZW1lbnRzXG5cbiAgICBmdW5jdGlvbiBwYXJzZVN0YXRlbWVudCgpIHtcbiAgICAgICAgdmFyIHRva2VuID0gbG9va2FoZWFkKCksXG4gICAgICAgICAgICBleHByLFxuICAgICAgICAgICAgbGFiZWxlZEJvZHk7XG5cbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuLkVPRikge1xuICAgICAgICAgICAgdGhyb3dVbmV4cGVjdGVkKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlbi5QdW5jdHVhdG9yKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlICc7JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VFbXB0eVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSAneyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlQmxvY2soKTtcbiAgICAgICAgICAgIGNhc2UgJygnOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUV4cHJlc3Npb25TdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW4uS2V5d29yZCkge1xuICAgICAgICAgICAgc3dpdGNoICh0b2tlbi52YWx1ZSkge1xuICAgICAgICAgICAgY2FzZSAnYnJlYWsnOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUJyZWFrU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlICdjb250aW51ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlQ29udGludWVTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgJ2RlYnVnZ2VyJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VEZWJ1Z2dlclN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSAnZG8nOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZURvV2hpbGVTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgJ2Zvcic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlRm9yU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlRnVuY3Rpb25EZWNsYXJhdGlvbigpO1xuICAgICAgICAgICAgY2FzZSAnaWYnOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUlmU3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjYXNlICdyZXR1cm4nOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZVJldHVyblN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSAnc3dpdGNoJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VTd2l0Y2hTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgJ3Rocm93JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VUaHJvd1N0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSAndHJ5JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VUcnlTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgJ3Zhcic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlVmFyaWFibGVTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGNhc2UgJ3doaWxlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VXaGlsZVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY2FzZSAnd2l0aCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlV2l0aFN0YXRlbWVudCgpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHIgPSBwYXJzZUV4cHJlc3Npb24oKTtcblxuICAgICAgICAvLyAxMi4xMiBMYWJlbGxlZCBTdGF0ZW1lbnRzXG4gICAgICAgIGlmICgoZXhwci50eXBlID09PSBTeW50YXguSWRlbnRpZmllcikgJiYgbWF0Y2goJzonKSkge1xuICAgICAgICAgICAgbGV4KCk7XG5cbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc3RhdGUubGFiZWxTZXQsIGV4cHIubmFtZSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5SZWRlY2xhcmF0aW9uLCAnTGFiZWwnLCBleHByLm5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzdGF0ZS5sYWJlbFNldFtleHByLm5hbWVdID0gdHJ1ZTtcbiAgICAgICAgICAgIGxhYmVsZWRCb2R5ID0gcGFyc2VTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGRlbGV0ZSBzdGF0ZS5sYWJlbFNldFtleHByLm5hbWVdO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5MYWJlbGVkU3RhdGVtZW50LFxuICAgICAgICAgICAgICAgIGxhYmVsOiBleHByLFxuICAgICAgICAgICAgICAgIGJvZHk6IGxhYmVsZWRCb2R5XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3VtZVNlbWljb2xvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguRXhwcmVzc2lvblN0YXRlbWVudCxcbiAgICAgICAgICAgIGV4cHJlc3Npb246IGV4cHJcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxMyBGdW5jdGlvbiBEZWZpbml0aW9uXG5cbiAgICBmdW5jdGlvbiBwYXJzZUZ1bmN0aW9uU291cmNlRWxlbWVudHMoKSB7XG4gICAgICAgIHZhciBzb3VyY2VFbGVtZW50LCBzb3VyY2VFbGVtZW50cyA9IFtdLCB0b2tlbiwgZGlyZWN0aXZlLCBmaXJzdFJlc3RyaWN0ZWQsXG4gICAgICAgICAgICBvbGRMYWJlbFNldCwgb2xkSW5JdGVyYXRpb24sIG9sZEluU3dpdGNoLCBvbGRJbkZ1bmN0aW9uQm9keTtcblxuICAgICAgICBleHBlY3QoJ3snKTtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG4gICAgICAgICAgICBpZiAodG9rZW4udHlwZSAhPT0gVG9rZW4uU3RyaW5nTGl0ZXJhbCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50ID0gcGFyc2VTb3VyY2VFbGVtZW50KCk7XG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50cy5wdXNoKHNvdXJjZUVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKHNvdXJjZUVsZW1lbnQuZXhwcmVzc2lvbi50eXBlICE9PSBTeW50YXguTGl0ZXJhbCkge1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgbm90IGRpcmVjdGl2ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGlyZWN0aXZlID0gc2xpY2VTb3VyY2UodG9rZW4ucmFuZ2VbMF0gKyAxLCB0b2tlbi5yYW5nZVsxXSAtIDEpO1xuICAgICAgICAgICAgaWYgKGRpcmVjdGl2ZSA9PT0gJ3VzZSBzdHJpY3QnKSB7XG4gICAgICAgICAgICAgICAgc3RyaWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoZmlyc3RSZXN0cmljdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93RXJyb3JUb2xlcmFudChmaXJzdFJlc3RyaWN0ZWQsIE1lc3NhZ2VzLlN0cmljdE9jdGFsTGl0ZXJhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZpcnN0UmVzdHJpY3RlZCAmJiB0b2tlbi5vY3RhbCkge1xuICAgICAgICAgICAgICAgICAgICBmaXJzdFJlc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBvbGRMYWJlbFNldCA9IHN0YXRlLmxhYmVsU2V0O1xuICAgICAgICBvbGRJbkl0ZXJhdGlvbiA9IHN0YXRlLmluSXRlcmF0aW9uO1xuICAgICAgICBvbGRJblN3aXRjaCA9IHN0YXRlLmluU3dpdGNoO1xuICAgICAgICBvbGRJbkZ1bmN0aW9uQm9keSA9IHN0YXRlLmluRnVuY3Rpb25Cb2R5O1xuXG4gICAgICAgIHN0YXRlLmxhYmVsU2V0ID0ge307XG4gICAgICAgIHN0YXRlLmluSXRlcmF0aW9uID0gZmFsc2U7XG4gICAgICAgIHN0YXRlLmluU3dpdGNoID0gZmFsc2U7XG4gICAgICAgIHN0YXRlLmluRnVuY3Rpb25Cb2R5ID0gdHJ1ZTtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaCgnfScpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50ID0gcGFyc2VTb3VyY2VFbGVtZW50KCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNvdXJjZUVsZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50cy5wdXNoKHNvdXJjZUVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0KCd9Jyk7XG5cbiAgICAgICAgc3RhdGUubGFiZWxTZXQgPSBvbGRMYWJlbFNldDtcbiAgICAgICAgc3RhdGUuaW5JdGVyYXRpb24gPSBvbGRJbkl0ZXJhdGlvbjtcbiAgICAgICAgc3RhdGUuaW5Td2l0Y2ggPSBvbGRJblN3aXRjaDtcbiAgICAgICAgc3RhdGUuaW5GdW5jdGlvbkJvZHkgPSBvbGRJbkZ1bmN0aW9uQm9keTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkJsb2NrU3RhdGVtZW50LFxuICAgICAgICAgICAgYm9keTogc291cmNlRWxlbWVudHNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZUZ1bmN0aW9uRGVjbGFyYXRpb24oKSB7XG4gICAgICAgIHZhciBpZCwgcGFyYW0sIHBhcmFtcyA9IFtdLCBib2R5LCB0b2tlbiwgc3RyaWN0ZWQsIGZpcnN0UmVzdHJpY3RlZCwgbWVzc2FnZSwgcHJldmlvdXNTdHJpY3QsIHBhcmFtU2V0O1xuXG4gICAgICAgIGV4cGVjdEtleXdvcmQoJ2Z1bmN0aW9uJyk7XG4gICAgICAgIHRva2VuID0gbG9va2FoZWFkKCk7XG4gICAgICAgIGlkID0gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKTtcbiAgICAgICAgaWYgKHN0cmljdCkge1xuICAgICAgICAgICAgaWYgKGlzUmVzdHJpY3RlZFdvcmQodG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHRva2VuLCBNZXNzYWdlcy5TdHJpY3RGdW5jdGlvbk5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGlzUmVzdHJpY3RlZFdvcmQodG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgZmlyc3RSZXN0cmljdGVkID0gdG9rZW47XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdEZ1bmN0aW9uTmFtZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpY3RNb2RlUmVzZXJ2ZWRXb3JkKHRva2VuLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBNZXNzYWdlcy5TdHJpY3RSZXNlcnZlZFdvcmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3QoJygnKTtcblxuICAgICAgICBpZiAoIW1hdGNoKCcpJykpIHtcbiAgICAgICAgICAgIHBhcmFtU2V0ID0ge307XG4gICAgICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICAgICAgICAgIHBhcmFtID0gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKHRva2VuLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBNZXNzYWdlcy5TdHJpY3RQYXJhbU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChwYXJhbVNldCwgdG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtRHVwZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWZpcnN0UmVzdHJpY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZXN0cmljdGVkV29yZCh0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1N0cmljdE1vZGVSZXNlcnZlZFdvcmQodG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaXJzdFJlc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBNZXNzYWdlcy5TdHJpY3RSZXNlcnZlZFdvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHBhcmFtU2V0LCB0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtRHVwZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChwYXJhbSk7XG4gICAgICAgICAgICAgICAgcGFyYW1TZXRbcGFyYW0ubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCgnKScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBleHBlY3QoJywnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdCgnKScpO1xuXG4gICAgICAgIHByZXZpb3VzU3RyaWN0ID0gc3RyaWN0O1xuICAgICAgICBib2R5ID0gcGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzKCk7XG4gICAgICAgIGlmIChzdHJpY3QgJiYgZmlyc3RSZXN0cmljdGVkKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yKGZpcnN0UmVzdHJpY3RlZCwgbWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmljdCAmJiBzdHJpY3RlZCkge1xuICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHN0cmljdGVkLCBtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBzdHJpY3QgPSBwcmV2aW91c1N0cmljdDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkZ1bmN0aW9uRGVjbGFyYXRpb24sXG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgICAgIGRlZmF1bHRzOiBbXSxcbiAgICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgICByZXN0OiBudWxsLFxuICAgICAgICAgICAgZ2VuZXJhdG9yOiBmYWxzZSxcbiAgICAgICAgICAgIGV4cHJlc3Npb246IGZhbHNlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VGdW5jdGlvbkV4cHJlc3Npb24oKSB7XG4gICAgICAgIHZhciB0b2tlbiwgaWQgPSBudWxsLCBzdHJpY3RlZCwgZmlyc3RSZXN0cmljdGVkLCBtZXNzYWdlLCBwYXJhbSwgcGFyYW1zID0gW10sIGJvZHksIHByZXZpb3VzU3RyaWN0LCBwYXJhbVNldDtcblxuICAgICAgICBleHBlY3RLZXl3b3JkKCdmdW5jdGlvbicpO1xuXG4gICAgICAgIGlmICghbWF0Y2goJygnKSkge1xuICAgICAgICAgICAgdG9rZW4gPSBsb29rYWhlYWQoKTtcbiAgICAgICAgICAgIGlkID0gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgIGlmIChzdHJpY3QpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSZXN0cmljdGVkV29yZCh0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHRva2VuLCBNZXNzYWdlcy5TdHJpY3RGdW5jdGlvbk5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzdHJpY3RlZFdvcmQodG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gTWVzc2FnZXMuU3RyaWN0RnVuY3Rpb25OYW1lO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpY3RNb2RlUmVzZXJ2ZWRXb3JkKHRva2VuLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBmaXJzdFJlc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFJlc2VydmVkV29yZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3QoJygnKTtcblxuICAgICAgICBpZiAoIW1hdGNoKCcpJykpIHtcbiAgICAgICAgICAgIHBhcmFtU2V0ID0ge307XG4gICAgICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICAgICAgICAgIHBhcmFtID0gcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1Jlc3RyaWN0ZWRXb3JkKHRva2VuLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBNZXNzYWdlcy5TdHJpY3RQYXJhbU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChwYXJhbVNldCwgdG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtRHVwZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWZpcnN0UmVzdHJpY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZXN0cmljdGVkV29yZCh0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1N0cmljdE1vZGVSZXNlcnZlZFdvcmQodG9rZW4udmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaXJzdFJlc3RyaWN0ZWQgPSB0b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBNZXNzYWdlcy5TdHJpY3RSZXNlcnZlZFdvcmQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHBhcmFtU2V0LCB0b2tlbi52YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UmVzdHJpY3RlZCA9IHRva2VuO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IE1lc3NhZ2VzLlN0cmljdFBhcmFtRHVwZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChwYXJhbSk7XG4gICAgICAgICAgICAgICAgcGFyYW1TZXRbcGFyYW0ubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCgnKScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBleHBlY3QoJywnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdCgnKScpO1xuXG4gICAgICAgIHByZXZpb3VzU3RyaWN0ID0gc3RyaWN0O1xuICAgICAgICBib2R5ID0gcGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzKCk7XG4gICAgICAgIGlmIChzdHJpY3QgJiYgZmlyc3RSZXN0cmljdGVkKSB7XG4gICAgICAgICAgICB0aHJvd0Vycm9yKGZpcnN0UmVzdHJpY3RlZCwgbWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmljdCAmJiBzdHJpY3RlZCkge1xuICAgICAgICAgICAgdGhyb3dFcnJvclRvbGVyYW50KHN0cmljdGVkLCBtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBzdHJpY3QgPSBwcmV2aW91c1N0cmljdDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkZ1bmN0aW9uRXhwcmVzc2lvbixcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgICAgICAgZGVmYXVsdHM6IFtdLFxuICAgICAgICAgICAgYm9keTogYm9keSxcbiAgICAgICAgICAgIHJlc3Q6IG51bGwsXG4gICAgICAgICAgICBnZW5lcmF0b3I6IGZhbHNlLFxuICAgICAgICAgICAgZXhwcmVzc2lvbjogZmFsc2VcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyAxNCBQcm9ncmFtXG5cbiAgICBmdW5jdGlvbiBwYXJzZVNvdXJjZUVsZW1lbnQoKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IGxvb2thaGVhZCgpO1xuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlbi5LZXl3b3JkKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRva2VuLnZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlICdjb25zdCc6XG4gICAgICAgICAgICBjYXNlICdsZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUNvbnN0TGV0RGVjbGFyYXRpb24odG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUZ1bmN0aW9uRGVjbGFyYXRpb24oKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlU3RhdGVtZW50KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9rZW4udHlwZSAhPT0gVG9rZW4uRU9GKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VTdGF0ZW1lbnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlU291cmNlRWxlbWVudHMoKSB7XG4gICAgICAgIHZhciBzb3VyY2VFbGVtZW50LCBzb3VyY2VFbGVtZW50cyA9IFtdLCB0b2tlbiwgZGlyZWN0aXZlLCBmaXJzdFJlc3RyaWN0ZWQ7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGxvb2thaGVhZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLlN0cmluZ0xpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc291cmNlRWxlbWVudCA9IHBhcnNlU291cmNlRWxlbWVudCgpO1xuICAgICAgICAgICAgc291cmNlRWxlbWVudHMucHVzaChzb3VyY2VFbGVtZW50KTtcbiAgICAgICAgICAgIGlmIChzb3VyY2VFbGVtZW50LmV4cHJlc3Npb24udHlwZSAhPT0gU3ludGF4LkxpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIG5vdCBkaXJlY3RpdmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRpcmVjdGl2ZSA9IHNsaWNlU291cmNlKHRva2VuLnJhbmdlWzBdICsgMSwgdG9rZW4ucmFuZ2VbMV0gLSAxKTtcbiAgICAgICAgICAgIGlmIChkaXJlY3RpdmUgPT09ICd1c2Ugc3RyaWN0Jykge1xuICAgICAgICAgICAgICAgIHN0cmljdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGZpcnN0UmVzdHJpY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yVG9sZXJhbnQoZmlyc3RSZXN0cmljdGVkLCBNZXNzYWdlcy5TdHJpY3RPY3RhbExpdGVyYWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmaXJzdFJlc3RyaWN0ZWQgJiYgdG9rZW4ub2N0YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlyc3RSZXN0cmljdGVkID0gdG9rZW47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50ID0gcGFyc2VTb3VyY2VFbGVtZW50KCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNvdXJjZUVsZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzb3VyY2VFbGVtZW50cy5wdXNoKHNvdXJjZUVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3VyY2VFbGVtZW50cztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZVByb2dyYW0oKSB7XG4gICAgICAgIHZhciBwcm9ncmFtO1xuICAgICAgICBzdHJpY3QgPSBmYWxzZTtcbiAgICAgICAgcHJvZ3JhbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IFN5bnRheC5Qcm9ncmFtLFxuICAgICAgICAgICAgYm9keTogcGFyc2VTb3VyY2VFbGVtZW50cygpXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBwcm9ncmFtO1xuICAgIH1cblxuICAgIC8vIFRoZSBmb2xsb3dpbmcgZnVuY3Rpb25zIGFyZSBuZWVkZWQgb25seSB3aGVuIHRoZSBvcHRpb24gdG8gcHJlc2VydmVcbiAgICAvLyB0aGUgY29tbWVudHMgaXMgYWN0aXZlLlxuXG4gICAgZnVuY3Rpb24gYWRkQ29tbWVudCh0eXBlLCB2YWx1ZSwgc3RhcnQsIGVuZCwgbG9jKSB7XG4gICAgICAgIGFzc2VydCh0eXBlb2Ygc3RhcnQgPT09ICdudW1iZXInLCAnQ29tbWVudCBtdXN0IGhhdmUgdmFsaWQgcG9zaXRpb24nKTtcblxuICAgICAgICAvLyBCZWNhdXNlIHRoZSB3YXkgdGhlIGFjdHVhbCB0b2tlbiBpcyBzY2FubmVkLCBvZnRlbiB0aGUgY29tbWVudHNcbiAgICAgICAgLy8gKGlmIGFueSkgYXJlIHNraXBwZWQgdHdpY2UgZHVyaW5nIHRoZSBsZXhpY2FsIGFuYWx5c2lzLlxuICAgICAgICAvLyBUaHVzLCB3ZSBuZWVkIHRvIHNraXAgYWRkaW5nIGEgY29tbWVudCBpZiB0aGUgY29tbWVudCBhcnJheSBhbHJlYWR5XG4gICAgICAgIC8vIGhhbmRsZWQgaXQuXG4gICAgICAgIGlmIChleHRyYS5jb21tZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAoZXh0cmEuY29tbWVudHNbZXh0cmEuY29tbWVudHMubGVuZ3RoIC0gMV0ucmFuZ2VbMV0gPiBzdGFydCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4dHJhLmNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIHJhbmdlOiBbc3RhcnQsIGVuZF0sXG4gICAgICAgICAgICBsb2M6IGxvY1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY2FuQ29tbWVudCgpIHtcbiAgICAgICAgdmFyIGNvbW1lbnQsIGNoLCBsb2MsIHN0YXJ0LCBibG9ja0NvbW1lbnQsIGxpbmVDb21tZW50O1xuXG4gICAgICAgIGNvbW1lbnQgPSAnJztcbiAgICAgICAgYmxvY2tDb21tZW50ID0gZmFsc2U7XG4gICAgICAgIGxpbmVDb21tZW50ID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG5cbiAgICAgICAgICAgIGlmIChsaW5lQ29tbWVudCkge1xuICAgICAgICAgICAgICAgIGNoID0gc291cmNlW2luZGV4KytdO1xuICAgICAgICAgICAgICAgIGlmIChpc0xpbmVUZXJtaW5hdG9yKGNoKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2MuZW5kID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogaW5kZXggLSBsaW5lU3RhcnQgLSAxXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGxpbmVDb21tZW50ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGFkZENvbW1lbnQoJ0xpbmUnLCBjb21tZW50LCBzdGFydCwgaW5kZXggLSAxLCBsb2MpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICdcXHInICYmIHNvdXJjZVtpbmRleF0gPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICsrbGluZU51bWJlcjtcbiAgICAgICAgICAgICAgICAgICAgbGluZVN0YXJ0ID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgPSAnJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGluZGV4ID49IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBsaW5lQ29tbWVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjb21tZW50ICs9IGNoO1xuICAgICAgICAgICAgICAgICAgICBsb2MuZW5kID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogbGVuZ3RoIC0gbGluZVN0YXJ0XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGFkZENvbW1lbnQoJ0xpbmUnLCBjb21tZW50LCBzdGFydCwgbGVuZ3RoLCBsb2MpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgKz0gY2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChibG9ja0NvbW1lbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNMaW5lVGVybWluYXRvcihjaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoID09PSAnXFxyJyAmJiBzb3VyY2VbaW5kZXggKyAxXSA9PT0gJ1xcbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50ICs9ICdcXHJcXG4nO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudCArPSBjaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICArK2xpbmVOdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVTdGFydCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvd0Vycm9yKHt9LCBNZXNzYWdlcy5VbmV4cGVjdGVkVG9rZW4sICdJTExFR0FMJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dFcnJvcih7fSwgTWVzc2FnZXMuVW5leHBlY3RlZFRva2VuLCAnSUxMRUdBTCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgKz0gY2g7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJyonKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaCA9IHNvdXJjZVtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICcvJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgPSBjb21tZW50LnN1YnN0cigwLCBjb21tZW50Lmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrQ29tbWVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jLmVuZCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBpbmRleCAtIGxpbmVTdGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ29tbWVudCgnQmxvY2snLCBjb21tZW50LCBzdGFydCwgaW5kZXgsIGxvYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudCA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgY2ggPSBzb3VyY2VbaW5kZXggKyAxXTtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICcvJykge1xuICAgICAgICAgICAgICAgICAgICBsb2MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBpbmRleCAtIGxpbmVTdGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBzdGFydCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpbmRleCArPSAyO1xuICAgICAgICAgICAgICAgICAgICBsaW5lQ29tbWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvYy5lbmQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW46IGluZGV4IC0gbGluZVN0YXJ0XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZUNvbW1lbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENvbW1lbnQoJ0xpbmUnLCBjb21tZW50LCBzdGFydCwgaW5kZXgsIGxvYyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNoID09PSAnKicpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gMjtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tDb21tZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgbG9jID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogaW5kZXggLSBsaW5lU3RhcnQgLSAyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93RXJyb3Ioe30sIE1lc3NhZ2VzLlVuZXhwZWN0ZWRUb2tlbiwgJ0lMTEVHQUwnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNXaGl0ZVNwYWNlKGNoKSkge1xuICAgICAgICAgICAgICAgICsraW5kZXg7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzTGluZVRlcm1pbmF0b3IoY2gpKSB7XG4gICAgICAgICAgICAgICAgKytpbmRleDtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICAnXFxyJyAmJiBzb3VyY2VbaW5kZXhdID09PSAnXFxuJykge1xuICAgICAgICAgICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICArK2xpbmVOdW1iZXI7XG4gICAgICAgICAgICAgICAgbGluZVN0YXJ0ID0gaW5kZXg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVyQ29tbWVudExvY2F0aW9uKCkge1xuICAgICAgICB2YXIgaSwgZW50cnksIGNvbW1lbnQsIGNvbW1lbnRzID0gW107XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4dHJhLmNvbW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBlbnRyeSA9IGV4dHJhLmNvbW1lbnRzW2ldO1xuICAgICAgICAgICAgY29tbWVudCA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBlbnRyeS50eXBlLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBlbnRyeS52YWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChleHRyYS5yYW5nZSkge1xuICAgICAgICAgICAgICAgIGNvbW1lbnQucmFuZ2UgPSBlbnRyeS5yYW5nZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChleHRyYS5sb2MpIHtcbiAgICAgICAgICAgICAgICBjb21tZW50LmxvYyA9IGVudHJ5LmxvYztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbW1lbnRzLnB1c2goY29tbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBleHRyYS5jb21tZW50cyA9IGNvbW1lbnRzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbGxlY3RUb2tlbigpIHtcbiAgICAgICAgdmFyIHN0YXJ0LCBsb2MsIHRva2VuLCByYW5nZSwgdmFsdWU7XG5cbiAgICAgICAgc2tpcENvbW1lbnQoKTtcbiAgICAgICAgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgbG9jID0ge1xuICAgICAgICAgICAgc3RhcnQ6IHtcbiAgICAgICAgICAgICAgICBsaW5lOiBsaW5lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGNvbHVtbjogaW5kZXggLSBsaW5lU3RhcnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0b2tlbiA9IGV4dHJhLmFkdmFuY2UoKTtcbiAgICAgICAgbG9jLmVuZCA9IHtcbiAgICAgICAgICAgIGxpbmU6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICBjb2x1bW46IGluZGV4IC0gbGluZVN0YXJ0XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRva2VuLnR5cGUgIT09IFRva2VuLkVPRikge1xuICAgICAgICAgICAgcmFuZ2UgPSBbdG9rZW4ucmFuZ2VbMF0sIHRva2VuLnJhbmdlWzFdXTtcbiAgICAgICAgICAgIHZhbHVlID0gc2xpY2VTb3VyY2UodG9rZW4ucmFuZ2VbMF0sIHRva2VuLnJhbmdlWzFdKTtcbiAgICAgICAgICAgIGV4dHJhLnRva2Vucy5wdXNoKHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUb2tlbk5hbWVbdG9rZW4udHlwZV0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgICAgIHJhbmdlOiByYW5nZSxcbiAgICAgICAgICAgICAgICBsb2M6IGxvY1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29sbGVjdFJlZ2V4KCkge1xuICAgICAgICB2YXIgcG9zLCBsb2MsIHJlZ2V4LCB0b2tlbjtcblxuICAgICAgICBza2lwQ29tbWVudCgpO1xuXG4gICAgICAgIHBvcyA9IGluZGV4O1xuICAgICAgICBsb2MgPSB7XG4gICAgICAgICAgICBzdGFydDoge1xuICAgICAgICAgICAgICAgIGxpbmU6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgY29sdW1uOiBpbmRleCAtIGxpbmVTdGFydFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlZ2V4ID0gZXh0cmEuc2NhblJlZ0V4cCgpO1xuICAgICAgICBsb2MuZW5kID0ge1xuICAgICAgICAgICAgbGluZTogbGluZU51bWJlcixcbiAgICAgICAgICAgIGNvbHVtbjogaW5kZXggLSBsaW5lU3RhcnRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBQb3AgdGhlIHByZXZpb3VzIHRva2VuLCB3aGljaCBpcyBsaWtlbHkgJy8nIG9yICcvPSdcbiAgICAgICAgaWYgKGV4dHJhLnRva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGV4dHJhLnRva2Vuc1tleHRyYS50b2tlbnMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBpZiAodG9rZW4ucmFuZ2VbMF0gPT09IHBvcyAmJiB0b2tlbi50eXBlID09PSAnUHVuY3R1YXRvcicpIHtcbiAgICAgICAgICAgICAgICBpZiAodG9rZW4udmFsdWUgPT09ICcvJyB8fCB0b2tlbi52YWx1ZSA9PT0gJy89Jykge1xuICAgICAgICAgICAgICAgICAgICBleHRyYS50b2tlbnMucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXh0cmEudG9rZW5zLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ1JlZ3VsYXJFeHByZXNzaW9uJyxcbiAgICAgICAgICAgIHZhbHVlOiByZWdleC5saXRlcmFsLFxuICAgICAgICAgICAgcmFuZ2U6IFtwb3MsIGluZGV4XSxcbiAgICAgICAgICAgIGxvYzogbG9jXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZWdleDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXJUb2tlbkxvY2F0aW9uKCkge1xuICAgICAgICB2YXIgaSwgZW50cnksIHRva2VuLCB0b2tlbnMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZXh0cmEudG9rZW5zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBlbnRyeSA9IGV4dHJhLnRva2Vuc1tpXTtcbiAgICAgICAgICAgIHRva2VuID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IGVudHJ5LnR5cGUsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGVudHJ5LnZhbHVlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV4dHJhLnJhbmdlKSB7XG4gICAgICAgICAgICAgICAgdG9rZW4ucmFuZ2UgPSBlbnRyeS5yYW5nZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChleHRyYS5sb2MpIHtcbiAgICAgICAgICAgICAgICB0b2tlbi5sb2MgPSBlbnRyeS5sb2M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICBleHRyYS50b2tlbnMgPSB0b2tlbnM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlTGl0ZXJhbCh0b2tlbikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogU3ludGF4LkxpdGVyYWwsXG4gICAgICAgICAgICB2YWx1ZTogdG9rZW4udmFsdWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVSYXdMaXRlcmFsKHRva2VuKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBTeW50YXguTGl0ZXJhbCxcbiAgICAgICAgICAgIHZhbHVlOiB0b2tlbi52YWx1ZSxcbiAgICAgICAgICAgIHJhdzogc2xpY2VTb3VyY2UodG9rZW4ucmFuZ2VbMF0sIHRva2VuLnJhbmdlWzFdKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uTWFya2VyKCkge1xuICAgICAgICB2YXIgbWFya2VyID0ge307XG5cbiAgICAgICAgbWFya2VyLnJhbmdlID0gW2luZGV4LCBpbmRleF07XG4gICAgICAgIG1hcmtlci5sb2MgPSB7XG4gICAgICAgICAgICBzdGFydDoge1xuICAgICAgICAgICAgICAgIGxpbmU6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgY29sdW1uOiBpbmRleCAtIGxpbmVTdGFydFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVuZDoge1xuICAgICAgICAgICAgICAgIGxpbmU6IGxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgY29sdW1uOiBpbmRleCAtIGxpbmVTdGFydFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIG1hcmtlci5lbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlWzFdID0gaW5kZXg7XG4gICAgICAgICAgICB0aGlzLmxvYy5lbmQubGluZSA9IGxpbmVOdW1iZXI7XG4gICAgICAgICAgICB0aGlzLmxvYy5lbmQuY29sdW1uID0gaW5kZXggLSBsaW5lU3RhcnQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgbWFya2VyLmFwcGx5R3JvdXAgPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgaWYgKGV4dHJhLnJhbmdlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5ncm91cFJhbmdlID0gW3RoaXMucmFuZ2VbMF0sIHRoaXMucmFuZ2VbMV1dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGV4dHJhLmxvYykge1xuICAgICAgICAgICAgICAgIG5vZGUuZ3JvdXBMb2MgPSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiB0aGlzLmxvYy5zdGFydC5saW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiB0aGlzLmxvYy5zdGFydC5jb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW5kOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiB0aGlzLmxvYy5lbmQubGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogdGhpcy5sb2MuZW5kLmNvbHVtblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBtYXJrZXIuYXBwbHkgPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgaWYgKGV4dHJhLnJhbmdlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yYW5nZSA9IFt0aGlzLnJhbmdlWzBdLCB0aGlzLnJhbmdlWzFdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChleHRyYS5sb2MpIHtcbiAgICAgICAgICAgICAgICBub2RlLmxvYyA9IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IHRoaXMubG9jLnN0YXJ0LmxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW46IHRoaXMubG9jLnN0YXJ0LmNvbHVtblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBlbmQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IHRoaXMubG9jLmVuZC5saW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiB0aGlzLmxvYy5lbmQuY29sdW1uXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhY2tHcm91cEV4cHJlc3Npb24oKSB7XG4gICAgICAgIHZhciBtYXJrZXIsIGV4cHI7XG5cbiAgICAgICAgc2tpcENvbW1lbnQoKTtcbiAgICAgICAgbWFya2VyID0gY3JlYXRlTG9jYXRpb25NYXJrZXIoKTtcbiAgICAgICAgZXhwZWN0KCcoJyk7XG5cbiAgICAgICAgZXhwciA9IHBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICAgIGV4cGVjdCgnKScpO1xuXG4gICAgICAgIG1hcmtlci5lbmQoKTtcbiAgICAgICAgbWFya2VyLmFwcGx5R3JvdXAoZXhwcik7XG5cbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhY2tMZWZ0SGFuZFNpZGVFeHByZXNzaW9uKCkge1xuICAgICAgICB2YXIgbWFya2VyLCBleHByO1xuXG4gICAgICAgIHNraXBDb21tZW50KCk7XG4gICAgICAgIG1hcmtlciA9IGNyZWF0ZUxvY2F0aW9uTWFya2VyKCk7XG5cbiAgICAgICAgZXhwciA9IG1hdGNoS2V5d29yZCgnbmV3JykgPyBwYXJzZU5ld0V4cHJlc3Npb24oKSA6IHBhcnNlUHJpbWFyeUV4cHJlc3Npb24oKTtcblxuICAgICAgICB3aGlsZSAobWF0Y2goJy4nKSB8fCBtYXRjaCgnWycpKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2goJ1snKSkge1xuICAgICAgICAgICAgICAgIGV4cHIgPSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFN5bnRheC5NZW1iZXJFeHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICBjb21wdXRlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBleHByLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcGFyc2VDb21wdXRlZE1lbWJlcigpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBtYXJrZXIuZW5kKCk7XG4gICAgICAgICAgICAgICAgbWFya2VyLmFwcGx5KGV4cHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHByID0ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguTWVtYmVyRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgY29tcHV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IGV4cHIsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiBwYXJzZU5vbkNvbXB1dGVkTWVtYmVyKClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG1hcmtlci5lbmQoKTtcbiAgICAgICAgICAgICAgICBtYXJrZXIuYXBwbHkoZXhwcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFja0xlZnRIYW5kU2lkZUV4cHJlc3Npb25BbGxvd0NhbGwoKSB7XG4gICAgICAgIHZhciBtYXJrZXIsIGV4cHI7XG5cbiAgICAgICAgc2tpcENvbW1lbnQoKTtcbiAgICAgICAgbWFya2VyID0gY3JlYXRlTG9jYXRpb25NYXJrZXIoKTtcblxuICAgICAgICBleHByID0gbWF0Y2hLZXl3b3JkKCduZXcnKSA/IHBhcnNlTmV3RXhwcmVzc2lvbigpIDogcGFyc2VQcmltYXJ5RXhwcmVzc2lvbigpO1xuXG4gICAgICAgIHdoaWxlIChtYXRjaCgnLicpIHx8IG1hdGNoKCdbJykgfHwgbWF0Y2goJygnKSkge1xuICAgICAgICAgICAgaWYgKG1hdGNoKCcoJykpIHtcbiAgICAgICAgICAgICAgICBleHByID0ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguQ2FsbEV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgIGNhbGxlZTogZXhwcixcbiAgICAgICAgICAgICAgICAgICAgJ2FyZ3VtZW50cyc6IHBhcnNlQXJndW1lbnRzKClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG1hcmtlci5lbmQoKTtcbiAgICAgICAgICAgICAgICBtYXJrZXIuYXBwbHkoZXhwcik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGNoKCdbJykpIHtcbiAgICAgICAgICAgICAgICBleHByID0ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBTeW50YXguTWVtYmVyRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgY29tcHV0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdDogZXhwcixcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHBhcnNlQ29tcHV0ZWRNZW1iZXIoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbWFya2VyLmVuZCgpO1xuICAgICAgICAgICAgICAgIG1hcmtlci5hcHBseShleHByKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwciA9IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogU3ludGF4Lk1lbWJlckV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgIGNvbXB1dGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBleHByLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcGFyc2VOb25Db21wdXRlZE1lbWJlcigpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBtYXJrZXIuZW5kKCk7XG4gICAgICAgICAgICAgICAgbWFya2VyLmFwcGx5KGV4cHIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVyR3JvdXAobm9kZSkge1xuICAgICAgICB2YXIgbiwgaSwgZW50cnk7XG5cbiAgICAgICAgbiA9IChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmFwcGx5KG5vZGUpID09PSAnW29iamVjdCBBcnJheV0nKSA/IFtdIDoge307XG4gICAgICAgIGZvciAoaSBpbiBub2RlKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiBpICE9PSAnZ3JvdXBSYW5nZScgJiYgaSAhPT0gJ2dyb3VwTG9jJykge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gbm9kZVtpXTtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkgPT09IG51bGwgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCBlbnRyeSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgICAgICBuW2ldID0gZW50cnk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbltpXSA9IGZpbHRlckdyb3VwKGVudHJ5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JhcFRyYWNraW5nRnVuY3Rpb24ocmFuZ2UsIGxvYykge1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAocGFyc2VGdW5jdGlvbikge1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBpc0JpbmFyeShub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUudHlwZSA9PT0gU3ludGF4LkxvZ2ljYWxFeHByZXNzaW9uIHx8XG4gICAgICAgICAgICAgICAgICAgIG5vZGUudHlwZSA9PT0gU3ludGF4LkJpbmFyeUV4cHJlc3Npb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHZpc2l0KG5vZGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RhcnQsIGVuZDtcblxuICAgICAgICAgICAgICAgIGlmIChpc0JpbmFyeShub2RlLmxlZnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2l0KG5vZGUubGVmdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpc0JpbmFyeShub2RlLnJpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpdChub2RlLnJpZ2h0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubGVmdC5ncm91cFJhbmdlIHx8IG5vZGUucmlnaHQuZ3JvdXBSYW5nZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQgPSBub2RlLmxlZnQuZ3JvdXBSYW5nZSA/IG5vZGUubGVmdC5ncm91cFJhbmdlWzBdIDogbm9kZS5sZWZ0LnJhbmdlWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZW5kID0gbm9kZS5yaWdodC5ncm91cFJhbmdlID8gbm9kZS5yaWdodC5ncm91cFJhbmdlWzFdIDogbm9kZS5yaWdodC5yYW5nZVsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUucmFuZ2UgPSBbc3RhcnQsIGVuZF07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5vZGUucmFuZ2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydCA9IG5vZGUubGVmdC5yYW5nZVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZCA9IG5vZGUucmlnaHQucmFuZ2VbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlLnJhbmdlID0gW3N0YXJ0LCBlbmRdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsb2MpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubGVmdC5ncm91cExvYyB8fCBub2RlLnJpZ2h0Lmdyb3VwTG9jKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydCA9IG5vZGUubGVmdC5ncm91cExvYyA/IG5vZGUubGVmdC5ncm91cExvYy5zdGFydCA6IG5vZGUubGVmdC5sb2Muc3RhcnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbmQgPSBub2RlLnJpZ2h0Lmdyb3VwTG9jID8gbm9kZS5yaWdodC5ncm91cExvYy5lbmQgOiBub2RlLnJpZ2h0LmxvYy5lbmQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlLmxvYyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydDogc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5vZGUubG9jID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5sb2MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IG5vZGUubGVmdC5sb2Muc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kOiBub2RlLnJpZ2h0LmxvYy5lbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcmtlciwgbm9kZTtcblxuICAgICAgICAgICAgICAgIHNraXBDb21tZW50KCk7XG5cbiAgICAgICAgICAgICAgICBtYXJrZXIgPSBjcmVhdGVMb2NhdGlvbk1hcmtlcigpO1xuICAgICAgICAgICAgICAgIG5vZGUgPSBwYXJzZUZ1bmN0aW9uLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgbWFya2VyLmVuZCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJhbmdlICYmIHR5cGVvZiBub2RlLnJhbmdlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIuYXBwbHkobm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxvYyAmJiB0eXBlb2Ygbm9kZS5sb2MgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlci5hcHBseShub2RlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNCaW5hcnkobm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaXQobm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhdGNoKCkge1xuXG4gICAgICAgIHZhciB3cmFwVHJhY2tpbmc7XG5cbiAgICAgICAgaWYgKGV4dHJhLmNvbW1lbnRzKSB7XG4gICAgICAgICAgICBleHRyYS5za2lwQ29tbWVudCA9IHNraXBDb21tZW50O1xuICAgICAgICAgICAgc2tpcENvbW1lbnQgPSBzY2FuQ29tbWVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChleHRyYS5yYXcpIHtcbiAgICAgICAgICAgIGV4dHJhLmNyZWF0ZUxpdGVyYWwgPSBjcmVhdGVMaXRlcmFsO1xuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbCA9IGNyZWF0ZVJhd0xpdGVyYWw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXh0cmEucmFuZ2UgfHwgZXh0cmEubG9jKSB7XG5cbiAgICAgICAgICAgIGV4dHJhLnBhcnNlR3JvdXBFeHByZXNzaW9uID0gcGFyc2VHcm91cEV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb24gPSBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb25BbGxvd0NhbGwgPSBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb25BbGxvd0NhbGw7XG4gICAgICAgICAgICBwYXJzZUdyb3VwRXhwcmVzc2lvbiA9IHRyYWNrR3JvdXBFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uID0gdHJhY2tMZWZ0SGFuZFNpZGVFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uQWxsb3dDYWxsID0gdHJhY2tMZWZ0SGFuZFNpZGVFeHByZXNzaW9uQWxsb3dDYWxsO1xuXG4gICAgICAgICAgICB3cmFwVHJhY2tpbmcgPSB3cmFwVHJhY2tpbmdGdW5jdGlvbihleHRyYS5yYW5nZSwgZXh0cmEubG9jKTtcblxuICAgICAgICAgICAgZXh0cmEucGFyc2VBZGRpdGl2ZUV4cHJlc3Npb24gPSBwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlQXNzaWdubWVudEV4cHJlc3Npb24gPSBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VCaXR3aXNlQU5ERXhwcmVzc2lvbiA9IHBhcnNlQml0d2lzZUFOREV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUJpdHdpc2VPUkV4cHJlc3Npb24gPSBwYXJzZUJpdHdpc2VPUkV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUJpdHdpc2VYT1JFeHByZXNzaW9uID0gcGFyc2VCaXR3aXNlWE9SRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlQmxvY2sgPSBwYXJzZUJsb2NrO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzID0gcGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VDYXRjaENsYXVzZSA9IHBhcnNlQ2F0Y2hDbGF1c2U7XG4gICAgICAgICAgICBleHRyYS5wYXJzZUNvbXB1dGVkTWVtYmVyID0gcGFyc2VDb21wdXRlZE1lbWJlcjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uID0gcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUNvbnN0TGV0RGVjbGFyYXRpb24gPSBwYXJzZUNvbnN0TGV0RGVjbGFyYXRpb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZUVxdWFsaXR5RXhwcmVzc2lvbiA9IHBhcnNlRXF1YWxpdHlFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VFeHByZXNzaW9uID0gcGFyc2VFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VGb3JWYXJpYWJsZURlY2xhcmF0aW9uID0gcGFyc2VGb3JWYXJpYWJsZURlY2xhcmF0aW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VGdW5jdGlvbkRlY2xhcmF0aW9uID0gcGFyc2VGdW5jdGlvbkRlY2xhcmF0aW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VGdW5jdGlvbkV4cHJlc3Npb24gPSBwYXJzZUZ1bmN0aW9uRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24gPSBwYXJzZUxvZ2ljYWxBTkRFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uID0gcGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VNdWx0aXBsaWNhdGl2ZUV4cHJlc3Npb24gPSBwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlTmV3RXhwcmVzc2lvbiA9IHBhcnNlTmV3RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlTm9uQ29tcHV0ZWRQcm9wZXJ0eSA9IHBhcnNlTm9uQ29tcHV0ZWRQcm9wZXJ0eTtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlT2JqZWN0UHJvcGVydHkgPSBwYXJzZU9iamVjdFByb3BlcnR5O1xuICAgICAgICAgICAgZXh0cmEucGFyc2VPYmplY3RQcm9wZXJ0eUtleSA9IHBhcnNlT2JqZWN0UHJvcGVydHlLZXk7XG4gICAgICAgICAgICBleHRyYS5wYXJzZVBvc3RmaXhFeHByZXNzaW9uID0gcGFyc2VQb3N0Zml4RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlUHJpbWFyeUV4cHJlc3Npb24gPSBwYXJzZVByaW1hcnlFeHByZXNzaW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VQcm9ncmFtID0gcGFyc2VQcm9ncmFtO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VQcm9wZXJ0eUZ1bmN0aW9uID0gcGFyc2VQcm9wZXJ0eUZ1bmN0aW9uO1xuICAgICAgICAgICAgZXh0cmEucGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbiA9IHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZVN0YXRlbWVudCA9IHBhcnNlU3RhdGVtZW50O1xuICAgICAgICAgICAgZXh0cmEucGFyc2VTaGlmdEV4cHJlc3Npb24gPSBwYXJzZVNoaWZ0RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlU3dpdGNoQ2FzZSA9IHBhcnNlU3dpdGNoQ2FzZTtcbiAgICAgICAgICAgIGV4dHJhLnBhcnNlVW5hcnlFeHByZXNzaW9uID0gcGFyc2VVbmFyeUV4cHJlc3Npb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZVZhcmlhYmxlRGVjbGFyYXRpb24gPSBwYXJzZVZhcmlhYmxlRGVjbGFyYXRpb247XG4gICAgICAgICAgICBleHRyYS5wYXJzZVZhcmlhYmxlSWRlbnRpZmllciA9IHBhcnNlVmFyaWFibGVJZGVudGlmaWVyO1xuXG4gICAgICAgICAgICBwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUFkZGl0aXZlRXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlQXNzaWdubWVudEV4cHJlc3Npb24pO1xuICAgICAgICAgICAgcGFyc2VCaXR3aXNlQU5ERXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUJpdHdpc2VBTkRFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlQml0d2lzZU9SRXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUJpdHdpc2VPUkV4cHJlc3Npb24pO1xuICAgICAgICAgICAgcGFyc2VCaXR3aXNlWE9SRXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUJpdHdpc2VYT1JFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlQmxvY2sgPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VCbG9jayk7XG4gICAgICAgICAgICBwYXJzZUZ1bmN0aW9uU291cmNlRWxlbWVudHMgPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VGdW5jdGlvblNvdXJjZUVsZW1lbnRzKTtcbiAgICAgICAgICAgIHBhcnNlQ2F0Y2hDbGF1c2UgPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VDYXRjaENsYXVzZSk7XG4gICAgICAgICAgICBwYXJzZUNvbXB1dGVkTWVtYmVyID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlQ29tcHV0ZWRNZW1iZXIpO1xuICAgICAgICAgICAgcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24pO1xuICAgICAgICAgICAgcGFyc2VDb25zdExldERlY2xhcmF0aW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlQ29uc3RMZXREZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUVxdWFsaXR5RXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZUV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlRm9yVmFyaWFibGVEZWNsYXJhdGlvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUZvclZhcmlhYmxlRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgcGFyc2VGdW5jdGlvbkRlY2xhcmF0aW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlRnVuY3Rpb25EZWNsYXJhdGlvbik7XG4gICAgICAgICAgICBwYXJzZUZ1bmN0aW9uRXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZUxlZnRIYW5kU2lkZUV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcocGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VMb2dpY2FsQU5ERXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZUxvZ2ljYWxPUkV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlTXVsdGlwbGljYXRpdmVFeHByZXNzaW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlTXVsdGlwbGljYXRpdmVFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlTmV3RXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZU5ld0V4cHJlc3Npb24pO1xuICAgICAgICAgICAgcGFyc2VOb25Db21wdXRlZFByb3BlcnR5ID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlTm9uQ29tcHV0ZWRQcm9wZXJ0eSk7XG4gICAgICAgICAgICBwYXJzZU9iamVjdFByb3BlcnR5ID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlT2JqZWN0UHJvcGVydHkpO1xuICAgICAgICAgICAgcGFyc2VPYmplY3RQcm9wZXJ0eUtleSA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZU9iamVjdFByb3BlcnR5S2V5KTtcbiAgICAgICAgICAgIHBhcnNlUG9zdGZpeEV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VQb3N0Zml4RXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZVByaW1hcnlFeHByZXNzaW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlUHJpbWFyeUV4cHJlc3Npb24pO1xuICAgICAgICAgICAgcGFyc2VQcm9ncmFtID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlUHJvZ3JhbSk7XG4gICAgICAgICAgICBwYXJzZVByb3BlcnR5RnVuY3Rpb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VQcm9wZXJ0eUZ1bmN0aW9uKTtcbiAgICAgICAgICAgIHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb24gPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZVN0YXRlbWVudCA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZVN0YXRlbWVudCk7XG4gICAgICAgICAgICBwYXJzZVNoaWZ0RXhwcmVzc2lvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZVNoaWZ0RXhwcmVzc2lvbik7XG4gICAgICAgICAgICBwYXJzZVN3aXRjaENhc2UgPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VTd2l0Y2hDYXNlKTtcbiAgICAgICAgICAgIHBhcnNlVW5hcnlFeHByZXNzaW9uID0gd3JhcFRyYWNraW5nKGV4dHJhLnBhcnNlVW5hcnlFeHByZXNzaW9uKTtcbiAgICAgICAgICAgIHBhcnNlVmFyaWFibGVEZWNsYXJhdGlvbiA9IHdyYXBUcmFja2luZyhleHRyYS5wYXJzZVZhcmlhYmxlRGVjbGFyYXRpb24pO1xuICAgICAgICAgICAgcGFyc2VWYXJpYWJsZUlkZW50aWZpZXIgPSB3cmFwVHJhY2tpbmcoZXh0cmEucGFyc2VWYXJpYWJsZUlkZW50aWZpZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBleHRyYS50b2tlbnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBleHRyYS5hZHZhbmNlID0gYWR2YW5jZTtcbiAgICAgICAgICAgIGV4dHJhLnNjYW5SZWdFeHAgPSBzY2FuUmVnRXhwO1xuXG4gICAgICAgICAgICBhZHZhbmNlID0gY29sbGVjdFRva2VuO1xuICAgICAgICAgICAgc2NhblJlZ0V4cCA9IGNvbGxlY3RSZWdleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVucGF0Y2goKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZXh0cmEuc2tpcENvbW1lbnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHNraXBDb21tZW50ID0gZXh0cmEuc2tpcENvbW1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXh0cmEucmF3KSB7XG4gICAgICAgICAgICBjcmVhdGVMaXRlcmFsID0gZXh0cmEuY3JlYXRlTGl0ZXJhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChleHRyYS5yYW5nZSB8fCBleHRyYS5sb2MpIHtcbiAgICAgICAgICAgIHBhcnNlQWRkaXRpdmVFeHByZXNzaW9uID0gZXh0cmEucGFyc2VBZGRpdGl2ZUV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZUFzc2lnbm1lbnRFeHByZXNzaW9uID0gZXh0cmEucGFyc2VBc3NpZ25tZW50RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIHBhcnNlQml0d2lzZUFOREV4cHJlc3Npb24gPSBleHRyYS5wYXJzZUJpdHdpc2VBTkRFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VCaXR3aXNlT1JFeHByZXNzaW9uID0gZXh0cmEucGFyc2VCaXR3aXNlT1JFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VCaXR3aXNlWE9SRXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlQml0d2lzZVhPUkV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZUJsb2NrID0gZXh0cmEucGFyc2VCbG9jaztcbiAgICAgICAgICAgIHBhcnNlRnVuY3Rpb25Tb3VyY2VFbGVtZW50cyA9IGV4dHJhLnBhcnNlRnVuY3Rpb25Tb3VyY2VFbGVtZW50cztcbiAgICAgICAgICAgIHBhcnNlQ2F0Y2hDbGF1c2UgPSBleHRyYS5wYXJzZUNhdGNoQ2xhdXNlO1xuICAgICAgICAgICAgcGFyc2VDb21wdXRlZE1lbWJlciA9IGV4dHJhLnBhcnNlQ29tcHV0ZWRNZW1iZXI7XG4gICAgICAgICAgICBwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VDb25zdExldERlY2xhcmF0aW9uID0gZXh0cmEucGFyc2VDb25zdExldERlY2xhcmF0aW9uO1xuICAgICAgICAgICAgcGFyc2VFcXVhbGl0eUV4cHJlc3Npb24gPSBleHRyYS5wYXJzZUVxdWFsaXR5RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIHBhcnNlRXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIHBhcnNlRm9yVmFyaWFibGVEZWNsYXJhdGlvbiA9IGV4dHJhLnBhcnNlRm9yVmFyaWFibGVEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIHBhcnNlRnVuY3Rpb25EZWNsYXJhdGlvbiA9IGV4dHJhLnBhcnNlRnVuY3Rpb25EZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIHBhcnNlRnVuY3Rpb25FeHByZXNzaW9uID0gZXh0cmEucGFyc2VGdW5jdGlvbkV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZUdyb3VwRXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlR3JvdXBFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uID0gZXh0cmEucGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uQWxsb3dDYWxsID0gZXh0cmEucGFyc2VMZWZ0SGFuZFNpZGVFeHByZXNzaW9uQWxsb3dDYWxsO1xuICAgICAgICAgICAgcGFyc2VMb2dpY2FsQU5ERXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlTG9naWNhbEFOREV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZUxvZ2ljYWxPUkV4cHJlc3Npb24gPSBleHRyYS5wYXJzZUxvZ2ljYWxPUkV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlTXVsdGlwbGljYXRpdmVFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VOZXdFeHByZXNzaW9uID0gZXh0cmEucGFyc2VOZXdFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VOb25Db21wdXRlZFByb3BlcnR5ID0gZXh0cmEucGFyc2VOb25Db21wdXRlZFByb3BlcnR5O1xuICAgICAgICAgICAgcGFyc2VPYmplY3RQcm9wZXJ0eSA9IGV4dHJhLnBhcnNlT2JqZWN0UHJvcGVydHk7XG4gICAgICAgICAgICBwYXJzZU9iamVjdFByb3BlcnR5S2V5ID0gZXh0cmEucGFyc2VPYmplY3RQcm9wZXJ0eUtleTtcbiAgICAgICAgICAgIHBhcnNlUHJpbWFyeUV4cHJlc3Npb24gPSBleHRyYS5wYXJzZVByaW1hcnlFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VQb3N0Zml4RXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlUG9zdGZpeEV4cHJlc3Npb247XG4gICAgICAgICAgICBwYXJzZVByb2dyYW0gPSBleHRyYS5wYXJzZVByb2dyYW07XG4gICAgICAgICAgICBwYXJzZVByb3BlcnR5RnVuY3Rpb24gPSBleHRyYS5wYXJzZVByb3BlcnR5RnVuY3Rpb247XG4gICAgICAgICAgICBwYXJzZVJlbGF0aW9uYWxFeHByZXNzaW9uID0gZXh0cmEucGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbjtcbiAgICAgICAgICAgIHBhcnNlU3RhdGVtZW50ID0gZXh0cmEucGFyc2VTdGF0ZW1lbnQ7XG4gICAgICAgICAgICBwYXJzZVNoaWZ0RXhwcmVzc2lvbiA9IGV4dHJhLnBhcnNlU2hpZnRFeHByZXNzaW9uO1xuICAgICAgICAgICAgcGFyc2VTd2l0Y2hDYXNlID0gZXh0cmEucGFyc2VTd2l0Y2hDYXNlO1xuICAgICAgICAgICAgcGFyc2VVbmFyeUV4cHJlc3Npb24gPSBleHRyYS5wYXJzZVVuYXJ5RXhwcmVzc2lvbjtcbiAgICAgICAgICAgIHBhcnNlVmFyaWFibGVEZWNsYXJhdGlvbiA9IGV4dHJhLnBhcnNlVmFyaWFibGVEZWNsYXJhdGlvbjtcbiAgICAgICAgICAgIHBhcnNlVmFyaWFibGVJZGVudGlmaWVyID0gZXh0cmEucGFyc2VWYXJpYWJsZUlkZW50aWZpZXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGV4dHJhLnNjYW5SZWdFeHAgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGFkdmFuY2UgPSBleHRyYS5hZHZhbmNlO1xuICAgICAgICAgICAgc2NhblJlZ0V4cCA9IGV4dHJhLnNjYW5SZWdFeHA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJpbmdUb0FycmF5KHN0cikge1xuICAgICAgICB2YXIgbGVuZ3RoID0gc3RyLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICAgICAgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICByZXN1bHRbaV0gPSBzdHIuY2hhckF0KGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2UoY29kZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgcHJvZ3JhbSwgdG9TdHJpbmc7XG5cbiAgICAgICAgdG9TdHJpbmcgPSBTdHJpbmc7XG4gICAgICAgIGlmICh0eXBlb2YgY29kZSAhPT0gJ3N0cmluZycgJiYgIShjb2RlIGluc3RhbmNlb2YgU3RyaW5nKSkge1xuICAgICAgICAgICAgY29kZSA9IHRvU3RyaW5nKGNvZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgc291cmNlID0gY29kZTtcbiAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICBsaW5lTnVtYmVyID0gKHNvdXJjZS5sZW5ndGggPiAwKSA/IDEgOiAwO1xuICAgICAgICBsaW5lU3RhcnQgPSAwO1xuICAgICAgICBsZW5ndGggPSBzb3VyY2UubGVuZ3RoO1xuICAgICAgICBidWZmZXIgPSBudWxsO1xuICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICAgIGFsbG93SW46IHRydWUsXG4gICAgICAgICAgICBsYWJlbFNldDoge30sXG4gICAgICAgICAgICBpbkZ1bmN0aW9uQm9keTogZmFsc2UsXG4gICAgICAgICAgICBpbkl0ZXJhdGlvbjogZmFsc2UsXG4gICAgICAgICAgICBpblN3aXRjaDogZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICBleHRyYSA9IHt9O1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBleHRyYS5yYW5nZSA9ICh0eXBlb2Ygb3B0aW9ucy5yYW5nZSA9PT0gJ2Jvb2xlYW4nKSAmJiBvcHRpb25zLnJhbmdlO1xuICAgICAgICAgICAgZXh0cmEubG9jID0gKHR5cGVvZiBvcHRpb25zLmxvYyA9PT0gJ2Jvb2xlYW4nKSAmJiBvcHRpb25zLmxvYztcbiAgICAgICAgICAgIGV4dHJhLnJhdyA9ICh0eXBlb2Ygb3B0aW9ucy5yYXcgPT09ICdib29sZWFuJykgJiYgb3B0aW9ucy5yYXc7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMudG9rZW5zID09PSAnYm9vbGVhbicgJiYgb3B0aW9ucy50b2tlbnMpIHtcbiAgICAgICAgICAgICAgICBleHRyYS50b2tlbnMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jb21tZW50ID09PSAnYm9vbGVhbicgJiYgb3B0aW9ucy5jb21tZW50KSB7XG4gICAgICAgICAgICAgICAgZXh0cmEuY29tbWVudHMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy50b2xlcmFudCA9PT0gJ2Jvb2xlYW4nICYmIG9wdGlvbnMudG9sZXJhbnQpIHtcbiAgICAgICAgICAgICAgICBleHRyYS5lcnJvcnMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNvdXJjZVswXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgZmlyc3QgdG8gY29udmVydCB0byBhIHN0cmluZy4gVGhpcyBpcyBnb29kIGFzIGZhc3QgcGF0aFxuICAgICAgICAgICAgICAgIC8vIGZvciBvbGQgSUUgd2hpY2ggdW5kZXJzdGFuZHMgc3RyaW5nIGluZGV4aW5nIGZvciBzdHJpbmdcbiAgICAgICAgICAgICAgICAvLyBsaXRlcmFscyBvbmx5IGFuZCBub3QgZm9yIHN0cmluZyBvYmplY3QuXG4gICAgICAgICAgICAgICAgaWYgKGNvZGUgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgc291cmNlID0gY29kZS52YWx1ZU9mKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRm9yY2UgYWNjZXNzaW5nIHRoZSBjaGFyYWN0ZXJzIHZpYSBhbiBhcnJheS5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHNvdXJjZVswXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgc291cmNlID0gc3RyaW5nVG9BcnJheShjb2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwYXRjaCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJvZ3JhbSA9IHBhcnNlUHJvZ3JhbSgpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHRyYS5jb21tZW50cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJDb21tZW50TG9jYXRpb24oKTtcbiAgICAgICAgICAgICAgICBwcm9ncmFtLmNvbW1lbnRzID0gZXh0cmEuY29tbWVudHM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4dHJhLnRva2VucyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJUb2tlbkxvY2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgcHJvZ3JhbS50b2tlbnMgPSBleHRyYS50b2tlbnM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4dHJhLmVycm9ycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBwcm9ncmFtLmVycm9ycyA9IGV4dHJhLmVycm9ycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChleHRyYS5yYW5nZSB8fCBleHRyYS5sb2MpIHtcbiAgICAgICAgICAgICAgICBwcm9ncmFtLmJvZHkgPSBmaWx0ZXJHcm91cChwcm9ncmFtLmJvZHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdW5wYXRjaCgpO1xuICAgICAgICAgICAgZXh0cmEgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9ncmFtO1xuICAgIH1cblxuICAgIC8vIFN5bmMgd2l0aCBwYWNrYWdlLmpzb24uXG4gICAgZXhwb3J0cy52ZXJzaW9uID0gJzEuMC40JztcblxuICAgIGV4cG9ydHMucGFyc2UgPSBwYXJzZTtcblxuICAgIC8vIERlZXAgY29weS5cbiAgICBleHBvcnRzLlN5bnRheCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuYW1lLCB0eXBlcyA9IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdHlwZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChuYW1lIGluIFN5bnRheCkge1xuICAgICAgICAgICAgaWYgKFN5bnRheC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgIHR5cGVzW25hbWVdID0gU3ludGF4W25hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBPYmplY3QuZnJlZXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBPYmplY3QuZnJlZXplKHR5cGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0eXBlcztcbiAgICB9KCkpO1xuXG59KSk7XG4vKiB2aW06IHNldCBzdz00IHRzPTQgZXQgdHc9ODAgOiAqL1xuIiwiXCJ1c2Ugc3RyaWN0XCJcblxuZnVuY3Rpb24gZHVwZV9hcnJheShjb3VudCwgdmFsdWUsIGkpIHtcbiAgdmFyIGMgPSBjb3VudFtpXXwwXG4gIGlmKGMgPD0gMCkge1xuICAgIHJldHVybiBbXVxuICB9XG4gIHZhciByZXN1bHQgPSBuZXcgQXJyYXkoYyksIGpcbiAgaWYoaSA9PT0gY291bnQubGVuZ3RoLTEpIHtcbiAgICBmb3Ioaj0wOyBqPGM7ICsraikge1xuICAgICAgcmVzdWx0W2pdID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yKGo9MDsgajxjOyArK2opIHtcbiAgICAgIHJlc3VsdFtqXSA9IGR1cGVfYXJyYXkoY291bnQsIHZhbHVlLCBpKzEpXG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gZHVwZV9udW1iZXIoY291bnQsIHZhbHVlKSB7XG4gIHZhciByZXN1bHQsIGlcbiAgcmVzdWx0ID0gbmV3IEFycmF5KGNvdW50KVxuICBmb3IoaT0wOyBpPGNvdW50OyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSB2YWx1ZVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gZHVwZShjb3VudCwgdmFsdWUpIHtcbiAgaWYodHlwZW9mIHZhbHVlID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgdmFsdWUgPSAwXG4gIH1cbiAgc3dpdGNoKHR5cGVvZiBjb3VudCkge1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIGlmKGNvdW50ID4gMCkge1xuICAgICAgICByZXR1cm4gZHVwZV9udW1iZXIoY291bnR8MCwgdmFsdWUpXG4gICAgICB9XG4gICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICBpZih0eXBlb2YgKGNvdW50Lmxlbmd0aCkgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmV0dXJuIGR1cGVfYXJyYXkoY291bnQsIHZhbHVlLCAwKVxuICAgICAgfVxuICAgIGJyZWFrXG4gIH1cbiAgcmV0dXJuIFtdXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZHVwZSIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBiaXRzID0gcmVxdWlyZShcImJpdC10d2lkZGxlXCIpXG52YXIgZHVwID0gcmVxdWlyZShcImR1cFwiKVxuaWYoIWdsb2JhbC5fX1RZUEVEQVJSQVlfUE9PTCkge1xuICBnbG9iYWwuX19UWVBFREFSUkFZX1BPT0wgPSB7XG4gICAgICBVSU5UOCAgIDogZHVwKFszMiwgMF0pXG4gICAgLCBVSU5UMTYgIDogZHVwKFszMiwgMF0pXG4gICAgLCBVSU5UMzIgIDogZHVwKFszMiwgMF0pXG4gICAgLCBJTlQ4ICAgIDogZHVwKFszMiwgMF0pXG4gICAgLCBJTlQxNiAgIDogZHVwKFszMiwgMF0pXG4gICAgLCBJTlQzMiAgIDogZHVwKFszMiwgMF0pXG4gICAgLCBGTE9BVCAgIDogZHVwKFszMiwgMF0pXG4gICAgLCBET1VCTEUgIDogZHVwKFszMiwgMF0pXG4gICAgLCBEQVRBICAgIDogZHVwKFszMiwgMF0pXG4gIH1cbn1cbnZhciBQT09MID0gZ2xvYmFsLl9fVFlQRURBUlJBWV9QT09MXG52YXIgVUlOVDggICA9IFBPT0wuVUlOVDhcbiAgLCBVSU5UMTYgID0gUE9PTC5VSU5UMTZcbiAgLCBVSU5UMzIgID0gUE9PTC5VSU5UMzJcbiAgLCBJTlQ4ICAgID0gUE9PTC5JTlQ4XG4gICwgSU5UMTYgICA9IFBPT0wuSU5UMTZcbiAgLCBJTlQzMiAgID0gUE9PTC5JTlQzMlxuICAsIEZMT0FUICAgPSBQT09MLkZMT0FUXG4gICwgRE9VQkxFICA9IFBPT0wuRE9VQkxFXG4gICwgREFUQSAgICA9IFBPT0wuREFUQVxuXG5mdW5jdGlvbiBmcmVlKGFycmF5KSB7XG4gIGlmKGFycmF5IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICB2YXIgbiA9IGFycmF5LmJ5dGVMZW5ndGh8MFxuICAgICAgLCBsb2dfbiA9IGJpdHMubG9nMihuKVxuICAgIGlmKG4gPCAzMikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIERBVEFbbG9nX25dLnB1c2goYXJyYXkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIG4gPSBhcnJheS5sZW5ndGh8MFxuICAgICAgLCBsb2dfbiA9IGJpdHMubG9nMihuKVxuICAgIGlmKG4gPCAzMikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmKGFycmF5IGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgVUlOVDhbbG9nX25dLnB1c2goYXJyYXkpXG4gICAgfSBlbHNlIGlmKGFycmF5IGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICAgIFVJTlQxNltsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBVaW50MzJBcnJheSkge1xuICAgICAgVUlOVDMyW2xvZ19uXS5wdXNoKGFycmF5KVxuICAgIH0gZWxzZSBpZihhcnJheSBpbnN0YW5jZW9mIEludDhBcnJheSkge1xuICAgICAgSU5UOFtsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBJbnQxNkFycmF5KSB7XG4gICAgICBJTlQxNltsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBJbnQzMkFycmF5KSB7XG4gICAgICBJTlQzMltsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkpIHtcbiAgICAgIEZMT0FUW2xvZ19uXS5wdXNoKGFycmF5KVxuICAgIH0gZWxzZSBpZihhcnJheSBpbnN0YW5jZW9mIEZsb2F0NjRBcnJheSkge1xuICAgICAgRE9VQkxFW2xvZ19uXS5wdXNoKGFycmF5KVxuICAgIH1cbiAgfVxufVxuZXhwb3J0cy5mcmVlID0gZnJlZVxuXG5mdW5jdGlvbiBtYWxsb2MobiwgZHR5cGUpIHtcbiAgbiA9IE1hdGgubWF4KGJpdHMubmV4dFBvdzIobiksIDMyKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgaWYoZHR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBkID0gREFUQVtsb2dfbl1cbiAgICBpZihkLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhciByID0gZFtkLmxlbmd0aC0xXVxuICAgICAgZC5wb3AoKVxuICAgICAgcmV0dXJuIHJcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBBcnJheUJ1ZmZlcihuKVxuICB9IGVsc2Uge1xuICAgIHN3aXRjaChkdHlwZSkge1xuICAgICAgY2FzZSBcInVpbnQ4XCI6XG4gICAgICAgIHZhciB1OCA9IFVJTlQ4W2xvZ19uXVxuICAgICAgICBpZih1OC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdmFyIHI4ID0gdThbdTgubGVuZ3RoLTFdXG4gICAgICAgICAgdTgucG9wKClcbiAgICAgICAgICByZXR1cm4gcjhcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobilcbiAgICAgIGJyZWFrXG4gICAgICBcbiAgICAgIGNhc2UgXCJ1aW50MTZcIjpcbiAgICAgICAgdmFyIHUxNiA9IFVJTlQxNltsb2dfbl1cbiAgICAgICAgaWYodTE2Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB2YXIgcjE2ID0gdTE2W3UxNi5sZW5ndGgtMV1cbiAgICAgICAgICB1MTYucG9wKClcbiAgICAgICAgICByZXR1cm4gcjE2XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBVaW50MTZBcnJheShuKVxuICAgICAgYnJlYWtcbiAgICAgIFxuICAgICAgY2FzZSBcInVpbnQzMlwiOlxuICAgICAgICB2YXIgdTMyID0gVUlOVDMyW2xvZ19uXVxuICAgICAgICBpZih1MzIubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHZhciByMzIgPSB1MzJbdTMyLmxlbmd0aC0xXVxuICAgICAgICAgIHUzMi5wb3AoKVxuICAgICAgICAgIHJldHVybiByMzJcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQzMkFycmF5KG4pXG4gICAgICBicmVha1xuICAgICAgXG4gICAgICBjYXNlIFwiaW50OFwiOlxuICAgICAgICB2YXIgaTggPSBJTlQ4W2xvZ19uXVxuICAgICAgICBpZihpOC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdmFyIHM4ID0gaThbaTgubGVuZ3RoLTFdXG4gICAgICAgICAgaTgucG9wKClcbiAgICAgICAgICByZXR1cm4gczhcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IEludDhBcnJheShuKVxuICAgICAgYnJlYWtcbiAgICAgIFxuICAgICAgY2FzZSBcImludDE2XCI6XG4gICAgICAgIHZhciBpMTYgPSBJTlQxNltsb2dfbl1cbiAgICAgICAgaWYoaTE2Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB2YXIgczE2ID0gaTE2W2kxNi5sZW5ndGgtMV1cbiAgICAgICAgICBpMTYucG9wKClcbiAgICAgICAgICByZXR1cm4gczE2XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBJbnQxNkFycmF5KG4pXG4gICAgICBicmVha1xuICAgICAgXG4gICAgICBjYXNlIFwiaW50MzJcIjpcbiAgICAgICAgdmFyIGkzMiA9IElOVDMyW2xvZ19uXVxuICAgICAgICBpZihpMzIubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHZhciBzMzIgPSBpMzJbaTMyLmxlbmd0aC0xXVxuICAgICAgICAgIGkzMi5wb3AoKVxuICAgICAgICAgIHJldHVybiBzMzJcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IEludDMyQXJyYXkobilcbiAgICAgIGJyZWFrXG4gICAgICBcbiAgICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgY2FzZSBcImZsb2F0MzJcIjpcbiAgICAgICAgdmFyIGYgPSBGTE9BVFtsb2dfbl1cbiAgICAgICAgaWYoZi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdmFyIHEgPSBmW2YubGVuZ3RoLTFdXG4gICAgICAgICAgZi5wb3AoKVxuICAgICAgICAgIHJldHVybiBxXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkobilcbiAgICAgIGJyZWFrXG4gICAgICBcbiAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgIGNhc2UgXCJmbG9hdDY0XCI6XG4gICAgICAgIHZhciBkZCA9IERPVUJMRVtsb2dfbl1cbiAgICAgICAgaWYoZGQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHZhciBwID0gZGRbZGQubGVuZ3RoLTFdXG4gICAgICAgICAgZGQucG9wKClcbiAgICAgICAgICByZXR1cm4gcFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgRmxvYXQ2NEFycmF5KG4pXG4gICAgICBicmVha1xuICAgICAgXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbFxufVxuZXhwb3J0cy5tYWxsb2MgPSBtYWxsb2NcblxuXG5mdW5jdGlvbiBjbGVhckNhY2hlKCkge1xuICBmb3IodmFyIGk9MDsgaTwzMjsgKytpKSB7XG4gICAgVUlOVDhbaV0ubGVuZ3RoID0gMFxuICAgIFVJTlQxNltpXS5sZW5ndGggPSAwXG4gICAgVUlOVDMyW2ldLmxlbmd0aCA9IDBcbiAgICBJTlQ4W2ldLmxlbmd0aCA9IDBcbiAgICBJTlQxNltpXS5sZW5ndGggPSAwXG4gICAgSU5UMzJbaV0ubGVuZ3RoID0gMFxuICAgIEZMT0FUW2ldLmxlbmd0aCA9IDBcbiAgICBET1VCTEVbaV0ubGVuZ3RoID0gMFxuICAgIERBVEFbaV0ubGVuZ3RoID0gMFxuICB9XG59XG5leHBvcnRzLmNsZWFyQ2FjaGUgPSBjbGVhckNhY2hlIiwidmFyIGN3aXNlID0gcmVxdWlyZShcImN3aXNlXCIpXG52YXIgbmRhcnJheSA9IHJlcXVpcmUoXCJuZGFycmF5XCIpXG5cbnZhciBhc3NpZ25fb3BzID0ge1xuICBhZGQ6ICBcIitcIixcbiAgc3ViOiAgXCItXCIsXG4gIG11bDogIFwiKlwiLFxuICBkaXY6ICBcIi9cIixcbiAgbW9kOiAgXCIlXCIsXG4gIGJhbmQ6IFwiJlwiLFxuICBib3I6ICBcInxcIixcbiAgYnhvcjogXCJeXCIsXG4gIGxzaGlmdDogXCI8PFwiLFxuICByc2hpZnQ6IFwiPj5cIixcbiAgcnJzaGlmdDogXCI+Pj5cIlxufTtcblxuKGZ1bmN0aW9uKCl7XG4gIGZvcih2YXIgaWQgaW4gYXNzaWduX29wcykge1xuICAgIHZhciBvcCA9IGFzc2lnbl9vcHNbaWRdXG4gICAgZXhwb3J0c1tpZF0gPSBjd2lzZSh7XG4gICAgICBhcmdzOiBbXCJhcnJheVwiLFwiYXJyYXlcIixcImFycmF5XCJdLFxuICAgICAgYm9keTogRnVuY3Rpb24oXCJhXCIsXCJiXCIsXCJjXCIsXCJhPWJcIitvcCtcImNcIilcbiAgICB9KVxuICAgIGV4cG9ydHNbaWQrXCJlcVwiXSA9IGN3aXNlKHtcbiAgICAgIGFyZ3M6IFtcImFycmF5XCIsXCJhcnJheVwiXSxcbiAgICAgIGJvZHk6IEZ1bmN0aW9uKFwiYVwiLFwiYlwiLFwiYVwiK29wK1wiPWJcIilcbiAgICB9KVxuICAgIGV4cG9ydHNbaWQrXCJzXCJdID0gY3dpc2Uoe1xuICAgICAgYXJnczogW1wiYXJyYXlcIiwgXCJhcnJheVwiLCBcInNjYWxhclwiXSxcbiAgICAgIGJvZHk6IEZ1bmN0aW9uKFwiYVwiLFwiYlwiLFwic1wiLFwiYT1iXCIrb3ArXCJzXCIpXG4gICAgfSlcbiAgICBleHBvcnRzW2lkK1wic2VxXCJdID0gY3dpc2Uoe1xuICAgICAgYXJnczogW1wiYXJyYXlcIixcInNjYWxhclwiXSxcbiAgICAgIGJvZHk6IEZ1bmN0aW9uKFwiYVwiLFwic1wiLFwiYVwiK29wK1wiPXNcIilcbiAgICB9KVxuICB9XG59KSgpXG5cbnZhciB1bmFyeV9vcHMgPSB7XG4gIG5vdDogXCIhXCIsXG4gIGJub3Q6IFwiflwiLFxuICBuZWc6IFwiLVwiLFxuICByZWNpcDogXCIxLjAvXCJcbn07XG5cbihmdW5jdGlvbigpe1xuICBmb3IodmFyIGlkIGluIHVuYXJ5X29wcykge1xuICAgIHZhciBvcCA9IHVuYXJ5X29wc1tpZF1cbiAgICBleHBvcnRzW2lkXSA9IGN3aXNlKHtcbiAgICAgIGFyZ3M6IFtcImFycmF5XCIsIFwiYXJyYXlcIl0sXG4gICAgICBib2R5OiBGdW5jdGlvbihcImFcIixcImJcIixcImE9XCIrb3ArXCJiXCIpXG4gICAgfSlcbiAgICBleHBvcnRzW2lkK1wiZXFcIl0gPSBjd2lzZSh7XG4gICAgICBhcmdzOiBbXCJhcnJheVwiXSxcbiAgICAgIGJvZHk6IEZ1bmN0aW9uKFwiYVwiLFwiYT1cIitvcCtcImFcIilcbiAgICB9KVxuICB9XG59KSgpXG5cbnZhciBiaW5hcnlfb3BzID0ge1xuICBhbmQ6IFwiJiZcIixcbiAgb3I6IFwifHxcIixcbiAgZXE6IFwiPT09XCIsXG4gIG5lcTogXCIhPT1cIixcbiAgbHQ6IFwiPFwiLFxuICBndDogXCI+XCIsXG4gIGxlcTogXCI8PVwiLFxuICBnZXE6IFwiPj1cIlxufTtcblxuKGZ1bmN0aW9uKCkge1xuICBmb3IodmFyIGlkIGluIGJpbmFyeV9vcHMpIHtcbiAgICB2YXIgb3AgPSBiaW5hcnlfb3BzW2lkXVxuICAgIGV4cG9ydHNbaWRdID0gY3dpc2Uoe1xuICAgICAgYXJnczogW1wiYXJyYXlcIixcImFycmF5XCIsXCJhcnJheVwiXSxcbiAgICAgIGJvZHk6IEZ1bmN0aW9uKFwiYVwiLCBcImJcIiwgXCJjXCIsIFwiYT1iXCIrb3ArXCJjXCIpXG4gICAgfSlcbiAgICBleHBvcnRzW2lkK1wic1wiXSA9IGN3aXNlKHtcbiAgICAgIGFyZ3M6IFtcImFycmF5XCIsXCJhcnJheVwiLFwic2NhbGFyXCJdLFxuICAgICAgYm9keTogRnVuY3Rpb24oXCJhXCIsIFwiYlwiLCBcInNcIiwgXCJhPWJcIitvcCtcInNcIilcbiAgICB9KVxuICAgIGV4cG9ydHNbaWQrXCJlcVwiXSA9IGN3aXNlKHtcbiAgICAgIGFyZ3M6IFtcImFycmF5XCIsIFwiYXJyYXlcIl0sXG4gICAgICBib2R5OiBGdW5jdGlvbihcImFcIiwgXCJiXCIsIFwiYT1hXCIrb3ArXCJiXCIpXG4gICAgfSlcbiAgICBleHBvcnRzW2lkK1wic2VxXCJdID0gY3dpc2Uoe1xuICAgICAgYXJnczogW1wiYXJyYXlcIiwgXCJzY2FsYXJcIl0sXG4gICAgICBib2R5OiBGdW5jdGlvbihcImFcIiwgXCJzXCIsIFwiYT1hXCIrb3ArXCJzXCIpXG4gICAgfSlcbiAgfVxufSkoKVxuXG52YXIgbWF0aF91bmFyeSA9IFtcbiAgXCJhYnNcIixcbiAgXCJhY29zXCIsXG4gIFwiYXNpblwiLFxuICBcImF0YW5cIixcbiAgXCJjZWlsXCIsXG4gIFwiY29zXCIsXG4gIFwiZXhwXCIsXG4gIFwiZmxvb3JcIixcbiAgXCJsb2dcIixcbiAgXCJyb3VuZFwiLFxuICBcInNpblwiLFxuICBcInNxcnRcIixcbiAgXCJ0YW5cIlxuXTtcblxuKGZ1bmN0aW9uKCkge1xuICBmb3IodmFyIGk9MDsgaTxtYXRoX3VuYXJ5Lmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGYgPSBtYXRoX3VuYXJ5W2ldXG4gICAgZXhwb3J0c1tmXSA9IGN3aXNlKHtcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW1wiYXJyYXlcIiwgXCJhcnJheVwiXSxcbiAgICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBmdW5jdGlvbihhLGIpIHtcbiAgICAgICAgICAgICAgICAgICAgICBhID0gdGhpcy5mdW5jKGIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgZXhwb3J0c1tmK1wiZXFcIl0gPSBjd2lzZSh7XG4gICAgICAgICAgICAgICAgICAgICAgYXJnczogW1wiYXJyYXlcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IGZ1bmN0aW9uKGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYSlcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gIH1cbn0pKClcblxudmFyIG1hdGhfY29tbSA9IFtcbiAgXCJtYXhcIixcbiAgXCJtaW5cIlxuXTtcbihmdW5jdGlvbigpe1xuICBmb3IodmFyIGk9MDsgaTxtYXRoX2NvbW0ubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgZj0gbWF0aF9jb21tW2ldXG4gXG4gICAgZXhwb3J0c1tmXSA9IGN3aXNlKHtcbiAgICAgICAgICAgICAgICAgIGFyZ3M6W1wiYXJyYXlcIiwgXCJhcnJheVwiLCBcImFycmF5XCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiLGMpIHtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuZnVuYyhiLGMpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICBleHBvcnRzW2YrXCJzXCJdID0gY3dpc2Uoe1xuICAgICAgICAgICAgICAgICAgYXJnczpbXCJhcnJheVwiLCBcImFycmF5XCIsIFwic2NhbGFyXCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiLGMpIHtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuZnVuYyhiLGMpXG4gICAgICAgICAgICAgICAgICB9fSlcbiAgICBleHBvcnRzW2YrXCJlcVwiXSA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiLCBcImFycmF5XCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYSxiKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gXG4gICAgZXhwb3J0c1tmK1wic2VxXCJdID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCIsIFwic2NhbGFyXCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYSxiKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gIH1cbn0pKClcblxudmFyIG1hdGhfbm9uY29tbSA9IFtcbiAgXCJhdGFuMlwiLFxuICBcInBvd1wiXG5dO1xuXG4oZnVuY3Rpb24oKXtcbiAgZm9yKHZhciBpPTA7IGk8bWF0aF9ub25jb21tLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGY9IG1hdGhfbm9uY29tbVtpXVxuICAgIGV4cG9ydHNbZl0gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIiwgXCJhcnJheVwiLCBcImFycmF5XCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiLGMpIHtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuZnVuYyhiLGMpXG4gICAgICAgICAgICAgICAgICB9fSlcbiAgICAgICAgICAgICAgICAgIFxuICAgIGV4cG9ydHNbZitcInNcIl0gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIiwgXCJhcnJheVwiLCBcInNjYWxhclwiXSxcbiAgICAgICAgICAgICAgICAgIHByZTogRnVuY3Rpb24oXCJ0aGlzLmZ1bmM9TWF0aC5cIitmKSxcbiAgICAgICAgICAgICAgICAgIGJvZHk6IGZ1bmN0aW9uKGEsYixjKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYixjKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gICAgICAgICAgICAgICAgICBcbiAgICBleHBvcnRzW2YrXCJlcVwiXSA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiLCBcImFycmF5XCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYSxiKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gICAgICAgICAgICAgICAgICBcbiAgICBleHBvcnRzW2YrXCJzZXFcIl0gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIiwgXCJzY2FsYXJcIl0sXG4gICAgICAgICAgICAgICAgICBwcmU6IEZ1bmN0aW9uKFwidGhpcy5mdW5jPU1hdGguXCIrZiksXG4gICAgICAgICAgICAgICAgICBib2R5OiBmdW5jdGlvbihhLGIpIHtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuZnVuYyhhLGIpXG4gICAgICAgICAgICAgICAgICB9fSlcbiAgICAgICAgICAgICAgICAgIFxuICAgIGV4cG9ydHNbZitcIm9wXCJdID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCIsIFwiYXJyYXlcIiwgXCJhcnJheVwiXSxcbiAgICAgICAgICAgICAgICAgIHByZTogRnVuY3Rpb24oXCJ0aGlzLmZ1bmM9TWF0aC5cIitmKSxcbiAgICAgICAgICAgICAgICAgIGJvZHk6IGZ1bmN0aW9uKGEsYixjKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYyxiKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gICAgICAgICAgICAgICAgICBcbiAgICBleHBvcnRzW2YrXCJvcHNcIl0gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIiwgXCJhcnJheVwiLCBcInNjYWxhclwiXSxcbiAgICAgICAgICAgICAgICAgIHByZTogRnVuY3Rpb24oXCJ0aGlzLmZ1bmM9TWF0aC5cIitmKSxcbiAgICAgICAgICAgICAgICAgIGJvZHk6IGZ1bmN0aW9uKGEsYixjKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYyxiKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gICAgICAgICAgICAgICAgICBcbiAgICBleHBvcnRzW2YrXCJvcGVxXCJdID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCIsIFwiYXJyYXlcIl0sXG4gICAgICAgICAgICAgICAgICBwcmU6IEZ1bmN0aW9uKFwidGhpcy5mdW5jPU1hdGguXCIrZiksXG4gICAgICAgICAgICAgICAgICBib2R5OiBmdW5jdGlvbihhLGIpIHtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuZnVuYyhiLGEpXG4gICAgICAgICAgICAgICAgICB9fSlcbiAgICAgICAgICAgICAgICAgIFxuICAgIGV4cG9ydHNbZitcIm9wc2VxXCJdID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCIsIFwic2NhbGFyXCJdLFxuICAgICAgICAgICAgICAgICAgcHJlOiBGdW5jdGlvbihcInRoaXMuZnVuYz1NYXRoLlwiK2YpLFxuICAgICAgICAgICAgICAgICAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLmZ1bmMoYixhKVxuICAgICAgICAgICAgICAgICAgfX0pXG4gICAgICAgICAgICAgICAgICBcbiAgfVxufSkoKVxuXG5leHBvcnRzLmFueSA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiXSxcbiAgYm9keTogZnVuY3Rpb24oYSkge1xuICAgIGlmKGEpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfX0pXG4gIFxuXG5leHBvcnRzLmFsbCA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiXSxcbiAgYm9keTogZnVuY3Rpb24oYSkge1xuICAgIGlmKCFhKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH0sXG4gIHBvc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlXG4gIH19KVxuICBcblxuZXhwb3J0cy5zdW0gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIl0sXG4gIHByZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdW0gPSAwXG4gIH0sXG4gIGJvZHk6IGZ1bmN0aW9uKGEpIHtcbiAgICB0aGlzLnN1bSArPSBhXG4gIH0sXG4gIHBvc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN1bVxuICB9fSlcbiAgXG5cbmV4cG9ydHMucHJvZCA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiXSxcbiAgcHJlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnByb2QgPSAxXG4gIH0sXG4gIGJvZHk6IGZ1bmN0aW9uKGEpIHtcbiAgICB0aGlzLnByb2QgKj0gYVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9kXG4gIH19KVxuICBcblxuZXhwb3J0cy5ub3JtMnNxdWFyZWQgPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIl0sXG4gIHByZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdW0gPSAwXG4gIH0sXG4gIGJvZHk6IGZ1bmN0aW9uKGEpIHtcbiAgICB0aGlzLnN1bSArPSBhKmFcbiAgfSxcbiAgcG9zdDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3VtXG4gIH19KVxuICBcblxuXG5leHBvcnRzLm5vcm0yID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCJdLFxuICBwcmU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VtID0gMFxuICB9LFxuICBib2R5OiBmdW5jdGlvbihhKSB7XG4gICAgdGhpcy5zdW0gKz0gYSphXG4gIH0sXG4gIHBvc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy5zdW0pXG4gIH19KVxuICBcblxuZXhwb3J0cy5ub3JtaW5mID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCJdLFxuICBwcmU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubiA9IDBcbiAgfSxcbiAgYm9keTogZnVuY3Rpb24oYSkge1xuICAgIGlmKGE8MCl7XG4gICAgICBpZigtYTx0aGlzLm4pe1xuICAgICAgICB0aGlzLm49LWFcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYoYT50aGlzLm4pe1xuICAgICAgcz1hXG4gICAgfVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5uXG4gIH19KVxuICBcblxuZXhwb3J0cy5ub3JtMSA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiXSxcbiAgcHJlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN1bSA9IDBcbiAgfSxcbiAgYm9keTogZnVuY3Rpb24oYSkge1xuICAgIHRoaXMuc3VtICs9IGEgPCAwID8gLWEgOiBhXG4gIH0sXG4gIHBvc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN1bVxuICB9fSlcblxuXG5leHBvcnRzLnN1cCA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiXSxcbiAgcHJlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmhpID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZXG4gIH0sXG4gIGJvZHk6IGZ1bmN0aW9uKGEpIHtcbiAgICBpZihhID4gdGhpcy5oaSkge1xuICAgICAgdGhpcy5oaSA9IGFcbiAgICB9XG4gIH0sXG4gIHBvc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmhpXG4gIH19KVxuICBcblxuZXhwb3J0cy5pbmYgPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIl0sXG4gIHByZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sbyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWVxuICB9LFxuICBib2R5OiBmdW5jdGlvbihhKSB7XG4gICAgaWYoYSA8IHRoaXMubG8pIHtcbiAgICAgIHRoaXMubG8gPSBhXG4gICAgfVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5sb1xuICB9fSlcbiAgXG5cbmV4cG9ydHMuYXJnbWluID0gY3dpc2UoeyBhcmdzOltcImluZGV4XCIsIFwiYXJyYXlcIl0sXG4gIHByZTogZnVuY3Rpb24oaSkge1xuICAgIHRoaXMubWluX3YgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFlcbiAgICB0aGlzLm1pbl9pID0gaS5zbGljZSgwKVxuICB9LFxuICBib2R5OiBmdW5jdGlvbihpLCBhKSB7XG4gICAgaWYoYSA8IHRoaXMubWluX3YpIHtcbiAgICAgIHRoaXMubWluX3YgPSBhXG4gICAgICBmb3IodmFyIGs9MDsgazxpLmxlbmd0aDsgKytrKSB7XG4gICAgICAgIHRoaXMubWluX2lba10gPSBpW2tdXG4gICAgICB9XG4gICAgfVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5taW5faVxuICB9fSlcbiAgXG5cbmV4cG9ydHMuYXJnbWF4ID0gY3dpc2UoeyBhcmdzOltcImluZGV4XCIsIFwiYXJyYXlcIl0sXG4gIHByZTogZnVuY3Rpb24oaSkge1xuICAgIHRoaXMubWF4X3YgPSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFlcbiAgICB0aGlzLm1heF9pID0gaS5zbGljZSgwKVxuICB9LFxuICBib2R5OiBmdW5jdGlvbihpLCBhKSB7XG4gICAgaWYoYSA+IHRoaXMubWF4X3YpIHtcbiAgICAgIHRoaXMubWF4X3YgPSBhXG4gICAgICBmb3IodmFyIGs9MDsgazxpLmxlbmd0aDsgKytrKSB7XG4gICAgICAgIHRoaXMubWF4X2lba10gPSBpW2tdXG4gICAgICB9XG4gICAgfVxuICB9LFxuICBwb3N0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tYXhfaVxuICB9fSlcbiAgXG5cbmV4cG9ydHMucmFuZG9tID0gY3dpc2UoeyBhcmdzOltcImFycmF5XCJdLFxuICBwcmU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucm5kID0gTWF0aC5yYW5kb21cbiAgfSxcbiAgYm9keTogZnVuY3Rpb24oYSkge1xuICAgIGEgPSB0aGlzLnJuZCgpXG4gIH19KVxuICBcblxuZXhwb3J0cy5hc3NpZ24gPSBjd2lzZSh7IGFyZ3M6W1wiYXJyYXlcIiwgXCJhcnJheVwiXSxcbiAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgYSA9IGJcbiAgfX0pXG5cbmV4cG9ydHMuYXNzaWducyA9IGN3aXNlKHsgYXJnczpbXCJhcnJheVwiLCBcInNjYWxhclwiXSxcbiAgYm9keTogZnVuY3Rpb24oYSxiKSB7XG4gICAgYSA9IGJcbiAgfX0pXG5cbmV4cG9ydHMuY2xvbmUgPSBmdW5jdGlvbihhcnJheSkge1xuICB2YXIgc3RyaWRlID0gbmV3IEFycmF5KGFycmF5LnNoYXBlLmxlbmd0aClcbiAgdmFyIHRzeiA9IDE7XG4gIGZvcih2YXIgaT1hcnJheS5zaGFwZS5sZW5ndGgtMTsgaT49MDsgLS1pKSB7XG4gICAgc3RyaWRlW2ldID0gdHN6XG4gICAgdHN6ICo9IGFycmF5LnNoYXBlW2ldXG4gIH1cbiAgdmFyIG5kYXRhID0gbmV3IGFycmF5LmRhdGEuY29uc3RydWN0b3IoYXJyYXkuZGF0YS5zbGljZSgwLCB0c3oqYXJyYXkuZGF0YS5CWVRFU19QRVJfRUxFTUVOVCkpXG4gIHZhciByZXN1bHQgPSBuZGFycmF5KG5kYXRhLCBhcnJheS5zaGFwZS5zbGljZSgwKSwgc3RyaWRlLCAwKVxuICByZXR1cm4gZXhwb3J0cy5hc3NpZ24ocmVzdWx0LCBhcnJheSlcbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciB0b29scyA9IHJlcXVpcmUoXCIuL2xpYi90b29scy5qc1wiKVxudmFyIG1ha2VWaWV3ID0gcmVxdWlyZShcIi4vbGliL3ZpZXduLmpzXCIpXG5cbmZ1bmN0aW9uIGFycmF5RFR5cGUoZGF0YSkge1xuICBpZihkYXRhIGluc3RhbmNlb2YgRmxvYXQ2NEFycmF5KSB7XG4gICAgcmV0dXJuIFwiZmxvYXQ2NFwiO1xuICB9IGVsc2UgaWYoZGF0YSBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSkge1xuICAgIHJldHVybiBcImZsb2F0MzJcIlxuICB9IGVsc2UgaWYoZGF0YSBpbnN0YW5jZW9mIEludDMyQXJyYXkpIHtcbiAgICByZXR1cm4gXCJpbnQzMlwiXG4gIH0gZWxzZSBpZihkYXRhIGluc3RhbmNlb2YgVWludDMyQXJyYXkpIHtcbiAgICByZXR1cm4gXCJ1aW50MzJcIlxuICB9IGVsc2UgaWYoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICByZXR1cm4gXCJ1aW50OFwiXG4gIH0gZWxzZSBpZihkYXRhIGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICByZXR1cm4gXCJ1aW50MTZcIlxuICB9IGVsc2UgaWYoZGF0YSBpbnN0YW5jZW9mIEludDE2QXJyYXkpIHtcbiAgICByZXR1cm4gXCJpbnQxNlwiXG4gIH0gZWxzZSBpZihkYXRhIGluc3RhbmNlb2YgSW50OEFycmF5KSB7XG4gICAgcmV0dXJuIFwiaW50OFwiXG4gIH1cbiAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gZW9yKHNoYXBlLCBzdHJpZGUsIG9mZnNldCkge1xuICBmb3IodmFyIGk9MDsgaTxzaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIGlmKHNoYXBlW2ldID09PSAwKSB7XG4gICAgICByZXR1cm4gMFxuICAgIH1cbiAgICBvZmZzZXQgKz0gKHNoYXBlW2ldLTEpICogc3RyaWRlW2ldXG4gIH1cbiAgcmV0dXJuIG9mZnNldFxufVxuXG4vL1dyYXBzIGEgdHlwZWQgYXJyYXkgYXMgYW4gbmRhcnJheVxuZnVuY3Rpb24gd3JhcCh0YXJyYXksIHNoYXBlLCBzdHJpZGUsIG9mZnNldCkge1xuICBpZighYXJyYXlEVHlwZSh0YXJyYXkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgaXMgbm90IGEgdHlwZWQgYXJyYXlcIilcbiAgfVxuICBpZighc2hhcGUpIHtcbiAgICBzaGFwZSA9IFsgdGFycmF5Lmxlbmd0aCBdXG4gIH0gZWxzZSB7XG4gICAgdmFyIHRzeiA9IDFcbiAgICBmb3IodmFyIGk9MDsgaTxzaGFwZS5sZW5ndGg7ICsraSkge1xuICAgICAgdHN6ICo9IHNoYXBlW2ldXG4gICAgfVxuICAgIGlmKHRzeiA+IHRhcnJheS5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkFycmF5IHNoYXBlIG91dCBvZiBib3VuZHNcIilcbiAgICB9XG4gIH1cbiAgaWYoIXN0cmlkZSkge1xuICAgIHN0cmlkZSA9IG5ldyBBcnJheShzaGFwZS5sZW5ndGgpXG4gICAgdmFyIHN6ID0gMVxuICAgIGZvcih2YXIgaT1zaGFwZS5sZW5ndGgtMTsgaT49MDsgLS1pKSB7XG4gICAgICBzdHJpZGVbaV0gPSBzelxuICAgICAgc3ogKj0gc2hhcGVbaV1cbiAgICB9XG4gIH0gZWxzZSBpZihzdHJpZGUubGVuZ3RoICE9PSBzaGFwZS5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJCYWQgc3RyaWRlIGxlbmd0aFwiKVxuICB9XG4gIGlmKCFvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSAwXG4gIH1cbiAgaWYodGFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICBpZihvZmZzZXQgPCAwIHx8IG9mZnNldCA+PSB0YXJyYXkubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPZmZzZXQgb3V0IG9mIHJhbmdlXCIpXG4gICAgfVxuICAgIHZhciBlID0gZW9yKHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbiAgICBpZihlIDwgMCB8fCBlID49IHRhcnJheS5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkFycmF5IHNoYXBlIG91dCBvZiBib3VuZHNcIilcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgb2Zmc2V0ID0gMFxuICB9XG4gIHJldHVybiBtYWtlVmlldyh0YXJyYXksIHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbn1cblxuZnVuY3Rpb24gZHR5cGUodmlldykge1xuICByZXR1cm4gYXJyYXlEVHlwZSh2aWV3LmRhdGEpXG59XG5cbmZ1bmN0aW9uIHplcm9zKHNoYXBlLCBkdHlwZSwgb3JkZXIpIHtcbiAgaWYoIWR0eXBlKSB7XG4gICAgZHR5cGUgPSBcImZsb2F0NjRcIlxuICB9XG4gIC8vRGVmYXVsdCByb3ctbWFqb3Igb3JkZXJcbiAgaWYoIW9yZGVyKSB7XG4gICAgb3JkZXIgPSBuZXcgQXJyYXkoc2hhcGUubGVuZ3RoKVxuICAgIGZvcih2YXIgaT1zaGFwZS5sZW5ndGgtMSwgaj0wOyBpPj0wOyAtLWksICsraikge1xuICAgICAgb3JkZXJbal0gPSBpXG4gICAgfVxuICB9XG4gIHZhciBzdHJpZGUgPSAgbmV3IEFycmF5KHNoYXBlLmxlbmd0aClcbiAgdmFyIHNpemUgPSAxXG4gIGZvcih2YXIgaT0wOyBpPHNoYXBlLmxlbmd0aDsgKytpKSB7XG4gICAgc3RyaWRlW29yZGVyW2ldXSA9IHNpemVcbiAgICBzaXplICo9IHNoYXBlW29yZGVyW2ldXVxuICB9XG4gIHZhciBidWZcbiAgc3dpdGNoKGR0eXBlKSB7XG4gICAgY2FzZSBcImludDhcIjpcbiAgICAgIGJ1ZiA9IG5ldyBJbnQ4QXJyYXkoc2l6ZSlcbiAgICBicmVha1xuICAgIGNhc2UgXCJpbnQxNlwiOlxuICAgICAgYnVmID0gbmV3IEludDE2QXJyYXkoc2l6ZSlcbiAgICBicmVha1xuICAgIGNhc2UgXCJpbnQzMlwiOlxuICAgICAgYnVmID0gbmV3IEludDMyQXJyYXkoc2l6ZSlcbiAgICBicmVha1xuICAgIGNhc2UgXCJ1aW50OFwiOlxuICAgICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSlcbiAgICBicmVha1xuICAgIGNhc2UgXCJ1aW50MTZcIjpcbiAgICAgIGJ1ZiA9IG5ldyBVaW50MTZBcnJheShzaXplKVxuICAgIGJyZWFrXG4gICAgY2FzZSBcInVpbnQzMlwiOlxuICAgICAgYnVmID0gbmV3IFVpbnQzMkFycmF5KHNpemUpXG4gICAgYnJlYWtcbiAgICBjYXNlIFwiZmxvYXQzMlwiOlxuICAgICAgYnVmID0gbmV3IEZsb2F0MzJBcnJheShzaXplKVxuICAgIGJyZWFrXG4gICAgY2FzZSBcImZsb2F0NjRcIjpcbiAgICAgIGJ1ZiA9IG5ldyBGbG9hdDY0QXJyYXkoc2l6ZSlcbiAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGRhdGEgdHlwZVwiKVxuICAgIGJyZWFrXG4gIH1cbiAgcmV0dXJuIG1ha2VWaWV3KGJ1Ziwgc2hhcGUsIHN0cmlkZSwgMClcbn1cblxuZnVuY3Rpb24gb3JkZXIodmlldykge1xuICByZXR1cm4gdG9vbHMub3JkZXIodmlldy5zdHJpZGUpXG59XG5cbmZ1bmN0aW9uIHNpemUodmlldykge1xuICB2YXIgc2hhcGUgPSB2aWV3LnNoYXBlXG4gICAgLCBkID0gc2hhcGUubGVuZ3RoXG4gICAgLCByID0gMSwgaVxuICBpZihkID09PSAwKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBmb3IoaT0wOyBpPGQ7ICsraSkge1xuICAgIHIgKj0gc2hhcGVbaV1cbiAgfVxuICByZXR1cm4gclxufVxuXG5mdW5jdGlvbiBwc3RyaWRlKHNoYXBlLCBvcmRlcikge1xuICB2YXIgaSA9IDAsIGQgPSBzaGFwZS5sZW5ndGhcbiAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShkKSwgcyA9IDFcbiAgaWYob3JkZXIpIHtcbiAgICBmb3IoaT0wOyBpPGQ7ICsraSkge1xuICAgICAgcmVzdWx0W29yZGVyW2ldXSA9IHNcbiAgICAgIHMgKj0gc2hhcGVbb3JkZXJbaV1dXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGZvcih2YXIgaT1kLTE7IGk+PTA7IC0taSkge1xuICAgICAgc3RyaWRlW2ldID0gc1xuICAgICAgcyAqPSBzaGFwZVtpXVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd3JhcFxubW9kdWxlLmV4cG9ydHMuemVyb3MgICAgPSB6ZXJvc1xubW9kdWxlLmV4cG9ydHMuZHR5cGUgICAgPSBkdHlwZVxubW9kdWxlLmV4cG9ydHMub3JkZXIgICAgPSBvcmRlclxubW9kdWxlLmV4cG9ydHMuc2l6ZSAgICAgPSBzaXplXG5tb2R1bGUuZXhwb3J0cy5zdHJpZGUgICA9IHBzdHJpZGVcbm1vZHVsZS5leHBvcnRzLmN0b3IgICAgID0gbWFrZVZpZXciLCJcbmZ1bmN0aW9uIGNvbXBhcmUxc3QoYSwgYikge1xuICByZXR1cm4gYVswXSAtIGJbMF07XG59XG5cbmZ1bmN0aW9uIG9yZGVyKHN0cmlkZSkge1xuICB2YXIgdGVybXMgPSBuZXcgQXJyYXkoc3RyaWRlLmxlbmd0aCk7XG4gIGZvcih2YXIgaT0wOyBpPHRlcm1zLmxlbmd0aDsgKytpKSB7XG4gICAgdGVybXNbaV0gPSBbTWF0aC5hYnMoc3RyaWRlW2ldKSwgaV07XG4gIH1cbiAgdGVybXMuc29ydChjb21wYXJlMXN0KTtcbiAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheSh0ZXJtcy5sZW5ndGgpO1xuICBmb3IodmFyIGk9MDsgaTxyZXN1bHQubGVuZ3RoOyArK2kpIHtcbiAgICByZXN1bHRbaV0gPSB0ZXJtc1tpXVsxXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnRzLm9yZGVyID0gb3JkZXI7XG5cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciB0b29scyA9IHJlcXVpcmUoXCIuL3Rvb2xzLmpzXCIpXG5cbnZhciBSRUNVUlNJT05fTElNSVQgPSAzMlxuXG5mdW5jdGlvbiBWaWV3TihkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgdGhpcy5kYXRhID0gZGF0YVxuICB0aGlzLnNoYXBlID0gc2hhcGVcbiAgdGhpcy5zdHJpZGUgPSBzdHJpZGVcbiAgdGhpcy5vZmZzZXQgPSBvZmZzZXRcbn1cblxuVmlld04ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcHRyID0gdGhpcy5vZmZzZXRcbiAgZm9yKHZhciBpPTA7IGk8dGhpcy5zaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIHB0ciArPSBhcmd1bWVudHNbaV0gKiB0aGlzLnN0cmlkZVtpXVxuICB9XG4gIHJldHVybiB0aGlzLmRhdGFbcHRyXVxufVxuVmlld04ucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcHRyID0gdGhpcy5vZmZzZXRcbiAgZm9yKHZhciBpPTA7IGk8dGhpcy5zaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIHB0ciArPSBhcmd1bWVudHNbaV0gKiB0aGlzLnN0cmlkZVtpXVxuICB9XG4gIHZhciB2ID0gYXJndW1lbnRzW3RoaXMuc2hhcGUubGVuZ3RoXVxuICB0aGlzLmRhdGFbcHRyXSA9IHZcbiAgcmV0dXJuIHZcbn1cblZpZXdOLnByb3RvdHlwZS5sbyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbnNoYXBlID0gdGhpcy5zaGFwZS5zbGljZSgwKVxuICB2YXIgbnN0cmlkZSA9IHRoaXMuc3RyaWRlLnNsaWNlKDApXG4gIHZhciBub2Zmc2V0ID0gdGhpcy5vZmZzZXRcbiAgZm9yKHZhciBpPTA7IGk8bnNoYXBlLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHggPSBhcmd1bWVudHNbaV1cbiAgICBpZih0eXBlb2YgeCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgeCB8PSAwXG4gICAgICBpZih4IDwgMCkge1xuICAgICAgICB4ID0gbnNoYXBlW2ldICsgeFxuICAgICAgfVxuICAgICAgbm9mZnNldCArPSB4ICogbnN0cmlkZVtpXVxuICAgICAgbnNoYXBlW2ldIC09IHhcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMuZGF0YSwgbnNoYXBlLCBuc3RyaWRlLCBub2Zmc2V0KVxufVxuVmlld04ucHJvdG90eXBlLmhpID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuc2hhcGUgPSBuZXcgQXJyYXkodGhpcy5zaGFwZS5sZW5ndGgpXG4gIGZvcih2YXIgaT0wOyBpPG5zaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIHZhciB4ID0gYXJndW1lbnRzW2ldXG4gICAgaWYodHlwZW9mIHggPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHggfD0gMFxuICAgICAgaWYoeCA8IDApIHtcbiAgICAgICAgeCA9IHRoaXMuc2hhcGVbaV0gKyB4XG4gICAgICB9XG4gICAgICBuc2hhcGVbaV0gPSB4XG4gICAgfSBlbHNlIHtcbiAgICAgIG5zaGFwZVtpXSA9IHRoaXMuc2hhcGVbaV1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMuZGF0YSwgbnNoYXBlLCB0aGlzLnN0cmlkZS5zbGljZSgwKSwgdGhpcy5vZmZzZXQpXG59XG5WaWV3Ti5wcm90b3R5cGUuc3RlcCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbnNoYXBlID0gdGhpcy5zaGFwZS5zbGljZSgwKVxuICB2YXIgbnN0cmlkZSA9IHRoaXMuc3RyaWRlLnNsaWNlKDApXG4gIHZhciBub2Zmc2V0ID0gdGhpcy5vZmZzZXRcbiAgZm9yKHZhciBpPTA7IGk8bnNoYXBlLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHMgPSBhcmd1bWVudHNbaV1cbiAgICBuc3RyaWRlW2ldICo9IHNcbiAgICBpZihzIDwgMCkge1xuICAgICAgbm9mZnNldCArPSB0aGlzLnN0cmlkZVtpXSAqICh0aGlzLnNoYXBlW2ldIC0gMSlcbiAgICAgIG5zaGFwZVtpXSA9IE1hdGguY2VpbCgtdGhpcy5zaGFwZVtpXSAvIHMpXG4gICAgfSBlbHNlIGlmKHMgPiAwKSB7XG4gICAgICBuc2hhcGVbaV0gPSBNYXRoLmNlaWwodGhpcy5zaGFwZVtpXSAvIHMpXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLmRhdGEsIG5zaGFwZSwgbnN0cmlkZSwgbm9mZnNldClcbn1cblZpZXdOLnByb3RvdHlwZS50cmFuc3Bvc2UgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5zaGFwZSA9IHRoaXMuc2hhcGUuc2xpY2UoMClcbiAgdmFyIG5zdHJpZGUgPSB0aGlzLnN0cmlkZS5zbGljZSgwKVxuICB2YXIgbm9mZnNldCA9IHRoaXMub2Zmc2V0XG4gIGZvcih2YXIgaT0wOyBpPG5zaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIHZhciBvcmQgPSBhcmd1bWVudHNbaV1cbiAgICBuc2hhcGVbaV0gPSB0aGlzLnNoYXBlW29yZF1cbiAgICBuc3RyaWRlW2ldID0gdGhpcy5zdHJpZGVbb3JkXVxuICB9XG4gIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLmRhdGEsIG5zaGFwZSwgbnN0cmlkZSwgbm9mZnNldClcbn1cblZpZXdOLnByb3RvdHlwZS5waWNrID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuc2hhcGUgPSBbXVxuICB2YXIgbnN0cmlkZSA9IFtdXG4gIHZhciBub2Zmc2V0ID0gdGhpcy5vZmZzZXRcbiAgZm9yKHZhciBpPTA7IGk8dGhpcy5zaGFwZS5sZW5ndGg7ICsraSkge1xuICAgIGlmKGFyZ3VtZW50c1tpXSA+PSAwKSB7XG4gICAgICBub2Zmc2V0ICs9IHRoaXMuc3RyaWRlW2ldICogYXJndW1lbnRzW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIG5zaGFwZS5wdXNoKHRoaXMuc2hhcGVbaV0pXG4gICAgICBuc3RyaWRlLnB1c2godGhpcy5zdHJpZGVbaV0pXG4gICAgfVxuICB9XG4gIHJldHVybiBDVE9SKHRoaXMuZGF0YSwgbnNoYXBlLCBuc3RyaWRlLCBub2Zmc2V0KVxufVxuXG5WaWV3Ti5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGJ1ZmZlciA9IFtdXG4gIHZhciBpbmRleCA9IG5ldyBBcnJheSh0aGlzLnNoYXBlLmxlbmd0aClcbiAgZm9yKHZhciBpPTA7IGk8aW5kZXgubGVuZ3RoOyArK2kpIHtcbiAgICBpbmRleFtpXSA9IDBcbiAgfVxuICB2YXIgcHRyID0gdGhpcy5vZmZzZXRcbiAgd2hpbGUodHJ1ZSkge1xuICAgIGZvcih2YXIgaT1pbmRleC5sZW5ndGgtMTsgaT49MDsgLS1pKSB7XG4gICAgICBpZihpbmRleFtpXSA9PT0gMCkge1xuICAgICAgICBidWZmZXIucHVzaChcIltcIilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfVxuICAgIHZhciBpID0gdGhpcy5zaGFwZS5sZW5ndGgtMVxuICAgIGJ1ZmZlci5wdXNoKHRoaXMuZGF0YVtwdHJdKVxuICAgIHdoaWxlKGk+PTApIHtcbiAgICAgIHB0ciArPSB0aGlzLnN0cmlkZVtpXVxuICAgICAgKytpbmRleFtpXVxuICAgICAgaWYoaW5kZXhbaV0gPj0gdGhpcy5zaGFwZVtpXSkge1xuICAgICAgICBidWZmZXIucHVzaChcIl1cIilcbiAgICAgICAgaWYoaSA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBidWZmZXIuam9pbihcIlwiKVxuICAgICAgICB9XG4gICAgICAgIHB0ciAtPSB0aGlzLnN0cmlkZVtpXSAqIHRoaXMuc2hhcGVbaV1cbiAgICAgICAgaW5kZXhbaS0tXSA9IDBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1ZmZlci5wdXNoKFwiLFwiKVxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBWaWV3MChkYXRhKSB7XG4gIHRoaXMuZGF0YSA9IGRhdGFcbiAgdGhpcy5zaGFwZSA9IFtdXG4gIHRoaXMuc3RyaWRlID0gW11cbiAgdGhpcy5vZmZzZXQgPSAwXG59XG5WaWV3MC5wcm90b3R5cGUuZ2V0ID1cblZpZXcwLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE51bWJlci5OYU5cbn1cblZpZXcwLnByb3RvdHlwZS5sbyA9XG5WaWV3MC5wcm90b3R5cGUuaGkgPVxuVmlldzAucHJvdG90eXBlLnN0ZXAgPVxuVmlldzAucHJvdG90eXBlLnRyYW5zcG9zZSA9XG5WaWV3MC5wcm90b3R5cGUucGljayA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFZpZXcwKHRoaXMuZGF0YSlcbn1cblZpZXcwLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJbXVwiXG59XG5cblxuZnVuY3Rpb24gVmlldzEoZGF0YSwgc2hhcGUsIHN0cmlkZSwgb2Zmc2V0KSB7XG4gIHRoaXMuZGF0YSA9IGRhdGFcbiAgdGhpcy5zaGFwZSA9IHNoYXBlXG4gIHRoaXMuc3RyaWRlID0gc3RyaWRlXG4gIHRoaXMub2Zmc2V0ID0gb2Zmc2V0XG59XG5WaWV3MS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oaSkge1xuICByZXR1cm4gdGhpcy5kYXRhW2kgKiB0aGlzLnN0cmlkZVswXSArIHRoaXMub2Zmc2V0XVxufVxuVmlldzEucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGksIHYpIHtcbiAgdGhpcy5kYXRhW2kgKiB0aGlzLnN0cmlkZVswXSArIHRoaXMub2Zmc2V0XSA9IHZcbiAgcmV0dXJuIHZcbn1cblZpZXcxLnByb3RvdHlwZS5sbyA9IFZpZXdOLnByb3RvdHlwZS5sb1xuVmlldzEucHJvdG90eXBlLmhpID0gVmlld04ucHJvdG90eXBlLmhpXG5WaWV3MS5wcm90b3R5cGUuc3RlcCA9IFZpZXdOLnByb3RvdHlwZS5zdGVwXG5WaWV3MS5wcm90b3R5cGUudHJhbnNwb3NlID0gVmlld04ucHJvdG90eXBlLnRyYW5zcG9zZVxuVmlldzEucHJvdG90eXBlLnBpY2sgPSBWaWV3Ti5wcm90b3R5cGUucGlja1xuVmlldzEucHJvdG90eXBlLnRvU3RyaW5nID0gVmlld04ucHJvdG90eXBlLnRvU3RyaW5nXG5cblxuZnVuY3Rpb24gVmlldzIoZGF0YSwgc2hhcGUsIHN0cmlkZSwgb2Zmc2V0KSB7XG4gIHRoaXMuZGF0YSA9IGRhdGFcbiAgdGhpcy5zaGFwZSA9IHNoYXBlXG4gIHRoaXMuc3RyaWRlID0gc3RyaWRlXG4gIHRoaXMub2Zmc2V0ID0gb2Zmc2V0XG59XG5WaWV3Mi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oaSwgaikge1xuICByZXR1cm4gdGhpcy5kYXRhW3RoaXMub2Zmc2V0ICsgaSAqIHRoaXMuc3RyaWRlWzBdICsgaiAqIHRoaXMuc3RyaWRlWzFdXVxufVxuVmlldzIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGksIGosIHYpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YVt0aGlzLm9mZnNldCArIGkgKiB0aGlzLnN0cmlkZVswXSArIGogKiB0aGlzLnN0cmlkZVsxXV0gPSB2XG59XG5WaWV3Mi5wcm90b3R5cGUuaGkgPSBWaWV3Ti5wcm90b3R5cGUuaGlcblZpZXcyLnByb3RvdHlwZS5sbyA9IFZpZXdOLnByb3RvdHlwZS5sb1xuVmlldzIucHJvdG90eXBlLnN0ZXAgPSBWaWV3Ti5wcm90b3R5cGUuc3RlcFxuVmlldzIucHJvdG90eXBlLnRyYW5zcG9zZSA9IFZpZXdOLnByb3RvdHlwZS50cmFuc3Bvc2VcblZpZXcyLnByb3RvdHlwZS5waWNrID0gVmlld04ucHJvdG90eXBlLnBpY2tcblZpZXcyLnByb3RvdHlwZS50b1N0cmluZyA9IFZpZXdOLnByb3RvdHlwZS50b1N0cmluZ1xuXG5cbmZ1bmN0aW9uIFZpZXczKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldCkge1xuICB0aGlzLmRhdGEgPSBkYXRhXG4gIHRoaXMuc2hhcGUgPSBzaGFwZVxuICB0aGlzLnN0cmlkZSA9IHN0cmlkZVxuICB0aGlzLm9mZnNldCA9IG9mZnNldFxufVxuVmlldzMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGksIGosIGspIHtcbiAgcmV0dXJuIHRoaXMuZGF0YVt0aGlzLm9mZnNldCArIGkgKiB0aGlzLnN0cmlkZVswXSArIGogKiB0aGlzLnN0cmlkZVsxXSArIGsgKiB0aGlzLnN0cmlkZVsyXV1cbn1cblZpZXczLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihpLCBqLCBrLCB2KSB7XG4gIHJldHVybiB0aGlzLmRhdGFbdGhpcy5vZmZzZXQgKyBpICogdGhpcy5zdHJpZGVbMF0gKyBqICogdGhpcy5zdHJpZGVbMV0gKyBrICogdGhpcy5zdHJpZGVbMl1dID0gdlxufVxuVmlldzMucHJvdG90eXBlLmhpID0gVmlld04ucHJvdG90eXBlLmhpXG5WaWV3My5wcm90b3R5cGUubG8gPSBWaWV3Ti5wcm90b3R5cGUubG9cblZpZXczLnByb3RvdHlwZS5zdGVwID0gVmlld04ucHJvdG90eXBlLnN0ZXBcblZpZXczLnByb3RvdHlwZS50cmFuc3Bvc2UgPSBWaWV3Ti5wcm90b3R5cGUudHJhbnNwb3NlXG5WaWV3My5wcm90b3R5cGUucGljayA9IFZpZXdOLnByb3RvdHlwZS5waWNrXG5WaWV3My5wcm90b3R5cGUudG9TdHJpbmcgPSBWaWV3Ti5wcm90b3R5cGUudG9TdHJpbmdcblxuXG5mdW5jdGlvbiBDVE9SKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldCkge1xuICBzd2l0Y2goc2hhcGUubGVuZ3RoKSB7XG4gICAgY2FzZSAwOiAgIHJldHVybiBuZXcgVmlldzAoZGF0YSlcbiAgICBjYXNlIDE6ICAgcmV0dXJuIG5ldyBWaWV3MShkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpXG4gICAgY2FzZSAyOiAgIHJldHVybiBuZXcgVmlldzIoZGF0YSwgc2hhcGUsIHN0cmlkZSwgb2Zmc2V0KVxuICAgIGNhc2UgMzogICByZXR1cm4gbmV3IFZpZXczKGRhdGEsIHNoYXBlLCBzdHJpZGUsIG9mZnNldClcbiAgICBkZWZhdWx0OiAgcmV0dXJuIG5ldyBWaWV3TihkYXRhLCBzaGFwZSwgc3RyaWRlLCBvZmZzZXQpXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDVE9SXG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgYml0cyA9IHJlcXVpcmUoXCJiaXQtdHdpZGRsZVwiKVxudmFyIHBvb2wgPSByZXF1aXJlKFwidHlwZWRhcnJheS1wb29sXCIpXG52YXIgbmRhcnJheSA9IHJlcXVpcmUoXCJuZGFycmF5XCIpXG52YXIgb3BzID0gcmVxdWlyZShcIm5kYXJyYXktb3BzXCIpXG52YXIgZmZ0ID0gcmVxdWlyZShcIm5kYXJyYXktZmZ0XCIpXG5cbmZ1bmN0aW9uIHplcm8oYXJyLCBsbywgaGkpIHtcbiAgZm9yKHZhciBpPWxvOyBpPGhpOyArK2kpIHtcbiAgICBhcnJbaV0gPSAwLjBcbiAgfVxufVxuXG5mdW5jdGlvbiBzcXVhcmUoeCwgeSkge1xuICB2YXIgbiA9IHgubGVuZ3RoLCBuMiA9IE1hdGguY2VpbCgwLjUqbil8MFxuICB4WzBdID0geVswXSA9IDAuMFxuICBmb3IodmFyIGk9MTsgaTxuMjsgKytpKSB7XG4gICAgdmFyIGEgPSB4W2ldLCBiID0geVtpXVxuICAgIHhbbi1pXSA9IHhbaV0gPSBhKmEgKyBiKmJcbiAgICB5W24taV0gPSB5W2ldID0gMC4wXG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFBlcmlvZCh4LCBsbywgaGksIHNjYWxlX2YpIHtcbiAgLy8xc3QgcGFzcyBjb21wdXRlIGJlc3QgdmFsXG4gIHZhciBsb2NfbSA9IDAuMFxuICBmb3IodmFyIGk9bG87IGk8aGk7ICsraSkge1xuICAgIGxvY19tID0gTWF0aC5tYXgobG9jX20sIHhbaV0pXG4gIH1cbiAgLy8ybmQgcGFzcyBjb21wdXRlIG1heFxuICB2YXIgdGhyZXNob2xkID0gbG9jX20gKiBzY2FsZV9mXG4gIGZvcih2YXIgaT1sbzsgaTxoaTsgKytpKSB7XG4gICAgaWYoeFtpXSA+IHRocmVzaG9sZCkge1xuICAgICAgdmFyIGJlc3QgPSB4W2ldXG4gICAgICB2YXIgciA9IGlcbiAgICAgIGZvcih2YXIgaj1pOyBqIDwgaGkgJiYgeFtqXSA+IHRocmVzaG9sZDsgKytqKSB7XG4gICAgICAgIGlmKHhbal0gPiBiZXN0KSB7XG4gICAgICAgICAgYmVzdCA9IHhbal1cbiAgICAgICAgICByID0galxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgeTAgPSB4W3ItMV0sIHkxID0geFtyXSwgeTIgPSB4W3IrMV1cbiAgICAgIHZhciBkZW5vbSA9IHkyIC0geTEgKyB5MFxuICAgICAgaWYoTWF0aC5hYnMoZGVub20pIDwgMWUtNikge1xuICAgICAgICByZXR1cm4gclxuICAgICAgfVxuICAgICAgdmFyIG51bWVyID0geTAgLSB5MlxuICAgICAgcmV0dXJuIHIgKyAwLjUgKiBudW1lciAvIGRlbm9tXG4gICAgfVxuICB9XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGRldGVjdFBpdGNoKHNpZ25hbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICB2YXIgeHNcbiAgaWYoc2lnbmFsLnNoYXBlKSB7XG4gICAgeHMgPSBzaWduYWwuc2hhcGVbMF1cbiAgfSBlbHNlIHtcbiAgICB4cyA9IHNpZ25hbC5sZW5ndGhcbiAgfVxuICBcbiAgdmFyIGksIGosIGtcbiAgdmFyIG4gPSBiaXRzLm5leHRQb3cyKDIqeHMpXG4gIHZhciByZV9hcnIgPSBwb29sLm1hbGxvY0Zsb2F0KG4pXG4gIHZhciBpbV9hcnIgPSBwb29sLm1hbGxvY0Zsb2F0KG4pXG4gIHZhciBYID0gbmRhcnJheS5jdG9yKHJlX2FyciwgW25dLCBbMV0sIDApXG4gIHZhciBZID0gbmRhcnJheS5jdG9yKGltX2FyciwgW25dLCBbMV0sIDApXG4gIFxuICAvL0luaXRpYWxpemUgYXJyYXkgZGVwZW5kaW5nIG9uIGlmIGl0IGlzIGEgdHlwZWQgYXJyYXlcbiAgaWYoc2lnbmFsLnNoYXBlKSB7XG4gICAgWC5zaGFwZVswXSA9IHhzXG4gICAgb3BzLmFzc2lnbihYLCBzaWduYWwpXG4gICAgWC5zaGFwZVswXSA9IG5cbiAgfSBlbHNlIHtcbiAgICByZV9hcnIuc2V0KHNpZ25hbClcbiAgfVxuICB6ZXJvKHJlX2FyciwgeHMsIG4pXG4gIHplcm8oaW1fYXJyLCAwLCBuKVxuICBcbiAgLy9BdXRvY29ycmVsYXRlXG4gIGZmdCgxLCBYLCBZKVxuICBzcXVhcmUocmVfYXJyLCBpbV9hcnIpXG4gIGZmdCgtMSwgWCwgWSlcbiAgXG4gIC8vRGV0ZWN0IHBpdGNoXG4gIHZhciB0aHJlc2hvbGQgPSBvcHRpb25zLnRocmVzaG9sZCB8fCAwLjlcbiAgdmFyIHBlcmlvZCA9IGZpbmRQZXJpb2QoXG4gICAgICAgICAgcmVfYXJyLFxuICAgICAgICAgIG9wdGlvbnMuc3RhcnRfYmluIHx8IDE2LFxuICAgICAgICAgIHhzPj4+MSxcbiAgICAgICAgICB0aHJlc2hvbGQpXG4gIFxuICAvL0ZyZWUgdGVtcG9yYXJ5IGFycmF5c1xuICBwb29sLmZyZWVGbG9hdChyZV9hcnIpXG4gIHBvb2wuZnJlZUZsb2F0KGltX2FycilcbiAgXG4gIHJldHVybiBwZXJpb2Rcbn1cbm1vZHVsZS5leHBvcnRzID0gZGV0ZWN0UGl0Y2giLCJcInVzZSBzdHJpY3RcIlxuXG4vLyBTbGljZXMgYSBzdHJlYW0gb2YgZnJhbWVzIGludG8gYSBzdHJlYW0gb2Ygb3ZlcmxhcHBpbmcgd2luZG93c1xuLy8gVGhlIHNpemUgb2YgZWFjaCBmcmFtZSBpcyB0aGUgc2FtZSBhcyB0aGUgc2l6ZSBvXG5mdW5jdGlvbiBjcmVhdGVIb3BTdHJlYW0oZnJhbWVfc2l6ZSwgaG9wX3NpemUsIG9uRnJhbWUsIG1heF9kYXRhX3NpemUpIHtcbiAgaWYoaG9wX3NpemUgPiBmcmFtZV9zaXplKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSG9wIHNpemUgbXVzdCBiZSBzbWFsbGVyIHRoYW4gZnJhbWUgc2l6ZVwiKVxuICB9XG4gIG1heF9kYXRhX3NpemUgICAgID0gbWF4X2RhdGFfc2l6ZSB8fCBmcmFtZV9zaXplXG4gIHZhciBidWZmZXIgICAgICAgID0gbmV3IEZsb2F0MzJBcnJheShmcmFtZV9zaXplICsgbWF4X2RhdGFfc2l6ZSlcbiAgdmFyIHB0ciAgICAgICAgICAgPSAwXG4gIHZhciBmcmFtZV9zbGljZXMgID0gW11cbiAgZm9yKHZhciBqPTA7IGorZnJhbWVfc2l6ZTw9YnVmZmVyLmxlbmd0aDsgais9aG9wX3NpemUpIHtcbiAgICBmcmFtZV9zbGljZXMucHVzaChidWZmZXIuc3ViYXJyYXkoaiwgaitmcmFtZV9zaXplKSlcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24gcHJvY2Vzc0hvcERhdGEoZGF0YSkge1xuICAgIHZhciBpLCBqLCBrXG4gICAgYnVmZmVyLnNldChkYXRhLCBwdHIpXG4gICAgcHRyICs9IGRhdGEubGVuZ3RoXG4gICAgZm9yKGk9MCwgaj0wOyBqK2ZyYW1lX3NpemU8PXB0cjsgKytpLCBqKz1ob3Bfc2l6ZSkge1xuICAgICAgb25GcmFtZShmcmFtZV9zbGljZXNbaV0pXG4gICAgfVxuICAgIGZvcihrPTA7IGo8cHRyOyApIHtcbiAgICAgIGJ1ZmZlci5zZXQoZnJhbWVfc2xpY2VzW2ldLCBrKVxuICAgICAgdmFyIG5ob3BzID0gTWF0aC5jZWlsKChrK2ZyYW1lX3NpemUpIC8gaG9wX3NpemUpfDBcbiAgICAgIHZhciBucHRyICA9IG5ob3BzICogaG9wX3NpemVcbiAgICAgIGlmKG5wdHIgIT09IGsrZnJhbWVfc2l6ZSkge1xuICAgICAgICBuaG9wcyAtPSAxXG4gICAgICAgIG5wdHIgLT0gaG9wX3NpemVcbiAgICAgIH1cbiAgICAgIGkgKz0gbmhvcHNcbiAgICAgIGogKz0gKG5wdHIgLSBrKVxuICAgICAgayAgPSBucHRyXG4gICAgfVxuICAgIHB0ciArPSBrIC0galxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlSG9wU3RyZWFtXG4iLCJcInVzZSBzdHJpY3RcIlxuXG5mdW5jdGlvbiBvdmVybGFwQWRkKGZyYW1lX3NpemUsIGhvcF9zaXplLCBvbkZyYW1lKSB7XG4gIGlmKGhvcF9zaXplID4gZnJhbWVfc2l6ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkhvcCBzaXplIG11c3QgYmUgc21hbGxlciB0aGFuIGZyYW1lIHNpemVcIilcbiAgfVxuICB2YXIgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSgyICogZnJhbWVfc2l6ZSlcbiAgdmFyIGZpcnN0X3NsaWNlID0gYnVmZmVyLnN1YmFycmF5KDAsIGZyYW1lX3NpemUpXG4gIHZhciBzZWNvbmRfc2xpY2UgPSBidWZmZXIuc3ViYXJyYXkoZnJhbWVfc2l6ZSlcbiAgdmFyIHNwdHIgPSAwLCBlcHRyID0gMFxuICByZXR1cm4gZnVuY3Rpb24gcHJvY2Vzc092ZXJsYXBBZGQoZGF0YSkge1xuICAgIHZhciBuID0gZnJhbWVfc2l6ZVxuICAgIHZhciBpLCBqLCBrXG4gICAgdmFyIEIgPSBidWZmZXJcbiAgICBcbiAgICAvL0FkZCBkYXRhIHRvIGZyYW1lXG4gICAgayA9IGVwdHJcbiAgICBmb3IoaT0wLCBqPXNwdHI7IGo8ayAmJiBpPG47ICsraSwgKytqKSB7XG4gICAgICBCW2pdICs9IGRhdGFbaV1cbiAgICB9XG4gICAgZm9yKDsgaTxuOyArK2ksICsraikge1xuICAgICAgQltqXSA9IGRhdGFbaV1cbiAgICB9XG4gICAgc3B0ciArPSBob3Bfc2l6ZVxuICAgIGVwdHIgPSBqXG4gICAgXG4gICAgLy9FbWl0IGZyYW1lIGlmIG5lY2Vzc2FyeVxuICAgIGlmKHNwdHIgPj0gZnJhbWVfc2l6ZSkge1xuICAgICAgb25GcmFtZShmaXJzdF9zbGljZSlcbiAgICAgIGZpcnN0X3NsaWNlLnNldChzZWNvbmRfc2xpY2UpXG4gICAgICBzcHRyIC09IGZyYW1lX3NpemVcbiAgICAgIGVwdHIgLT0gZnJhbWVfc2l6ZVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG92ZXJsYXBBZGQiLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgYml0cyA9IHJlcXVpcmUoXCJiaXQtdHdpZGRsZVwiKVxudmFyIGR1cCA9IHJlcXVpcmUoXCJkdXBcIilcbmlmKCFnbG9iYWwuX19UWVBFREFSUkFZX1BPT0wpIHtcbiAgZ2xvYmFsLl9fVFlQRURBUlJBWV9QT09MID0ge1xuICAgICAgVUlOVDggICA6IGR1cChbMzIsIDBdKVxuICAgICwgVUlOVDE2ICA6IGR1cChbMzIsIDBdKVxuICAgICwgVUlOVDMyICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UOCAgICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UMTYgICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UMzIgICA6IGR1cChbMzIsIDBdKVxuICAgICwgRkxPQVQgICA6IGR1cChbMzIsIDBdKVxuICAgICwgRE9VQkxFICA6IGR1cChbMzIsIDBdKVxuICAgICwgREFUQSAgICA6IGR1cChbMzIsIDBdKVxuICB9XG59XG52YXIgUE9PTCA9IGdsb2JhbC5fX1RZUEVEQVJSQVlfUE9PTFxudmFyIFVJTlQ4ICAgPSBQT09MLlVJTlQ4XG4gICwgVUlOVDE2ICA9IFBPT0wuVUlOVDE2XG4gICwgVUlOVDMyICA9IFBPT0wuVUlOVDMyXG4gICwgSU5UOCAgICA9IFBPT0wuSU5UOFxuICAsIElOVDE2ICAgPSBQT09MLklOVDE2XG4gICwgSU5UMzIgICA9IFBPT0wuSU5UMzJcbiAgLCBGTE9BVCAgID0gUE9PTC5GTE9BVFxuICAsIERPVUJMRSAgPSBQT09MLkRPVUJMRVxuICAsIERBVEEgICAgPSBQT09MLkRBVEFcblxuZXhwb3J0cy5mcmVlID0gZnVuY3Rpb24gZnJlZShhcnJheSkge1xuICBpZihhcnJheSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgdmFyIG4gPSBhcnJheS5ieXRlTGVuZ3RofDBcbiAgICAgICwgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgICBEQVRBW2xvZ19uXS5wdXNoKGFycmF5KVxuICB9IGVsc2Uge1xuICAgIHZhciBuID0gYXJyYXkubGVuZ3RofDBcbiAgICAgICwgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgICBpZihhcnJheSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgIFVJTlQ4W2xvZ19uXS5wdXNoKGFycmF5KVxuICAgIH0gZWxzZSBpZihhcnJheSBpbnN0YW5jZW9mIFVpbnQxNkFycmF5KSB7XG4gICAgICBVSU5UMTZbbG9nX25dLnB1c2goYXJyYXkpXG4gICAgfSBlbHNlIGlmKGFycmF5IGluc3RhbmNlb2YgVWludDMyQXJyYXkpIHtcbiAgICAgIFVJTlQzMltsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBJbnQ4QXJyYXkpIHtcbiAgICAgIElOVDhbbG9nX25dLnB1c2goYXJyYXkpXG4gICAgfSBlbHNlIGlmKGFycmF5IGluc3RhbmNlb2YgSW50MTZBcnJheSkge1xuICAgICAgSU5UMTZbbG9nX25dLnB1c2goYXJyYXkpXG4gICAgfSBlbHNlIGlmKGFycmF5IGluc3RhbmNlb2YgSW50MzJBcnJheSkge1xuICAgICAgSU5UMzJbbG9nX25dLnB1c2goYXJyYXkpXG4gICAgfSBlbHNlIGlmKGFycmF5IGluc3RhbmNlb2YgRmxvYXQzMkFycmF5KSB7XG4gICAgICBGTE9BVFtsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9IGVsc2UgaWYoYXJyYXkgaW5zdGFuY2VvZiBGbG9hdDY0QXJyYXkpIHtcbiAgICAgIERPVUJMRVtsb2dfbl0ucHVzaChhcnJheSlcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0cy5mcmVlVWludDggPSBmdW5jdGlvbiBmcmVlVWludDgoYXJyYXkpIHtcbiAgVUlOVDhbYml0cy5sb2cyKGFycmF5Lmxlbmd0aCldLnB1c2goYXJyYXkpXG59XG5cbmV4cG9ydHMuZnJlZVVpbnQxNiA9IGZ1bmN0aW9uIGZyZWVVaW50MTYoYXJyYXkpIHtcbiAgVUlOVDE2W2JpdHMubG9nMihhcnJheS5sZW5ndGgpXS5wdXNoKGFycmF5KVxufVxuXG5leHBvcnRzLmZyZWVVaW50MzIgPSBmdW5jdGlvbiBmcmVlVWludDMyKGFycmF5KSB7XG4gIFVJTlQzMltiaXRzLmxvZzIoYXJyYXkubGVuZ3RoKV0ucHVzaChhcnJheSlcbn1cblxuZXhwb3J0cy5mcmVlSW50OCA9IGZ1bmN0aW9uIGZyZWVJbnQ4KGFycmF5KSB7XG4gIElOVDhbYml0cy5sb2cyKGFycmF5Lmxlbmd0aCldLnB1c2goYXJyYXkpXG59XG5cbmV4cG9ydHMuZnJlZUludDE2ID0gZnVuY3Rpb24gZnJlZUludDE2KGFycmF5KSB7XG4gIElOVDE2W2JpdHMubG9nMihhcnJheS5sZW5ndGgpXS5wdXNoKGFycmF5KVxufVxuXG5leHBvcnRzLmZyZWVJbnQzMiA9IGZ1bmN0aW9uIGZyZWVJbnQzMihhcnJheSkge1xuICBJTlQzMltiaXRzLmxvZzIoYXJyYXkubGVuZ3RoKV0ucHVzaChhcnJheSlcbn1cblxuZXhwb3J0cy5mcmVlRmxvYXQzMiA9IGV4cG9ydHMuZnJlZUZsb2F0ID0gZnVuY3Rpb24gZnJlZUZsb2F0KGFycmF5KSB7XG4gIEZMT0FUW2JpdHMubG9nMihhcnJheS5sZW5ndGgpXS5wdXNoKGFycmF5KVxufVxuXG5leHBvcnRzLmZyZWVGbG9hdDY0ID0gZXhwb3J0cy5mcmVlRG91YmxlID0gZnVuY3Rpb24gZnJlZURvdWJsZShhcnJheSkge1xuICBET1VCTEVbYml0cy5sb2cyKGFycmF5Lmxlbmd0aCldLnB1c2goYXJyYXkpXG59XG5cbmV4cG9ydHMuZnJlZUFycmF5QnVmZmVyID0gZnVuY3Rpb24gZnJlZUFycmF5QnVmZmVyKGFycmF5KSB7XG4gIERBVEFbYml0cy5sb2cyKGFycmF5Lmxlbmd0aCldLnB1c2goYXJyYXkpXG59XG5cbmV4cG9ydHMubWFsbG9jID0gZnVuY3Rpb24gbWFsbG9jKG4sIGR0eXBlKSB7XG4gIG4gPSBiaXRzLm5leHRQb3cyKG4pXG4gIHZhciBsb2dfbiA9IGJpdHMubG9nMihuKVxuICBpZihkdHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGQgPSBEQVRBW2xvZ19uXVxuICAgIGlmKGQubGVuZ3RoID4gMCkge1xuICAgICAgdmFyIHIgPSBkW2QubGVuZ3RoLTFdXG4gICAgICBkLnBvcCgpXG4gICAgICByZXR1cm4gclxuICAgIH1cbiAgICByZXR1cm4gbmV3IEFycmF5QnVmZmVyKG4pXG4gIH0gZWxzZSB7XG4gICAgc3dpdGNoKGR0eXBlKSB7XG4gICAgICBjYXNlIFwidWludDhcIjpcbiAgICAgICAgdmFyIHU4ID0gVUlOVDhbbG9nX25dXG4gICAgICAgIGlmKHU4Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4gdTgucG9wKClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobilcbiAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJ1aW50MTZcIjpcbiAgICAgICAgdmFyIHUxNiA9IFVJTlQxNltsb2dfbl1cbiAgICAgICAgaWYodTE2Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4gdTE2LnBvcCgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBVaW50MTZBcnJheShuKVxuICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcInVpbnQzMlwiOlxuICAgICAgICB2YXIgdTMyID0gVUlOVDMyW2xvZ19uXVxuICAgICAgICBpZih1MzIubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB1MzIucG9wKClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQzMkFycmF5KG4pXG4gICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiaW50OFwiOlxuICAgICAgICB2YXIgaTggPSBJTlQ4W2xvZ19uXVxuICAgICAgICBpZihpOC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIGk4LnBvcCgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBJbnQ4QXJyYXkobilcbiAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJpbnQxNlwiOlxuICAgICAgICB2YXIgaTE2ID0gSU5UMTZbbG9nX25dXG4gICAgICAgIGlmKGkxNi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIGkxNi5wb3AoKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgSW50MTZBcnJheShuKVxuICAgICAgYnJlYWtcblxuICAgICAgY2FzZSBcImludDMyXCI6XG4gICAgICAgIHZhciBpMzIgPSBJTlQzMltsb2dfbl1cbiAgICAgICAgaWYoaTMyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4gaTMyLnBvcCgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBJbnQzMkFycmF5KG4pXG4gICAgICBicmVha1xuXG4gICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgIGNhc2UgXCJmbG9hdDMyXCI6XG4gICAgICAgIHZhciBmID0gRkxPQVRbbG9nX25dXG4gICAgICAgIGlmKGYubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiBmLnBvcCgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkobilcbiAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgIGNhc2UgXCJmbG9hdDY0XCI6XG4gICAgICAgIHZhciBkZCA9IERPVUJMRVtsb2dfbl1cbiAgICAgICAgaWYoZGQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiBkZC5wb3AoKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgRmxvYXQ2NEFycmF5KG4pXG4gICAgICBicmVha1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbFxufVxuXG5leHBvcnRzLm1hbGxvY1VpbnQ4ID0gZnVuY3Rpb24gbWFsbG9jVWludDgobikge1xuICBuID0gYml0cy5uZXh0UG93MihuKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgdmFyIGNhY2hlID0gVUlOVDhbbG9nX25dXG4gIGlmKGNhY2hlLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gY2FjaGUucG9wKClcbiAgfVxuICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobilcbn1cblxuZXhwb3J0cy5tYWxsb2NVaW50MTYgPSBmdW5jdGlvbiBtYWxsb2NVaW50MTYobikge1xuICBuID0gYml0cy5uZXh0UG93MihuKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgdmFyIGNhY2hlID0gVUlOVDE2W2xvZ19uXVxuICBpZihjYWNoZS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGNhY2hlLnBvcCgpXG4gIH1cbiAgcmV0dXJuIG5ldyBVaW50MTZBcnJheShuKVxufVxuXG5leHBvcnRzLm1hbGxvY1VpbnQzMiA9IGZ1bmN0aW9uIG1hbGxvY1VpbnQzMihuKSB7XG4gIG4gPSBiaXRzLm5leHRQb3cyKG4pXG4gIHZhciBsb2dfbiA9IGJpdHMubG9nMihuKVxuICB2YXIgY2FjaGUgPSBVSU5UMzJbbG9nX25dXG4gIGlmKGNhY2hlLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gY2FjaGUucG9wKClcbiAgfVxuICByZXR1cm4gbmV3IFVpbnQzMkFycmF5KG4pXG59XG5cbmV4cG9ydHMubWFsbG9jSW50OCA9IGZ1bmN0aW9uIG1hbGxvY0ludDgobikge1xuICBuID0gYml0cy5uZXh0UG93MihuKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgdmFyIGNhY2hlID0gSU5UOFtsb2dfbl1cbiAgaWYoY2FjaGUubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBjYWNoZS5wb3AoKVxuICB9XG4gIHJldHVybiBuZXcgSW50OEFycmF5KG4pXG59XG5cbmV4cG9ydHMubWFsbG9jSW50MTYgPSBmdW5jdGlvbiBtYWxsb2NJbnQxNihuKSB7XG4gIG4gPSBiaXRzLm5leHRQb3cyKG4pXG4gIHZhciBsb2dfbiA9IGJpdHMubG9nMihuKVxuICB2YXIgY2FjaGUgPSBJTlQxNltsb2dfbl1cbiAgaWYoY2FjaGUubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBjYWNoZS5wb3AoKVxuICB9XG4gIHJldHVybiBuZXcgSW50MTZBcnJheShuKVxufVxuXG5leHBvcnRzLm1hbGxvY0ludDMyID0gZnVuY3Rpb24gbWFsbG9jSW50MzIobikge1xuICBuID0gYml0cy5uZXh0UG93MihuKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgdmFyIGNhY2hlID0gSU5UMzJbbG9nX25dXG4gIGlmKGNhY2hlLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gY2FjaGUucG9wKClcbiAgfVxuICByZXR1cm4gbmV3IEludDMyQXJyYXkobilcbn1cblxuZXhwb3J0cy5tYWxsb2NGbG9hdDMyID0gZXhwb3J0cy5tYWxsb2NGbG9hdCA9IGZ1bmN0aW9uIG1hbGxvY0Zsb2F0KG4pIHtcbiAgbiA9IGJpdHMubmV4dFBvdzIobilcbiAgdmFyIGxvZ19uID0gYml0cy5sb2cyKG4pXG4gIHZhciBjYWNoZSA9IEZMT0FUW2xvZ19uXVxuICBpZihjYWNoZS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGNhY2hlLnBvcCgpXG4gIH1cbiAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkobilcbn1cblxuZXhwb3J0cy5tYWxsb2NGbG9hdDY0ID0gZXhwb3J0cy5tYWxsb2NEb3VibGUgPSBmdW5jdGlvbiBtYWxsb2NEb3VibGUobikge1xuICBuID0gYml0cy5uZXh0UG93MihuKVxuICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobilcbiAgdmFyIGNhY2hlID0gRE9VQkxFW2xvZ19uXVxuICBpZihjYWNoZS5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGNhY2hlLnBvcCgpXG4gIH1cbiAgcmV0dXJuIG5ldyBGbG9hdDY0QXJyYXkobilcbn1cblxuZXhwb3J0cy5tYWxsb2NBcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIG1hbGxvY0FycmF5QnVmZmVyKG4pIHtcbiAgbiA9IGJpdHMubmV4dFBvdzIobilcbiAgdmFyIGxvZ19uID0gYml0cy5sb2cyKG4pXG4gIHZhciBjYWNoZSA9IERBVEFbbG9nX25dXG4gIGlmKGNhY2hlLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gY2FjaGUucG9wKClcbiAgfVxuICByZXR1cm4gbmV3IEFycmF5QnVmZmVyKG4pXG59XG5cbmV4cG9ydHMuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUoKSB7XG4gIGZvcih2YXIgaT0wOyBpPDMyOyArK2kpIHtcbiAgICBVSU5UOFtpXS5sZW5ndGggPSAwXG4gICAgVUlOVDE2W2ldLmxlbmd0aCA9IDBcbiAgICBVSU5UMzJbaV0ubGVuZ3RoID0gMFxuICAgIElOVDhbaV0ubGVuZ3RoID0gMFxuICAgIElOVDE2W2ldLmxlbmd0aCA9IDBcbiAgICBJTlQzMltpXS5sZW5ndGggPSAwXG4gICAgRkxPQVRbaV0ubGVuZ3RoID0gMFxuICAgIERPVUJMRVtpXS5sZW5ndGggPSAwXG4gICAgREFUQVtpXS5sZW5ndGggPSAwXG4gIH1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBmcmFtZUhvcCA9IHJlcXVpcmUoXCJmcmFtZS1ob3BcIilcbnZhciBvdmVybGFwQWRkID0gcmVxdWlyZShcIm92ZXJsYXAtYWRkXCIpXG52YXIgZGV0ZWN0UGl0Y2ggPSByZXF1aXJlKFwiZGV0ZWN0LXBpdGNoXCIpXG52YXIgcG9vbCA9IHJlcXVpcmUoXCJ0eXBlZGFycmF5LXBvb2xcIilcblxuZnVuY3Rpb24gY3JlYXRlV2luZG93KG4pIHtcbiAgdmFyIHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobilcbiAgZm9yKHZhciBpPTA7IGk8bjsgKytpKSB7XG4gICAgdmFyIHQgPSBpIC8gKG4tMSlcbiAgICByZXN1bHRbaV0gPSAwLjUgKiAoMS4wIC0gTWF0aC5jb3MoMi4wKk1hdGguUEkgKiB0KSlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVdpbmRvdyh3LCBob3Bfc2l6ZSkge1xuICB2YXIgbiA9IHcubGVuZ3RoXG4gIHZhciBuaCA9IChuIC8gaG9wX3NpemUpfDBcbiAgdmFyIHNjYWxlID0gcG9vbC5tYWxsb2NGbG9hdDMyKG4pXG4gIGZvcih2YXIgaT0wOyBpPG47ICsraSkge1xuICAgIHZhciBzID0gMC4wXG4gICAgZm9yKHZhciBqPTA7IGo8bmg7ICsraikge1xuICAgICAgcyArPSB3WyhpICsgaipob3Bfc2l6ZSklbl1cbiAgICB9XG4gICAgc2NhbGVbaV0gPSBzXG4gIH1cbiAgZm9yKHZhciBpPTA7IGk8bjsgKytpKSB7XG4gICAgd1tpXSAvPSBzY2FsZVtpXVxuICB9XG4gIHBvb2wuZnJlZUZsb2F0MzIoc2NhbGUpXG59XG5cbi8vQXBwbGllcyB3aW5kb3cgdG8gc2lnbmFsXG5mdW5jdGlvbiBhcHBseVdpbmRvdyhYLCBXLCBmcmFtZSkge1xuICB2YXIgaSwgbiA9IGZyYW1lLmxlbmd0aFxuICBmb3IoaT0wOyBpPG47ICsraSkge1xuICAgIFhbaV0gPSBXW2ldICogZnJhbWVbaV1cbiAgfVxufVxuXG4vL1BlcmZvcm1zIHRoZSBhY3R1YWwgcGl0Y2ggc2NhbGluZ1xuZnVuY3Rpb24gc2NhbGVQaXRjaChvdXQsIHgsIG54LCBwZXJpb2QsIHNjYWxlLCBzaGlmdCwgdykge1xuICB2YXIgbm8gPSBvdXQubGVuZ3RoXG4gIGZvcih2YXIgaT0wOyBpPG5vOyArK2kpIHtcbiAgICB2YXIgdCAgPSBpICogc2NhbGUgKyBzaGlmdFxuICAgIHZhciB0aSA9IE1hdGguZmxvb3IodCl8MFxuICAgIHZhciB0ZiA9IHQgLSB0aVxuICAgIHZhciB4MSA9IHhbdGklbnhdXG4gICAgdmFyIHgyID0geFsodGkrMSklbnhdXG4gICAgdmFyIHYgPSAoMS4wIC0gdGYpICogeDEgKyB0ZiAqIHgyXG4gICAgb3V0W2ldID0gd1tpXSAqIHZcbiAgfVxufVxuXG4vL01hdGNoIHN0YXJ0L2VuZCBwb2ludHMgb2Ygc2lnbmFsIHRvIGF2b2lkIHBvcHBpbmcgYXJ0ZWZhY3RzXG5mdW5jdGlvbiBmaW5kTWF0Y2goeCwgc3RhcnQsIHN0ZXApIHtcbiAgdmFyIGEgPSB4WzBdLCBiID0geFtzdGVwXSwgYyA9IHhbMipzdGVwXVxuICB2YXIgbiA9IHgubGVuZ3RoXG4gIHZhciBiZXN0X2QgPSA4XG4gIHZhciBiZXN0X2kgPSBzdGFydFxuICBmb3IodmFyIGk9c3RhcnQ7IGk8bi0yKnN0ZXA7ICsraSkge1xuICAgIHZhciBzID0geFtpXS1hLCB0ID0geFtpK3N0ZXBdLWIsIHU9eFtpKzIqc3RlcF0tY1xuICAgIHZhciBkID0gcypzICsgdCp0ICsgdSp1XG4gICAgaWYoIGQgPCBiZXN0X2QgKSB7XG4gICAgICBiZXN0X2QgPSBkXG4gICAgICBiZXN0X2kgPSBpXG4gICAgfVxuICB9XG4gIHJldHVybiBiZXN0X2lcbn1cblxuZnVuY3Rpb24gcGl0Y2hTaGlmdChvbkRhdGEsIG9uVHVuZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICBcbiAgdmFyIGZyYW1lX3NpemUgID0gb3B0aW9ucy5mcmFtZVNpemUgfHwgMjA0OFxuICB2YXIgaG9wX3NpemUgICAgPSBvcHRpb25zLmhvcFNpemUgfHwgKGZyYW1lX3NpemU+Pj4yKVxuICB2YXIgc2FtcGxlX3JhdGUgPSBvcHRpb25zLnNhbXBsZVJhdGUgfHwgNDQxMDBcbiAgdmFyIGRhdGFfc2l6ZSAgID0gb3B0aW9ucy5tYXhEYXRhU2l6ZSB8fCB1bmRlZmluZWRcbiAgdmFyIGFfd2luZG93ICAgID0gb3B0aW9ucy5hbmFseXNpc1dpbmRvdyB8fCBjcmVhdGVXaW5kb3coZnJhbWVfc2l6ZSlcbiAgdmFyIHNfd2luZG93ICAgID0gb3B0aW9ucy5zeW50aGVzaXNXaW5kb3cgfHwgY3JlYXRlV2luZG93KGZyYW1lX3NpemUpXG4gIHZhciB0aHJlc2hvbGQgICA9IG9wdGlvbnMuZnJlcVRocmVzaG9sZCB8fCAwLjlcbiAgdmFyIHN0YXJ0X2JpbiAgID0gb3B0aW9ucy5taW5QZXJpb2QgfHwgTWF0aC5taW4oaG9wX3NpemUsIE1hdGgubWF4KDE2LCBNYXRoLnJvdW5kKHNhbXBsZV9yYXRlIC8gNDAwKSkpfDBcbiAgXG4gIHZhciBkZXRlY3RfcGFyYW1zID0ge1xuICAgIHRocmVzaG9sZDogdGhyZXNob2xkLFxuICAgIHN0YXJ0X2Jpbjogc3RhcnRfYmluXG4gIH1cbiAgXG4gIHZhciB0ICAgICAgICAgICA9IDBcbiAgdmFyIGN1ciAgICAgICAgID0gbmV3IEZsb2F0MzJBcnJheShmcmFtZV9zaXplKVxuICBcbiAgaWYoZnJhbWVfc2l6ZSAlIGhvcF9zaXplICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSG9wIHNpemUgbXVzdCBkaXZpZGUgZnJhbWUgc2l6ZVwiKVxuICB9XG4gIFxuICAvL05vcm1hbGl6ZSBzeW50aGVzaXMgd2luZG93XG4gIG5vcm1hbGl6ZVdpbmRvdyhzX3dpbmRvdywgaG9wX3NpemUpXG4gIFxuICB2YXIgYWRkRnJhbWUgPSBvdmVybGFwQWRkKGZyYW1lX3NpemUsIGhvcF9zaXplLCBvbkRhdGEpXG4gIHZhciBkZWxheSA9IDBcbiAgXG4gIGZ1bmN0aW9uIGRvUGl0Y2hTaGlmdChmcmFtZSkge1xuXG4gICAgLy9BcHBseSB3aW5kb3dcbiAgICBhcHBseVdpbmRvdyhjdXIsIGFfd2luZG93LCBmcmFtZSlcbiAgICBcbiAgICAvL0NvbXB1dGUgcGl0Y2gsIHBlcmlvZCBhbmQgc2FtcGxlIHJhdGVcbiAgICB2YXIgcGVyaW9kID0gZGV0ZWN0UGl0Y2goY3VyLCBkZXRlY3RfcGFyYW1zKVxuICAgIHZhciBwaXRjaCA9IDAuMFxuICAgIGlmKHBlcmlvZCA+IDApIHtcbiAgICAgIHBpdGNoID0gc2FtcGxlX3JhdGUgLyBwZXJpb2RcbiAgICB9XG4gICAgdmFyIHNjYWxlX2YgPSBvblR1bmUodCAvIHNhbXBsZV9yYXRlLCBwaXRjaClcbiAgICBcbiAgICAvL0NhbGN1bGF0ZSBmcmFtZSBzaXplXG4gICAgdmFyIGZzaXplID0gZnJhbWVfc2l6ZT4+MVxuICAgIGlmKHBlcmlvZCA+IDApIHtcbiAgICAgIGZzaXplID0gKE1hdGgubWF4KDEsIE1hdGguZmxvb3IoMC41KmZyYW1lX3NpemUvcGVyaW9kKSkgKiBwZXJpb2QpfDBcbiAgICB9ICAgIFxuICAgIGZzaXplID0gZmluZE1hdGNoKGZyYW1lLCBmc2l6ZXwwLCBNYXRoLm1heCgxLCBwZXJpb2QvMjApfDApXG4gICAgXG4gICAgLy9BcHBseSBzY2FsaW5nXG4gICAgZGVsYXkgPSAoKGRlbGF5ICUgZnNpemUpICsgZnNpemUpICUgZnNpemVcbiAgICBzY2FsZVBpdGNoKGN1ciwgZnJhbWUsIGZzaXplLCBwZXJpb2R8MCwgc2NhbGVfZiwgZGVsYXksIHNfd2luZG93KVxuICAgIFxuICAgIC8vVXBkYXRlIGNvdW50ZXJzXG4gICAgZGVsYXkgKz0gaG9wX3NpemUgKiAoc2NhbGVfZiAtIDEuMClcbiAgICB0ICs9IGhvcF9zaXplXG4gICAgXG4gICAgLy9BZGQgZnJhbWVcbiAgICBhZGRGcmFtZShjdXIpXG4gIH1cbiAgXG4gIHJldHVybiBmcmFtZUhvcChmcmFtZV9zaXplLCBob3Bfc2l6ZSwgZG9QaXRjaFNoaWZ0LCBkYXRhX3NpemUpXG59XG5tb2R1bGUuZXhwb3J0cyA9IHBpdGNoU2hpZnRcbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgYml0cyA9IHJlcXVpcmUoJ2JpdC10d2lkZGxlJylcbnZhciBkdXAgPSByZXF1aXJlKCdkdXAnKVxuXG4vL0xlZ2FjeSBwb29sIHN1cHBvcnRcbmlmKCFnbG9iYWwuX19UWVBFREFSUkFZX1BPT0wpIHtcbiAgZ2xvYmFsLl9fVFlQRURBUlJBWV9QT09MID0ge1xuICAgICAgVUlOVDggICA6IGR1cChbMzIsIDBdKVxuICAgICwgVUlOVDE2ICA6IGR1cChbMzIsIDBdKVxuICAgICwgVUlOVDMyICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UOCAgICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UMTYgICA6IGR1cChbMzIsIDBdKVxuICAgICwgSU5UMzIgICA6IGR1cChbMzIsIDBdKVxuICAgICwgRkxPQVQgICA6IGR1cChbMzIsIDBdKVxuICAgICwgRE9VQkxFICA6IGR1cChbMzIsIDBdKVxuICAgICwgREFUQSAgICA6IGR1cChbMzIsIDBdKVxuICAgICwgVUlOVDhDICA6IGR1cChbMzIsIDBdKVxuICAgICwgQlVGRkVSICA6IGR1cChbMzIsIDBdKVxuICB9XG59XG5cbnZhciBoYXNVaW50OEMgPSAodHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5KSAhPT0gJ3VuZGVmaW5lZCdcbnZhciBQT09MID0gZ2xvYmFsLl9fVFlQRURBUlJBWV9QT09MXG5cbi8vVXBncmFkZSBwb29sXG5pZighUE9PTC5VSU5UOEMpIHtcbiAgUE9PTC5VSU5UOEMgPSBkdXAoWzMyLCAwXSlcbn1cbmlmKCFQT09MLkJVRkZFUikge1xuICBQT09MLkJVRkZFUiA9IGR1cChbMzIsIDBdKVxufVxuXG4vL05ldyB0ZWNobmlxdWU6IE9ubHkgYWxsb2NhdGUgZnJvbSBBcnJheUJ1ZmZlclZpZXcgYW5kIEJ1ZmZlclxudmFyIERBVEEgICAgPSBQT09MLkRBVEFcbiAgLCBCVUZGRVIgID0gUE9PTC5CVUZGRVJcblxuZXhwb3J0cy5mcmVlID0gZnVuY3Rpb24gZnJlZShhcnJheSkge1xuICBpZihCdWZmZXIuaXNCdWZmZXIoYXJyYXkpKSB7XG4gICAgQlVGRkVSW2JpdHMubG9nMihhcnJheS5sZW5ndGgpXS5wdXNoKGFycmF5KVxuICB9IGVsc2Uge1xuICAgIGlmKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcnJheSkgIT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScpIHtcbiAgICAgIGFycmF5ID0gYXJyYXkuYnVmZmVyXG4gICAgfVxuICAgIGlmKCFhcnJheSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHZhciBuID0gYXJyYXkubGVuZ3RoIHx8IGFycmF5LmJ5dGVMZW5ndGhcbiAgICB2YXIgbG9nX24gPSBiaXRzLmxvZzIobil8MFxuICAgIERBVEFbbG9nX25dLnB1c2goYXJyYXkpXG4gIH1cbn1cblxuZnVuY3Rpb24gZnJlZUFycmF5QnVmZmVyKGJ1ZmZlcikge1xuICBpZighYnVmZmVyKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgdmFyIG4gPSBidWZmZXIubGVuZ3RoIHx8IGJ1ZmZlci5ieXRlTGVuZ3RoXG4gIHZhciBsb2dfbiA9IGJpdHMubG9nMihuKVxuICBEQVRBW2xvZ19uXS5wdXNoKGJ1ZmZlcilcbn1cblxuZnVuY3Rpb24gZnJlZVR5cGVkQXJyYXkoYXJyYXkpIHtcbiAgZnJlZUFycmF5QnVmZmVyKGFycmF5LmJ1ZmZlcilcbn1cblxuZXhwb3J0cy5mcmVlVWludDggPVxuZXhwb3J0cy5mcmVlVWludDE2ID1cbmV4cG9ydHMuZnJlZVVpbnQzMiA9XG5leHBvcnRzLmZyZWVJbnQ4ID1cbmV4cG9ydHMuZnJlZUludDE2ID1cbmV4cG9ydHMuZnJlZUludDMyID1cbmV4cG9ydHMuZnJlZUZsb2F0MzIgPSBcbmV4cG9ydHMuZnJlZUZsb2F0ID1cbmV4cG9ydHMuZnJlZUZsb2F0NjQgPSBcbmV4cG9ydHMuZnJlZURvdWJsZSA9IFxuZXhwb3J0cy5mcmVlVWludDhDbGFtcGVkID0gXG5leHBvcnRzLmZyZWVEYXRhVmlldyA9IGZyZWVUeXBlZEFycmF5XG5cbmV4cG9ydHMuZnJlZUFycmF5QnVmZmVyID0gZnJlZUFycmF5QnVmZmVyXG5cbmV4cG9ydHMuZnJlZUJ1ZmZlciA9IGZ1bmN0aW9uIGZyZWVCdWZmZXIoYXJyYXkpIHtcbiAgQlVGRkVSW2JpdHMubG9nMihhcnJheS5sZW5ndGgpXS5wdXNoKGFycmF5KVxufVxuXG5leHBvcnRzLm1hbGxvYyA9IGZ1bmN0aW9uIG1hbGxvYyhuLCBkdHlwZSkge1xuICBpZihkdHlwZSA9PT0gdW5kZWZpbmVkIHx8IGR0eXBlID09PSAnYXJyYXlidWZmZXInKSB7XG4gICAgcmV0dXJuIG1hbGxvY0FycmF5QnVmZmVyKG4pXG4gIH0gZWxzZSB7XG4gICAgc3dpdGNoKGR0eXBlKSB7XG4gICAgICBjYXNlICd1aW50OCc6XG4gICAgICAgIHJldHVybiBtYWxsb2NVaW50OChuKVxuICAgICAgY2FzZSAndWludDE2JzpcbiAgICAgICAgcmV0dXJuIG1hbGxvY1VpbnQxNihuKVxuICAgICAgY2FzZSAndWludDMyJzpcbiAgICAgICAgcmV0dXJuIG1hbGxvY1VpbnQzMihuKVxuICAgICAgY2FzZSAnaW50OCc6XG4gICAgICAgIHJldHVybiBtYWxsb2NJbnQ4KG4pXG4gICAgICBjYXNlICdpbnQxNic6XG4gICAgICAgIHJldHVybiBtYWxsb2NJbnQxNihuKVxuICAgICAgY2FzZSAnaW50MzInOlxuICAgICAgICByZXR1cm4gbWFsbG9jSW50MzIobilcbiAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgIGNhc2UgJ2Zsb2F0MzInOlxuICAgICAgICByZXR1cm4gbWFsbG9jRmxvYXQobilcbiAgICAgIGNhc2UgJ2RvdWJsZSc6XG4gICAgICBjYXNlICdmbG9hdDY0JzpcbiAgICAgICAgcmV0dXJuIG1hbGxvY0RvdWJsZShuKVxuICAgICAgY2FzZSAndWludDhfY2xhbXBlZCc6XG4gICAgICAgIHJldHVybiBtYWxsb2NVaW50OENsYW1wZWQobilcbiAgICAgIGNhc2UgJ2J1ZmZlcic6XG4gICAgICAgIHJldHVybiBtYWxsb2NCdWZmZXIobilcbiAgICAgIGNhc2UgJ2RhdGEnOlxuICAgICAgY2FzZSAnZGF0YXZpZXcnOlxuICAgICAgICByZXR1cm4gbWFsbG9jRGF0YVZpZXcobilcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gbWFsbG9jQXJyYXlCdWZmZXIobikge1xuICB2YXIgbiA9IGJpdHMubmV4dFBvdzIobilcbiAgdmFyIGxvZ19uID0gYml0cy5sb2cyKG4pXG4gIHZhciBkID0gREFUQVtsb2dfbl1cbiAgaWYoZC5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGQucG9wKClcbiAgfVxuICByZXR1cm4gbmV3IEFycmF5QnVmZmVyKG4pXG59XG5leHBvcnRzLm1hbGxvY0FycmF5QnVmZmVyID0gbWFsbG9jQXJyYXlCdWZmZXJcblxuZnVuY3Rpb24gbWFsbG9jVWludDgobikge1xuICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobWFsbG9jQXJyYXlCdWZmZXIobiksIDAsIG4pXG59XG5leHBvcnRzLm1hbGxvY1VpbnQ4ID0gbWFsbG9jVWludDhcblxuZnVuY3Rpb24gbWFsbG9jVWludDE2KG4pIHtcbiAgcmV0dXJuIG5ldyBVaW50MTZBcnJheShtYWxsb2NBcnJheUJ1ZmZlcigyKm4pLCAwLCBuKVxufVxuZXhwb3J0cy5tYWxsb2NVaW50MTYgPSBtYWxsb2NVaW50MTZcblxuZnVuY3Rpb24gbWFsbG9jVWludDMyKG4pIHtcbiAgcmV0dXJuIG5ldyBVaW50MzJBcnJheShtYWxsb2NBcnJheUJ1ZmZlcig0Km4pLCAwLCBuKVxufVxuZXhwb3J0cy5tYWxsb2NVaW50MzIgPSBtYWxsb2NVaW50MzJcblxuZnVuY3Rpb24gbWFsbG9jSW50OChuKSB7XG4gIHJldHVybiBuZXcgSW50OEFycmF5KG1hbGxvY0FycmF5QnVmZmVyKG4pLCAwLCBuKVxufVxuZXhwb3J0cy5tYWxsb2NJbnQ4ID0gbWFsbG9jSW50OFxuXG5mdW5jdGlvbiBtYWxsb2NJbnQxNihuKSB7XG4gIHJldHVybiBuZXcgSW50MTZBcnJheShtYWxsb2NBcnJheUJ1ZmZlcigyKm4pLCAwLCBuKVxufVxuZXhwb3J0cy5tYWxsb2NJbnQxNiA9IG1hbGxvY0ludDE2XG5cbmZ1bmN0aW9uIG1hbGxvY0ludDMyKG4pIHtcbiAgcmV0dXJuIG5ldyBJbnQzMkFycmF5KG1hbGxvY0FycmF5QnVmZmVyKDQqbiksIDAsIG4pXG59XG5leHBvcnRzLm1hbGxvY0ludDMyID0gbWFsbG9jSW50MzJcblxuZnVuY3Rpb24gbWFsbG9jRmxvYXQobikge1xuICByZXR1cm4gbmV3IEZsb2F0MzJBcnJheShtYWxsb2NBcnJheUJ1ZmZlcig0Km4pLCAwLCBuKVxufVxuZXhwb3J0cy5tYWxsb2NGbG9hdDMyID0gZXhwb3J0cy5tYWxsb2NGbG9hdCA9IG1hbGxvY0Zsb2F0XG5cbmZ1bmN0aW9uIG1hbGxvY0RvdWJsZShuKSB7XG4gIHJldHVybiBuZXcgRmxvYXQ2NEFycmF5KG1hbGxvY0FycmF5QnVmZmVyKDgqbiksIDAsIG4pXG59XG5leHBvcnRzLm1hbGxvY0Zsb2F0NjQgPSBleHBvcnRzLm1hbGxvY0RvdWJsZSA9IG1hbGxvY0RvdWJsZVxuXG5mdW5jdGlvbiBtYWxsb2NVaW50OENsYW1wZWQobikge1xuICBpZihoYXNVaW50OEMpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KG1hbGxvY0FycmF5QnVmZmVyKG4pLCAwLCBuKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBtYWxsb2NVaW50OChuKVxuICB9XG59XG5leHBvcnRzLm1hbGxvY1VpbnQ4Q2xhbXBlZCA9IG1hbGxvY1VpbnQ4Q2xhbXBlZFxuXG5mdW5jdGlvbiBtYWxsb2NEYXRhVmlldyhuKSB7XG4gIHJldHVybiBuZXcgRGF0YVZpZXcobWFsbG9jQXJyYXlCdWZmZXIobiksIDAsIG4pXG59XG5leHBvcnRzLm1hbGxvY0RhdGFWaWV3ID0gbWFsbG9jRGF0YVZpZXdcblxuZnVuY3Rpb24gbWFsbG9jQnVmZmVyKG4pIHtcbiAgbiA9IGJpdHMubmV4dFBvdzIobilcbiAgdmFyIGxvZ19uID0gYml0cy5sb2cyKG4pXG4gIHZhciBjYWNoZSA9IEJVRkZFUltsb2dfbl1cbiAgaWYoY2FjaGUubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBjYWNoZS5wb3AoKVxuICB9XG4gIHJldHVybiBuZXcgQnVmZmVyKG4pXG59XG5leHBvcnRzLm1hbGxvY0J1ZmZlciA9IG1hbGxvY0J1ZmZlclxuXG5leHBvcnRzLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlKCkge1xuICBmb3IodmFyIGk9MDsgaTwzMjsgKytpKSB7XG4gICAgUE9PTC5VSU5UOFtpXS5sZW5ndGggPSAwXG4gICAgUE9PTC5VSU5UMTZbaV0ubGVuZ3RoID0gMFxuICAgIFBPT0wuVUlOVDMyW2ldLmxlbmd0aCA9IDBcbiAgICBQT09MLklOVDhbaV0ubGVuZ3RoID0gMFxuICAgIFBPT0wuSU5UMTZbaV0ubGVuZ3RoID0gMFxuICAgIFBPT0wuSU5UMzJbaV0ubGVuZ3RoID0gMFxuICAgIFBPT0wuRkxPQVRbaV0ubGVuZ3RoID0gMFxuICAgIFBPT0wuRE9VQkxFW2ldLmxlbmd0aCA9IDBcbiAgICBQT09MLlVJTlQ4Q1tpXS5sZW5ndGggPSAwXG4gICAgREFUQVtpXS5sZW5ndGggPSAwXG4gICAgQlVGRkVSW2ldLmxlbmd0aCA9IDBcbiAgfVxufSIsIlxyXG5leHBvcnQgY2xhc3MgQWJzdHJhY3RDYW52YXMge1xyXG4gICAgY29uc3RydWN0b3IoaWRlbnRpZmllcikge1xyXG4gICAgICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWRlbnRpZmllcik7XHJcbiAgICAgICAgdGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5jYW52YXMuaGVpZ2h0O1xyXG4gICAgfVxyXG59IiwiXHJcbmV4cG9ydCBmdW5jdGlvbiBkb3BwbGVyU2hpZnQocmVsVmVsTywgcmVsVmVsUywgdlNvdW5kKSB7XHJcbiAgICBsZXQgRnJlTXVsdCA9ICh2U291bmQgKyByZWxWZWxPKSAvICh2U291bmQgLSByZWxWZWxTKTtcclxuICAgIHJldHVybiBGcmVNdWx0O1xyXG59IiwiaW1wb3J0IE1pa29QaXRjaFNoaWZ0IGZyb20gXCJwaXRjaC1zaGlmdFwiO1xyXG5pbXBvcnQgcG9vbCBmcm9tIFwidHlwZWRhcnJheS1wb29sXCI7XHJcblxyXG5jb25zdCBGUkFNRV9TSVpFID0gMjA0ODtcclxuXHJcbmV4cG9ydCBjbGFzcyBGcmVxdWVuY3lTaGlmdGVyIHtcclxuICAgIGNvbnN0cnVjdG9yKGNvbnRleHQsIGlucHV0Tm9kZSwgb3V0cHV0Tm9kZSkge1xyXG4gICAgICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gY29udGV4dDtcclxuICAgICAgICB0aGlzLnByb2Nlc3Nvck5vZGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoRlJBTUVfU0laRSwgMSwgMSk7XHJcbiAgICAgICAgLy90aGlzLnNoaWZ0ZXIgPSBuZXcgUGl0Y2hzaGlmdCg0MDk2LCB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlLCBcIkZGVFwiKTtcclxuICAgICAgICB0aGlzLnF1ZXVlID0gW107XHJcbiAgICAgICAgdGhpcy5zaGlmdGVyID0gTWlrb1BpdGNoU2hpZnQoKGRhdGEpID0+IHRoaXMudXNlRGF0YShkYXRhKSwgKCkgPT4gdGhpcy5nZXRTaGlmdCgpLCB7XHJcbiAgICAgICAgICAgICAgICBmcmFtZVNpemU6IEZSQU1FX1NJWkVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgLy9BZGQgc29tZSBib2d1cyBkYXRhIHNvIGl0IGRvZXNuJ3QgcnVuIG91dCBvZiBzdHVmZlxyXG4gICAgICAgIHRoaXMuc2hpZnRlcihuZXcgRmxvYXQzMkFycmF5KEZSQU1FX1NJWkUpKTtcclxuICAgICAgICB0aGlzLnNoaWZ0ZXIobmV3IEZsb2F0MzJBcnJheShGUkFNRV9TSVpFKSk7XHJcbiAgICAgICAgdGhpcy5zaGlmdGVyKG5ldyBGbG9hdDMyQXJyYXkoRlJBTUVfU0laRSkpO1xyXG4gICAgICAgIHRoaXMuc2hpZnRlcihuZXcgRmxvYXQzMkFycmF5KEZSQU1FX1NJWkUpKTtcclxuICAgICAgICB0aGlzLnNoaWZ0ZXIobmV3IEZsb2F0MzJBcnJheShGUkFNRV9TSVpFKSk7XHJcbiAgICAgICAgdGhpcy5wcm9jZXNzb3JOb2RlLm9uYXVkaW9wcm9jZXNzID0gKChldmVudCkgPT4gdGhpcy5wcm9jZXNzQXVkaW8oZXZlbnQpKTtcclxuICAgICAgICB0aGlzLnNoaWZ0TXVsdGlwbGllciA9IDE7XHJcbiAgICAgICAgaW5wdXROb2RlLmNvbm5lY3QodGhpcy5wcm9jZXNzb3JOb2RlKTtcclxuICAgICAgICB0aGlzLnByb2Nlc3Nvck5vZGUuY29ubmVjdChvdXRwdXROb2RlKTtcclxuICAgICAgICB0aGlzLmlucHV0Tm9kZSA9IGlucHV0Tm9kZTtcclxuICAgIH1cclxuXHJcbiAgICB1c2VEYXRhKGRhdGEpIHtcclxuICAgICAgICBsZXQgYnVmID0gcG9vbC5tYWxsb2NGbG9hdDMyKGRhdGEubGVuZ3RoKTtcclxuICAgICAgICBidWYuc2V0KGRhdGEpO1xyXG4gICAgICAgIHRoaXMucXVldWUucHVzaChidWYpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFNoaWZ0KG11bCkge1xyXG4gICAgICAgIHRoaXMuc2hpZnRNdWx0aXBsaWVyID0gbXVsO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFNoaWZ0KCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNoaWZ0TXVsdGlwbGllciB8fCAxO1xyXG4gICAgfVxyXG5cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgdGhpcy5wcm9jZXNzb3JOb2RlLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICB0aGlzLmlucHV0Tm9kZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgdGhpcy5hdWRpb0NvbnRleHQuY2xvc2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcm9jZXNzQXVkaW8oZXZlbnQpIHtcclxuICAgICAgICB0aGlzLnNoaWZ0ZXIoZXZlbnQuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCkpO1xyXG4gICAgICAgIGxldCBvdXQgPSBldmVudC5vdXRwdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XHJcbiAgICAgICAgbGV0IHEgPSB0aGlzLnF1ZXVlWzBdO1xyXG4gICAgICAgIHRoaXMucXVldWUuc2hpZnQoKTtcclxuICAgICAgICBvdXQuc2V0KHEpO1xyXG4gICAgICAgIHBvb2wuZnJlZUZsb2F0MzIocSk7XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgbGV0IG91dHB1dEJ1ZmZlciA9IGV2ZW50Lm91dHB1dEJ1ZmZlcjtcclxuICAgICAgICBsZXQgaW5wdXRCdWZmZXIgPSBldmVudC5pbnB1dEJ1ZmZlcjtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgY2hhbm5lbCA9IDA7IGNoYW5uZWwgPCBvdXRwdXRCdWZmZXIubnVtYmVyT2ZDaGFubmVsczsgY2hhbm5lbCsrKSB7XHJcbiAgICAgICAgICAgIGxldCBpbnB1dERhdGEgPSBpbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YShjaGFubmVsKTtcclxuICAgICAgICAgICAgbGV0IG91dHB1dERhdGEgPSBvdXRwdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoY2hhbm5lbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2hpZnRlci5wcm9jZXNzKHRoaXMuc2hpZnRNdWx0aXBsaWVyLCBpbnB1dERhdGEubGVuZ3RoLCA0LCBpbnB1dERhdGEpO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG91dHB1dERhdGEubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dERhdGFbaV0gPSB0aGlzLnNoaWZ0ZXIub3V0ZGF0YVtpXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gKi9cclxuICAgIH1cclxufSIsImV4cG9ydCBjbGFzcyBSb3RhdGluZ0ltYWdlIHtcclxuICAgIFxyXG4gICAgY29uc3RydWN0b3IoaW1nLCBjZW50ZXJYLCBjZW50ZXJZLCBjYW52YXMpe1xyXG4gICAgICAgIHRoaXMuYW5ndWxhckxvYyA9IDA7XHJcbiAgICAgICAgdGhpcy5pbWFnZSA9IGltZztcclxuICAgICAgICB0aGlzLmNlbnRlciA9IHtcInhcIjogY2VudGVyWCwgXCJ5XCI6IGNlbnRlcll9O1xyXG4gICAgICAgIHRoaXMuY2FudmFzID0gY2FudmFzO1xyXG4gICAgICAgIHRoaXMuaXNGaXJzdFRpbWUgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMubGFzdERyYXdUaW1lID0gMDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdXBkYXRlSW1hZ2UoYW5ndWxhclZlbG9jaXR5KSB7XHJcbiAgICAgICAgbGV0IG9mZnNldCA9ICh0aGlzLmlzRmlyc3RUaW1lID09PSB0cnVlKSA/IDAgOiAoYW5ndWxhclZlbG9jaXR5ICogKChEYXRlLm5vdygpIC0gdGhpcy5sYXN0RHJhd1RpbWUpIC8gMTAwMCkpO1xyXG4gICAgICAgIGxldCByb3RhdGlvbiA9IHRoaXMuYW5ndWxhckxvYyArIG9mZnNldDtcclxuICAgICAgICB0aGlzLmlzRmlyc3RUaW1lID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5jYW52YXMuY3R4LnNhdmUoKTtcclxuICAgICAgICB0aGlzLmNhbnZhcy5jdHgudHJhbnNsYXRlKHRoaXMuY2VudGVyLngsIHRoaXMuY2VudGVyLnkpO1xyXG4gICAgICAgIHRoaXMuY2FudmFzLmN0eC5yb3RhdGUocm90YXRpb24pO1xyXG4gICAgICAgIHRoaXMuY2FudmFzLmN0eC5kcmF3SW1hZ2UodGhpcy5pbWFnZSwgLXRoaXMuaW1hZ2Uud2lkdGggLyAyLCAtdGhpcy5pbWFnZS5oZWlnaHQgLyAyKTtcclxuICAgICAgICB0aGlzLmNhbnZhcy5jdHgucmVzdG9yZSgpO1xyXG4gICAgICAgIHRoaXMubGFzdERyYXdUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB0aGlzLmFuZ3VsYXJMb2MgPSByb3RhdGlvbjtcclxuICAgIH1cclxuICAgIFxyXG59IiwiaW1wb3J0IHtSb3RhdGluZ0ltYWdlfSBmcm9tIFwiLi9Sb3RhdGluZ0ltYWdlXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgUm90YXRpbmdUcmFuc2xhdGVkSW1hZ2UgZXh0ZW5kcyBSb3RhdGluZ0ltYWdlIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihpbWcsIGNlbnRlclgsIGNlbnRlclksIGNhbnZhcywgcmFkaXVzKSB7XHJcbiAgICAgICAgc3VwZXIoaW1nLCBjZW50ZXJYLCBjZW50ZXJZLCBjYW52YXMpO1xyXG4gICAgICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZUltYWdlKGFuZ3VsYXJWZWxvY2l0eSkge1xyXG4gICAgICAgIGxldCBvZmZzZXQgPSAodGhpcy5pc0ZpcnN0VGltZSA9PT0gdHJ1ZSkgPyAwIDogKGFuZ3VsYXJWZWxvY2l0eSAqICgoRGF0ZS5ub3coKSAtIHRoaXMubGFzdERyYXdUaW1lKSAvIDEwMDApKTtcclxuICAgICAgICBsZXQgcm90YXRpb24gPSB0aGlzLmFuZ3VsYXJMb2MgKyBvZmZzZXQ7XHJcbiAgICAgICAgdGhpcy5pc0ZpcnN0VGltZSA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMubGFzdERyYXdUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB0aGlzLmFuZ3VsYXJMb2MgPSByb3RhdGlvbjtcclxuICAgICAgICBsZXQgcG9zaXRpb25YID0gdGhpcy5yYWRpdXMgKiBNYXRoLmNvcyhyb3RhdGlvbikgKyB0aGlzLmNlbnRlci54IC0gKDAuNSAqIHRoaXMuaW1hZ2Uud2lkdGgpO1xyXG4gICAgICAgIGxldCBwb3NpdGlvblkgPSB0aGlzLnJhZGl1cyAqIE1hdGguc2luKHJvdGF0aW9uKSArIHRoaXMuY2VudGVyLnkgLSAoMC41ICogdGhpcy5pbWFnZS5oZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2FudmFzLmN0eC5kcmF3SW1hZ2UodGhpcy5pbWFnZSwgcG9zaXRpb25YLCBwb3NpdGlvblkpO1xyXG5cclxuICAgIH1cclxufSIsIlxyXG5leHBvcnQgY2xhc3MgVmVjdG9ye1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHgsIHkpe1xyXG4gICAgICAgIHRoaXMueCA9IHg7XHJcbiAgICAgICAgdGhpcy55ID0geTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgbWFnbml0dWRlKCkge1xyXG4gICAgICAgIHJldHVybihNYXRoLnNxcnQoTWF0aC5wb3codGhpcy54LCAyKSArIE1hdGgucG93KHRoaXMueSwgMikpKTtcclxuICAgIH1cclxuXHJcbiAgICBkaXJlY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4oTWF0aC5hdGFuMih0aGlzLngsIHRoaXMueSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGRvdChvdGhlclZlYykge1xyXG4gICAgICAgIHJldHVybiAob3RoZXJWZWMueCAqIHRoaXMueCkgKyAob3RoZXJWZWMueSAqIHRoaXMueSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHN1YihvdGhlclZlYykge1xyXG4gICAgICAgIHJldHVybiBuZXcgVmVjdG9yKHRoaXMueCAtIG90aGVyVmVjLngsIHRoaXMueSAtIG90aGVyVmVjLnkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbXBvbmVudChvdGhlclZlYykge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5kb3Qob3RoZXJWZWMpIC8gb3RoZXJWZWMubWFnbml0dWRlKCkpO1xyXG4gICAgfVxyXG59IiwiaW1wb3J0IHtBYnN0cmFjdENhbnZhc30gZnJvbSBcIi4vQWJzdHJhY3RDYW52YXNcIjtcclxuaW1wb3J0IHtSb3RhdGluZ0ltYWdlfSBmcm9tIFwiLi9Sb3RhdGluZ0ltYWdlXCI7XHJcbmltcG9ydCB7VmVjdG9yfSBmcm9tIFwiLi9WZWN0b3JcIjtcclxuaW1wb3J0IHtkb3BwbGVyU2hpZnR9IGZyb20gXCIuL0RvcHBsZXJTaGlmdFwiO1xyXG5pbXBvcnQge1JvdGF0aW5nVHJhbnNsYXRlZEltYWdlfSBmcm9tIFwiLi9Sb3RhdGluZ1RyYW5zbGF0ZWRJbWFnZVwiO1xyXG5pbXBvcnQge0ZyZXF1ZW5jeVNoaWZ0ZXJ9IGZyb20gXCIuL0ZyZXF1ZW5jeVNoaWZ0ZXJcIjtcclxuXHJcbmNvbnN0IFNQRUFLRVJfQU5HVUxBUl9WRUxPQ0lUWSA9IDE7XHJcbmNvbnN0IFNDQUxFID0gMC4wMTtcclxuXHJcbmNsYXNzIE1haW4ge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5tYWluQ2FudmFzID0gbmV3IEFic3RyYWN0Q2FudmFzKFwibWFpbi1jYW52YXNcIik7XHJcbiAgICAgICAgdGhpcy5ncmFkQmFzZSA9IDA7XHJcbiAgICAgICAgdGhpcy5pbWFnZXMgPSB7XHJcbiAgICAgICAgICAgIFwicGlud2hlZWxcIjogdGhpcy5sb2FkSW1hZ2UoXCJpbWcvcGlud2hlZWwucG5nXCIpLFxyXG4gICAgICAgICAgICBcImJhY2tQaW53aGVlbFwiOiB0aGlzLmxvYWRJbWFnZShcImltZy9CYWNrUGlud2hlZWwucG5nXCIpLFxyXG4gICAgICAgICAgICBcInJpY2tcIjogdGhpcy5sb2FkSW1hZ2UoJ2ltZy9yaWNrLnBuZycpLFxyXG4gICAgICAgICAgICBcInBlcnNvblwiOiB0aGlzLmxvYWRJbWFnZSgnaW1nL3BlcnNvbi5wbmcnKSxcclxuICAgICAgICAgICAgXCJzcGVha2VyXCI6IHRoaXMubG9hZEltYWdlKCdpbWcvc3BlYWtlci5wbmcnKVxyXG4gICAgICAgIH07XHJcblxyXG5cclxuICAgICAgICB0aGlzLmltYWdlcy5waW53aGVlbC5vbmxvYWQgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMud2hlZWwgPSBuZXcgUm90YXRpbmdJbWFnZSh0aGlzLmltYWdlcy5waW53aGVlbCxcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIsIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyLCB0aGlzLm1haW5DYW52YXMpO1xyXG4gICAgICAgICAgICB0aGlzLmJhY2tXaGVlbCA9IG5ldyBSb3RhdGluZ0ltYWdlKHRoaXMuaW1hZ2VzLmJhY2tQaW53aGVlbCxcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIsIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyLCB0aGlzLm1haW5DYW52YXMpO1xyXG4gICAgICAgICAgICB0aGlzLnNwZWFrZXIgPSBuZXcgUm90YXRpbmdUcmFuc2xhdGVkSW1hZ2UodGhpcy5pbWFnZXMuc3BlYWtlcixcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIsIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWluQ2FudmFzLCAodGhpcy5pbWFnZXMuYmFja1BpbndoZWVsLndpZHRoIC8gMikgLSA0Nik7XHJcbiAgICAgICAgICAgIHRoaXMub2JzID0gbmV3IFJvdGF0aW5nVHJhbnNsYXRlZEltYWdlKHRoaXMuaW1hZ2VzLnBlcnNvbixcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIsIHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWluQ2FudmFzLCAodGhpcy5pbWFnZXMucGlud2hlZWwud2lkdGggLyAyKSAtIDUwKTtcclxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0b25lLWJ1dHRvblwiKS5vbmNsaWNrID0gKCkgPT4gdGhpcy5zZXRPdXRwdXRUeXBlVG9uZSgpO1xyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1wMy1idXR0b25cIikub25jbGljayA9ICgpID0+IHRoaXMuc2V0T3V0cHV0VHlwZU1wMygpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5rb25hbWkgPSBuZXcgS29uYW1pKCgpID0+IHRoaXMucmlja3JvbGwoKSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJpY2tyb2xsZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc2hpZnRlciA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gdGhpcy5yZW5kZXIoKSk7XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICByaWNrcm9sbCgpIHtcclxuICAgICAgICB0aGlzLnJpY2tyb2xsZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuc3BlYWtlci5pbWFnZSA9IHRoaXMuaW1hZ2VzLnJpY2s7XHJcbiAgICAgICAgdGhpcy5jcmVhdGVNdXNpY05vZGVBbmRTaGlmdGVyKFwiaHR0cHM6Ly9pYTgwMDgwNS51cy5hcmNoaXZlLm9yZy8yNy9pdGVtcy9OZXZlckdvbm5hR2l2ZVlvdVVwL2pvY29mdWxsaW50ZXJ2aWV3NDEubXAzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRJbWFnZSh1cmwpIHtcclxuICAgICAgICAgICAgbGV0IGltZztcclxuICAgICAgICAgICAgaW1nID0gbmV3IEltYWdlKCk7XHJcbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XHJcbiAgICAgICAgICAgIHJldHVybiBpbWc7XHJcbiAgICB9XHJcblxyXG4gICAgcmVuZGVyKCkge1xyXG4gICAgICAgIHRoaXMubWFpbkNhbnZhcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMubWFpbkNhbnZhcy53aWR0aCwgdGhpcy5tYWluQ2FudmFzLmhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5iYWNrV2hlZWwudXBkYXRlSW1hZ2UodGhpcy5nZXRTcGVha2VyQW5ndWxhclZlbG9jaXR5KCkpO1xyXG4gICAgICAgIHRoaXMud2hlZWwudXBkYXRlSW1hZ2UodGhpcy5nZXRPYnNlcnZlckFuZ3VsYXJWZWxvY2l0eSgpKTtcclxuICAgICAgICB0aGlzLm9icy51cGRhdGVJbWFnZSh0aGlzLmdldE9ic2VydmVyQW5ndWxhclZlbG9jaXR5KCkpO1xyXG4gICAgICAgIHRoaXMuc3BlYWtlci51cGRhdGVJbWFnZSh0aGlzLmdldFNwZWFrZXJBbmd1bGFyVmVsb2NpdHkoKSk7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5wdXROb2RlICYmIHRoaXMuaW5wdXROb2RlLmZyZXF1ZW5jeSkge1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0Tm9kZS5mcmVxdWVuY3kudmFsdWUgPSB0aGlzLmdldEZyZXF1ZW5jeSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5zaGlmdGVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2hpZnRlci5zZXRTaGlmdCh0aGlzLmRvcHBsZXJTY2FsZSgpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB0aGlzLnJlbmRlcigpKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRPdXRwdXRUeXBlVG9uZSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMucmlja3JvbGxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zaGlmdGVyKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNoaWZ0ZXIuc3RvcCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCBjb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0Tm9kZSA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0Tm9kZS5mcmVxdWVuY3kudmFsdWUgPSB0aGlzLmdldEZyZXF1ZW5jeSgpO1xyXG4gICAgICAgICAgICB0aGlzLmlucHV0Tm9kZS5zdGFydCgpO1xyXG4gICAgICAgICAgICB0aGlzLnNoaWZ0ZXIgPSBuZXcgRnJlcXVlbmN5U2hpZnRlcihjb250ZXh0LCB0aGlzLmlucHV0Tm9kZSwgY29udGV4dC5kZXN0aW5hdGlvbik7XHJcbiAgICAgICAgICAgIHRoaXMuYXVkaW8gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHNldE91dHB1dFR5cGVNcDMoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnJpY2tyb2xsZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5jcmVhdGVNdXNpY05vZGVBbmRTaGlmdGVyKHRoaXMuZ2V0TXAzVXJsKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgY3JlYXRlTXVzaWNOb2RlQW5kU2hpZnRlcih1cmwpIHtcclxuICAgICAgICBpZiAodGhpcy5zaGlmdGVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2hpZnRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xyXG4gICAgICAgIHRoaXMuYXVkaW8gPSBuZXcgQXVkaW8odXJsKTtcclxuICAgICAgICB0aGlzLmF1ZGlvLm9uZXJyb3IgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0T3V0cHV0VHlwZVRvbmUoKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuYXVkaW8uY3Jvc3NPcmlnaW4gPSBcImFub255bW91c1wiO1xyXG4gICAgICAgIHRoaXMuYXVkaW8uYXV0b3BsYXkgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuYXVkaW8ubG9vcCA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5hdWRpby5wbGF5KCk7XHJcbiAgICAgICAgdGhpcy5pbnB1dE5vZGUgPSBjb250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZSh0aGlzLmF1ZGlvKTtcclxuICAgICAgICB0aGlzLnNoaWZ0ZXIgPSBuZXcgRnJlcXVlbmN5U2hpZnRlcihjb250ZXh0LCB0aGlzLmlucHV0Tm9kZSwgY29udGV4dC5kZXN0aW5hdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0U3BlYWtlckFuZ3VsYXJWZWxvY2l0eSgpIHtcclxuICAgICAgICByZXR1cm4gU1BFQUtFUl9BTkdVTEFSX1ZFTE9DSVRZICogKCtkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNwZWFrZXItdmVsb2NpdHlcIikudmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldE9ic2VydmVyQW5ndWxhclZlbG9jaXR5KCkge1xyXG4gICAgICAgIHJldHVybiBTUEVBS0VSX0FOR1VMQVJfVkVMT0NJVFkgKiAoK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwib2JzZXJ2ZXItdmVsb2NpdHlcIikudmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldE1wM1VybCgpIHtcclxuICAgICAgICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ1cmwtdGV4dFwiKS52YWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRGcmVxdWVuY3koKSB7XHJcbiAgICAgICAgcmV0dXJuICgrZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJvcmlnaW4tZnJlcXVlbmN5XCIpLnZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICBkb3BwbGVyU2NhbGUoKSB7XHJcbiAgICAgICAgbGV0IHN0YXJ0WCA9ICh0aGlzLmltYWdlcy5waW53aGVlbC53aWR0aCAvIDIpICogTWF0aC5jb3ModGhpcy53aGVlbC5hbmd1bGFyTG9jKTtcclxuICAgICAgICBsZXQgc3RhcnRZID0gKHRoaXMuaW1hZ2VzLnBpbndoZWVsLmhlaWdodCAvIDIpICogTWF0aC5zaW4odGhpcy53aGVlbC5hbmd1bGFyTG9jKTtcclxuICAgICAgICBsZXQgc3BlYWtlclZlbG9jaXR5ID0gdGhpcy5nZXRTcGVha2VyQW5ndWxhclZlbG9jaXR5KCkgKiB0aGlzLm1haW5DYW52YXMud2lkdGggLyAyO1xyXG4gICAgICAgIGxldCBzcGVha2VyVmVsID0gbmV3IFZlY3RvcihzcGVha2VyVmVsb2NpdHkgKiBNYXRoLmNvcyh0aGlzLndoZWVsLmFuZ3VsYXJMb2MgKyBNYXRoLlBJIC8gMiksXHJcbiAgICAgICAgICAgIHNwZWFrZXJWZWxvY2l0eSAqIE1hdGguc2luKHRoaXMud2hlZWwuYW5ndWxhckxvYyArIE1hdGguUEkgLyAyKSk7XHJcbiAgICAgICAgbGV0IG9ic2VydmVyVmVsb2NpdHkgPSB0aGlzLmdldE9ic2VydmVyQW5ndWxhclZlbG9jaXR5KCkgKiB0aGlzLm1haW5DYW52YXMud2lkdGggLyAyO1xyXG4gICAgICAgIGxldCBvYnNlcnZlclZlbCA9IG5ldyBWZWN0b3Iob2JzZXJ2ZXJWZWxvY2l0eSAqIE1hdGguY29zKHRoaXMud2hlZWwuYW5ndWxhckxvYyArIE1hdGguUEkgLyAyKSxcclxuICAgICAgICAgICAgb2JzZXJ2ZXJWZWxvY2l0eSAqIE1hdGguc2luKHRoaXMud2hlZWwuYW5ndWxhckxvYyArIE1hdGguUEkgLyAyKSk7XHJcbiAgICAgICAgbGV0IG9ic2VydmVyVmVjID0gbmV3IFZlY3RvcigoTWF0aC5jb3ModGhpcy5vYnMuYW5ndWxhckxvYykgKiB0aGlzLm9icy5yYWRpdXMpICsgKHRoaXMubWFpbkNhbnZhcy53aWR0aCAvIDIpLCAoTWF0aC5zaW4odGhpcy5vYnMuYW5ndWxhckxvYykgKiB0aGlzLm9icy5yYWRpdXMpICsgKHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyKSk7XHJcbiAgICAgICAgbGV0IHNwZWFrZXJWZWMgPSBuZXcgVmVjdG9yKChNYXRoLmNvcyh0aGlzLnNwZWFrZXIuYW5ndWxhckxvYykgKiB0aGlzLnNwZWFrZXIucmFkaXVzKSArICh0aGlzLm1haW5DYW52YXMud2lkdGggLyAyKSwgKE1hdGguc2luKHRoaXMuc3BlYWtlci5hbmd1bGFyTG9jKSAqIHRoaXMuc3BlYWtlci5yYWRpdXMpICsgKHRoaXMubWFpbkNhbnZhcy5oZWlnaHQgLyAyKSk7XHJcbiAgICAgICAgbGV0IHBvc1ZlYyA9IG9ic2VydmVyVmVjLnN1YihzcGVha2VyVmVjKTtcclxuICAgICAgICBsZXQgcG9zVmVjMiA9IHNwZWFrZXJWZWMuc3ViKG9ic2VydmVyVmVjKTtcclxuICAgICAgICByZXR1cm4gZG9wcGxlclNoaWZ0KG9ic2VydmVyVmVsLmNvbXBvbmVudChwb3NWZWMyKSAqIFNDQUxFLCBzcGVha2VyVmVsLmNvbXBvbmVudChwb3NWZWMpICogU0NBTEUsIDM0Myk7XHJcbiAgICB9XHJcbn1cclxuXHJcbm5ldyBNYWluKCk7Il19
