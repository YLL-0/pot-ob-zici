/**
 * Email for the admin: password reset and the invitation sent to a new
 * user. Sent through Resend's HTTP API with a small Payload email adapter
 * (no extra dependency — it is one POST request).
 *
 * Environment (lib/cms.ts isEmailConfigured):
 *   RESEND_API_KEY   — Resend API key (server only)
 *   EMAIL_FROM       — sender address on a domain verified in Resend
 *   EMAIL_FROM_NAME  — optional sender name, default »Pot ob žici«
 *   NEXT_PUBLIC_SERVER_URL — public site URL; links in emails point there
 *
 * Without RESEND_API_KEY + EMAIL_FROM Payload has no email adapter and only
 * logs messages to the server console — nothing reaches the recipient.
 * The invitation hook says so to the admin instead of pretending it sent.
 */

import type { PayloadEmailAdapter, PayloadRequest, SendEmailOptions } from "payload";
import { APIError } from "payload";

const RESEND_URL = "https://api.resend.com/emails";
export const PRIVZETO_IME_POSILJATELJA = "Pot ob žici";

type Naslov = string | { address: string; name?: string };

function vNiz(n: Naslov): string {
  if (typeof n === "string") return n;
  return n.name ? `"${n.name.replace(/"/g, "")}" <${n.address}>` : n.address;
}

function seznam(v: unknown): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => vNiz(x as Naslov));
}

export function resendAdapter({
  apiKey,
  posiljatelj,
  imePosiljatelja,
}: {
  apiKey: string;
  posiljatelj: string;
  imePosiljatelja: string;
}): PayloadEmailAdapter {
  return () => ({
    name: "resend",
    defaultFromAddress: posiljatelj,
    defaultFromName: imePosiljatelja,
    sendEmail: async (message: SendEmailOptions) => {
      const neprazno = (v: string[]) => (v.length > 0 ? v : undefined);
      const telo = {
        from: message.from ? vNiz(message.from as Naslov) : vNiz({ address: posiljatelj, name: imePosiljatelja }),
        to: seznam(message.to),
        cc: neprazno(seznam(message.cc)),
        bcc: neprazno(seznam(message.bcc)),
        reply_to: neprazno(seznam(message.replyTo)),
        subject: message.subject ?? "",
        html: typeof message.html === "string" ? message.html : undefined,
        text: typeof message.text === "string" ? message.text : undefined,
      };
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(telo),
      });
      const odgovor = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok) {
        throw new APIError(
          `Pošiljanje e-pošte ni uspelo (Resend, HTTP ${res.status}): ${odgovor?.message ?? "neznana napaka"}`,
          502,
        );
      }
      return odgovor;
    },
  });
}

// ---------------------------------------------------------------------------
// Slovenian messages
// ---------------------------------------------------------------------------

/** Public base URL for links in emails: NEXT_PUBLIC_SERVER_URL, else the request's origin. */
function osnovniUrl(req?: Partial<PayloadRequest>): string {
  const izOkolja = req?.payload?.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (izOkolja) return izOkolja.replace(/\/+$/, "");
  try {
    const host = req?.headers?.get("host");
    if (host && req?.url) return `${new URL(req.url).protocol}//${host}`;
  } catch {
    // fall through
  }
  return "";
}

export function povezavaZaGeslo(req: Partial<PayloadRequest> | undefined, token: string): string {
  const admin = req?.payload?.config.routes.admin ?? "/admin";
  const reset = req?.payload?.config.admin.routes.reset ?? "/reset";
  return `${osnovniUrl(req)}${admin}${reset}/${token}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Plain, robust email layout: one column, inline styles (email clients
 * ignore stylesheets), the link also written out in full for clients that
 * strip buttons. Colours are the site's ink/accent tokens, inlined.
 */
function predloga({ naslov, odstavki, gumb, povezava, opomba }: {
  naslov: string;
  odstavki: string[];
  gumb: string;
  povezava: string;
  opomba: string;
}): string {
  const p = (t: string) => `<p style="margin:0 0 16px;line-height:1.6">${t}</p>`;
  return `<!doctype html><html lang="sl"><body style="margin:0;padding:24px;background:#faf7f1;font-family:Arial,Helvetica,sans-serif;color:#1f1c18;font-size:16px">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4ddd1;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#57514a">Pot ob žici · urejanje</p>
<h1 style="margin:0 0 20px;font-size:22px">${escapeHtml(naslov)}</h1>
${odstavki.map(p).join("\n")}
<p style="margin:24px 0"><a href="${escapeHtml(povezava)}" style="display:inline-block;background:#2a4536;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escapeHtml(gumb)}</a></p>
${p(`Če gumb ne deluje, kopiraj to povezavo v brskalnik:<br><a href="${escapeHtml(povezava)}" style="color:#2a4536;word-break:break-all">${escapeHtml(povezava)}</a>`)}
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#57514a">${opomba}</p>
</div></body></html>`;
}

function ime(user: unknown): string | null {
  const i = (user as { ime?: string | null } | undefined)?.ime;
  return i && i.trim() ? i.trim() : null;
}

export function ponastavitevGeslaZadeva(): string {
  return "Ponastavitev gesla — Pot ob žici";
}

export function ponastavitevGeslaHtml({ req, token, user }: { req?: PayloadRequest; token?: string; user?: unknown }): string {
  const pozdrav = ime(user) ? `Pozdravljeni, ${escapeHtml(ime(user)!)}!` : "Pozdravljeni!";
  return predloga({
    naslov: "Ponastavitev gesla",
    odstavki: [
      pozdrav,
      "Prejeli smo zahtevo za ponastavitev gesla za vaš račun v urejevalniku spletne strani Pot ob žici. Novo geslo nastavite s klikom na gumb.",
    ],
    gumb: "Nastavi novo geslo",
    povezava: povezavaZaGeslo(req, token ?? ""),
    opomba:
      "Povezava velja 1 uro. Če ponastavitve niste zahtevali, to sporočilo prezrite — vaše geslo ostane nespremenjeno.",
  });
}

export const VELJAVNOST_POVABILA_MS = 7 * 24 * 60 * 60 * 1000;

export function povabiloZadeva(): string {
  return "Povabilo v urejevalnik — Pot ob žici";
}

export function povabiloHtml({
  req,
  token,
  user,
  povabil,
}: {
  req: PayloadRequest;
  token: string;
  user: unknown;
  povabil: string | null;
}): string {
  const vloga = (user as { vloga?: string } | undefined)?.vloga === "admin" ? "skrbnik" : "urednik";
  const pozdrav = ime(user) ? `Pozdravljeni, ${escapeHtml(ime(user)!)}!` : "Pozdravljeni!";
  return predloga({
    naslov: "Povabilo v urejevalnik",
    odstavki: [
      pozdrav,
      `${povabil ? escapeHtml(povabil) : "Skrbnik"} vas je povabil k urejanju spletne strani Pot ob žici kot <strong>${vloga}</strong>. ` +
        "Z računom lahko urejate besedila, fotografije in lokacije spominskih obeležij.",
      `Za prijavo si najprej nastavite svoje geslo. Uporabniško ime je vaš e-poštni naslov: <strong>${escapeHtml(
        (user as { email?: string } | undefined)?.email ?? "",
      )}</strong>.`,
    ],
    gumb: "Nastavi geslo in se prijavi",
    povezava: povezavaZaGeslo(req, token),
    opomba:
      "Povezava velja 7 dni. Če poteče, na prijavni strani izberite »Pozabljeno geslo«. Če povabila niste pričakovali, sporočilo prezrite.",
  });
}
