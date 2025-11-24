import { NextResponse } from "next/server";
import Retell from "retell-sdk";

export async function POST(request) {
  try {
    // Initialize Retell client with your API key
    const client = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // Create a web call to get access token
    const webCallResponse = await client.call.createWebCall({
      agent_id: process.env.RETELL_AGENT_ID,
    });

    // Return the access token
    return NextResponse.json({
      accessToken: webCallResponse.access_token,
    });
  } catch (error) {
    console.error("Error creating Retell web call:", error);
    return NextResponse.json(
      { 
        error: "Failed to create web call", 
        details: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
