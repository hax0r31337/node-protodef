module.exports = {
  Read: {
    pstring: ['parametrizable', (compiler, string) => {
      let code = ''
      if (string.countType) {
        code += 'const { value: count, size: countSize } = ' + compiler.callType(string.countType) + '\n'
      } else if (string.count) {
        code += 'const count = ' + string.count + '\n'
        code += 'const countSize = 0\n'
      } else {
        throw new Error('pstring must contain either count or countType')
      }
      code += 'offset += countSize\n'
      code += 'if (offset + count > buffer.byteLength) {\n'
      code += '  throw new PartialReadError("Missing characters in string, found size is " + buffer.byteLength + " expected size was " + (offset + count))\n'
      code += '}\n'
      const encoding = string.encoding || 'utf8'
      if (encoding === 'utf8' || encoding === 'utf-8') {
        code += 'if (!ctx.textDecoder) ctx.textDecoder = new TextDecoder("utf-8")\n'
        code += 'const stringBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, count)\n'
        code += 'return { value: ctx.textDecoder.decode(stringBytes), size: count + countSize }'
      } else {
        code += `if (!ctx.textDecoder_${encoding}) ctx.textDecoder_${encoding} = new TextDecoder("${encoding}")\n`
        code += 'const stringBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, count)\n'
        code += `return { value: ctx.textDecoder_${encoding}.decode(stringBytes), size: count + countSize }`
      }
      return compiler.wrapCode(code)
    }],
    buffer: ['parametrizable', (compiler, buffer) => {
      let code = ''
      if (buffer.countType) {
        code += 'const { value: count, size: countSize } = ' + compiler.callType(buffer.countType) + '\n'
      } else if (buffer.count) {
        code += 'const count = ' + buffer.count + '\n'
        code += 'const countSize = 0\n'
      } else {
        throw new Error('buffer must contain either count or countType')
      }
      code += 'offset += countSize\n'
      code += 'if (offset + count > buffer.byteLength) {\n'
      code += '  throw new PartialReadError()\n'
      code += '}\n'
      code += 'const slicedView = new DataView(buffer.buffer, buffer.byteOffset + offset, count)\n'
      code += 'return { value: slicedView, size: count + countSize }'
      return compiler.wrapCode(code)
    }],
    bitfield: ['parametrizable', (compiler, values) => {
      let code = ''
      const totalBytes = Math.ceil(values.reduce((acc, { size }) => acc + size, 0) / 8)
      code += `if ( offset + ${totalBytes} > buffer.byteLength) { throw new PartialReadError() }\n`

      const names = []
      let totalSize = 8
      code += 'let bits = buffer.getUint8(offset++)\n'
      for (const i in values) {
        const { name, size, signed } = values[i]
        const trueName = compiler.getField(name)
        while (totalSize < size) {
          totalSize += 8
          code += 'bits = (bits << 8) | buffer.getUint8(offset++)\n'
        }
        code += `let ${trueName} = (bits >> ` + (totalSize - size) + ') & 0x' + ((1 << size) - 1).toString(16) + '\n'
        if (signed) code += `${trueName} -= (${trueName} & 0x` + (1 << (size - 1)).toString(16) + ') << 1\n'
        totalSize -= size
        if (name === trueName) names.push(name)
        else names.push(`${name}: ${trueName}`)
      }
      code += 'return { value: { ' + names.join(', ') + ` }, size: ${totalBytes} }`
      return compiler.wrapCode(code)
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]}${big ? 'n,' : ','}`
        fstr += '}'
      }
      return compiler.wrapCode(`
const { value: _value, size } = ${compiler.callType(type, 'offset')}
const value = { _value }
const flags = ${fstr}
for (const key in flags) {
  value[key] = (_value & flags[key]) == flags[key]
}
return { value, size }
      `.trim())
    }],
    mapper: ['parametrizable', (compiler, mapper) => {
      let code = 'const { value, size } = ' + compiler.callType(mapper.type) + '\n'
      code += 'return { value: ' + JSON.stringify(sanitizeMappings(mapper.mappings)) + '[value] || value, size }'
      return compiler.wrapCode(code)
    }]
  },

  Write: {
    pstring: ['parametrizable', (compiler, string) => {
      const encoding = string.encoding || 'utf8'
      let code = ''
      if (encoding === 'utf8' || encoding === 'utf-8') {
        code += 'if (!ctx.textEncoder) ctx.textEncoder = new TextEncoder()\n'
        code += 'const encodedBytes = ctx.textEncoder.encode(value)\n'
      } else {
        code += `if (!ctx.textEncoder_${encoding}) ctx.textEncoder_${encoding} = new TextEncoder("${encoding}")\n`
        code += `const encodedBytes = ctx.textEncoder_${encoding}.encode(value)\n`
      }
      code += 'const length = encodedBytes.length\n'
      if (string.countType) {
        code += 'offset = ' + compiler.callType('length', string.countType) + '\n'
      } else if (string.count === null) {
        throw new Error('pstring must contain either count or countType')
      }
      code += 'const targetBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, length)\n'
      code += 'targetBytes.set(encodedBytes)\n'
      code += 'return offset + length'
      return compiler.wrapCode(code)
    }],
    buffer: ['parametrizable', (compiler, buffer) => {
      let code = 'let sourceBytes\n'
      code += 'if (value instanceof DataView) {\n'
      code += '  sourceBytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)\n'
      code += '} else if (value instanceof Uint8Array) {\n'
      code += '  sourceBytes = value\n'
      code += '} else if (ArrayBuffer.isView(value)) {\n'
      code += '  sourceBytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)\n'
      code += '} else {\n'
      code += '  sourceBytes = new Uint8Array(value)\n'
      code += '}\n'
      if (buffer.countType) {
        code += 'offset = ' + compiler.callType('sourceBytes.length', buffer.countType) + '\n'
      } else if (buffer.count === null) {
        throw new Error('buffer must contain either count or countType')
      }
      code += 'const targetBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, sourceBytes.length)\n'
      code += 'targetBytes.set(sourceBytes)\n'
      code += 'return offset + sourceBytes.length'
      return compiler.wrapCode(code)
    }],
    bitfield: ['parametrizable', (compiler, values) => {
      let toWrite = ''
      let bits = 0
      let code = ''
      for (const i in values) {
        let { name, size } = values[i]
        const trueName = compiler.getField(name)
        code += `let ${trueName} = value.${name}\n`
        while (size > 0) {
          const writeBits = Math.min(8 - bits, size)
          const mask = ((1 << writeBits) - 1)
          if (toWrite !== '') toWrite = `((${toWrite}) << ${writeBits}) | `
          toWrite += `((${trueName} >> ` + (size - writeBits) + ') & 0x' + mask.toString(16) + ')'
          size -= writeBits
          bits += writeBits
          if (bits === 8) {
            code += 'buffer.setUint8(offset++, ' + toWrite + ')\n'
            bits = 0
            toWrite = ''
          }
        }
      }
      if (bits !== 0) {
        code += 'buffer.setUint8(offset++, (' + toWrite + ') << ' + (8 - bits) + ')\n'
      }
      code += 'return offset'
      return compiler.wrapCode(code)
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]}${big ? 'n,' : ','}`
        fstr += '}'
      }
      return compiler.wrapCode(`
const flags = ${fstr}
let val = value._value ${big ? '|| 0n' : ''}
for (const key in flags) {
  if (value[key]) val |= flags[key]
}
return (ctx.${type})(val, buffer, offset)
      `.trim())
    }],
    mapper: ['parametrizable', (compiler, mapper) => {
      const mappings = JSON.stringify(swapMappings(mapper.mappings))
      const code = 'return ' + compiler.callType(`${mappings}[value] || value`, mapper.type)
      return compiler.wrapCode(code)
    }]
  },

  SizeOf: {
    pstring: ['parametrizable', (compiler, string) => {
      const encoding = string.encoding || 'utf8'
      let code = ''
      if (encoding === 'utf8' || encoding === 'utf-8') {
        code += 'if (!ctx.textEncoder) ctx.textEncoder = new TextEncoder()\n'
        code += 'let size = ctx.textEncoder.encode(value).length\n'
      } else {
        code += `if (!ctx.textEncoder_${encoding}) ctx.textEncoder_${encoding} = new TextEncoder("${encoding}")\n`
        code += `let size = ctx.textEncoder_${encoding}.encode(value).length\n`
      }
      if (string.countType) {
        code += 'size += ' + compiler.callType('size', string.countType) + '\n'
      } else if (string.count === null) {
        throw new Error('pstring must contain either count or countType')
      }
      code += 'return size'
      return compiler.wrapCode(code)
    }],
    buffer: ['parametrizable', (compiler, buffer) => {
      let code = 'let size\n'
      code += 'if (value instanceof DataView) {\n'
      code += '  size = value.byteLength\n'
      code += '} else if (value instanceof Uint8Array) {\n'
      code += '  size = value.length\n'
      code += '} else if (ArrayBuffer.isView(value)) {\n'
      code += '  size = value.byteLength\n'
      code += '} else {\n'
      code += '  size = new Uint8Array(value).length\n'
      code += '}\n'
      if (buffer.countType) {
        code += 'size += ' + compiler.callType('size', buffer.countType) + '\n'
      } else if (buffer.count === null) {
        throw new Error('buffer must contain either count or countType')
      }
      code += 'return size'
      return compiler.wrapCode(code)
    }],
    bitfield: ['parametrizable', (compiler, values) => {
      const totalBytes = Math.ceil(values.reduce((acc, { size }) => acc + size, 0) / 8)
      return `${totalBytes}`
    }],
    bitflags: ['parametrizable', (compiler, { type, flags, shift, big }) => {
      let fstr = JSON.stringify(flags)
      if (Array.isArray(flags)) {
        fstr = '{'
        for (const [k, v] of Object.entries(flags)) fstr += `"${v}": ${big ? (1n << BigInt(k)) : (1 << k)}` + (big ? 'n,' : ',')
        fstr += '}'
      } else if (shift) {
        fstr = '{'
        for (const key in flags) fstr += `"${key}": ${1 << flags[key]}${big ? 'n,' : ','}`
        fstr += '}'
      }
      return compiler.wrapCode(`
const flags = ${fstr}
let val = value._value ${big ? '|| 0n' : ''}
for (const key in flags) {
  if (value[key]) val |= flags[key]
}
return (ctx.${type})(val)
      `.trim())
    }],
    mapper: ['parametrizable', (compiler, mapper) => {
      const mappings = JSON.stringify(swapMappings(mapper.mappings))
      const code = 'return ' + compiler.callType(`${mappings}[value] || value`, mapper.type)
      return compiler.wrapCode(code)
    }]
  }
}

// Convert hexadecimal keys to decimal
function sanitizeMappings (json) {
  const ret = {}
  for (let key in json) {
    let val = json[key]
    key = hex2dec(key)
    if (!isNaN(val)) val = Number(val)
    if (val === 'true') val = true
    if (val === 'false') val = false
    ret[key] = val
  }
  return ret
}

function swapMappings (json) {
  const ret = {}
  for (let key in json) {
    const val = json[key]
    key = hex2dec(key)
    ret[val] = (isNaN(key)) ? key : parseInt(key, 10)
  }
  return ret
}

function hex2dec (num) {
  if ((num.match(/^0x[0-9a-f]+$/i))) { return parseInt(num.substring(2), 16) }
  return num
}
