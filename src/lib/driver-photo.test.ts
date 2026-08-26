import { describe, expect, it } from "vitest";
import {
  DRIVER_PHOTO_ERROR,
  DRIVER_PHOTO_MAX_BYTES,
  driverPhotoObjectPath,
  isStoredDriverPhotoPath,
  validateDriverPhoto,
} from "./driver-photo";

function fakeFile(type: string, size: number, name = "foto.jpg"): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("validateDriverPhoto", () => {
  it("akzeptiert JPEG unter 2 MB", () => {
    expect(validateDriverPhoto(fakeFile("image/jpeg", 1200))).toBeNull();
  });

  it("lehnt GIF und zu große Dateien ab", () => {
    expect(validateDriverPhoto(fakeFile("image/gif", 800))).toBe(
      DRIVER_PHOTO_ERROR,
    );
    expect(
      validateDriverPhoto(fakeFile("image/png", DRIVER_PHOTO_MAX_BYTES + 1)),
    ).toBe(DRIVER_PHOTO_ERROR);
  });
});

describe("driver photo paths", () => {
  it("baut den Mandantenpfad company/driver/datei", () => {
    const path = driverPhotoObjectPath(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      fakeFile("image/webp", 10, "x.webp"),
    );
    expect(path.startsWith("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/")).toBe(true);
    expect(path.endsWith(".webp")).toBe(true);
    expect(isStoredDriverPhotoPath(path)).toBe(true);
  });

  it("erkennt Data-URLs und http nicht als Storage-Pfad", () => {
    expect(isStoredDriverPhotoPath("data:image/jpeg;base64,abc")).toBe(false);
    expect(isStoredDriverPhotoPath("https://cdn.example/foto.jpg")).toBe(false);
    expect(isStoredDriverPhotoPath(null)).toBe(false);
  });
});
