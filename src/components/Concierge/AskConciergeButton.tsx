"use client";

export default function AskConciergeButton({
  eventId,
  prompt,
  autoSend = true,
  className,
  children,
}: {
  eventId: string;
  prompt: string;
  autoSend?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("concierge:prompt", {
            detail: { eventId, prompt, autoSend },
          }),
        );
      }}
      className={className}
    >
      {children}
    </button>
  );
}
