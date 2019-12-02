import { h, render, Component } from "preact";
import { Node } from "./p2p/browser-bundle"
import { createNode } from "./p2p/create-node"

declare let require:any

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

class Content extends Component<any, any> {
  constructor(props:{}) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div>Hello</div>
    )
  }
}

function refresh() {
  render(
    <Content />,
    parentNode, replaceNode
  );
  replaceNode = undefined
}
refresh()

createNode((err:any, node:Node) => {
  if (err) {
    console.log("Failure", err)
  }

  node.on('peer:discovery', (peerInfo:any) => {
    console.log("Discovered peer", peerInfo.id.toB58String())
  })

  node.on('peer:connect', (peerInfo:any) => {
    console.log("Connected peer", peerInfo.id.toB58String())
  })

  node.on('peer:disconnect', (peerInfo:any) => {
    console.log("Disconnected peer", peerInfo.id.toB58String())
  })

  node.start((err:any) => {
    if (err) {
      console.log("Start failure", err)
      return
    }

    console.log("Started, self is", node.peerInfo.id.toB58String())

    let nodeI = 0
    node.peerInfo.multiaddrs.toArray().forEach((ma:any) => {
      console.log("Peer", nodeI++, ":", ma.toString())
    })
  })
})
