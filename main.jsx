window.onerror = function(msg, url, line) {
  document.body.innerHTML = <div style="background:#111;color:#ff5555;padding:20px;font-family:monospace;height:100vh;"><h3>Runtime Crash:</h3><p>\</p><p>\:\</p></div>;
};
import './index.css'
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
