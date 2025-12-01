const { PartialReadError } = require('../utils')

module.exports = {
  varint: [readVarInt, writeVarInt, sizeOfVarInt, require('../../ProtoDef/schemas/numeric.json').varint],
  varint64: [readVarLong, writeVarLong, sizeOfVarLong, require('../../ProtoDef/schemas/numeric.json').varint64],
  varint128: [readVarLong128, writeVarLong, sizeOfVarLong, require('../../ProtoDef/schemas/numeric.json').varint128],
  zigzag32: [readSignedVarInt, writeSignedVarInt, sizeOfSignedVarInt, require('../../ProtoDef/schemas/numeric.json').zigzag32],
  zigzag64: [readSignedVarLong, writeSignedVarLong, sizeOfSignedVarLong, require('../../ProtoDef/schemas/numeric.json').zigzag64]
}

// u32

function readVarInt(view, offset) {
  let result = 0
  let shift = 0
  let cursor = offset

  while (true) {
    if (cursor >= view.byteLength) throw new PartialReadError('Unexpected buffer end while reading VarInt')
    const byte = view.getUint8(cursor)
    result |= (byte & 0x7F) << shift // Add the bits, excluding the MSB
    cursor++
    if (!(byte & 0x80)) { // If MSB is not set, return result
      return { value: result, size: cursor - offset }
    }
    shift += 7
    if (shift > 64) throw new PartialReadError(`varint is too big: ${shift}`) // Make sure our shift don't overflow.
  }
}

function sizeOfVarInt(value) {
  let cursor = 0
  while (value & ~0x7F) {
    value >>>= 7
    cursor++
  }
  return cursor + 1
}

function writeVarInt(value, view, offset) {
  let cursor = 0
  while (value & ~0x7F) {
    view.setUint8(offset + cursor, (value & 0xFF) | 0x80)
    cursor++
    value >>>= 7
  }
  view.setUint8(offset + cursor, value)
  return offset + cursor + 1
}

// u64

function readVarLong(view, offset) {
  let result = 0n
  let shift = 0n
  let cursor = offset

  while (true) {
    if (cursor >= view.byteLength) throw new PartialReadError('Unexpected buffer end while reading VarLong')
    const byte = view.getUint8(cursor)
    result |= (BigInt(byte) & 0x7Fn) << shift // Add the bits, excluding the MSB
    cursor++
    if (!(byte & 0x80)) { // If MSB is not set, return result
      return { value: result, size: cursor - offset }
    }
    shift += 7n
    if (shift > 63n) throw new Error(`varint is too big: ${shift}`)
  }
}

function readVarLong128(view, offset) {
  let result = 0n
  let shift = 0n
  let cursor = offset

  while (true) {
    if (cursor >= view.byteLength) throw new PartialReadError('Unexpected buffer end while reading VarLong')
    const byte = view.getUint8(cursor)
    result |= (BigInt(byte) & 0x7Fn) << shift // Add the bits, excluding the MSB
    cursor++
    if (!(byte & 0x80)) { // If MSB is not set, return result
      return { value: result, size: cursor - offset }
    }
    shift += 7n
    if (shift > 127n) throw new Error(`varint is too big: ${shift}`)
  }
}

function sizeOfVarLong(value) {
  value = BigInt(value)
  let size = 0
  do {
    value >>= 7n
    size++
  } while (value !== 0n)
  return size
}

function writeVarLong(value, view, offset) {
  value = BigInt(value)
  let cursor = offset
  do {
    const byte = value & 0x7Fn
    value >>= 7n
    view.setUint8(cursor++, Number(byte) | (value ? 0x80 : 0))
  } while (value)
  return cursor
}

// Zigzag 32

function readSignedVarInt(view, offset) {
  const { value, size } = readVarInt(view, offset)
  return { value: (value >>> 1) ^ -(value & 1), size }
}

function sizeOfSignedVarInt(value) {
  return sizeOfVarInt((value << 1) ^ (value >> 31))
}

function writeSignedVarInt(value, view, offset) {
  return writeVarInt((value << 1) ^ (value >> 31), view, offset)
}

// Zigzag 64

function readSignedVarLong(view, offset) {
  const { value, size } = readVarLong(view, offset)
  return { value: (value >> 1n) ^ -(value & 1n), size }
}

function sizeOfSignedVarLong(value) {
  return sizeOfVarLong((BigInt(value) << 1n) ^ (BigInt(value) >> 63n))
}

function writeSignedVarLong(value, view, offset) {
  return writeVarLong((BigInt(value) << 1n) ^ (BigInt(value) >> 63n), view, offset)
}
