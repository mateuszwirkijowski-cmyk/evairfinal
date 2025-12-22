import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const accessToken = body._accessToken;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing access token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dbClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/create-conversation")) {
      const { data: conversation, error: convError } = await dbClient
        .from("conversations")
        .insert({
          name: body.groupName || null,
          is_group: body.isGroup || false,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) {
        return new Response(
          JSON.stringify({ error: convError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allMemberIds = [user.id, ...(body.memberIds || []).filter(id => id !== user.id)];
      const members = allMemberIds.map(userId => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: membersError } = await dbClient
        .from("conversation_members")
        .insert(members);

      if (membersError) {
        return new Response(
          JSON.stringify({ error: membersError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ conversation }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.endsWith("/send-message")) {
      const { data: membership } = await dbClient
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", body.conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Not a member of this conversation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: message, error: msgError } = await dbClient
        .from("messages")
        .insert({
          conversation_id: body.conversationId,
          sender_id: user.id,
          content: body.content,
          media_url: body.mediaUrl || null,
          media_type: body.mediaType || null,
        })
        .select()
        .single();

      if (msgError) {
        return new Response(
          JSON.stringify({ error: msgError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});