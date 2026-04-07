declare namespace ProtoDef {
  type PacketBuffer = Uint8Array | ArrayBuffer | DataView

  interface ReadResult<T = unknown> {
    value: T
    size: number
  }

  type TypeDefinition = string | [string, any]
  type TypeDefinitions = Record<string, TypeDefinition>

  interface Protocol {
    types?: TypeDefinitions
    [key: string]: Protocol | TypeDefinitions | undefined
  }

  interface FieldInfoObject {
    type: string
    typeArgs?: any
  }

  type FieldInfo = string | [string, any] | FieldInfoObject

  interface CountOptions {
    count?: number | string
    countType?: FieldInfo
  }

  type TypeDefKind = 'native' | 'context' | 'parametrizable'
  type CompilerImplementation = number | string | ((...args: any[]) => any)
  type CompilerTypeDefinition = [TypeDefKind, CompilerImplementation]
  type CompilerTypeDefinitions = Record<string, CompilerTypeDefinition>

  interface CompilerTypeSet {
    Read: CompilerTypeDefinitions
    Write: CompilerTypeDefinitions
    SizeOf: CompilerTypeDefinitions
  }

  interface CompiledContext {
    [key: string]: unknown
  }

  interface BaseCompiler {
    primitiveTypes: Record<string, string>
    native: Record<string, unknown>
    context: Record<string, string>
    types: TypeDefinitions
    scopeStack: Array<Record<string, string>>
    parameterizableTypes: Record<string, (...args: any[]) => string>
    addNativeType(type: string, fn: CompilerImplementation): void
    addParametrizableType(type: string, maker: (...args: any[]) => string): void
    addTypes(types: CompilerTypeDefinitions): void
    addTypesToCompile(types: TypeDefinitions): void
    addProtocol(protocolData: Protocol, path: string[]): void
    indent(code: string, indent?: string): string
    getField(name: string, noAssign?: boolean): string
    generate(): string
    compile(code: string): CompiledContext
    wrapCode(code: string, args?: string[]): string
    compileType(type: TypeDefinition): string
  }

  interface ReadCompiler extends BaseCompiler {
    callType(type: TypeDefinition, offsetExpr?: string, args?: string[]): string
  }

  interface WriteCompiler extends BaseCompiler {
    callType(value: string, type: TypeDefinition, offsetExpr?: string, args?: string[]): string
  }

  interface SizeOfCompiler extends BaseCompiler {
    callType(value: string, type: TypeDefinition, args?: string[]): string
  }

  interface CompiledProtodef {
    sizeOfCtx: CompiledContext
    writeCtx: CompiledContext
    readCtx: CompiledContext
    read<T = unknown>(view: DataView, cursor: number, type: string): ReadResult<T>
    write(value: any, view: DataView, cursor: number, type: string): number
    setVariable(key: string, val: any): void
    sizeOf(value: any, type: string): number
    createPacketBuffer(type: string, packet: any): Uint8Array
    parsePacketBuffer<T = unknown>(type: string, buffer: PacketBuffer, offset?: number, assertSize?: boolean): T
  }

  interface ProtoDefCompiler {
    readCompiler: ReadCompiler
    writeCompiler: WriteCompiler
    sizeOfCompiler: SizeOfCompiler
    addTypes(types: CompilerTypeSet): void
    addTypesToCompile(types: TypeDefinitions): void
    addProtocol(protocolData: Protocol, path: string[]): void
    addVariable(key: string, val: any): void
    compileProtoDefSync(options?: { printCode?: boolean }): CompiledProtodef
  }

  interface PartialReadError extends Error {
    partialReadError: true
  }

  interface PartialReadErrorConstructor {
    new(message?: string): PartialReadError
  }

  interface UtilsExports {
    getField(countField: string, context: any): any
    getFieldInfo(fieldInfo: FieldInfo): FieldInfoObject
    addErrorField<T extends Error & { field?: string }>(e: T, field: string): never
    getCount(this: { read: (...args: any[]) => ReadResult<number> }, buffer: DataView, offset: number, options: CountOptions, rootNode: any): { count: number, size: number }
    sendCount(this: { write: (...args: any[]) => number }, len: number, buffer: DataView, offset: number, options: CountOptions, rootNode: any): number
    calcCount(this: { sizeOf: (...args: any[]) => number }, len: number, options: CountOptions, rootNode: any): number
    tryCatch<T>(tryfn: () => T, catchfn: (err: any) => void): T | undefined
    tryDoc<T>(tryfn: () => T, field: string): T
    PartialReadError: PartialReadErrorConstructor
  }

  interface CompilerExports {
    ReadCompiler: new () => ReadCompiler
    WriteCompiler: new () => WriteCompiler
    SizeOfCompiler: new () => SizeOfCompiler
    ProtoDefCompiler: new () => ProtoDefCompiler
    CompiledProtodef: new (sizeOfCtx: CompiledContext, writeCtx: CompiledContext, readCtx: CompiledContext) => CompiledProtodef
  }

  const Compiler: CompilerExports
  const utils: UtilsExports
}

declare const protodef: {
  Compiler: ProtoDef.CompilerExports
  utils: ProtoDef.UtilsExports
}

export = protodef
