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
    const { email } = await req.json()

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

    console.log('ENV CHECK:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRole: !!serviceRoleKey,
      hasResendKey: !!resendApiKey,
      appUrl
    })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find user by email using admin API
    const { data: { users }, error: adminError } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.email === email)

    // Always return success (don't reveal if email exists)
    if (!user) {
      console.log('User not found for email:', email)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    // Delete old tokens for this email
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', email)

    // Insert new token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
        email,
        expires_at: expiresAt,
        used: false
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error('Błąd zapisu tokenu')
    }

    // Send email using Resend SDK
    const resend = new Resend(resendApiKey)

    const { data, error: resendError } = await resend.emails.send({
      from: 'Evair <noreply@evair.pl>',
      to: email,
      subject: 'Resetowanie hasła',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Resetowanie hasła</h2>
          <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta.</p>
          <p>Kliknij poniższy przycisk aby ustawić nowe hasło:</p>
          <a href="${appUrl}/?reset_token=${token}"
             style="display:inline-block; padding: 12px 24px;
                    background: #6366f1; color: white;
                    text-decoration: none; border-radius: 6px;
                    margin: 16px 0;">
            Resetuj hasło
          </a>
          <p style="color: #888; font-size: 0.85rem;">
            Link wygasa za 1 godzinę.<br>
            Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.
          </p>
        </div>
      `
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      throw new Error('Błąd wysyłki emaila: ' + JSON.stringify(resendError))
    }

    console.log('Email sent successfully:', data)

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
