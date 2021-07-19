// ReadableStreams don't let you read out specific quantities of bytes. This wrapper does

// In case we want to introduce something like msgpack-javascript's ReadableStreamLike later
type BasicStream = ReadableStream
type BasicReader = ReadableStreamDefaultReader
type GeneratorResult = {value?:any, done?:boolean}

// Based on typedArrays.ts in msgpack-javascript
function toUintArray(obj:unknown) {
	if (obj instanceof Uint8Array)
		return obj
	throw new Error("Not a Uint8Array: " + (typeof obj))
}

interface ByteReader {
	readBytes(dst:Uint8Array, bytesMax:number) : Promise<number> // Returns bytes read
	eof() : boolean
}

abstract class BufferedByteReader {
	lastBuffer:Uint8Array
	lastBufferOffset:number
	eofLast:boolean

	// Writes lastBuffer and eofLast as appropriate
	// Behavior is undefined if eofLast already true when it is called
	abstract readNext():Promise<void>

	// The ReadableStream will feed us buffers of unpredictable size. We need to parcel those buffers back out.
	async readBytes(dst:Uint8Array, bytesMax:number) {
		let copied = 0
		// Loop until all requested bytes are fulfilled, or the stream runs out of bytes
		while (!this.eofLast && copied < bytesMax) {
			if (!this.lastBuffer) { // First buffer, or last buffer exhausted
				await this.readNext()
				this.lastBufferOffset = 0
			}
			if (this.lastBuffer) { // Assume if this is null we've hit eof
				const remainToCopy = bytesMax-copied // Max bytes we can read
				const remainInBuffer = this.lastBuffer.length-this.lastBufferOffset
				const overflow = remainInBuffer > remainToCopy // More bytes exist than we can read?
				const haveOffset = this.lastBufferOffset > 0 // If true reading from not-start-of-buffer
				const readLength = Math.min(remainToCopy, remainInBuffer)
				const slice = overflow || haveOffset ? // Because of how set() works, unless we're copying the full buffer
				              this.lastBuffer.slice(this.lastBufferOffset, this.lastBufferOffset + readLength) : // we have to slice.
				              this.lastBuffer

				dst.set(slice)
				this.lastBufferOffset += readLength
				copied += readLength
				// Finished with buffer
				if (this.lastBufferOffset >= this.lastBuffer.length) {
					this.lastBuffer = null
					this.lastBufferOffset = null
				}
			}
		}
		return copied // If undersized that's a sign of early EOF
	}
	eof() { return !this.lastBuffer && this.eofLast }
}

// Based on something resembling AsyncGenerator
abstract class GeneratorByteReader extends BufferedByteReader {
	abstract next(): Promise<GeneratorResult>

	async readNext() {
		const readResult = await this.next()
		if (readResult.value) { // Usually EOF will result in a blank value and done set
			this.lastBuffer = toUintArray(readResult.value)
		}
		this.eofLast = readResult.done
		this.lastBufferOffset = 0
	}
}

// Based on a (browser) ReadableStream
class StreamByteReader extends GeneratorByteReader {
	reader: BasicReader

	constructor(stream : BasicStream) {
		super()
		this.reader = stream.getReader()
	}

	next() {
		return this.reader.read()
	}
}

// Based on an iterator stream
class ItByteReader extends GeneratorByteReader {
	iterator: AsyncGenerator

	constructor(stream: AsyncGenerator) {
		super()
		this.iterator = stream[Symbol.asyncIterator]()
	}

	next() {
		return this.iterator.next()
	}
}


// Based on an iterator stream which returns BufferLists.
// This is inefficient, it is a stopgap. BufferList actually provides the same functions as ByteReader,
// so this could be written to just rely on ByteReader.copy.
class ItBlByteReader extends GeneratorByteReader {
	iterator: AsyncGenerator

	constructor(stream: AsyncGenerator) {
		super()
		this.iterator = stream[Symbol.asyncIterator]()
	}

	async next() {
		const v = await this.iterator.next()
		if (v.done)
			return {done:true}
		return {
			value:new Uint8Array(v.value.slice(0, v.value.length).buffer)
		}
	}
}

export { toUintArray, ByteReader, StreamByteReader, ItByteReader, ItBlByteReader }
