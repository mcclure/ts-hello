/* eslint-disable no-console */
'use strict'

const Libp2p = require('libp2p')
const PeerId = require('peer-id')
const Websockets = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const Mplex = require('libp2p-mplex')
const { NOISE } = require('libp2p-noise')
const KadDHT = require('libp2p-kad-dht')
const commander = require('commander')
const commandError = require('commander.js-error')
const wrtc = require('wrtc')
const fs = require('fs')
const os = require('os')

const hostname = require('../BOUNCE-SERVER').hostname

const wsPort = 10001
const verboseNetwork = true

// When invoking this script, you should include two things:
// - A file to store/load an encryption key in, so that is consistent across boots
// - A protocol name. Because the libp2p discovery protocols are still in progress,
//   you need to ensure that the p2p swarm for your app consists of *only* users of
//   your app. To guarantee that, support a "hello" protocol that your app nodes
//   support but incompatible nodes will not. The bounce server will dial that
//   protocol on connection-- disconnecting if it is not supported-- and the bounce
//   server will respond to messages on that by sending a single 0 byte.
//   As long as valid nodes (1) send something other than a 0 byte on connect, and
//   (2) do not attempt to communicate with a node that sends a lone 0 byte on connect,
//   you will both know that all nodes follow your protocol and know which nodes are
//   network-glue-only.
commander
  .version("0.0.1")
  .option('-f, --id-file <file>', 'Store/load peer ID here')
  .option('-t, --id-temp', 'Single-use ID (not recommended)')
  .option('-p, --protocol <name>', 'Protocol to dial/ack (don\'t include trailing slash)')
  .parse(process.argv)
const options = commander.opts()

const delay = require('delay')

const transportKey = WebRTCStar.prototype[Symbol.toStringTag]

if (!(options.idFile || options.idTemp))
  commandError("Must specify peer file, for example -f peer.json")
if (options.idFile && options.idTemp)
  commandError("Included both --id-file and --id-temp options, which doesn't make sense")

const createNode = async (peerId) => {
  const node = await Libp2p.create({
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
        `/dns4/${hostname}/tcp/9090/ws/p2p-webrtc-star`
      ]
    },
    modules: {
      transport: [Websockets, WebRTCStar],
      streamMuxer: [Mplex],
      connEncryption: [NOISE],
      dht: KadDHT
    },
    config: {
      peerDiscovery: {
          autoDial:false
      },
      dht: {
        enabled: true
      },
      transport: {
        [transportKey]: {
          wrtc // You can use `wrtc` when running in Node.js
        }
      }
    },
    peerId
  })

  await node.start()
  return node
}

let node1
;(async () => {
  let peerId

  // Load peer from file (if any)
  if (options.idFile && fs.existsSync(options.idFile)) {
    const json = JSON.parse( fs.readFileSync(options.idFile) )
    peerId = await PeerId.createFromJSON(json)
  }

  // Create peer (if needed)
  if (!peerId) {
    peerId = await PeerId.create({keyType:'ed25519', bits:2048})
    console.log("Generating new peer keys")

    if (options.idFile) {
      fs.writeFileSync(options.idFile, JSON.stringify( peerId.toJSON() ))
    }
  }

  // Create node with peer
  node1 = await createNode(peerId)
  console.log("Self is", node1.peerId.toB58String())

  if (options.protocol) { // See note at top
    const tempBuffer = new Uint8Array([0]) // Single zero byte, indicating a 0-length message, indicating ACK
    const protocolString = `/${options.protocol}`


    // Respond to any message with empty response
    node1.handle([protocolString], ({ protocol, stream }) => {
      (async () => {
        await stream.write(tempBuffer, 1)
      })()
    })

    // Don't connect to or gossip about nodes unless they support the required protocol
    node1.peerStore.on('change:protocols', ({ peerId, protocols}) => {
      if (!protocols.includes(protocolString)) {
        node1.hangUp(peerId)
        node1.peerStore.addressBook.delete(peerId)
        if (verboseNetwork) console.log("Rejecting peer", peerId.toB58String(), "for lack of protocol", protocolString, "supported protocols", protocols)
      }
      else if (verboseNetwork) console.log("Accepting peer", peerId.toB58String(), "with protocol", protocolString)
    })
  }

  // Print access info
  console.log("\nYou can access the server at these multiaddrs:")

  const nets = os.networkInterfaces();
  const results = Object.create(null); // or just '{}', an empty object

  for (const internal of [true, false]) {
    let header
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.internal != internal || (net.family !== 'IPv4')) { // && net.family !== 'IPv6'
          continue
        }
        if (!header) {
          console.log(internal ? "\n(local)" : "\n(global)")
          header = true
        }

        console.log(`\n/ip4/${net.address}/tcp/${wsPort}/ws/p2p/${peerId.toB58String()}`);
      }
    }
  }
})();
