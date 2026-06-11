"use client";

import { BrowserRouter } from "react-router-dom";

import { App } from "@client/App";

export function ClientApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
