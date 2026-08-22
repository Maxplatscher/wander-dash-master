import { supabase } from "@/integrations/supabase/client";

export const DRIVER_PHOTO_BUCKET = "driver-photos";
export const DRIVER_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const DRIVER_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DRIVER_PHOTO_ERROR =
  "Nur JPEG, PNG oder WebP, maximal 2 MB.";

type AllowedMime = (typeof DRIVER_PHOTO_MIME_TYPES)[number];

export function isDriverPhotoMime(value: string): value is AllowedMime {
  return (DRIVER_PHOTO_MIME_TYPES as readonly string[]).includes(value);
}

export function validateDriverPhoto(file: File): string | null {
  if (!isDriverPhotoMime(file.type)) return DRIVER_PHOTO_ERROR;
  if (file.size <= 0 || file.size > DRIVER_PHOTO_MAX_BYTES) {
    return DRIVER_PHOTO_ERROR;
  }
  return null;
}

export function isStoredDriverPhotoPath(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return false;
  }
  return value.split("/").length === 3;
}

function extensionForMime(mime: AllowedMime): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function driverPhotoObjectPath(
  companyId: string,
  driverId: string,
  file: File,
): string {
  const ext = isDriverPhotoMime(file.type)
    ? extensionForMime(file.type)
    : "jpg";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  return `${companyId}/${driverId}/${id}.${ext}`;
}

export function fileFromDataUrl(dataUrl: string, fileName = "foto.jpg"): File | null {
  const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  if (!isDriverPhotoMime(mime)) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  } catch {
    return null;
  }
}

export async function uploadDriverPhoto(params: {
  companyId: string;
  driverId: string;
  file: File;
  previousPath?: string | null;
}): Promise<string> {
  const validationError = validateDriverPhoto(params.file);
  if (validationError) throw new Error(validationError);

  const path = driverPhotoObjectPath(
    params.companyId,
    params.driverId,
    params.file,
  );
  const { error } = await supabase.storage
    .from(DRIVER_PHOTO_BUCKET)
    .upload(path, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type,
    });
  if (error) throw new Error(error.message);

  if (params.previousPath && isStoredDriverPhotoPath(params.previousPath)) {
    await supabase.storage
      .from(DRIVER_PHOTO_BUCKET)
      .remove([params.previousPath]);
  }

  return path;
}

export async function removeDriverPhoto(path: string): Promise<void> {
  if (!isStoredDriverPhotoPath(path)) return;
  const { error } = await supabase.storage
    .from(DRIVER_PHOTO_BUCKET)
    .remove([path]);
  if (error) throw new Error(error.message);
}

export async function signedDriverPhotoUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!isStoredDriverPhotoPath(path)) return path.startsWith("http") ? path : null;
  const { data, error } = await supabase.storage
    .from(DRIVER_PHOTO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl ?? null;
}
