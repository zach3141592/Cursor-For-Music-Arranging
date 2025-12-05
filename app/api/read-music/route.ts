import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// System prompt for expert music transcription
const systemPrompt = `You are an expert music transcriber with deep knowledge of Western music notation and ABC notation format. You have perfect understanding of:
- The grand staff system (treble clef for right hand, bass clef for left hand)
- Key signatures and their accidental rules
- Time signatures and measure grouping
- ABC notation standard syntax

Your task is to convert sheet music images to valid ABC notation through careful, systematic analysis. Be meticulous about octave accuracy, key signature application, and rhythm validation.`

// Pass 1: Structured analysis and transcription prompt
const pass1Prompt = `Analyze this sheet music image and convert it to valid ABC notation.

=== STEP 1: IDENTIFY STRUCTURE ===

First, examine the image and identify:
1. Staff type: single staff, grand staff (piano), or multiple instruments
2. Clef(s): treble (G clef), bass (F clef), or both
3. Key signature: Count sharps or flats
   - Sharps order: F# C# G# D# A# E# B#
   - Flats order: Bb Eb Ab Db Gb Cb Fb
   - Key of C = no sharps/flats
   - Key of G = 1 sharp (F#)
   - Key of D = 2 sharps (F#, C#)
   - Key of F = 1 flat (Bb)
4. Time signature: top number = beats per measure, bottom = note value

=== STEP 2: ABC OCTAVE REFERENCE ===

CRITICAL - Use correct octave notation:
- C,, D,, E,, = Octave 2 (very low)
- C, D, E, = Octave 3 (bass clef low)
- C D E F G A B = Octave 4 (middle C octave, around middle of grand staff)
- c d e f g a b = Octave 5 (treble clef middle)
- c' d' e' = Octave 6 (treble clef high)
- c'' d'' = Octave 7 (very high)

Middle C (first ledger line below treble staff OR first ledger line above bass staff) = C (uppercase, no modifier)

=== STEP 3: DURATION REFERENCE (with L:1/8 base) ===

- Whole note (empty oval, no stem) = 8
- Half note (empty oval with stem) = 4
- Quarter note (filled with stem) = 2
- Eighth note (filled with flag/beam) = 1
- Sixteenth note (two flags) = /2
- Dotted note = multiply by 1.5 (e.g., dotted quarter = 3)

=== STEP 4: TRANSCRIBE SYSTEMATICALLY ===

Work LEFT to RIGHT, measure by measure:
1. Apply key signature accidentals to ALL affected notes (e.g., in G major, every F is F# unless marked natural)
2. Use ^ for sharp, _ for flat, = for natural
3. Separate measures with | bar lines
4. For chords, use brackets: [CEG]
5. For piano, use V:1 for right hand (treble), V:2 for left hand (bass)

=== STEP 5: VALIDATE EACH MEASURE ===

Before writing each measure, verify the durations sum correctly:
- 4/4 time: should equal 8 eighth notes (or equivalent)
- 3/4 time: should equal 6 eighth notes (or equivalent)
- 6/8 time: should equal 6 eighth notes

=== OUTPUT FORMAT ===

Return ONLY valid ABC notation:
X:1
T:[Title if visible, or "Untitled"]
M:[time signature, e.g., 4/4]
L:1/8
Q:1/4=100
K:[key, e.g., C, G, Dm]
V:1 clef=treble name="RH"
[music for right hand/treble]
V:2 clef=bass name="LH"
[music for left hand/bass]

=== EXAMPLES ===

Example 1 - Simple C major melody:
X:1
T:Scale
M:4/4
L:1/8
K:C
V:1 clef=treble
C2 D2 E2 F2 | G2 A2 B2 c2 |

Example 2 - G major with both hands:
X:1
T:Simple Piece
M:3/4
L:1/8
K:G
V:1 clef=treble
d4 B2 | G4 A2 |
V:2 clef=bass
G,6 | D,4 z2 |

Now analyze the provided image and generate the ABC notation.`

// Pass 2: Verification prompt
function getVerificationPrompt(pass1Abc: string): string {
  return `You are verifying ABC notation that was transcribed from a sheet music image.

ORIGINAL TRANSCRIPTION:
${pass1Abc}

VERIFICATION TASK:
Look at the original sheet music image again and verify the transcription above is correct.

Check for these common errors:
1. OCTAVE ERRORS: Are notes in the correct octave?
   - Middle C = C (uppercase)
   - Notes above middle C in treble = c d e (lowercase)
   - Notes below middle C in bass = C, B, A, (with comma)

2. KEY SIGNATURE: Are accidentals from key signature applied throughout?
   - In G major, every F should be ^F (F#) unless marked natural

3. RHYTHM: Do measures have the correct total duration?
   - In 4/4, each measure should sum to 8 eighth notes

4. MISSING NOTES: Are all visible notes transcribed?

5. WRONG PITCHES: Do the note positions match the staff lines/spaces?

If you find errors, provide the CORRECTED ABC notation.
If the transcription is correct, return it unchanged.

Return ONLY the ABC notation (corrected if needed). No explanations.`
}

// Validate and fix common ABC syntax issues
function validateAndFixAbc(abc: string): { abc: string; fixes: string[] } {
  const fixes: string[] = []
  let fixed = abc

  // Remove markdown code blocks
  fixed = fixed.replace(/```abc\n?/gi, '').replace(/```\n?/g, '').trim()

  // Ensure X: header exists
  if (!/^X:\s*\d+/m.test(fixed)) {
    fixed = 'X:1\n' + fixed
    fixes.push('Added missing X:1 header')
  }

  // Ensure K: header exists (required before music)
  if (!/^K:/m.test(fixed)) {
    // Try to insert K:C before first music line
    const lines = fixed.split('\n')
    const musicLineIndex = lines.findIndex(line =>
      /^[A-Ga-gz\[\|V:]/.test(line) && !/^[A-Z]:/.test(line)
    )
    if (musicLineIndex > 0) {
      lines.splice(musicLineIndex, 0, 'K:C')
      fixed = lines.join('\n')
      fixes.push('Added missing K:C header (defaulted to C major)')
    }
  }

  // Fix unclosed brackets at end of lines
  const lines = fixed.split('\n')
  fixed = lines.map((line, i) => {
    if (!/^[A-Z]:/.test(line)) {
      const openBrackets = (line.match(/\[/g) || []).length
      const closeBrackets = (line.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) {
        fixes.push(`Line ${i + 1}: Closed ${openBrackets - closeBrackets} unclosed bracket(s)`)
        return line + ']'.repeat(openBrackets - closeBrackets)
      }
    }
    return line
  }).join('\n')

  // Fix unclosed braces (grace notes)
  const openBraces = (fixed.match(/\{/g) || []).length
  const closeBraces = (fixed.match(/\}/g) || []).length
  if (openBraces > closeBraces) {
    fixed = fixed + '}'.repeat(openBraces - closeBraces)
    fixes.push('Closed unclosed grace note braces')
  }

  return { abc: fixed, fixes }
}

// Check if ABC has critical syntax errors that need retry
function hasCriticalErrors(abc: string): string[] {
  const errors: string[] = []

  if (!/^X:\s*\d+/m.test(abc)) {
    errors.push('Missing X: header')
  }
  if (!/^K:/m.test(abc)) {
    errors.push('Missing K: (key) header')
  }
  if (!/^M:/m.test(abc)) {
    errors.push('Missing M: (time signature) header')
  }

  // Check for obviously invalid content
  if (abc.length < 20) {
    errors.push('Response too short to be valid ABC notation')
  }

  return errors
}

export async function POST(request: Request) {
  try {
    const { image, mimeType } = await request.json()

    if (!image) {
      return Response.json({ error: 'Image data is required' }, { status: 400 })
    }

    const imageUrl = `data:${mimeType};base64,${image}`

    // ========== PASS 1: Initial Transcription ==========
    console.log('Pass 1: Initial transcription...')

    const pass1Response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: pass1Prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1, // Lower temperature for more consistent output
    })

    let pass1Abc = pass1Response.choices[0]?.message?.content?.trim()

    if (!pass1Abc) {
      throw new Error('No response from OpenAI in Pass 1')
    }

    // Clean and validate pass 1 result
    const pass1Validated = validateAndFixAbc(pass1Abc)
    pass1Abc = pass1Validated.abc

    // ========== PASS 2: Self-Verification ==========
    console.log('Pass 2: Self-verification...')

    const pass2Response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: getVerificationPrompt(pass1Abc) },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    })

    let pass2Abc = pass2Response.choices[0]?.message?.content?.trim()

    if (!pass2Abc) {
      // If pass 2 fails, use pass 1 result
      console.log('Pass 2 returned empty, using Pass 1 result')
      pass2Abc = pass1Abc
    }

    // Clean and validate pass 2 result
    const pass2Validated = validateAndFixAbc(pass2Abc)
    let finalAbc = pass2Validated.abc

    // ========== RETRY IF CRITICAL ERRORS ==========
    const criticalErrors = hasCriticalErrors(finalAbc)

    if (criticalErrors.length > 0) {
      console.log('Critical errors detected, attempting retry...', criticalErrors)

      const retryPrompt = `The previous transcription had errors: ${criticalErrors.join(', ')}.

Please look at the sheet music image again and provide valid ABC notation.

REQUIREMENTS:
1. Must start with X:1
2. Must include M: (time signature like 4/4)
3. Must include K: (key like C, G, Dm)
4. Must include actual music notation after the headers

Return ONLY the ABC notation.`

      const retryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: retryPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      })

      const retryAbc = retryResponse.choices[0]?.message?.content?.trim()
      if (retryAbc) {
        const retryValidated = validateAndFixAbc(retryAbc)
        finalAbc = retryValidated.abc
      }
    }

    console.log('Transcription complete')

    return Response.json({
      abc: finalAbc,
      passes: 2,
      fixes: [...pass1Validated.fixes, ...pass2Validated.fixes]
    })

  } catch (error) {
    console.error('OpenAI Vision API error:', error)
    return Response.json(
      { error: 'Failed to read sheet music from image' },
      { status: 500 }
    )
  }
}
