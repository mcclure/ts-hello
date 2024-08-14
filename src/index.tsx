import { h, render, Component } from "preact";

declare let require:any

function boot() {
  console.log("Boot")
  let root = document.getElementById("content");
  let page = document.createTextNode("Loaded");
  root.replaceChild(page, root.firstChild);
}

(window as any).boot = boot; // Export