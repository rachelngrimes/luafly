import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { hwid, version, executor } = req.query;
  if (!hwid) return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ No HWID provided.")`);

  // Version check
  if (version) {
    const { data: versionData } = await supabase
      .from("versions")
      .select("*")
      .eq("version", version)
      .eq("active", true)
      .single();

    if (!versionData) {
      return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ Outdated loader. Please get the latest version.")`);
    }
  }

  // Check invalid attempts
  const { data: attemptData } = await supabase
    .from("invalid_attempts")
    .select("attempts")
    .eq("hwid", hwid)
    .single();

  if (attemptData && attemptData.attempts >= 10) {
    if (process.env.WEBHOOK_URL) {
      await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `⚠️ **Brute force detected!**\n**HWID:** ${hwid}\n**Attempts:** ${attemptData.attempts}`
        })
      });
    }
    return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ You have been flagged for suspicious activity.")`);
  }

  // Check user
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("hwid", hwid)
    .single();

  if (error || !user) {
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
    return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ You are not whitelisted. Contact the developer.")`);
  }

  if (user.status === "blacklisted") {
    const reason = user.ban_reason || "No reason provided.";
    return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ You are blacklisted.\\nReason: ${reason}")`);
  }

  // Check expiry
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    await supabase.from("users").update({ status: "expired" }).eq("hwid", hwid);

    if (process.env.WEBHOOK_URL) {
      await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `⏰ **${user.username || "Unknown"}**'s whitelist has expired.`
        })
      });
    }

    return res.status(200).send(`game.Players.LocalPlayer:Kick("❌ Your whitelist has expired. Contact the developer.")`);
  }

  // Check expiry warning (3 days)
  if (user.expires_at && !user.notified_expiry) {
    const daysLeft = Math.ceil((new Date(user.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3) {
      await supabase.from("users").update({ notified_expiry: true }).eq("hwid", hwid);
      if (process.env.WEBHOOK_URL) {
        await fetch(process.env.WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `⚠️ **${user.username || "Unknown"}**'s whitelist expires in **${daysLeft} day(s)**!`
          })
        });
      }
    }
  }

  // Update executor and last seen
  await supabase.from("users").update({
    executor: executor || "Unknown",
    last_seen: new Date().toISOString()
  }).eq("hwid", hwid);

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
        content: `✅ **${user.username || "Unknown"}** executed the script.\n**HWID:** ${hwid}\n**Executor:** ${executor || "Unknown"}`
      })
    });
  }

  // Serve script
  const script = await fetch(process.env.SCRIPT_URL).then(r => r.text());
  return res.status(200).send(script);
}
