import { h, render, Component } from "preact";

declare let require:any

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

class Content extends Component<any, any> {
  constructor(props:{}) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div>Hello</div>
    )
  }
}

render(
  <Content />,
  parentNode, replaceNode
);
