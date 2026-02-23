import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("VITE_RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL");

    console.log('ENV CHECK:', {
      hasResendKey: !!resendApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRole: !!serviceRoleKey,
      hasAppUrl: !!appUrl
    });

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing RESEND_API_KEY env variable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase env variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!appUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing APP_URL env variable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up user by email in auth.users table
    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error("Failed to fetch users");
    }

    const { users } = await userResponse.json();
    const user = users.find((u: any) => u.email === email);

    // Security: Always return success, even if user not found
    if (!user) {
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate token
    const token = crypto.randomUUID();

    // Delete any previous unused tokens for this email
    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_tokens?email=eq.${email}&used=eq.false`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
        },
      }
    );

    // Insert new token into password_reset_tokens table
    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_tokens`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          token: token,
          email: email,
        }),
      }
    );

    if (!insertResponse.ok) {
      throw new Error("Failed to insert token");
    }

    // Send email via Resend API
    const resetLink = `${appUrl}/?reset_token=${token}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Resetowanie hasła",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Resetowanie hasła</h1>
              </div>
              <div class="content">
                <p>Otrzymałeś tę wiadomość, ponieważ ktoś poprosił o zresetowanie hasła do Twojego konta.</p>
                <p>Kliknij poniższy przycisk, aby ustawić nowe hasło:</p>
                <p style="text-align: center;">
                  <a href="${resetLink}" class="button">Resetuj hasło</a>
                </p>
                <p>Lub skopiuj i wklej ten link w przeglądarce:</p>
                <p style="background: white; padding: 10px; border-radius: 4px; word-break: break-all;">
                  ${resetLink}
                </p>
                <p><strong>Link wygaśnie za 1 godzinę.</strong></p>
                <p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
              </div>
              <div class="footer">
                <p>Wiadomość wygenerowana automatycznie - nie odpowiadaj na nią.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error("Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in send-reset-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
