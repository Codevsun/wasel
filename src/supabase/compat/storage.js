// Firebase Storage-compatible stubs implemented on top of Supabase Storage.
// Vite aliases redirect `firebase/storage` here. The app configures Storage but
// does not currently use it; these wrappers exist for parity.

import { supabase } from "../client"

const DEFAULT_BUCKET = "uploads"

export const storage = { __isSupabaseStorage: true, bucket: DEFAULT_BUCKET }

export function getStorage() {
  return storage
}

export function ref(_storage, path) {
  return { __ref: "storage", path }
}

export async function uploadBytes(storageRef, data) {
  const { error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(storageRef.path, data, { upsert: true })
  if (error) throw error
  return { ref: storageRef }
}

export async function getDownloadURL(storageRef) {
  const { data } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(storageRef.path)
  return data.publicUrl
}

export async function deleteObject(storageRef) {
  const { error } = await supabase.storage.from(DEFAULT_BUCKET).remove([storageRef.path])
  if (error) throw error
}
