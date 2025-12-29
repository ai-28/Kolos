import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a professional connection draft letter using AI
 * @param {Object} params - Connection details
 * @param {Object} params.clientProfile - Client profile information
 * @param {string} params.clientGoals - Client's goals
 * @param {Object} params.signalInfo - Related signal information (optional)
 * @param {Object} params.dealInfo - Deal information (optional)
 * @param {string} params.connectionType - Type of connection (linkedin, email, both)
 * @param {string} params.targetName - Name of the person to connect with
 * @param {string} params.targetCompany - Company of the target person
 * @returns {Promise<string>} Generated draft message
 */
export async function generateConnectionDraft({
    clientProfile,
    clientGoals,
    signalInfo = null,
    dealInfo = null,
    connectionType = 'email',
    targetName,
    targetCompany
}) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        // Build context from client profile
        const clientContext = `
Client Information:
- Name: ${clientProfile.name || 'N/A'}
- Company: ${clientProfile.company || 'N/A'}
- Role: ${clientProfile.role || 'N/A'}
- Industries: ${clientProfile.industries || 'N/A'}
- Regions: ${clientProfile.regions || 'N/A'}
- Goals: ${clientGoals || 'N/A'}
${clientProfile.project_size ? `- Project Size: ${clientProfile.project_size}` : ''}
${clientProfile.raise_amount ? `- Raise Amount: ${clientProfile.raise_amount}` : ''}
${clientProfile.check_size ? `- Check Size: ${clientProfile.check_size}` : ''}
${clientProfile.strategy_focus ? `- Strategy Focus: ${clientProfile.strategy_focus}` : ''}
${clientProfile.business_stage ? `- Business Stage: ${clientProfile.business_stage}` : ''}
${clientProfile.deal_type ? `- Deal Type: ${clientProfile.deal_type}` : ''}
${clientProfile.deal_size ? `- Deal Size: ${clientProfile.deal_size}` : ''}
${clientProfile.active_deal ? `- Active Deal: ${clientProfile.active_deal}` : ''}
`;

        // Build signal context if available
        let signalContext = '';
        if (signalInfo) {
            signalContext = `
Related Signal/Context:
- Headline: ${signalInfo.headline_source || signalInfo.headline || 'N/A'}
- Date: ${signalInfo.date || 'N/A'}
- Type: ${signalInfo.signal_type || 'N/A'}
- Next Step: ${signalInfo.next_step || 'N/A'}
- URL: ${signalInfo.url || 'N/A'}
`;
        }

        // Build deal context if available
        let dealContext = '';
        if (dealInfo) {
            dealContext = `
Deal Information:
- Deal Name: ${dealInfo.deal_name || 'N/A'}
- Target: ${dealInfo.target || 'N/A'}
- Stage: ${dealInfo.stage || 'N/A'}
- Deal Size: ${dealInfo.target_deal_size || 'N/A'}
- Next Step: ${dealInfo.next_step || 'N/A'}
`;
        }

        const prompt = `
You are a professional business development assistant helping to create personalized connection letters.

Generate a professional, concise, and compelling connection message for:

Target Person: ${targetName}
Target Company: ${targetCompany || 'N/A'}
Connection Type: ${connectionType}

${clientContext}
${signalContext}
${dealContext}

Requirements:
1. Keep the message professional but warm and personable
2. Be specific about why you're reaching out (reference goals, signal, or deal if relevant)
3. Clearly state the value proposition or mutual benefit
4. Include a clear call-to-action (request for meeting, call, or next step)
5. Keep it concise (2-3 short paragraphs, max 200 words)
6. Use appropriate tone for ${connectionType === 'linkedin' ? 'LinkedIn' : 'email'} communication
7. Personalize based on the client's goals and context provided
8. Avoid generic phrases - be specific and authentic

Generate ONLY the message text, no greetings, no signatures, no markdown formatting. Just the body of the message.
`;

        let completion;
        try {
            // Try gpt-4o first (latest and most capable)
            completion = await client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional business development assistant specializing in creating personalized B2B connection messages. You create concise, compelling, and authentic messages that drive meaningful business connections."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });
        } catch (modelError) {
            // Fallback to gpt-4-turbo if gpt-4o is not available
            console.warn('gpt-4o not available, falling back to gpt-4-turbo:', modelError.message);
            completion = await client.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional business development assistant specializing in creating personalized B2B connection messages. You create concise, compelling, and authentic messages that drive meaningful business connections."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });
        }

        const draftMessage = completion.choices[0].message.content.trim();

        if (!draftMessage || draftMessage.length < 50) {
            throw new Error('Generated draft message is too short or empty');
        }

        return draftMessage;
    } catch (error) {
        console.error('Error generating connection draft:', error);
        // Provide more detailed error message
        if (error.response) {
            throw new Error(`Failed to generate draft: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
        }
        throw new Error(`Failed to generate draft: ${error.message}`);
    }
}

