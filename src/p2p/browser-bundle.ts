// Adapted from index.js, libp2p-js "libp2p-in-the-browser" example, git tag v0.29.0

declare let require:any

const Libp2p = require('libp2p')
const Websockets = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const { NOISE } = require('libp2p-noise')
const Mplex = require('libp2p-mplex')
const Bootstrap = require('libp2p-bootstrap')
const KadDHT = require('libp2p-kad-dht')

import { hostname as bounceServer, publicKey as bounceKey } from '../../BOUNCE-SERVER'

const familyIp = `dns4/${bounceServer}`, wsPort = 10001, publicKey = bounceKey

// Starting peers
const bootstrapList : string[] = [
  `/${familyIp}/tcp/${wsPort}/ws/p2p/${publicKey}`
]

// Used for inbound connections when NATed
// libp2p-in-the-browser comment claims these are "added to our multiaddrs list"
const signalingList = [
  `/dns4/${bounceServer}/tcp/9090/ws/p2p-webrtc-star`,
]

const Node = Libp2p.create({
  addresses: {
    listen: signalingList
  },
  modules: {
    transport: [Websockets, WebRTCStar],
    connEncryption: [NOISE],
    streamMuxer: [Mplex],
    peerDiscovery: [Bootstrap],
    dht: KadDHT,
  },
  config: {
    peerDiscovery: {
      autoDial: true,
      bootstrap: {
        enabled: true,
        list: bootstrapList
      }
    },
    dht: {                        // Possible none of this is required except toplevel enabled:true
      kBucketSize: 20,
      enabled: true,
      randomWalk: {
        enabled: true,            // Allows to disable discovery (enabled by default)
        interval: 300e3,
        timeout: 10e3
      }
    }
  }
})

// Note export is a promise
export { Node }
