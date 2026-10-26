import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
const base = import.meta.env.BASE_URL;
const raw = window.location.pathname.startsWith(base)
  ? window.location.pathname.slice(base.length)
  : window.location.pathname.slice(1);
const path = raw && !raw.endsWith("/") ? `${raw}/` : raw;
const root = document.getElementById("root");
root.firstElementChild
  ? hydrateRoot(root, <App path={path} />)
  : createRoot(root).render(<App path={path} />);
