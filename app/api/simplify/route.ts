import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { abc, settings } = await request.json()

    if (!abc) {
      return Response.json({ error: 'ABC notation is required' }, { status: 400 })
    }

    // Create a detailed prompt for music simplification
    const prompt = `You are an expert music arranger specializing in simplifying piano sheet music. Your task is to take ABC notation and create an easier version for beginner/intermediate pianists.

Original ABC notation:
${abc}

Simplification requirements:
${settings.removeOrnaments ? '- Remove ornaments (grace notes, trills, rolls, mordents, etc.)' : ''}
${settings.reduceChords ? '- Reduce complex chords to single notes or simple intervals' : ''}
${settings.dropSecondaryVoices ? '- Keep only the main melody line, remove secondary voices' : ''}
${settings.limitRhythm ? '- Simplify fast rhythms (16th notes become 8th notes, etc.)' : ''}
${settings.simplifyTies ? '- Remove complex ties and slurs' : ''}

Guidelines:
1. Maintain the musical essence and key of the piece
2. Keep the overall structure and form
3. Simplify technical passages while preserving the melody
4. Use standard ABC notation format
5. Ensure the output is valid ABC that can be rendered
6. Focus on making it playable by intermediate pianists
7. Preserve the time signature and basic rhythm
8. Keep dynamics simple (p, mf, f only)

Return ONLY the simplified ABC notation, no explanations or additional text.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert music arranger. Return only valid ABC notation without any explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const simplifiedAbc = completion.choices[0]?.message?.content?.trim()

    if (!simplifiedAbc) {
      throw new Error('No response from OpenAI')
    }

    return Response.json({ simplifiedAbc })

  } catch (error) {
    console.error('OpenAI API error:', error)
    return Response.json(
      { error: 'Failed to simplify music with AI' },
      { status: 500 }
    )
  }
}
