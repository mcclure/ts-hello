## Subformats

* ULEB: see src/leb.ts, [Wikipedia](https://en.wikipedia.org/wiki/LEB128)
* SHA-256m1: "SHA-256 minus one", this is standard SHA-256 with the high order bit of the first byte dropped.
	* If the "dropped bit" (high order bit of byte 0) is high, this means the sha is "present" (the content denoted by the bit will be sent in this transmission)
	* A SHA-256m1 of all zeroes is taken to mean "unknown".
* msgpack: As implemented by msgpack-javascript

This is an implementation of a Merkle Tree Accumulator (see mta.ts, [Crosby09](https://www.usenix.org/legacy/events/sec09/tech/full_papers/crosby.pdf)). A terse binary packing is used.

## Implementation-specific conventions

These are not so much format restrictions as content that the current implementation cannot process.

* All ULEB sizes max out at 2^50-1 (could possibly go up to  2^55-1, so they can be stored in the integer part of a double)

## User dump

- Length of metadata blob (ULEB),
- Metadata blob (msgpack),
	Keys: user: string, depth:number
- Recursively for each hash starting with root:
	- If leaf [if at max depth]:
		- Self hash (SHA-256m1),
		- Content length (uleb),
		- Content (msgpack) [later could be specified by metadata blob]
	- If branch
		- Self hash (SHA-256m1),
		- Left node (recurse),
		- Right node (recurse),

TODO

* Should put both tree hashes together so they can be checked together
* Signing
* Special behavior for hash 0000?
