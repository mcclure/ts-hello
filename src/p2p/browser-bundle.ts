// File from browser-bundle.js, libp2p-js "libp2p-in-the-browser" example, git tag v0.27.3
// libp2p-js license (MIT) applies

declare let require:any

const Libp2p = require('libp2p')
const Websockets = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const Secio = require('libp2p-secio')
const Mplex = require('libp2p-mplex')
const Boostrap = require('libp2p-bootstrap')

// Find this list at: https://github.com/libp2p/js-libp2p/blob/master/examples/libp2p-in-the-browser/index.js
const bootstrapList = [
  '/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
  '/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
  '/dns4/sfo-3.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
  '/dns4/sgp-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
  '/dns4/nyc-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
  '/dns4/nyc-2.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64'
]

const Node:any = Libp2p.create({
  modules: {
    transport: [Websockets, WebRTCStar],
    connEncryption: [Secio],
    streamMuxer: [Mplex],
    peerDiscovery: [Boostrap]
  },
  config: {
    peerDiscovery: {
      bootstrap: {
        enabled: true,
        list: bootstrapList
      }
    }
  }
})

export { Node }
