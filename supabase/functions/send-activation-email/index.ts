import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email jest wymagany' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Generate activation token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Store token in database
    const { error: insertError } = await supabase
      .from('activation_tokens')
      .insert({
        email,
        token,
        expires_at: expiresAt,
        used: false
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error('Błąd zapisu tokenu aktywacyjnego')
    }

    // Send activation email
    const resend = new Resend(resendApiKey)

    const { error: resendError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Aktywacja konta Evair',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Witaj${fullName ? ', ' + fullName : ''}!</h2>
          <p>Dziękujemy za rejestrację w Evair. Kliknij poniższy przycisk, aby aktywować swoje konto:</p>
          <a href="${appUrl}/?activation_token=${token}"
             style="display:inline-block; padding: 12px 24px;
                    background: #6366f1; color: white;
                    text-decoration: none; border-radius: 6px;
                    margin: 16px 0;">
            Aktywuj konto
          </a>
          <p style="color: #888; font-size: 0.85rem;">
            Link wygasa za 24 godziny.<br>
            Jeśli nie zakładałeś konta w Evair, zignoruj tę wiadomość.
          </p>
        </div>
      `
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      throw new Error('Błąd wysyłki emaila: ' + JSON.stringify(resendError))
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
