import { describe, expect, it } from "vitest";
import {
  fallbackMessageId,
  parseImapHeaders,
  previewFromBody,
  shipmentDraftFromMail,
} from "./imap-mail";

describe("imap-mail", () => {
  it("liest Message-ID, Absender und Betreff", () => {
    const parsed = parseImapHeaders(
      "Message-ID: <abc@example.com>\r\nFrom: Verkäufer <anna@firma.de>\r\nSubject: Lieferschein 12\r\nDate: Sat, 22 Aug 2026 10:00:00 +0200\r\n",
    );
    expect(parsed.messageId).toBe("<abc@example.com>");
    expect(parsed.from).toBe("anna@firma.de");
    expect(parsed.subject).toBe("Lieferschein 12");
  });

  it("erfindet keine Lieferadresse", () => {
    const draft = shipmentDraftFromMail({
      companyId: "d7da1c5a-7cba-4678-8003-bc8844510a87",
      depotId: null,
      serviceDate: "2026-08-24",
      preview: "Bitte liefern an Musterstraße 1",
      headers: {
        messageId: "<x@y>",
        subject: "LS",
        from: "a@b.de",
        date: null,
      },
    });
    expect(draft.delivery_address).toBeNull();
    expect(draft.customer_name).toBeNull();
    expect(draft.intake_source).toBe("email_imap");
    expect(draft.integration_id).toBeNull();
    expect(draft.missing_fields.needs_review).toBe(true);
  });

  it("zieht Klartext aus HTML ohne Skripte", () => {
    expect(previewFromBody("<html><script>x</script><p>Hallo  Welt</p></html>")).toBe("Hallo Welt");
  });

  it("bildet eine stabile Fallback-Message-ID", () => {
    const headers = { messageId: null, subject: "A", from: "b@c.de", date: "x" };
    expect(fallbackMessageId("aaaaaaaa-bbbb", headers, "p")).toBe(
      fallbackMessageId("aaaaaaaa-bbbb", headers, "p"),
    );
  });
});
