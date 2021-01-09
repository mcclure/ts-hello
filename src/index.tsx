import { h, JSX, render, Component } from "preact";
import { LargestPossibleCanvas, makeHidpi2D } from "./canvas"

// @ts-ignore
import canvas2image from 'canvas2image-2'

// ----- Data helpers -----


// ----- Data -----

let lastCanvas:{canvas:HTMLCanvasElement, width:number, height:number} = null

// ----- Display helpers -----

// Turn a function into a compliant event handler
function handle(f:()=>void) {
  return (e:JSX.TargetedEvent) => {
    e.preventDefault();
    f();
    return true;
  }
}

function AppCanvas({}) {
  return <LargestPossibleCanvas onMount={(canvas) => {
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = false // Does this even do anything? Should I use canvas { image-rendering: pixelated } also?

    const width  = canvas.width
    const height = canvas.height

    lastCanvas = {canvas, width, height}

    // Now draw
    context.fillStyle = '#AAA'
    context.fillRect(0, 0, width, height)
  }} />
}

function Controls() {
  return <div className="Controls">
    <a href="#" onClick={handle(()=>{
      if (lastCanvas) {
        const {canvas, width, height} = lastCanvas
        canvas2image.saveAsPNG(canvas, width, height)
      }
    })}>⬇️</a>
  </div>
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

function Content() {
  if (!navigator.gpu) {
      return <div className="TopError">
        This app requires WebGPU. Either your browser does not support WebGPU, or you must enable an experimental flag to access it.
      </div>
  }

  return (
    <div className="Content">
      <Controls />
      <AppCanvas />
    </div>)
}

render(
  <Content />,
  parentNode, replaceNode
);
