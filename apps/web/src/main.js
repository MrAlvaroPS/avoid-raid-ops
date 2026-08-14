import React from "react";
import { createRoot } from "react-dom/client";
import { jsx } from "react/jsx-runtime";
import { AppShell } from "./app/AppShell.js";

createRoot(document.getElementById("root")).render(
  jsx(React.StrictMode, { children: jsx(AppShell, {}) })
);
