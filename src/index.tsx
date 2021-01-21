import { h, JSX, render, Component } from "preact";
import { LargestPossibleCanvas, makeHidpi2D } from "./canvas"
import { State, WrapStateContexts } from "./state"

import _canvas2image from "./canvas2image"
const canvas2image = _canvas2image("gpupresent")

// ----- Data helpers -----


// ----- Data -----

let lastCanvas:{canvas:HTMLCanvasElement, width:number, height:number} = null
const animate = new State(false)
const preserve = new State(false)

// ----- Display helpers -----

// Turn a function into a compliant event handler
function handle(f:()=>void) {
  return (e:JSX.TargetedEvent) => {
    e.preventDefault();
    f();
    return true;
  }
}

function AppCanvas({gpu}:{gpu:GPU}) {
  let stillMounted = true
  const preserveV = preserve.get()
  const animateV = animate.get()

  return <LargestPossibleCanvas onUnmount={() => {stillMounted = false}} onMount={async (canvas) => {
    const attributes = preserveV ? { preserveDrawingBuffer: true } : undefined

    const context = canvas.getContext("gpupresent", attributes)
    const gpuContext = (context as any) as GPUCanvasContext
console.log("DRAWING")

    const width  = canvas.width
    const height = canvas.height
    
    // ARE YOU READING THIS IN 2022? REMOVE ME
    // This next line is to work around a known bug in Chrome Canary as of 2021-01-18
    canvas.width = width; canvas.height = height

    // To draw in WebGPU, you need the following things:
    // - You need mesh data to draw,
    //   and descriptors to describe the format of the mesh data.
    // - You need a vertex shader to convert the meshes into NDCs and a fragment shader to rasterize.
    // - You need a pipeline description to hold the mesh and shader descriptions.
    // - You need a command buffer to tell the pipeline to execute,
    //   and render pass encoders to add commands to the command buffer,
    //   and a command buffer encoder to create the render pass encoders.
    // - You need a swapchain to vend the texture that will be drawn on screen,
    //   and each frame you need the texture to draw into
    //   and a view on the texture to make the texture drawable.

    // You get a queue, from a device, from an adapter.
    // The queue is used to submit commands to be drawn.
    const adapter = await gpu.requestAdapter()
    const device = await adapter.requestDevice()
    const queue = device.defaultQueue

    // The swapchain is used to submit framebuffers [textures] to the display
    const swapChainDescription: GPUSwapChainDescriptor = {
      device: device,
      format: "bgra8unorm",
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT | GPUTextureUsage.COPY_SRC
    }

    // Scene Data [position color, indices for a single triangle]
    const positions = new Float32Array([
       1.0, -1.0, 0.0,
      -1.0, -1.0, 0.0,
       0.0,  1.0, 0.0
    ])
    const colors = new Float32Array([
       1.0, 0.0, 0.0,
       0.0, 1.0, 0.0,
       0.0, 0.0, 1.0
    ])
    const indices = new Uint16Array([ 0, 1, 2 ])

    // Helper function for creating GPUBuffer(s) out of Typed Arrays
    const createBuffer = (arr: Float32Array | Uint16Array, usage: number) => {
        // Align to 4 bytes (required when mapped)
        const desc = { size: ((arr.byteLength + 3) & ~3), usage, mappedAtCreation: true }
        const buffer = device.createBuffer(desc)
        const bufferMapped = buffer.getMappedRange(0,)

        const writeArray =
            arr instanceof Uint16Array ? new Uint16Array(bufferMapped) : new Float32Array(bufferMapped)
        writeArray.set(arr)
        buffer.unmap()
        return buffer
    }

    // Convert our scene data to GPU Buffers
    const positionBuffer = createBuffer(positions, GPUBufferUsage.VERTEX)
    const colorBuffer = createBuffer(colors, GPUBufferUsage.VERTEX)
    const indexBuffer = createBuffer(indices, GPUBufferUsage.INDEX)

    // 👋 Helper function for creating GPUShaderModule(s) out of SPIR-V files
    const loadData = async (filePath: string) =>
      fetch(new Request(filePath), { method: "GET", mode: "cors" }).then((res) =>
        res.arrayBuffer().then((arr) => new Uint32Array(arr))
      )
    const loadShader = async (shaderPath: string) =>
      await device.createShaderModule({code: await loadData(shaderPath)})

    const vShader = await loadShader("triangle.vert.spv")
    const fShader = await loadShader("triangle.frag.spv")

    const layout: GPUPipelineLayout = device.createPipelineLayout({bindGroupLayouts:[]});

    const positionBufferDesc: GPUVertexBufferLayoutDescriptor = {
      attributes: [{ // GPUVertexAttributeDescriptor
        shaderLocation: 0, // [[attribute(0)]]
        offset: 0,
        format: "float3"
      }],
      arrayStride: 4 * 3, // sizeof(float) * 3
      stepMode: "vertex"
    };
    const colorBufferDesc: GPUVertexBufferLayoutDescriptor = {
      attributes: [{
        shaderLocation: 1, // [[attribute(1)]]
        offset: 0,
        format: "float3"
      }],
      arrayStride: 4 * 3, // sizeof(float) * 3
      stepMode: "vertex"
    };

    // The pipleine will actually do the work
    const pipelineDesc: GPURenderPipelineDescriptor = {
      layout,

      vertexStage: { // GPUShaderModuleDescriptor
        module: vShader,
        entryPoint: "main"
      },
      fragmentStage: {
        module: fShader,
        entryPoint: "main"
      },

      primitiveTopology: "triangle-list",
      colorStates: [ { // GPUColorStateDescriptor
        format: "bgra8unorm",
        alphaBlend: {
          srcFactor: "src-alpha",
          dstFactor: "one-minus-src-alpha",
          operation: "add"
        },
        colorBlend: {
          srcFactor: "src-alpha",
          dstFactor: "one-minus-src-alpha",
          operation: "add"
        },
        writeMask: GPUColorWrite.ALL
      } ],

      vertexState: { // GPUVertexStateDescriptor
        //indexFormat: "uint16", // This line is only allowed for triangle strips
        vertexBuffers: [ positionBufferDesc, colorBufferDesc ]
      },
      rasterizationState: { // GPURasterizationStateDescriptor
        frontFace: "cw",
        cullMode: "none"
      }
    }

    const pipeline = device.createRenderPipeline(pipelineDesc);

    const swapchain: GPUSwapChain = gpuContext.configureSwapChain(swapChainDescription)

    const frame = () => {
      // Swapchain automatically creates a color texture (but not a depth texture)
      const colorTexture = swapchain.getCurrentTexture()
      const colorTextureView = colorTexture.createView()

      const commandEncoder = device.createCommandEncoder();
      {
        const passEncoder = commandEncoder.beginRenderPass({ // GPURenderPassDescriptor
          colorAttachments: [
            { //GPURenderPassColorAttachmentDescriptor
              attachment: colorTextureView,
              loadValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: "store"
            }
          ],
        });
        passEncoder.setPipeline(pipeline);
        passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
        passEncoder.setScissorRect(0, 0, canvas.width, canvas.height);
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.setIndexBuffer(indexBuffer, "uint16");
        passEncoder.drawIndexed(3, 1, 0, 0, 0);
        passEncoder.endPass();
      }
      queue.submit([ commandEncoder.finish() ]);
    }

    if (animateV) {
      const frameLoop = () => {
        if (stillMounted) {
          frame()
          requestAnimationFrame(frameLoop)
        }
      }

      requestAnimationFrame(frameLoop)
    } else {
      frame()
    }

    lastCanvas = {canvas, width, height}
  }} />
}

function Checkbox({state, label}:{state:State<boolean>, label:string|JSX.Element}) {
  const v = state.get()
  return <span>
          <input className="ToggleButton" type="checkbox" checked={v}
            onInput={(e:JSX.TargetedEvent<HTMLInputElement>) => state.set(e.currentTarget.checked)} />
            {label}
         </span>
}

function Controls() {
  return <div className="Controls">
    <Checkbox state={animate} label="Animate" /><br />
    <Checkbox state={preserve} label="preserveDrawingBuffer" /><br />
    <a href="#" onClick={handle(()=>{
      if (lastCanvas) {
        const {canvas, width, height} = lastCanvas
        canvas2image.saveAsPNG(canvas, width, height, "download-tdu")
      }
    })}>toDataURL</a>
    <br />
    <a href="#" onClick={handle(async ()=>{
      if (lastCanvas) {
        const {canvas, width, height} = lastCanvas
        const bitmap = await createImageBitmap(canvas)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = bitmap.width;
        tempCanvas.height = bitmap.height;
        const context = tempCanvas.getContext('bitmaprenderer');
        context.transferFromImageBitmap(bitmap);

        canvas2image.saveAsImage(tempCanvas, bitmap.width, bitmap.height, "png", "download-cib")
      }
    })}>createImageBitmap</a>
  </div>
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

function Content() {
  const gpu = navigator.gpu
  if (!gpu) {
      return <div className="TopError">
        This app requires WebGPU. Either your browser does not support WebGPU, or you must enable an experimental flag to access it.
      </div>
  }

  return (
    <div className="Content">
      <Controls />
      <AppCanvas gpu={gpu} />
    </div>)
}

render(
  WrapStateContexts(<Content />, [animate, preserve]),
  parentNode, replaceNode
);
