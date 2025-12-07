/**
 * Server-side API route to proxy image downloads
 * This bypasses CORS restrictions by fetching the image on the server
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const imageUrl = url.searchParams.get("url");
  
  if (!imageUrl) {
    return json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Fetch the image on the server (no CORS restrictions)
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Hominio/1.0)',
      },
    });

    if (!response.ok) {
      return json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the image as a blob
    const blob = await response.blob();
    
    // Convert blob to base64 for transmission
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = blob.type || 'image/jpeg';

    // Return as JSON with base64 data
    return json({
      data: base64,
      mimeType: mimeType,
      size: blob.size,
    });
  } catch (error) {
    console.error("Error proxying image:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};

