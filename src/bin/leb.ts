// Implement LEB128 (currently unsigned only) https://en.wikipedia.org/wiki/LEB128
// Used for sizes

import { ByteReader } from "./byteStream"

// Takes a Uint8Array of at least 8 bytes. Returns a number of bytes.
function lengthToUleb(dst:Uint8Array, source:number) {
	let length = 0
	while (true) {
		const idx = length
		dst[idx] = source & 0x7F
		length++
		source >>= 7
		if (source > 0)
			dst[idx] |= 0x80
		else
			break
		if (length > 8) // Better to just not check and let it crash?
			throw new Error("Length longer than 2^64, should be impossible")
	}
	return length
}

const tempBuffer = new Uint8Array(8)

async function writeStreamWithUleb(writer:WritableStreamDefaultWriter, buffer:Uint8Array) {
	const lengthLength = lengthToUleb(tempBuffer, buffer.byteLength)
	await writer.write(tempBuffer.slice(0, lengthLength))
	await writer.write(buffer)
}

// Reads one byte at a time from a string until it has a length.
async function ulebLengthFromStream(reader:ByteReader) {
	let result = 0
	let bytes = 0
	while (true) {
		const count = await reader.readBytes(tempBuffer, 1)
		if (!count)
			throw new Error("Uleb ran out of buffer after " + bytes + " bytes")
console.log("Uleb debug: Got byte", tempBuffer[0])
		result <<= 7
		result |= (tempBuffer[0] & 0x7F)
		bytes++
		if (!(tempBuffer[0] & 0x80))
			break // Done!
		// You're not allocating a buffer bigger than 562 terabytes. You're just not
		// TODO: Support up to 4.5 petabytes
		if (bytes > 7) {
			throw new Error("Uleb got unrealistically large number (over 2^49)")
		}
	}
	return result
}

export { lengthToUleb, writeStreamWithUleb, ulebLengthFromStream }