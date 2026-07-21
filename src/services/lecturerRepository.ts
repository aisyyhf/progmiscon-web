import type { LecturerProfile } from "../types";
import { supabase } from "./supabaseClient";

type LecturerProfileRow = {
  user_id: string;
  email: string;
  full_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getLecturerProfile(
  userId: string,
): Promise<LecturerProfile | undefined> {
  const { data, error } = await supabase
    .from("lecturer_profiles")
    .select(
      "user_id,email,full_name,active,created_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<LecturerProfileRow>();

  if (error) {
    throw new Error(
      `Profil dosen gagal dimuat: ${error.message}`,
    );
  }

  if (!data) return undefined;

  return {
    userId: data.user_id,
    email: data.email,
    fullName: data.full_name,
    active: data.active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getCurrentUserAdminAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_is_admin");

  if (error) {
    throw new Error(`Hak akses Admin gagal diperiksa: ${error.message}`);
  }

  return data === true;
}
