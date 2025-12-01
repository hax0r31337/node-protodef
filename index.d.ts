type ReadFn = (buffer: Buffer, cursor: number, _fieldInfo: any, rootNodes: any) => any
type WriteFn = (value: any, buffer: Buffer, offset: number, _fieldInfo: any, rootNode: any) => number
type SizeOfFn = ((value: any, _fieldInfo: any, rootNode: any) => number)

type FieldInfo = string | { type: string, typeArgs: any }
type TypeFunc = [ReadFn, WriteFn, number | SizeOfFn,?any]
type TypeParams = any
declare interface TypeParamsCounted { count: number | FieldInfo, countType: TypeDef }
type TypeDef = 'native' | TypeFunc | [string, any]
type TypesDef = { [field: string]: TypeDef }
type Protocol = {
  types: TypesDef
  [field: string]: TypeDef | Protocol
}
declare type TypeDefKind = 'native' | 'context' | 'parametrizable'

declare abstract class ProtodefBaseCompiler {
  primitiveTypes = {}
  native = {}
  context = {}
  types: TypesDef
  scopeStack = []
  parameterizableTypes = {}
  addNativeType(type: string, fn: CallableFunction): void
  addContextType(type: string, fn: CallableFunction): void
  addParametrizableType(type: string, maker: CallableFunction): void
  addTypes(types: { [key: string]: [TypeDefKind, CallableFunction] }): void
  addProtocol(protocolData: Protocol, path: string[]): void
  protected addTypesToCompile(types: any): void
  protected indent(code: string, indent: string): string
  protected getField(name: string): any
  generate(): string
  compile(code: string): Function<any>
  protected wrapCode(code: string, args: string[]): string
  protected compileType(type: string | any[]): string
}

declare class ProtodefReadCompiler extends ProtodefBaseCompiler {
  private callType(value: string, type: string | any[], offsetExpr: string, args: string[]): string
}

declare class ProtodefWriteCompiler extends ProtodefBaseCompiler {
  private callType(value: string, type: string | any[], offsetExpr: string, args: string[]): string
}

declare class ProtodefSizeOfCompiler extends ProtodefBaseCompiler {
  private callType(value: string, type: string | any[], args: string[]): string
}

declare class ProtodefCompiler {
  readCompiler: ProtodefReadCompiler
  writeCompiler: ProtodefWriteCompiler
  sizeOfCompiler: ProtodefSizeOfCompiler
  addTypes(types: { [key: string]: [TypeDefKind, CallableFunction] }): void
  addProtocol(protocolData: Protocol, path: string[]): void
  addTypesToCompile(types: any): void
  addVariable(key: string, val: any): void
  compileProtoDefSync(options?: { printCode?: boolean }): CompiledProtoDef
}

declare abstract class AbstractProtoDefInterface {
  read: ReadFn
  write: WriteFn
  sizeOf: SizeOfFn
  createPacketBuffer(type: string, packet: any): Uint8Array
  parsePacketBuffer(type: string, buffer: Uint8Array | ArrayBuffer | DataView, offset = 0, assertSize = true): any
}

declare class CompiledProtoDef extends AbstractProtoDefInterface {
  private sizeOfCtx: SizeOfFn
  private writeCtx: WriteFn
  private readCtx: ReadFn
  constructor(sizeOfCtx: SizeOfFn, writeCtx: WriteFn, readCtx: ReadFn)
  setVariable(key: string, val: any): void
}

declare class ProtodefPartialError extends Error {
  partialReadError: true
  constructor(message?: string)
}

declare module 'protodef' {
  export const Compiler: {
    ReadCompiler: typeof ProtodefReadCompiler
    WriteCompiler: typeof ProtodefWriteCompiler
    SizeOfCompiler: typeof ProtodefSizeOfCompiler
    ProtoDefCompiler: typeof ProtodefCompiler
    CompiledProtoDef: CompiledProtoDef
  }
  export const utils: {
    getField(countField: string, context: object): any | undefined
    getFieldInfo(fieldInfo: FieldInfo): FieldInfo
    addErrorField(e: Error & { field: string }, field: string): Error & { field: string }
    getCount(buffer: Buffer, offset: number, options: TypeParamsCounted, rootNode: any): { count: number, size: number }
    sendCount(len: number, buffer: Buffer, offset: number, options: TypeParamsCounted, rootNode: any): number
    calcCount(len: number, options: TypeParamsCounted, rootNode: any): number
    tryCatch(tryfn: CallableFunction, catchfn: CallableFunction): any
    PartialReadError
  }
}
