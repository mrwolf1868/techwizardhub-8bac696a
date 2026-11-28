import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Remove previously persisted private account state; only public catalogs may be cached.
window.localStorage.removeItem("techwizard-hub-user");
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
