const { getField, getFieldInfo, tryDoc, PartialReadError } = require('../utils')

module.exports = {
  switch: [readSwitch, writeSwitch, sizeOfSwitch, require('../../ProtoDef/schemas/conditional.json').switch],
  option: [readOption, writeOption, sizeOfOption, require('../../ProtoDef/schemas/conditional.json').option]
}

function readSwitch (view, offset, { compareTo, fields, compareToValue, default: defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (typeof fields[compareTo] === 'undefined' && typeof defVal === 'undefined') { throw new Error(compareTo + ' has no associated fieldInfo in switch') }
  for (const field in fields) {
    if (field.startsWith('/')) {
      fields[this.types[field.slice(1)]] = fields[field]
      delete fields[field]
    }
  }
  const caseDefault = typeof fields[compareTo] === 'undefined'
  const resultingType = caseDefault ? defVal : fields[compareTo]
  const fieldInfo = getFieldInfo(resultingType)
  return tryDoc(() => this.read(view, offset, fieldInfo, rootNode), caseDefault ? 'default' : compareTo)
}

function writeSwitch (value, view, offset, { compareTo, fields, compareToValue, default: defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (typeof fields[compareTo] === 'undefined' && typeof defVal === 'undefined') { throw new Error(compareTo + ' has no associated fieldInfo in switch') }
  for (const field in fields) {
    if (field.startsWith('/')) {
      fields[this.types[field.slice(1)]] = fields[field]
      delete fields[field]
    }
  }
  const caseDefault = typeof fields[compareTo] === 'undefined'
  const fieldInfo = getFieldInfo(caseDefault ? defVal : fields[compareTo])
  return tryDoc(() => this.write(value, view, offset, fieldInfo, rootNode), caseDefault ? 'default' : compareTo)
}

function sizeOfSwitch (value, { compareTo, fields, compareToValue, default: defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (typeof fields[compareTo] === 'undefined' && typeof defVal === 'undefined') { throw new Error(compareTo + ' has no associated fieldInfo in switch') }
  for (const field in fields) {
    if (field.startsWith('/')) {
      fields[this.types[field.slice(1)]] = fields[field]
      delete fields[field]
    }
  }
  const caseDefault = typeof fields[compareTo] === 'undefined'
  const fieldInfo = getFieldInfo(caseDefault ? defVal : fields[compareTo])
  return tryDoc(() => this.sizeOf(value, fieldInfo, rootNode), caseDefault ? 'default' : compareTo)
}

function readOption (view, offset, typeArgs, context) {
  if (view.byteLength < offset + 1) { throw new PartialReadError() }
  const val = view.getUint8(offset++)
  if (val !== 0) {
    const retval = this.read(view, offset, typeArgs, context)
    retval.size++
    return retval
  } else { return { size: 1 } }
}

function writeOption (value, view, offset, typeArgs, context) {
  if (value != null) {
    view.setUint8(offset++, 1)
    offset = this.write(value, view, offset, typeArgs, context)
  } else { view.setUint8(offset++, 0) }
  return offset
}

function sizeOfOption (value, typeArgs, context) {
  return value == null ? 1 : this.sizeOf(value, typeArgs, context) + 1
}
