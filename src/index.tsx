import { h, JSX, render, Component } from "preact"
import linkState from 'linkstate';
import { State, WrapStateContexts } from "./gui/state"
import { writeStreamWithUleb, ulebLengthFromStream, lengthToUleb } from "./bin/leb"
import { StreamByteReader, ItBlByteReader } from "./bin/byteStream"
import { Record, List, OrderedSet } from "immutable-oss"
import { encode, decode } from "@msgpack/msgpack"
import { createWriteStream } from "streamsaver" // Currently used only in Debug
import { Node } from "./p2p/browser-bundle" // Networking

import { encode as encode11, decode as decode11 } from 'base2048'
import { encode as encode15, decode as decode15 } from 'base32768'
import { encode as encode16, decode as decode16 } from 'base65536'
const multihashing = require("multihashing-async")
const CID = require('cids')
const itPipe = require('it-pipe')

import { sign as naclSign } from 'tweetnacl';

const siteName = "DHT Connection Test"
const helloProtocolName = "kad-dht-hello"
const protocolName = "cruddy-dht-demo-bug"
const protocolVersion = "0.0.0"
const postMaxLength = 500
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

// "DownloadTime" refers to when the status was saved into memory
type UserProps = {name?:string, post?:string, downloadTime:Date, isSelf:boolean, signKey:nacl.SignKeyPair, id:number}
let userPropsGenerator = 1
function nextUserPropsId() { return userPropsGenerator++ }

const User = Record<UserProps>({name:null, post:null, downloadTime:null, isSelf: false, signKey:null, id:0})
const login = new State(User())
const feed = new State(List<UserProps>())
const overrideUser = new State<UserProps>(null) // JUL21 remove maybe?
const debugMode = new State(false)

// ----- Data helpers -----

// Turn a function into a compliant event handler
function handle(f:()=>void) {
  return (e:JSX.TargetedEvent) => {
    e.preventDefault();
    f();
    return true;
  }
}

async function HashRaw(source:Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', source))
}

// ----- Networking -----

const helloProtocolString = `/${helloProtocolName}`
const protocolString = `/${protocolName}/${protocolVersion}`

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

function logErrorIncoming(err:string) {
  console.log("Incoming connection error", err)
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
      
      node.handle([helloProtocolString], ({ protocol, stream }:{protocol:string, stream:any}) => {
        (async () => {
          // DO NOTHING? TODO: CONSIDER CLOSING STREAM?
        })()
      })

      node.handle([protocolString], ({ protocol, stream }:{protocol:string, stream:any}) => {
        (async () => {
          // NODE CONNECT HERE
          console.log("PROTOCOL CONNECT!", stream.timeline, stream)

          itPipe(
            stream,
            async function (source:any) {
              // const signKey = login.value.get('signKey')
              const byteReader = new ItBlByteReader(source)
              const length = signKey.publicKey.length
              if (length > 0) {
                const bytes = new Uint8Array(length)
                await byteReader.readBytes(bytes, length)
                console.log("KEY QUERY:", bytes)
                let match = true
                for (let c = 0; match && c < length; c++) {
                  if (bytes[c] == signKey.publicKey[c]) {
                    match = false
                  }
                }
                if (match) {
                  // Note: Sign but don't encrypt
                  const userProps = login.value
                  const innerObject = { name:userProps.get("name"), post:userProps.get("post"), updateTime:userProps.get('downloadTime') }
                  const innerData = encode(innerObject, {initialBufferSize:128})
                  const signData = naclSign.detached(innerData, userProps.get('signKey').secretKey)
                  const outerObject = { sign:signData, data:innerData }
                  const data = encode(outerObject, {initialBufferSize:1})
                  const tempBuffer = new Uint8Array(1)
                  const lengthLength = lengthToUleb(tempBuffer, 1)
                  const lengthBuffer = tempBuffer
console.log("Sending this many bytes of data", data.byteLength, lengthBuffer[0], lengthBuffer)
                  return itPipe(
                    [lengthBuffer, data],
                    stream
                  )
                } else {
                  logErrorIncoming("Other user requested message, but they asked for the wrong key")
                }
              } else {
                logErrorIncoming("Internal error: No public key")
              }
            }
          )
          // JUL21: Here wait for number then return result

          console.log("CONNECTED PIPE", stream.timeline)
        })()
      })


      // Don't connect to or gossip about nodes unless they support the required protocol
      node.peerStore.on('change:protocols', ({ peerId, protocols }:{peerId:any, protocols:any}) => {
        if (!protocols.includes(helloProtocolString)) {
          node.hangUp(peerId)
          node.peerStore.addressBook.delete(peerId)
          if (verboseNetwork) console.log("Rejecting peer", peerId.toB58String(), "for lack of protocol", protocolString, "supported protocols", protocols)
        } else {
          if (verboseNetwork) console.log("Accepting peer", peerId.toB58String(), "with protocol", protocolString)
          // JUL21: Do send here or lower?
        }
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

      phase = "Please hold..."
      const delay = require('delay')
      // See https://github.com/libp2p/js-libp2p/issues/950
      await delay(5000)

      phase = "Publish"

      const signKey = login.value.get('signKey')
      const signHash = await HashRaw(signKey.publicKey)
      const cid = await cidForData(signHash)
      console.log("PROVIDING", cid)
      await node.contentRouting.provide(cid) // Warning: Do this too early 
      globalNode = node

      phase = "Connected"
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
type LoginBoxState = {name:string,post:string,error?:string[]}
class LoginBox extends Component<{}, LoginBoxState> {
  constructor(props:{}) {
    super(props)
    this.state = {name:'', post:''}
  }
  handleSubmit() {
    if (this.state.name && this.state.post) {
      const signKey = naclSign.keyPair()

      login.set(login.value.set('name', this.state.name)
                           .set('post', this.state.post)
                           .set('downloadTime', new Date())
                           .set('isSelf', true)
                           .set('signKey', signKey)
                           .set('id', nextUserPropsId()))

      netConnect()

      //JUL21: Save these for display
      console.log("Encoded:")
      console.log(encode11(signKey.publicKey))
      console.log(encode15(signKey.publicKey))
      console.log(encode16(signKey.publicKey))
    } else {
      this.setState({error:
        (this.state.name ? [] : ["No name entered"]).concat
        (this.state.post ? [] : ["No post entered"])
      })
    }
  }
  render() {
    let error:JSX.Element[]
    if (this.state.error) {
      error = this.state.error.map(e => <div className="Errors">{e}</div>)
    }
    return (
      <div className="LoginBox">
        <div className="SiteTitle">{siteName}</div>
        <form onSubmit={(e)=>{e.preventDefault(); this.handleSubmit(); return true}}>
          <div className="Instructions">Enter your name.</div>
          <label>
            <input type="text" value={this.state.name} onInput={linkState(this, 'name')} />
          </label>

          <br /><br />

          <div className="Instructions">What do you have to say?</div>
          <textarea placeholder="Type something here" rows={4} cols={60} 
              value={this.state.post} onInput={linkState(this, 'post')}/>

          <br /><br />

          <input type="submit" value="Login" />
        </form>
        {error}

        <hr />
        <div className="Disclaimers">
          <b>Warning:</b> This is a P2P application. This means <b>your IP address</b>, and therefore your location to the fidelity of the city or better, <b>will be visible to other users</b>.
        </div>
      </div>
    )
  }
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")
const startingPercent = /^\%/

// Left side "make post" / controls box
type ControlsState = {follow:string,followError?:string}
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
      const followKey = f1 || f2 || f3
      console.log("SEARCHING", f1, f2, f3, followKey)
      if (!followKey) {
        this.setState({followError:"Couldn't recognize follow code"})
      } else if (!globalNode) {
        this.setState({followError:"Not connected yet"})
      } else {
        const followHash = await HashRaw(followKey)
        const cid = await cidForData(followHash)
        console.log("SEARCHING 2", cid)
        let targetMultiaddr
        for await (const provider of globalNode.contentRouting.findProviders(cid)) {
          console.log("GOT")
          console.log(provider)
          targetMultiaddr = provider
          break
        }
        console.log("DONE SEARCH")

        // BEGIN DOWNLOAD
        const { stream } = await globalNode.dialProtocol(targetMultiaddr.id, protocolString)

        itPipe( // Intentionally leak promise
          [followKey],
          stream, // "Write to the stream, and pass its output to the next function"
          async function (source:any) {
            const byteReader = new ItBlByteReader(source)
            console.log("RECEIVING FROM FOLLOW")
            const length = await ulebLengthFromStream(byteReader)
            const bytes = new Uint8Array(length)
            await byteReader.readBytes(bytes, length)
            const msg = decode(bytes.buffer)
            console.log("RESULT", msg)

            //JUL21 Download here
          }
        )
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

    // ---- READY DEBUG ----
    if (debugModeV) { // Hidden / debug mode buttons
      debugButtons = [
        //JUN21 Network status here?
      ]
    }
    return (
      <div className="Controls">

        <form className="FollowBox"
          onSubmit={handle(()=>this.handleFollow())}
        >
          <div>
            <input type="text" placeholder="Paste DHT address"
              value={this.state.follow} onInput={linkState(this, 'follow')}/>
          </div>
          <input className="FollowButton" type="submit" value="Connect" />
          {count}
        </form>
        {followError}

        <hr />

        {connecting}
        {networkErrors}
        <div className="DebugControls">
          <input className="ToggleButton" type="checkbox" value="Debug" checked={debugModeV}
            onInput={(e:JSX.TargetedEvent<HTMLInputElement>) => debugMode.set(e.currentTarget.checked)} />
            DEBUG<br />
          {debugButtons}
        </div>
      </div>
    )
  }
}

// Render a post.
function PostContent({userProps}:{userProps:UserProps}) {
  return <div className="Post">
      <div className="PostMeta">
        <div className="Username">{userProps.name}</div>
      </div>
      <div className="PostContent">{userProps.post}</div>
    </div>
}

// Right side content area -- feed
function FeedPane({feedList}:{feedList:List<UserProps>}) {
  const postDivs:JSX.Element[] = []
  const size = feedList.size
  let idx = 1

  postDivs.length = size
  for (const userProps of feedList) {
    const key = userProps.id
    postDivs[size - idx++] = 
      <PostContent key={key} userProps={userProps} />
  }
  return <div className="Content">
    <div className="Header">Messages:</div>
    {postDivs}
  </div>
}

function ContentPane() {
  return <FeedPane feedList={feed.get()} />
}

// Toplevel element, handles state
function Page() {
  const loginV = login.get()

  if (!loginV.get('name')) {
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
    debugMode]),
  parentNode, replaceNode
)
