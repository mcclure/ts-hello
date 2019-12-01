import * as React from "react";
import * as ReactDOM from "react-dom";

declare let require:any

class Content extends React.Component<any, any> {
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

ReactDOM.render(
  <Content />,
  document.getElementById("content")
);
