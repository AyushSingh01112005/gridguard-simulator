import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import ReadingWindow from "@/app/models/ReadingWindow";

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    // Validate required payload fields
    if (!body.area || !body.houses || !body.transformer) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (area, houses, transformer)" },
        { status: 400 }
      );
    }

    const newReadingWindow = await ReadingWindow.create(body);

    return NextResponse.json(
      {
        success: true,
        message: "Reading window saved successfully",
        data: newReadingWindow,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving reading window:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to save reading window",
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await connectDB();
    const readings = await ReadingWindow.find({}).sort({ createdAt: -1 }).limit(20);
    return NextResponse.json({ success: true, data: readings });
  } catch (error) {
    console.error("Error fetching readings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch readings" },
      { status: 500 }
    );
  }
}
