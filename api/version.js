import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { version } = req.query;
  if (!version) return res.status(400).json({ error: "No version provided" });

  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("version", version)
    .eq("active", true)
    .single();

  if (error || !data) return res.status(200).json({ valid: false });
  return res.status(200).json({ valid: true });
}
