export type Language = "en" | "bn" | "banglish";

export const labels: Record<
  Language,
  { flagged: string; uncertainty: string; next: string; unusual: string }
> = {
  en: {
    flagged: "Why this was flagged",
    uncertainty: "What remains uncertain",
    next: "Recommended next step",
    unusual: "Unusual activity detected — requires review",
  },
  bn: {
    flagged: "কেন সতর্কতা তৈরি হয়েছে",
    uncertainty: "যা এখনো অনিশ্চিত",
    next: "প্রস্তাবিত পরবর্তী পদক্ষেপ",
    unusual: "অস্বাভাবিক কার্যক্রম শনাক্ত হয়েছে — পর্যালোচনা প্রয়োজন",
  },
  banglish: {
    flagged: "Keno alert toiri hoyeche",
    uncertainty: "Ja ekhono uncertain",
    next: "Poroborti nirapod podokkhep",
    unusual: "Osabhabik activity dekha geche — review proyojon",
  },
};
