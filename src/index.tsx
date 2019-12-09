import { h, render, Context, createContext, JSX } from "preact";
import { useContext } from "preact/hooks";
import { Node } from "./p2p/browser-bundle"
import { createNode } from "./p2p/create-node"
import { OrderedSet } from "immutable"

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

class StateGroup {
  constructor(public states:State<any>[]) {}
  render(inside:JSX.Element) {
    for (let X of this.states) {
      inside = <X.context.Provider value={X.value}>{inside}</X.context.Provider>
    }
    return inside
  }
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

let SelfId = new State("")
let PreconnectList = new State(OrderedSet<string>())
let ConnectList = new State(OrderedSet<string>())

let states = new StateGroup([SelfId, PreconnectList, ConnectList])

function UserBox() {
  const selfId = useContext(SelfId.context)
  return <div>You are {selfId ? selfId : "[pending]"}</div>
}

function UsersBox(props: {list: State<OrderedSet<string>>, label:string}) {
  const userList = useContext(props.list.context)
  const userFragment = userList.map(
    s => <div>{s}</div>
  ).toJS()
  return <div><div>{props.label}</div>{userFragment}</div>
}

function Content() {
  return <div>
    Hello?<br />
    <UserBox />
    <UsersBox label="Discovered peers" list={PreconnectList} />
    <UsersBox label="Connected peers" list={ConnectList} />
  </div>
}

let refresh = new Refresher(() => {
  render( states.render(<Content />),
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
    PreconnectList.value = PreconnectList.value.add(peerInfo.id.toB58String()); refresh.request()
  })

  node.on('peer:connect', (peerInfo:any) => {
    if (verbose) console.log("Connected peer", peerInfo.id.toB58String())
    PreconnectList.value = PreconnectList.value.delete(peerInfo.id.toB58String());
    ConnectList.value = ConnectList.value.add(peerInfo.id.toB58String()); refresh.request()
  })

  node.on('peer:disconnect', (peerInfo:any) => {
    if (verbose) console.log("Disconnected peer", peerInfo.id.toB58String())
    ConnectList.value = ConnectList.value.delete(peerInfo.id.toB58String()); refresh.request()
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
