"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Region {
  value: string;
  label: string;
}

export default function OnboardingForm({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [region, setRegion] = useState<string>("greater_accra");
  const [city, setCity] = useState("Accra");
  const [guestCount, setGuestCount] = useState(150);
  const [styleBand, setStyleBand] = useState<"budget" | "mid" | "premium" | "luxury">("mid");
  const [components, setComponents] = useState<("traditional" | "white_wedding")[]>([
    "traditional",
    "white_wedding",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleComponent(c: "traditional" | "white_wedding") {
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (components.length === 0) {
      setError("Choose at least one ceremony type.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brideName,
          groomName,
          eventDate,
          region,
          city,
          guestCount,
          styleBand,
          components,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create event");
        return;
      }
      router.push(`/dashboard/${data.event.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bride">
              Bride
            </label>
            <input
              id="bride"
              className="input"
              required
              placeholder="Ama"
              value={brideName}
              onChange={(e) => setBrideName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="groom">
              Groom
            </label>
            <input
              id="groom"
              className="input"
              required
              placeholder="Kwame"
              value={groomName}
              onChange={(e) => setGroomName(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Event date
          </label>
          <input
            id="date"
            type="date"
            className="input"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="region">
              Region
            </label>
            <select
              id="region"
              className="input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input
              id="city"
              className="input"
              required
              placeholder="Accra"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="guests">
              Expected guests
            </label>
            <input
              id="guests"
              type="number"
              min={10}
              max={5000}
              className="input"
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(10, Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="label" htmlFor="style">
              Style
            </label>
            <select
              id="style"
              className="input"
              value={styleBand}
              onChange={(e) =>
                setStyleBand(e.target.value as "budget" | "mid" | "premium" | "luxury")
              }
            >
              <option value="budget">Budget</option>
              <option value="mid">Mid-range</option>
              <option value="premium">Premium</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="label">Ceremony</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "traditional", label: "Traditional engagement" },
            { value: "white_wedding", label: "White wedding" },
          ].map((c) => {
            const selected = components.includes(c.value as "traditional" | "white_wedding");
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleComponent(c.value as "traditional" | "white_wedding")}
                className={
                  selected
                    ? "rounded-full bg-kente-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full bg-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-200"
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary w-full text-base" disabled={loading}>
        {loading ? "Creating your event…" : "Create my event"}
      </button>
    </form>
  );
}
