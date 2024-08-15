import { h, render, Component } from "preact";

declare let require:any

let root:HTMLElement = null;
const BOXES_ACROSS = 11;
const boxes:HTMLDivElement[] = [];
let firstTime:number = null;
let frameTime = 0;
let boxSide:number = null;
let baseX:number = null;
let baseY:number = null;

function fixBoxSize() {
  const width = root.offsetWidth;
  const height = root.offsetHeight;
  console.log("Resize", width, height);

  const square = Math.min(width, height);
  boxSide = Math.max(1,
    Math.floor(square/(BOXES_ACROSS*3-1+5))
  );
  baseX = Math.floor((width - square)/2);
  baseY = Math.floor((height - square)/2);

  const size = boxSide + "px";
  for (const idx in boxes) {
    const box = boxes[idx];
    box.style.width = size;
    box.style.height = size;
  }
}

function fixBoxPos() {
  for (const _idx in boxes) {
    const box = boxes[_idx];
    const idx = +_idx;
    const y = Math.floor(idx / BOXES_ACROSS);
    const x = idx % BOXES_ACROSS;

    const theta = y + x;
    const off = Math.sin(frameTime/1000 + 4*theta/BOXES_ACROSS) * boxSide;

    box.style.left = (baseX + boxSide*3*(1+x) - off) + "px";
    box.style.top = (baseY + boxSide*3*(1+y) - off) + "px";
  }
}

function step(_frameTime:number) {
  if (!firstTime)
    firstTime = _frameTime;
  frameTime = _frameTime - firstTime;

  window.requestAnimationFrame(step);
  fixBoxPos();
}

function resize() {
  fixBoxSize();
  fixBoxPos();
}

function boot() {
  console.log("Boot")
  root = document.getElementById("content");
  let page = document.createElement("div");

  for (let z = 0; z < BOXES_ACROSS*BOXES_ACROSS; z++) {
    let box = document.createElement("div");
    box.style.position = "fixed";
    box.style.backgroundColor = "white";

    boxes.push(box);
    page.appendChild(box);
  }
  fixBoxSize();
  fixBoxPos();
  root.replaceChild(page, root.firstChild);

  (new ResizeObserver(resize)).observe(root); // Callback will occur when div (fullscreen) resizes
  window.requestAnimationFrame(step);
}

(window as any).boot = boot; // Export