import { NextResponse } from "next/server";
import { extractTextFromImage } from "../../../lib/gemini";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json({ success: false, error: "No image provided for transcription." }, { status: 400 });
    }

    console.log(`[Vision API] Received instant transcription request (${image.size} bytes)...`);
    const transcription = await extractTextFromImage(image);

    return NextResponse.json({ success: true, text: transcription });
  } catch (error: any) {
    console.error("[Vision API] Fatal error inside transcription proxy:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to parse image via Vision model." },
      { status: 500 }
    );
  }
}
