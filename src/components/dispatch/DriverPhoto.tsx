import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  isStoredDriverPhotoPath,
  signedDriverPhotoUrl,
  validateDriverPhoto,
} from "@/lib/driver-photo";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function useResolvedPhotoUrl(photoUrl: string | null | undefined) {
  const stored = isStoredDriverPhotoPath(photoUrl);
  const { data } = useQuery({
    queryKey: ["driver-photo-url", photoUrl],
    enabled: stored,
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedDriverPhotoUrl(photoUrl!),
  });
  if (!photoUrl) return null;
  if (photoUrl.startsWith("data:") || photoUrl.startsWith("http")) return photoUrl;
  return data ?? null;
}

interface DriverPhotoAvatarProps {
  name: string;
  photoUrl?: string | null;
  className?: string;
}

export function DriverPhotoAvatar({
  name,
  photoUrl,
  className,
}: DriverPhotoAvatarProps) {
  const src = useResolvedPhotoUrl(photoUrl);
  return (
    <div
      className={cn(
        "rounded overflow-hidden bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

interface DriverPhotoPickerProps {
  name: string;
  photoUrl: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  sizeClassName?: string;
}

export function DriverPhotoPicker({
  name,
  photoUrl,
  onFile,
  onClear,
  disabled,
  sizeClassName = "h-20 w-20",
}: DriverPhotoPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const src = useResolvedPhotoUrl(localPreview ?? photoUrl);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const validation = validateDriverPhoto(file);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    onFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "relative rounded overflow-hidden border border-hairline bg-panel-2",
          "flex items-center justify-center text-lg font-semibold text-foreground",
          "hover:border-primary/40 transition-colors disabled:opacity-60",
          sizeClassName,
        )}
        onClick={() => fileRef.current?.click()}
        title="Foto wählen"
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials(name || "?")}</span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 py-0.5">
          <Camera className="w-3.5 h-3.5 text-white" />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {photoUrl || localPreview ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() => {
            if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
            setLocalPreview(null);
            setError(null);
            onClear();
          }}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Foto entfernen
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">JPEG, PNG oder WebP, max. 2 MB</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

