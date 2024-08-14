import { h, render, Component } from "preact";

declare let require:any

function boot() {
  console.log("Boot")
  let root = document.getElementById("content");
  root.innerHTML = "Loaded"
}

(window as any).boot = boot; // Export