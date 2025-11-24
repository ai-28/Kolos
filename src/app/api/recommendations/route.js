import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
    try {
        const profile = await req.json();

        if (!profile || typeof profile !== "object") {
            return NextResponse.json(
                { error: "Invalid profile data" },
                { status: 400 }
            );
        }

        const prompt = `
You are Kolos AI. Generate exactly 3 actionable, personalized recommendations for this member.
Keep each recommendation short, clear, and practical.

Profile:
${JSON.stringify(profile, null, 2)}

Format your response as a numbered list (1., 2., 3.) with each recommendation on a new line.
Return ONLY plain text, no markdown formatting.
`;

        const completion = await client.chat.completions.create({
            model: "gpt-4o", // or "gpt-4-turbo" or "gpt-3.5-turbo" depending on your needs
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        const recommendations = completion.choices[0].message.content;

        return NextResponse.json({
            recommendations,
        });
    } catch (error) {
        console.error("Error generating recommendations:", error);
        return NextResponse.json(
            {
                error: "Failed to generate recommendations",
                details: error.message,
            },
            { status: 500 }
        );
    }
}
