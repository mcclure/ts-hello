// Implement LEB128 (currently unsigned only) https://en.wikipedia.org/wiki/LEB128
// Used for sizes

import { ByteReader } from "./byteStream"

// Takes a Uint8Array of at least 8 bytes. Returns a number of bytes.
function lengthToUleb(dst:Uint8Array, source:number) {
	if (source > 255)
		throw new Error("Fake uleb doesn't work with bytes>255")
	console.log("Creating fake-uleb array contents", source)
	dst[0] = source
	return 1
}

const tempBuffer = new Uint8Array(1)

async function writeStreamWithUleb(writer:WritableStreamDefaultWriter, buffer:Uint8Array) {
	const lengthLength = lengthToUleb(tempBuffer, buffer.byteLength)
	if (lengthLength != 1)
		throw new Error("Fake uleb should always write a single byte")
	console.log("Fake-uleb send debug:", tempBuffer[0])
	await writer.write(tempBuffer)
	await writer.write(buffer)
}

// Reads one byte at a time from a string until it has a length.
async function ulebLengthFromStream(reader:ByteReader) {
	let result = 0
	let bytes = 0
	const count = await reader.readBytes(tempBuffer, 1)
	if (!count)
		throw new Error("Fake-uleb couldn't read buffer")
	console.log("Fake-uleb debug: Got byte", tempBuffer[0])
	result = tempBuffer[0]
	return result
}

export { lengthToUleb, writeStreamWithUleb, ulebLengthFromStream }