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

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token jest wymagany' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('activation_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Nieprawidłowy lub wygasły link aktywacyjny' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Link aktywacyjny wygasł. Zarejestruj się ponownie.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find user by email
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) throw new Error('Błąd pobierania użytkowników')

    const user = users?.find(u => u.email === tokenData.email)
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Użytkownik nie został znaleziony' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Confirm user email in Supabase Auth
    const { error: confirmError } = await supabase.auth.admin.updateUser(user.id, {
      email_confirm: true
    })

    if (confirmError) {
      console.error('Confirm error:', confirmError)
      throw new Error('Błąd aktywacji konta')
    }

    // Mark token as used
    await supabase
      .from('activation_tokens')
      .update({ used: true })
      .eq('token', token)

    console.log('Account activated for:', tokenData.email)

    return new Response(
      JSON.stringify({ success: true, email: tokenData.email }),
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
