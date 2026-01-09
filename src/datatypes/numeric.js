const { PartialReadError } = require('../utils')

function readI64(view, offset) {
  if (offset + 8 > view.byteLength) { throw new PartialReadError() }
  return {
    value: view.getBigInt64(offset, false),
    size: 8
  }
}

function writeI64(value, view, offset) {
  view.setBigInt64(offset, BigInt(value), false)
  return offset + 8
}

function readLI64(view, offset) {
  if (offset + 8 > view.byteLength) { throw new PartialReadError() }
  return {
    value: view.getBigInt64(offset, true),
    size: 8
  }
}

function writeLI64(value, view, offset) {
  view.setBigInt64(offset, BigInt(value), true)
  return offset + 8
}

function readU64(view, offset) {
  if (offset + 8 > view.byteLength) { throw new PartialReadError() }
  return {
    value: view.getBigUint64(offset, false),
    size: 8
  }
}

function writeU64(value, view, offset) {
  view.setBigUint64(offset, BigInt(value), false)
  return offset + 8
}

function readLU64(view, offset) {
  if (offset + 8 > view.byteLength) { throw new PartialReadError() }
  return {
    value: view.getBigUint64(offset, true),
    size: 8
  }
}

function writeLU64(value, view, offset) {
  view.setBigUint64(offset, BigInt(value), true)
  return offset + 8
}

function generateFunctions(dataViewReader, dataViewWriter, size, littleEndian, schema) {
  const reader = (view, offset) => {
    if (offset + size > view.byteLength) { throw new PartialReadError() }
    const value = size === 1 ? view[dataViewReader](offset) : view[dataViewReader](offset, littleEndian)
    return {
      value,
      size
    }
  }
  const writer = (value, view, offset) => {
    if (size === 1) {
      view[dataViewWriter](offset, value)
    } else {
      view[dataViewWriter](offset, value, littleEndian)
    }
    return offset + size
  }
  return [reader, writer, size, schema]
}

const nums = {
  i8: ['getInt8', 'setInt8', 1, false],
  u8: ['getUint8', 'setUint8', 1, false],
  i16: ['getInt16', 'setInt16', 2, false],
  u16: ['getUint16', 'setUint16', 2, false],
  i32: ['getInt32', 'setInt32', 4, false],
  u32: ['getUint32', 'setUint32', 4, false],
  f32: ['getFloat32', 'setFloat32', 4, false],
  f64: ['getFloat64', 'setFloat64', 8, false],
  li8: ['getInt8', 'setInt8', 1, true],
  lu8: ['getUint8', 'setUint8', 1, true],
  li16: ['getInt16', 'setInt16', 2, true],
  lu16: ['getUint16', 'setUint16', 2, true],
  li32: ['getInt32', 'setInt32', 4, true],
  lu32: ['getUint32', 'setUint32', 4, true],
  lf32: ['getFloat32', 'setFloat32', 4, true],
  lf64: ['getFloat64', 'setFloat64', 8, true]
}

const types = Object.keys(nums).reduce((types, num) => {
  types[num] = generateFunctions(nums[num][0], nums[num][1], nums[num][2], nums[num][3], require('../../ProtoDef/schemas/numeric.json')[num])
  return types
}, {})
types.i64 = [readI64, writeI64, 8, require('../../ProtoDef/schemas/numeric.json').i64]
types.li64 = [readLI64, writeLI64, 8, require('../../ProtoDef/schemas/numeric.json').li64]
types.u64 = [readU64, writeU64, 8, require('../../ProtoDef/schemas/numeric.json').u64]
types.lu64 = [readLU64, writeLU64, 8, require('../../ProtoDef/schemas/numeric.json').lu64]

module.exports = types
