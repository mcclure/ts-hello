// Preact component wrapping a canvas
// Based on this blog post https://medium.com/@pdx.lucasm/canvas-with-react-js-32e133c05258
// Adapted by Andi McClure. I am assuming code reuse from the medium post is too minimal to copyright.
// This file (canvas.tsx) is made available to you under the CC0 license [public domain]

import { h, JSX } from 'preact'
import { useRef, useEffect, useState, Ref } from 'preact/hooks'
import ResizeObserver from 'preact-resize-observer'

interface CanvasProps<T> extends JSX.HTMLAttributes<HTMLCanvasElement> {
  onMount?:(canvas:HTMLCanvasElement)=>T,
  onDraw?: (canvas:HTMLCanvasElement, context:T)=>void,
  onUnmount?: (canvas:HTMLCanvasElement, context:T)=>void,
  hiDpi?:boolean // Defaults to true
}

function Canvas<T>(props : CanvasProps<T>) {
  const {onMount, onDraw, onUnmount, hiDpi, width, height} = props

  const canvasRef:Ref<HTMLCanvasElement> = useRef(null)

  let canvasStyle

  if (hiDpi !== false && typeof(width) == "number" && typeof(height) == "number") {
    const { devicePixelRatio=1 } = window

    if (devicePixelRatio != 1) {
      props = {...props}
      props.width = width*devicePixelRatio
      props.height = height*devicePixelRatio
      canvasStyle = `width:${width}px; height:${height}px;`
      console.log("DOING", canvasStyle)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current

    const context:T = onMount ? onMount(canvas) : null

    return onUnmount ? () => onUnmount(canvas, context) : null
  })

  return <canvas style={canvasStyle} ref={canvasRef} {...props} />
}

function makeHidpi2D(canvas:HTMLCanvasElement, context:CanvasRenderingContext2D) {
  const { width, height } = canvas.getBoundingClientRect()
  const { devicePixelRatio=1 } = window
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = width * devicePixelRatio
  canvas.height = height * devicePixelRatio
}

interface LargestPossibleCanvasProps<T> extends CanvasProps<T> {
  upscalePower?:number
}

// Note: For this component to work right you MUST have a class named LargestPossibleCanvas with width:100vw;height:100vh;
function LargestPossibleCanvas<T>(props:LargestPossibleCanvasProps<T>) {
  const [initial, setInitial] = useState(true);
  const [x, setX] = useState(-1)
  const [y, setY] = useState(-1)
  const { upscalePower=2 } = props

  function handleResize(newX:number, newY:number) {
    let max = 1
    while (true) {
      const newMax = max * upscalePower
      if (newMax > newX || newMax > newY) {
        setX(max)
        setY(max)
        if (initial)
          setInitial(false)
        return
      }
      max = newMax
    }
  }

  return <ResizeObserver initial={initial} onResize={handleResize}>
    <div className="LargestPossibleCanvas">
      { initial ? <div>&nbsp;</div> : <Canvas width={x} height={y} {...props}/> }
    </div>
  </ResizeObserver>
}

export {Canvas, makeHidpi2D, LargestPossibleCanvas}
