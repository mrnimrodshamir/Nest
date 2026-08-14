# NestUp release sharing audit

Audited 2026-08-14 against code release candidate `738f9cc`.

| Surface | Share entry point | Helper | WhatsApp path | Native fallback | Failure handling |
|---|---|---|---|---|---|
| Activity Details | Header share button | `openNativeShare` | Not shown on this surface | Primary path | Never rejects; double taps are suppressed; cancellation is normal |
| Activity success | WhatsApp and More options | `openWhatsAppShare` / `openNativeShare` | Message-only `whatsapp://send`; no recipient | Automatic when WhatsApp is absent or fails | Never rejects; one shared presentation lock |
| Place Details | Share and WhatsApp buttons | Same shared helpers | Message-only; no venue contact action | Automatic | Never rejects; malformed identifiers omit the deep link |
| Event Details | Share and WhatsApp buttons | Same shared helpers | Message-only; no organizer contact action | Automatic | Never rejects; malformed identifiers omit the deep link |
| Public Profile | No share entry point | Not applicable | Not applicable | Not applicable | Not applicable |
| Chats / Forums | No share entry point | Not applicable | Not applicable | Not applicable | Forum deep links remain parser-compatible for future use |

All share copy is short, NestUp-branded, multiline-safe, and contains at most
one canonical `nestup://` deep link. Legacy incoming `momzi://` links remain
accepted so links shared by older builds do not break; new links always use
`nestup://`.

The shared runtime covers WhatsApp installed/absent, receiver-sensitive native
methods, `canOpenURL`/`openURL`/native failures, explicit dismissal, double taps,
malformed Unicode, Hebrew/French/Russian text, emoji, multiline text, and
missing optional content fields. Product screens never call `Share.share` or a
WhatsApp URL directly.
