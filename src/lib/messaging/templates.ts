// Pre-baked outbound message templates. These are written for both channels
// (WhatsApp + SMS) — WhatsApp gets a slightly more conversational tone, SMS
// stays compact for character budget.
//
// Real Meta Cloud API sends require pre-approved templates with placeholders.
// We render plaintext bodies here for the mock+SMS paths; for live WhatsApp,
// the templateKey is what gets approved upstream.

export type TemplateKey = "save_the_date" | "rsvp_reminder" | "thank_you_followup";

export interface TemplateVars {
  brideName: string;
  groomName: string;
  eventDateLine: string;
  eventCity: string;
  rsvpLink: string;
  giftLink: string;
  guestFirstName: string;
}

interface TemplateBodies {
  whatsapp: (v: TemplateVars) => string;
  sms: (v: TemplateVars) => string;
}

const TEMPLATES: Record<TemplateKey, TemplateBodies> = {
  save_the_date: {
    whatsapp: (v) =>
      `Hi ${v.guestFirstName}! 💌\n\n${v.brideName} & ${v.groomName} are getting married on ${v.eventDateLine} in ${v.eventCity}.\n\nSave the date and RSVP here whenever you're ready:\n${v.rsvpLink}\n\nWe can't wait to celebrate with you!`,
    sms: (v) =>
      `${v.brideName} & ${v.groomName} are getting married ${v.eventDateLine} in ${v.eventCity}. Save the date and RSVP: ${v.rsvpLink}`,
  },
  rsvp_reminder: {
    whatsapp: (v) =>
      `Hi ${v.guestFirstName} — quick nudge from ${v.brideName} & ${v.groomName} 🙏\n\nWe haven't seen your RSVP yet. Could you let us know by tapping the link below?\n${v.rsvpLink}\n\nIf you've already replied, please ignore this message. Thank you!`,
    sms: (v) =>
      `Reminder from ${v.brideName} & ${v.groomName}: please RSVP at ${v.rsvpLink}`,
  },
  thank_you_followup: {
    whatsapp: (v) =>
      `Hi ${v.guestFirstName}, just a warm follow-up from ${v.brideName} & ${v.groomName}. If you'd still like to bless us with a MoMo gift, the link is here: ${v.giftLink}. Either way, we're so glad you're part of this with us.`,
    sms: (v) =>
      `From ${v.brideName} & ${v.groomName}: if you'd like to send a MoMo gift, the link is ${v.giftLink}. Thank you for being part of our day.`,
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  save_the_date: "Save the date / invitation",
  rsvp_reminder: "RSVP reminder",
  thank_you_followup: "Gift follow-up",
};

export function renderTemplate(
  key: TemplateKey,
  channel: "whatsapp" | "sms",
  vars: TemplateVars,
): string {
  return TEMPLATES[key][channel](vars);
}
