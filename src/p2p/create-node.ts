// File from create-node.js, libp2p-js "libp2p-in-the-browser/1" example
// libp2p-js license (MIT) applies

declare let require:any

const PeerInfo = require('peer-info')
import { Node } from "./browser-bundle"

function createNode (callback : (err:any, node?:Node)=>any) {
  PeerInfo.create((err:any, peerInfo:any) => {
    if (err) {
      return callback(err)
    }

    const peerIdStr = peerInfo.id.toB58String()
    const webrtcAddr = `/dns4/star-signal.cloud.ipfs.team/tcp/443/wss/p2p-webrtc-star/p2p/${peerIdStr}`
    const wsAddr = `/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star`

    peerInfo.multiaddrs.add(webrtcAddr)
    peerInfo.multiaddrs.add(wsAddr)

    const node = new Node({
      peerInfo
    })

    node.idStr = peerIdStr
    callback(null, node)
  })
}

export { createNode }
