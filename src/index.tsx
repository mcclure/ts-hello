import { h, render, Context, createContext, JSX, ComponentChildren } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";
import { Node } from "./p2p/browser-bundle"
import { OrderedSet, List, Record } from "immutable"

declare let require:any

let verbose = false

// ---- Helpers ----

// A piece of state with a notification system for Preact listeners
class State<T> {
  public context: Context<T>
  private listeners:Set<(_:T)=>void>

  // Construct with an initial value. "Inherit" to use an existing context key
  constructor(public value:T, inherit?: Context<T>) {
    this.listeners = new Set<(_:T)=>void>()
    this.context = inherit || createContext(value)
  }

  // Call to update value
  set(value:T) {
    this.value = value
    for (let fn of this.listeners) {
      fn(this.value)
    }
  }

  addListener(listener:(_:T)=>void) { this.listeners.add(listener) }
  removeListener(listener:(_:T)=>void) { this.listeners.delete(listener) }

  clone() { return new State(this.value, this.context) }
}

// Preact component which is an auto-updating Provider for a State
function StateContext<T> (props:{state:State<T>, children:ComponentChildren}) {
  let state = props.state
  let [value, setValue] = useState(state.value)
  let effect = useEffect(() => {
    state.addListener(setValue)
    return () => {
      state.removeListener(setValue)
    }
  }, []) // Empty dependencies list so listener only registers once
  return <state.context.Provider value={value}>{props.children}</state.context.Provider>
}

// Function to wrap a React component in several layers of StateContexts at once
function WrapStateContexts(content:JSX.Element, states:State<any>[]) {
  for (let s of states) {
      content = <StateContext state={s}>{content}</StateContext>
    }
    return content
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

let states = [ConnectionFailed, SelfId, PreconnectList, ConnectList, ErrorList]

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
  const userFragment = userList.toArray().map(
    s => <div className="Id">{s}</div>
  )
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
  const errorFragment = errorList.toArray().map(
    e => <div className="Error"><span className="Explanation">{e.get("tag") || "Error"}:</span> <span className="content">{e.get("error") || "[Unknown error]"}</span></div>
  )
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

  ErrorList.set( ErrorList.value.push(ErrorRecord({tag: tag, error: err.message})) )
  if (isFatal) ConnectionFailed.set( true )
}

// Display

render( WrapStateContexts(<Content />, states),
  document.getElementById("content"), document.getElementById("initial-loading")
);

// ---- Networking ----
(async function() { // Create and invoke an async function
  let phase = "Startup"
  try {
    const node = await Node

    phase = "Configuration"
    
    node.on('peer:discovery', (peerId:any) => {
      const peerIdStr = peerId.toB58String()
      if (verbose) console.log("Discovered peer", peerIdStr)
      PreconnectList.set( PreconnectList.value.add(peerIdStr) );
    })

    node.connectionManager.on('peer:connect', (connection:any) => {
      const peerIdStr = connection.remotePeer.toB58String()
      if (verbose) console.log("Connected peer", peerIdStr)
      PreconnectList.set( PreconnectList.value.delete(peerIdStr) );
      ConnectList.set( ConnectList.value.add(peerIdStr) )
    })

    node.connectionManager.on('peer:disconnect', (connection:any) => {
      const peerIdStr = connection.remotePeer.toB58String()
      if (verbose) console.log("Disconnected peer", peerIdStr)
      ConnectList.set( ConnectList.value.delete(peerIdStr) )
    })

    phase = "Connection"
    await node.start();

    const selfPeerIdStr = node.peerId.toB58String()

    phase = "Cleanup"

    if (verbose) console.log("Started, self is", selfPeerIdStr)
    SelfId.set( selfPeerIdStr )

    if (verbose) {
      let nodeI = 0
      node.multiaddrs.forEach((ma:any) => {
        // FIXME: Should these be added to the Connected or Discovery lists? 
        console.log("Starting peer", nodeI++, ":", ma.toString())
      })
    }
  } catch (e) {
    logError(`${phase} failure`, e, true)
  }
})()
