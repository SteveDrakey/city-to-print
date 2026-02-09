import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SceneData } from "../src/types";
import { renderPreviewImages } from "./lib/renderScene";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sceneData } = req.body as { sceneData: SceneData };

    if (
      !sceneData ||
      !Array.isArray(sceneData.buildings) ||
      !Array.isArray(sceneData.roads) ||
      !Array.isArray(sceneData.water) ||
      typeof sceneData.modelWidthMm !== "number" ||
      typeof sceneData.modelDepthMm !== "number"
    ) {
      return res.status(400).json({ error: "Invalid sceneData" });
    }

    const images = renderPreviewImages(sceneData);

    return res.status(200).json({ images });
  } catch (err) {
    console.error("Render preview error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Render failed",
    });
  }
}
