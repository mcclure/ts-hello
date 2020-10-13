import { h, render, Component } from "preact";
import linkState from 'linkstate';
import { State, WrapStateContexts } from "./state"
import { List } from "immutable"

declare let require:any

// ----- Data helpers -----

// Convert to number if this is a string describing a number, otherwise do nothing
// Nightmare function adapted from https://stackoverflow.com/a/35759874/6582253
function numericOrUnchanged<T>(str:T) : number|T {
  if (typeof str != "string") return str
  const parsedAsNumber = parseFloat(str)
  const isNumber = !isNaN(str as any) && !isNaN(parsedAsNumber)
  return isNumber ? parsedAsNumber : str
}

// ----- Data -----

const data = new State(List<number|string>())

// ----- Display helpers -----

// Note the convention in this page:
// - Functional components are used for anything that uses context
// - Class components are used for anything that uses linkState
// This convention does prevent context and linkState from being used together.
// But maybe that's a good thing.

// Modal "pick a username" box
type ListEditState = {entry:string}
type ListEditProps = {targetState:State<List<number|string>>}
class ListEdit extends Component<ListEditProps, ListEditState> {
  constructor(props:ListEditProps) {
    super(props)
    this.state = {entry:''}
  }
  handlePush() {
    const targetState = this.props.targetState
    const entry = numericOrUnchanged(this.state.entry)
    if (entry != null) { // Intentionally catches undefined also
      console.log(`Pushing: ${String(entry)}`)
      targetState.set(targetState.value.push(entry))
      this.setState({entry:''})
    }
  }
  handlePop() {
    const targetState = this.props.targetState
    console.log(`Popping: ${String(targetState.value.last())}`)
    targetState.set(targetState.value.pop())
  }
  render() {
    return (
      <div className="EditBox">
        <form onSubmit={(e)=>{e.preventDefault(); this.handlePush(); return true}}>
          <label>
            <input type="text" value={this.state.entry} onInput={linkState(this, 'entry')} />
          </label>
          <input type="submit" disabled={!Boolean(this.state.entry)} value="Push" />
          <input type="button" onClick={(e) => {this.handlePop(); return true}} value="Pop" />
        </form>
      </div>
    )
  }
}

function ListDisplay<T>({targetState}:{targetState:State<List<T>>}) {
  const list = targetState.get()
  let keyId = 0
  // Convert list list.toSeq().map(s => <div>{s}</div>).toArray() would work if you need ES5 support
  const listDivs = Array.from(list, e => {
    keyId++
    return <div className="ListItem" key={keyId}>{String(e)}</div>
  })

  return <div className="ListDisplay">
    {listDivs}
  </div>
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

function Content() {
  return (
    <div className="Content">
      <ListEdit targetState={data} />
      <ListDisplay targetState={data} />
    </div>)
}

render(
  WrapStateContexts(<Content />, [data]),
  parentNode, replaceNode
)
