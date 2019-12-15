import { h, render, Context, createContext, JSX } from "preact";
import { useContext } from "preact/hooks";
import { Node } from "./p2p/browser-bundle"
import { createNode } from "./p2p/create-node"
import { OrderedSet, List, Record } from "immutable"

declare let require:any

let verbose = false

// ---- Helpers ----

// Object triggers a callback on the next animation frame.
// When the animation frame comes the callback will be called only once.
class Refresher {
  private refreshed = true
  public refresh:()=>void

  // Construct with callback to be called
  constructor(refreshCallback :()=>void, dontRenderYet?:boolean) {
    this.refresh = () => {
      this.refreshed = true
      refreshCallback()
    }
    if (!dontRenderYet)
      this.refresh()
  }

  // Call to trigger callback on next frame
  request() {
     if (this.refreshed) {
      this.refreshed = false
      requestAnimationFrame(this.refresh)
    }
  }
}

// Object pairs a piece of global state with a Preact context
// To use, change the "value" field and then request Preact rerender
class State<T> {
  public context: Context<T>
  constructor(public value:T) {
    this.context = createContext(value)
  }
}

// Object keeps a list of States and wraps a JSX element with providers for all of them in order.
class StateGroup {
  // Construct with list of States
  constructor(public states:State<any>[]) {}

  // Call to turn JSX element into context-wrapped JSX element
  render(inside:JSX.Element) {
    for (let X of this.states) {
      inside = <X.context.Provider value={X.value}>{inside}</X.context.Provider>
    }
    return inside
  }
}

// ----- Display -----

// DOM elements
let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

// Immutable Record for an error (to format like "tag: error")
type ErrorRecordParams = {tag:string, error:string}
const ErrorRecord = Record<ErrorRecordParams>({ tag: null, error: null })

// Global state
let ConnectionFailed = new State(false)
let SelfId = new State("")
let PreconnectList = new State(OrderedSet<string>())
let ConnectList = new State(OrderedSet<string>())
let ErrorList = new State(List<Record<ErrorRecordParams>>())

let states = new StateGroup([ConnectionFailed, SelfId, PreconnectList, ConnectList, ErrorList])

// Preact rendering

// Display in lieu of user info when not connected
function NoUserBox(props: {failed:boolean}) {
  return <div className="UserBox"><span className="Header">{props.failed ? "Connection failed" : "Connecting to libp2p…"}</span></div>
}

// Display information about "our" peer
function UserBox(props: {selfId:string}) {
  return <div className="UserBox"><span className="Header">Connected to libp2p</span> as <span className="Id">{props.selfId}</span></div>
}

// Display information about connected peers
function UsersBox(props: {list: State<OrderedSet<string>>, label:string, className:string}) {
  const userList = useContext(props.list.context)
  const userFragment = userList.map(
    s => <div className="Id">{s}</div>
  ).toJS()
  return <div className={"ListBox " + props.className}>
    <div className="Header">{props.label}</div>
    <div className="List">{userFragment}</div>
  </div>
}

// Display list of errors (or nothing if empty)
function ErrorBox() {
  const errorList = useContext(ErrorList.context)
  if (errorList.isEmpty())
    return null
  const errorFragment = errorList.map(
    e => <div className="Error"><span className="Explanation">{e.get("tag") || "Error"}:</span> <span className="content">{e.get("error") || "[Unknown error]"}</span></div>
  ).toJS()
  return <div className="ListBox ErrorBox">
    <div className="Header">Errors</div>
    <div className="List">{errorFragment}</div>
  </div>
}

// Display entire UI (JSX root element)
function Content() {
  const connectionFailed = useContext(ConnectionFailed.context)
  const selfId = useContext(SelfId.context)

  if (!selfId)
    return <div>
      <NoUserBox failed={connectionFailed} />
      <ErrorBox />
    </div>

  return <div>
    <UserBox selfId={selfId} />
    <ErrorBox />
    <UsersBox label="Connected peers" list={ConnectList} className="ConnectBox" />
    <UsersBox label="Discovered peers" list={PreconnectList} className="PreconnectBox" />
  </div>
}

// Call to append to error list
function logError(tag:string, err:Error, isFatal:boolean) {
  if (verbose || isFatal)
    console.log(tag, err);

  ErrorList.value = ErrorList.value.push(ErrorRecord({tag: tag, error: err.message}))
  if (isFatal) ConnectionFailed.value = true
  refresh.request()
}

// Display
let refresh = new Refresher(() => {
  render( states.render(<Content />),
    parentNode, replaceNode
  );
  replaceNode = undefined
})

// ---- Networking ----

createNode((err:Error, node:Node) => {
  if (err) {
    logError("Startup failure", err, true)
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

  node.start((err:Error) => {
    if (err) {
      logError("Connection failure", err, true)
      return
    }

    if (verbose) console.log("Started, self is", node.peerInfo.id.toB58String())
    SelfId.value = node.peerInfo.id.toB58String(); refresh.request()

    let nodeI = 0
    node.peerInfo.multiaddrs.toArray().forEach((ma:any) => {
      // FIXME: Should these be added to the Connected or Discovery lists? 
      if (verbose) console.log("Peer", nodeI++, ":", ma.toString())
    })
  })
})
