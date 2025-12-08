import { NextResponse } from "next/server";
import Retell from "retell-sdk";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, linkedinUrl } = body || {};

    // Initialize Retell client with your API key
    const client = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // Prepare web call options
    const webCallOptions = {
      agent_id: process.env.RETELL_AGENT_ID,
    };

    // Add dynamic variables if provided
    // RetellAI uses retell_llm_dynamic_variables to pass initial data
    if (name || email || linkedinUrl) {
      webCallOptions.retell_llm_dynamic_variables = {
        name: name || "",
        email: email || "",
        linkedin_url: linkedinUrl || "", // Note: use underscore for variable names
      };
    }

    // Create a web call to get access token
    const webCallResponse = await client.call.createWebCall(webCallOptions);

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
