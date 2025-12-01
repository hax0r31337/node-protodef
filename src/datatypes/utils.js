const { getCount, sendCount, calcCount, PartialReadError } = require('../utils')

// Global UTF-8 encoder/decoder for better performance
const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8')

// Helper function to get encoder for different encodings
function getTextDecoder (encoding) {
  try {
    return new TextDecoder(encoding)
  } catch (e) {
    // Fallback to utf-8 if encoding not supported
    return utf8Decoder
  }
}

function getTextEncoder (encoding) {
  // TextEncoder only supports utf-8
  if (encoding === 'utf8' || encoding === 'utf-8') {
    return utf8Encoder
  }
  // For other encodings, we'll need to use a different approach
  return null
}

module.exports = {
  bool: [readBool, writeBool, 1, require('../../ProtoDef/schemas/utils.json').bool],
  pstring: [readPString, writePString, sizeOfPString, require('../../ProtoDef/schemas/utils.json').pstring],
  buffer: [readBuffer, writeBuffer, sizeOfBuffer, require('../../ProtoDef/schemas/utils.json').buffer],
  void: [readVoid, writeVoid, 0, require('../../ProtoDef/schemas/utils.json').void],
  bitfield: [readBitField, writeBitField, sizeOfBitField, require('../../ProtoDef/schemas/utils.json').bitfield],
  bitflags: [readBitflags, writeBitflags, sizeOfBitflags, require('../../ProtoDef/schemas/utils.json').bitflags],
  cstring: [readCString, writeCString, sizeOfCString, require('../../ProtoDef/schemas/utils.json').cstring],
  mapper: [readMapper, writeMapper, sizeOfMapper, require('../../ProtoDef/schemas/utils.json').mapper],
  ...require('./varint')
}

function mapperEquality (a, b) {
  return a === b || parseInt(a) === parseInt(b)
}

function readMapper (view, offset, { type, mappings }, rootNode) {
  const { size, value } = this.read(view, offset, type, rootNode)
  let mappedValue = null
  const keys = Object.keys(mappings)
  for (let i = 0; i < keys.length; i++) {
    if (mapperEquality(keys[i], value)) {
      mappedValue = mappings[keys[i]]
      break
    }
  }
  if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
  return {
    size,
    value: mappedValue
  }
}

function writeMapper (value, view, offset, { type, mappings }, rootNode) {
  const keys = Object.keys(mappings)
  let mappedValue = null
  for (let i = 0; i < keys.length; i++) {
    if (mapperEquality(mappings[keys[i]], value)) {
      mappedValue = keys[i]
      break
    }
  }
  if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
  return this.write(mappedValue, view, offset, type, rootNode)
}

function sizeOfMapper (value, { type, mappings }, rootNode) {
  const keys = Object.keys(mappings)
  let mappedValue = null
  for (let i = 0; i < keys.length; i++) {
    if (mapperEquality(mappings[keys[i]], value)) {
      mappedValue = keys[i]
      break
    }
  }
  if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
  return this.sizeOf(mappedValue, type, rootNode)
}

function readPString (view, offset, typeArgs, rootNode) {
  const { size, count } = getCount.call(this, view, offset, typeArgs, rootNode)
  const cursor = offset + size
  const strEnd = cursor + count
  if (strEnd > view.byteLength) {
    throw new PartialReadError('Missing characters in string, found size is ' + view.byteLength +
    ' expected size was ' + strEnd)
  }

  const encoding = typeArgs.encoding || 'utf8'
  const bytes = new Uint8Array(view.buffer, view.byteOffset + cursor, count)
  const decoder = getTextDecoder(encoding)
  return {
    value: decoder.decode(bytes),
    size: strEnd - offset
  }
}

function writePString (value, view, offset, typeArgs, rootNode) {
  const encoding = typeArgs.encoding || 'utf8'
  const encoder = getTextEncoder(encoding)
  const bytes = encoder ? encoder.encode(value) : utf8Encoder.encode(value)
  const length = bytes.length
  offset = sendCount.call(this, length, view, offset, typeArgs, rootNode)
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  uint8View.set(bytes, offset)
  return offset + length
}

function sizeOfPString (value, typeArgs, rootNode) {
  const encoding = typeArgs.encoding || 'utf8'
  const encoder = getTextEncoder(encoding)
  const bytes = encoder ? encoder.encode(value) : utf8Encoder.encode(value)
  const length = bytes.length
  const size = calcCount.call(this, length, typeArgs, rootNode)
  return size + length
}

function readBool (view, offset) {
  if (offset + 1 > view.byteLength) throw new PartialReadError()
  const value = view.getInt8(offset)
  return {
    value: !!value,
    size: 1
  }
}

function writeBool (value, view, offset) {
  view.setInt8(offset, +value)
  return offset + 1
}

function readBuffer (view, offset, typeArgs, rootNode) {
  const { size, count } = getCount.call(this, view, offset, typeArgs, rootNode)
  offset += size
  if (offset + count > view.byteLength) throw new PartialReadError()
  return {
    value: new Uint8Array(view.buffer, view.byteOffset + offset, count),
    size: size + count
  }
}

function writeBuffer (value, view, offset, typeArgs, rootNode) {
  if (!(value instanceof Uint8Array)) {
    value = new Uint8Array(value)
  }
  offset = sendCount.call(this, value.length, view, offset, typeArgs, rootNode)
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  uint8View.set(value, offset)
  return offset + value.length
}

function sizeOfBuffer (value, typeArgs, rootNode) {
  if (!(value instanceof Uint8Array)) {
    value = new Uint8Array(value)
  }
  const size = calcCount.call(this, value.length, typeArgs, rootNode)
  return size + value.length
}

function readVoid () {
  return {
    value: undefined,
    size: 0
  }
}

function writeVoid (value, view, offset) {
  return offset
}

function generateBitMask (n) {
  return (1 << n) - 1
}

function readBitField (view, offset, typeArgs) {
  const beginOffset = offset
  let curVal = null
  let bits = 0
  const results = {}
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  results.value = typeArgs.reduce((acc, { size, signed, name }) => {
    let currentSize = size
    let val = 0
    while (currentSize > 0) {
      if (bits === 0) {
        if (view.byteLength < offset + 1) { throw new PartialReadError() }
        curVal = uint8View[offset++]
        bits = 8
      }
      const bitsToRead = Math.min(currentSize, bits)
      val = (val << bitsToRead) | (curVal & generateBitMask(bits)) >> (bits - bitsToRead)
      bits -= bitsToRead
      currentSize -= bitsToRead
    }
    if (signed && val >= 1 << (size - 1)) { val -= 1 << size }
    acc[name] = val
    return acc
  }, {})
  results.size = offset - beginOffset
  return results
}
function writeBitField (value, view, offset, typeArgs) {
  let toWrite = 0
  let bits = 0
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  typeArgs.forEach(({ size, signed, name }) => {
    const val = value[name]
    if ((!signed && val < 0) || (signed && val < -(1 << (size - 1)))) { throw new Error(value + ' < ' + signed ? (-(1 << (size - 1))) : 0) } else if ((!signed && val >= 1 << size) ||
        (signed && val >= (1 << (size - 1)) - 1)) { throw new Error(value + ' >= ' + signed ? (1 << size) : ((1 << (size - 1)) - 1)) }
    while (size > 0) {
      const writeBits = Math.min(8 - bits, size)
      toWrite = toWrite << writeBits |
        ((val >> (size - writeBits)) & generateBitMask(writeBits))
      size -= writeBits
      bits += writeBits
      if (bits === 8) {
        uint8View[offset++] = toWrite
        bits = 0
        toWrite = 0
      }
    }
  })
  if (bits !== 0) { uint8View[offset++] = toWrite << (8 - bits) }
  return offset
}

function sizeOfBitField (value, typeArgs) {
  return Math.ceil(typeArgs.reduce((acc, { size }) => {
    return acc + size
  }, 0) / 8)
}

function readCString (view, offset, typeArgs) {
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let size = 0
  while (offset + size < view.byteLength && uint8View[offset + size] !== 0x00) { size++ }
  if (view.byteLength < offset + size + 1) { throw new PartialReadError() }

  const encoding = typeArgs?.encoding || 'utf8'
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, size)
  const decoder = getTextDecoder(encoding)
  return {
    value: decoder.decode(bytes),
    size: size + 1
  }
}

function writeCString (value, view, offset, typeArgs) {
  const encoding = typeArgs?.encoding || 'utf8'
  const encoder = getTextEncoder(encoding)
  const bytes = encoder ? encoder.encode(value) : utf8Encoder.encode(value)
  const length = bytes.length
  const uint8View = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  uint8View.set(bytes, offset)
  offset += length
  view.setInt8(offset, 0x00)
  return offset + 1
}

function sizeOfCString (value) {
  const bytes = utf8Encoder.encode(value)
  return bytes.length + 1
}

function readBitflags (view, offset, { type, flags, shift, big }, rootNode) {
  const { size, value } = this.read(view, offset, type, rootNode)
  let f = {}
  if (Array.isArray(flags)) {
    for (const [k, v] of Object.entries(flags)) {
      f[v] = big ? (1n << BigInt(k)) : (1 << k)
    }
  } else if (shift) {
    for (const k in flags) {
      f[k] = big ? (1n << BigInt(flags[k])) : (1 << flags[k])
    }
  } else {
    f = flags
  }
  const result = { _value: value }
  for (const key in f) {
    result[key] = (value & f[key]) === f[key]
  }
  return { value: result, size }
}

function writeBitflags (value, view, offset, { type, flags, shift, big }, rootNode) {
  let f = {}
  if (Array.isArray(flags)) {
    for (const [k, v] of Object.entries(flags)) {
      f[v] = big ? (1n << BigInt(k)) : (1 << k)
    }
  } else if (shift) {
    for (const k in flags) {
      f[k] = big ? (1n << BigInt(flags[k])) : (1 << flags[k])
    }
  } else {
    f = flags
  }
  let val = value._value || (big ? 0n : 0)
  for (const key in f) {
    if (value[key]) val |= f[key]
  }
  return this.write(val, view, offset, type, rootNode)
}

function sizeOfBitflags (value, { type, flags, shift, big }, rootNode) {
  if (!value) throw new Error('Missing field')
  let f = {}
  if (Array.isArray(flags)) {
    for (const [k, v] of Object.entries(flags)) {
      f[v] = big ? (1n << BigInt(k)) : (1 << k)
    }
  } else if (shift) {
    for (const k in flags) {
      f[k] = big ? (1n << BigInt(flags[k])) : (1 << flags[k])
    }
  } else {
    f = flags
  }
  let mappedValue = value._value || (big ? 0n : 0)
  for (const key in f) {
    if (value[key]) mappedValue |= f[key]
  }
  return this.sizeOf(mappedValue, type, rootNode)
}
