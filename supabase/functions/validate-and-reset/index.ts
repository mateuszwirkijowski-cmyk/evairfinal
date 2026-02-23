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
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Token i nowe hasło są wymagane" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Hasło musi mieć minimum 8 znaków" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    // Look up token in password_reset_tokens
    const tokenResponse = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_tokens?token=eq.${token}&used=eq.false&expires_at=gt.${new Date().toISOString()}&select=*`,
      {
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to fetch token");
    }

    const tokens = await tokenResponse.json();

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "Link wygasł lub jest nieprawidłowy" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenRecord = tokens[0];
    const userId = tokenRecord.user_id;

    // Update user password using Supabase Admin API
    const updateResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Failed to update password:", errorText);
      throw new Error("Failed to update password");
    }

    // Mark token as used
    const markUsedResponse = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_tokens?id=eq.${tokenRecord.id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          used: true,
        }),
      }
    );

    if (!markUsedResponse.ok) {
      console.error("Failed to mark token as used");
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in validate-and-reset:", error);
    return new Response(
      JSON.stringify({ error: "Wystąpił błąd serwera" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
