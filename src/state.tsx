// Tools for disseminating a piece of state to Preact context/hooks
// To use: Keep your state variables inside State objects
// Wrap components that need to use state in <StateContext state={}> tags
// If you have a BUNCH of state objects, WrapStateContexts can make that easier

import { h, render, Context, createContext, JSX, ComponentChildren } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";

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
  // Convenience function (calls useContext, so must be called in React callstack)
  // For reading outside React callstacks, read .value
  get() {
  	return useContext(this.context)
  }

  // These weird little functions are why this class exists. You can't just save a
  // React useState because a useState is connected to a single component and React
  // components are constantly unmounting and remounting themselves.
  // This "listener" tracking keeps track of that remounting.
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

export { State, StateContext, WrapStateContexts }
