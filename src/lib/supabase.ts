import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zwqjgtacdtewrpizyjzq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cWpndGFjZHRld3JwaXp5anpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODYxNjYsImV4cCI6MjA4ODg2MjE2Nn0.Cr5P9OQyFh-gBEs47AcNYaZ16qCyMySimCkAAt9Pc8w";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
