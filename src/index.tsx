import { h, JSX, render, Component } from "preact"
import linkState from 'linkstate';
import { State, WrapStateContexts } from "./state"
import { Record, OrderedSet, List } from "immutable-oss"
import { Node } from "./p2p/browser-bundle" // Networking

import { encode as encode11, decode as decode11 } from 'base2048'
import { encode as encode15, decode as decode15 } from 'base32768'
import { encode as encode16, decode as decode16 } from 'base65536'
const multihashing = require("multihashing-async")
const CID = require('cids') // FIXME: This isn't in package.json. Where did it come from? 

import { box as naclBox } from 'tweetnacl';

declare let require:any

const siteName = "kad-dht test"
const protocolName = "dht-test"
const verboseNetwork = true

// How this works:
// - LoginBox displays at open. When "login" is clicked, it calls a method netConnect.

// FIXME: Wrap all callbacks in try-catch error printers, also do this in bounce.js. libp2p will silently eat exceptions

// ----- Data -----

// "Ref cell" acts like a shared pointer
interface Ref<T> { value:T; set(value:T):void; get():T; } // Note State conforms
class SimpleRef<T> {
  constructor(public value:T) {}
  get() { return this.value }
  set(value:T) { this.value = value }
}

type UserProps = {signKey:nacl.BoxKeyPair}

const User = Record<UserProps>({signKey:null})
const login = new State(User())
const debugMode = new State(false)
const debugOfflineMode = new State(false)

// ----- Data helpers -----

// Turn a function into a compliant event handler
function handle(f:()=>void) {
  return (e:JSX.TargetedEvent) => {
    e.preventDefault();
    f();
    return true;
  }
}

// ----- Networking -----

const protocolString = `/${protocolName}`

enum ConnectionStatus {
  None, // Just started up
  Connecting,
  Connected,
  Failed
}

// Immutable Record for an error (to format like "tag: error")
type ErrorRecordParams = {tag:string, error:string}
const ErrorRecord = Record<ErrorRecordParams>({ tag: null, error: null })

// Global state
let connectionStatus = new State(ConnectionStatus.None)
let selfId = new State("")
let preconnectList = new State(OrderedSet<string>())
let connectList = new State(OrderedSet<string>())
let errorList = new State(List<Record<ErrorRecordParams>>())
let globalNode:any

// Call to append to error list
function logError(tag:string, err:Error, isFatal:boolean) {
  if (verboseNetwork || isFatal)
    console.log(tag, err)

  errorList.set( errorList.value.push(ErrorRecord({tag: tag, error: err.message})) )
  if (isFatal) connectionStatus.set( ConnectionStatus.Failed )
}

async function cidForData(data:Uint8Array) {
  // We want to use the 256-bit public key as a 256-bit Kademlia key.
  // libp2p won't let us do that. We have to convert it to a "multihash" and then to a "CID".
  // This appears to mutate the key along the way, but I'm not sure how.
  // This is the best I can find for how to make a "CID" https://github.com/multiformats/js-cid#usage
  const signKeyMultihash = await multihashing(data, 'sha2-256') // Does this *create* a SHA256 or simply *tag* as SHA256?
  // Note 0x12 for SHA-256
  return new CID(1, 0x12, signKeyMultihash)
}

function netConnect() {
  if (connectionStatus.value != ConnectionStatus.None) { return }

  connectionStatus.set( ConnectionStatus.Connecting )

  ;(async function() { // Create and invoke an async function
    let phase = "Startup"
    try {
      const node = await Node

      phase = "Configuration"
      
      node.handle([protocolString], ({ protocol, stream }:{protocol:string, stream:any}) => {
        (async () => {
          // NODE CONNECT HERE
        })()
      })

      // Don't connect to or gossip about nodes unless they support the required protocol
      node.peerStore.on('change:protocols', ({ peerId, protocols }:{peerId:any, protocols:any}) => {
        if (!protocols.includes(protocolString)) {
          node.hangUp(peerId)
          node.peerStore.addressBook.delete(peerId)
          if (verboseNetwork) console.log("Rejecting peer", peerId.toB58String(), "for lack of protocol", protocolString, "supported protocols", protocols)
        }
        else if (verboseNetwork) console.log("Accepting peer", peerId.toB58String(), "with protocol", protocolString)
        // DO WORK HERE
      })

      node.on('peer:discovery', (peerId:any) => {
        const peerIdStr = peerId.toB58String()
        if (verboseNetwork) console.log("Discovered peer", peerIdStr)
        preconnectList.set( preconnectList.value.add(peerIdStr) );
      })

      node.connectionManager.on('peer:connect', (connection:any) => {
        const peerIdStr = connection.remotePeer.toB58String()
        if (verboseNetwork) console.log("Connected peer", peerIdStr)
        preconnectList.set( preconnectList.value.delete(peerIdStr) );
        connectList.set( connectList.value.add(peerIdStr) )
      })

      node.connectionManager.on('peer:disconnect', (connection:any) => {
        const peerIdStr = connection.remotePeer.toB58String()
        if (verboseNetwork) console.log("Disconnected peer", peerIdStr)
        connectList.set( connectList.value.delete(peerIdStr) )
      })

      phase = "Connection"
      await node.start();

      const selfPeerIdStr = node.peerId.toB58String()

      phase = "Cleanup"

      if (verboseNetwork) console.log("Started, self is", selfPeerIdStr)
      selfId.set( selfPeerIdStr )
      connectionStatus.set( ConnectionStatus.Connected )

      if (verboseNetwork) {
        let nodeI = 0
        node.multiaddrs.forEach((ma:any) => {
          // FIXME: Should these be added to the Connected or Discovery lists? 
          console.log("Starting peer", nodeI++, ":", ma.toString())
        })
      }

      phase = "Publish"

      const delay = require('delay')
      await delay(30000)
      const signKey = login.value.get('signKey')
      const cid = await cidForData(signKey.publicKey)
      console.log("PROVIDING", cid)
      await node.contentRouting.provide(cid) // Warning: Do this too early 
      globalNode = node
    } catch (e) {
      logError(`${phase} failure`, e, true)
    }
  })()
}

// ----- Special screens -----

// Note the convention in this page:
// - Functional components are used for anything that uses context
// - Class components are used for anything that uses linkState
// The fact this convention prevents context and linkState from being used together
// is assumed good, because it means you either have global or form state but never both

// Modal "pick a username" box
type LoginBoxState = {name:string,error?:string}
class LoginBox extends Component<{}, LoginBoxState> {
  constructor(props:{}) {
    super(props)
    this.state = {name:''}
  }
  handleSubmit() {
    const signKey = naclBox.keyPair()
    login.set(login.value.set('signKey', signKey))

    netConnect()

    console.log("Follow-code versions (all 3 identical):")
    console.log(encode11(signKey.publicKey))
    console.log(encode15(signKey.publicKey))
    console.log(encode16(signKey.publicKey))
  }
  render() {
    let error:JSX.Element
    if (this.state.error) {
      error = <div className="Errors">{this.state.error}</div>
    }
    return (
      <div className="LoginBox">
        <div className="SiteTitle">{siteName}</div>
        <div className="Disclaimers">This is a test. All interesting information is in the JavaScript debug console.
        </div>
        <div className="Instructions">Open this in two tabs. Copy a "follow code" (any) out of one tab's JS console, into the "Follow" box of the other.</div>
        <form onSubmit={(e)=>{e.preventDefault(); this.handleSubmit(); return true}}>
          <input type="submit" value="Login" />
        </form>
        {error}
      </div>
    )
  }
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")
const startingPercent = /^\%/

// Left side "make post" / controls box
type ControlsState = {post:string,postError?:string,follow:string,followError?:string}
class Controls extends Component<any, any> {
  constructor(props:{}) {
    super(props)
    this.state = {post:''}
  }

  async handleFollow() {
    try {
      const follow = this.state.follow.replace(startingPercent, '')
      let f1, f2, f3
      try { f1 = decode11(follow) } catch (e) {}
      try { f2 = decode15(follow) } catch (e) {}
      try { f3 = decode16(follow) } catch (e) {}
      const result = f1 || f2 || f3
      console.log("SEARCHING", f1, f2, f3)
      if (!result) {
        this.setState({followError:"Couldn't recognize follow code"})
      } else if (!globalNode) {
        this.setState({followError:"Not connected yet"})
      } else {
        const cid = await cidForData(result)
        console.log("SEARCHING 2", cid)
        // As elsewehre: I don't know how I'm supposed to access the "._dht" object. The _dht key appears to work at least.
        for await (const provider of globalNode.contentRouting.findProviders(cid)) {
          console.log("GOT")
          console.log(provider)
        }
        console.log("DONE SEARCH")
      }
    } catch (e) {
      console.log("handleFollow error", e)
      this.setState({followError:e.toString()})
    }
  }

  render() {
    let debugModeV = debugMode.get()
    let connectionStatusV = connectionStatus.get()
    let errorListV = errorList.get()
    let followError:JSX.Element
    let networkErrors:JSX.Element[]
    let count:JSX.Element
    let debugButtons:JSX.Element[]
    let connecting

    // ---- READY STATUS ----
    if (connectionStatusV == ConnectionStatus.Connecting) {
      connecting = <div className="ConnectionStatus">Connecting...</div>
    } else if (connectionStatusV == ConnectionStatus.Failed) {
      connecting = <div className="ConnectionStatus">Disconnected</div>
    }
    for (const e of errorListV) {
      if (!networkErrors)
        networkErrors = []
      networkErrors.push(<div className="Errors">
        <span className="Explanation">{e.get("tag") || "Error"}:</span> {" "}
        <span className="content">{e.get("error") || "[Unknown error]"}</span>
      </div>)
    }

    // ---- READY FOLLOW ----
    if (this.state.followError) { // Can unify with LoginBox a little?
      followError = <div className="Errors">{this.state.followError}</div>
    }

    return (
      <div className="Controls">

        <form className="FollowBox"
          onSubmit={handle(()=>this.handleFollow())}
        >
          <div>
            <input type="text" placeholder="Paste follow code"
              value={this.state.follow} onInput={linkState(this, 'follow')}/>
          </div>
          <input className="FollowButton" type="submit" value="Follow" />
          {count}
        </form>
        {followError}

        <hr />

        {connecting}
        {networkErrors}
      </div>
    )
  }
}

function ContentPane() {
  return <div className="Content">
    Left blank
  </div>
}

// Toplevel element, handles state
function Page() {
  const loginV = login.get()

  if (!loginV.get('signKey')) {
    return <LoginBox />
  }

  return (
    <div className="Page">
      <Controls />
      <ContentPane />
    </div>
  )
}

render(
  WrapStateContexts(<Page />, [
    login,
    connectionStatus, errorList,
    debugMode, debugOfflineMode]),
  parentNode, replaceNode
)
