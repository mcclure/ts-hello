import { h, render, createContext } from "preact";
import { useContext } from "preact/hooks";
import { Node } from "./p2p/browser-bundle"
import { createNode } from "./p2p/create-node"
//import { OrderedSet } from "immutable"

declare let require:any

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")
let verbose = false

let selfIdValue = ''
let SelfId = createContext(selfIdValue)

//let selfId : string, setSelfId : StateUpdater<string>;
//const [preconnectList, setPreconnectList] = useState(OrderedSet<string>());
//const [connectList, setConnectList] = useState(OrderedSet<string>());

function Content() {
  const selfId = useContext(SelfId)
  return <div>
    Hello?<br />
    I am {selfId ? selfId : "[pending]"}
  </div>
}

let refreshed = false
function refresh() {
  refreshed = true
  render(
    <SelfId.Provider value={selfIdValue}>
      <Content />
    </SelfId.Provider>,
    parentNode, replaceNode
  );
  replaceNode = undefined
}
function requestRefresh() {
  if (refreshed) {
    refreshed = false
    requestAnimationFrame(refresh)
  }
}
refresh()

createNode((err:any, node:Node) => {
  if (err) {
    console.log("Failure", err)
  }

  node.on('peer:discovery', (peerInfo:any) => {
    if (verbose) console.log("Discovered peer", peerInfo.id.toB58String())
  })

  node.on('peer:connect', (peerInfo:any) => {
    if (verbose) console.log("Connected peer", peerInfo.id.toB58String())
  })

  node.on('peer:disconnect', (peerInfo:any) => {
    if (verbose) console.log("Disconnected peer", peerInfo.id.toB58String())
  })

  node.start((err:any) => {
    if (err) {
      console.log("Start failure", err)
      return
    }

    if (verbose) console.log("Started, self is", node.peerInfo.id.toB58String())
    selfIdValue = node.peerInfo.id.toB58String(); requestRefresh()

    let nodeI = 0
    node.peerInfo.multiaddrs.toArray().forEach((ma:any) => {
      if (verbose) console.log("Peer", nodeI++, ":", ma.toString())
    })
  })
})
