import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugLog = []

  try {
    const { token } = await req.json()
    debugLog.push('Step 1: Token received: ' + (token ? token.substring(0, 8) + '...' : 'MISSING'))

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token jest wymagany', debug: debugLog }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    debugLog.push('Step 2: Env vars present: url=' + !!supabaseUrl + ' key=' + !!serviceRoleKey)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('activation_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle()

    debugLog.push('Step 3: Token lookup - found: ' + !!tokenData + ' error: ' + (tokenError?.message || 'none'))

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: 'Błąd bazy danych: ' + tokenError.message, debug: debugLog }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: 'Nieprawidłowy lub wygasły link aktywacyjny', debug: debugLog }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLog.push('Step 4: Token email: ' + tokenData.email)

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Link aktywacyjny wygasł. Zarejestruj się ponownie.', debug: debugLog }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLog.push('Step 5: Token not expired')

    // Find user in profiles table by email
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', tokenData.email)
      .maybeSingle()

    debugLog.push('Step 6: Profile lookup - found: ' + !!profileData + ' error: ' + (profileError?.message || 'none'))

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Błąd bazy danych (profile): ' + profileError.message, debug: debugLog }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profileData) {
      return new Response(
        JSON.stringify({ error: 'Profil użytkownika nie został znaleziony. Email: ' + tokenData.email, debug: debugLog }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLog.push('Step 7: Profile found, id: ' + profileData.id)

    // Mark token as used
    const { error: tokenUpdateError } = await supabase
      .from('activation_tokens')
      .update({ used: true })
      .eq('token', token)

    debugLog.push('Step 8: Token marked used - error: ' + (tokenUpdateError?.message || 'none'))

    // Activate user account in profiles table
    const { error: activateError } = await supabase
      .from('profiles')
      .update({ is_activated: true })
      .eq('id', profileData.id)

    debugLog.push('Step 9: Profile activated - error: ' + (activateError?.message || 'none'))

    if (activateError) {
      return new Response(
        JSON.stringify({ error: 'Błąd aktywacji profilu: ' + activateError.message, debug: debugLog }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLog.push('Step 10: SUCCESS')

    return new Response(
      JSON.stringify({ success: true, email: tokenData.email, debug: debugLog }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    debugLog.push('CATCH ERROR: ' + error.message)
    return new Response(
      JSON.stringify({ error: error.message, debug: debugLog }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
