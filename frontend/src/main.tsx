import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DialogProvider } from "./components/Dialog";
import { Garde } from "./components/Garde";
import "katex/dist/katex.min.css";
import "./styles/global.css";
import "./styles/editor.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Garde>
      <DialogProvider>
        <App />
      </DialogProvider>
    </Garde>
  </React.StrictMode>,
);
