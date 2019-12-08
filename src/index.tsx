import { h, render, Context, createContext } from "preact";
import { useContext } from "preact/hooks";
import { Node } from "./p2p/browser-bundle"
import { createNode } from "./p2p/create-node"
//import { OrderedSet } from "immutable"

declare let require:any

let verbose = false

// ---- Helpers ----

class Refresher {
  private refreshed = true
  public refresh:()=>void
  constructor(refreshCallback :()=>void, dontRenderYet?:boolean) {
    this.refresh = () => {
      this.refreshed = true
      refreshCallback()
    }
    if (!dontRenderYet)
      this.refresh()
  }
  request() {
     if (this.refreshed) {
      this.refreshed = false
      requestAnimationFrame(this.refresh)
    }
  }
}

class State<T> {
  public context: Context<T>
  constructor(public value:T) {
    this.context = createContext(value)
  }
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

let SelfId = new State("")

//let selfId : string, setSelfId : StateUpdater<string>;
//const [preconnectList, setPreconnectList] = useState(OrderedSet<string>());
//const [connectList, setConnectList] = useState(OrderedSet<string>());

function Content() {
  const selfId = useContext(SelfId.context)
  return <div>
    Hello?<br />
    I am {selfId ? selfId : "[pending]"}
  </div>
}

let refresh = new Refresher(() => {
  render(
    <SelfId.context.Provider value={SelfId.value}>
      <Content />
    </SelfId.context.Provider>,
    parentNode, replaceNode
  );
  replaceNode = undefined
})

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
    SelfId.value = node.peerInfo.id.toB58String(); refresh.request()

    let nodeI = 0
    node.peerInfo.multiaddrs.toArray().forEach((ma:any) => {
      if (verbose) console.log("Peer", nodeI++, ":", ma.toString())
    })
  })
})
