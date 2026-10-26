import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";
export { pageRoutes, pageMeta, brand, services } from "./content.js";
export const render = (path) => renderToString(<App path={path} />);
