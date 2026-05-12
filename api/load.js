import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { hwid } = req.query;
  if (!hwid) return res.status(200).send(`game.Players.LocalPlayer:Kick("No HWID provided.")`);

  // Check invalid attempts
  const { data: attemptData } = await supabase
    .from("invalid_attempts")
    .select("attempts")
    .eq("hwid", hwid)
    .single();

  if (attemptData && attemptData.attempts >= 10) {
    return res.status(200).send(`game.Players.LocalPlayer:Kick("You have been flagged for suspicious activity.")`);
  }

  // Check user
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("hwid", hwid)
    .single();

  if (error || !user) {
    // Log invalid attempt
    if (attemptData) {
      await supabase
        .from("invalid_attempts")
        .update({ attempts: attemptData.attempts + 1, last_attempt: new Date().toISOString() })
        .eq("hwid", hwid);
    } else {
      await supabase
        .from("invalid_attempts")
        .insert([{ hwid, attempts: 1, last_attempt: new Date().toISOString() }]);
    }
    return res.status(200).send(`game.Players.LocalPlayer:Kick("You are not whitelisted.")`);
  }

  if (user.status === "blacklisted") {
    const reason = user.ban_reason || "No reason provided.";
    return res.status(200).send(`game.Players.LocalPlayer:Kick("You are blacklisted. Reason: ${reason}")`);
  }

  // Check key expiry
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    await supabase.from("users").update({ status: "expired" }).eq("hwid", hwid);
    return res.status(200).send(`game.Players.LocalPlayer:Kick("Your whitelist has expired.")`);
  }

  // Log execution
  await supabase.from("logs").insert([{
    hwid,
    username: user.username || "Unknown",
    action: "executed",
    timestamp: new Date().toISOString()
  }]);

  // Send webhook
  if (process.env.WEBHOOK_URL) {
    await fetch(process.env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `✅ **${user.username || "Unknown"}** executed the script.\n**HWID:** ${hwid}`
      })
    });
  }

  // Serve script
  const script = await fetch(process.env.SCRIPT_URL).then(r => r.text());
  return res.status(200).send(script);
}
