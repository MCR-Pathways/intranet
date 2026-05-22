"use client";

import { createSlatePlugin } from "platejs";

export const BaseToggleV2Plugin = createSlatePlugin({
  key: "toggle_v2",
  node: { isElement: true },
});

export const BaseToggleV2SummaryPlugin = createSlatePlugin({
  key: "toggle_v2_summary",
  node: { isElement: true },
});
