import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReaderCard from "../components/ReaderCard";
import { Link } from "react-router-dom";

const tabOptions = ["All", "Online"] as const;
type TabType = typeof tabOptions[number];

export default function Readings() {
  const [tab, setTab] = useState<TabType>("All");
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<string>("");

  // Fetch all readers
  const { data: allReaders, isLoading: loadingAll } = useQuery({
    queryKey: ["allReaders"],
    queryFn: async () => {
      const res = await fetch("/api/readers");
      return res.ok ? await res.json() : [];
    },
  });
  // Fetch online
  const { data: onlineReaders, isLoading: loadingOnline } = useQuery({
    queryKey: ["onlineReaders"],
    queryFn: async () => {
      const res = await fetch("/api/readers/online");
      return res.ok ? await res.json() : [];
    },
  });

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    (allReaders || []).forEach((r: any) =>
      (r.specialties || []).forEach((s: string) => set.add(s))
    );
    return Array.from(set);
  }, [allReaders]);

  // Filtered readers
  const filtered =
    (tab === "All" ? allReaders : onlineReaders)?.filter((r: any) => {
      let ok = true;
      if (specialty) ok = ok && (r.specialties || []).includes(specialty);
      if (search)
        ok =
          ok &&
          (r.fullName?.toLowerCase().includes(search.toLowerCase()) ||
            r.username?.toLowerCase().includes(search.toLowerCase()));
      return ok;
    }) || [];

  return (
    <div className="min-h-screen bg-celestial flex flex-col py-10 px-2 items-center">
      <h1 className="font-heading text-4xl text-pink mb-6">Readers</h1>
      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        {tabOptions.map((t) => (
          <button
            key={t}
            className={`px-6 py-2 rounded-full font-bold ${
              tab === t
                ? "bg-pink text-white shadow-glow"
                : "bg-black text-pink border border-pink"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Filters */}
      <div className="flex gap-4 mb-8 flex-wrap justify-center">
        <input
          type="text"
          placeholder="Search by name"
          className="px-4 py-2 rounded-full border border-gold bg-black text-white focus:outline-none font-body"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-4 py-2 rounded-full border border-gold bg-black text-white font-body"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        >
          <option value="">All Specialties</option>
          {allSpecialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {/* Reader grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mb-8">
        {(tab === "All" ? loadingAll : loadingOnline) ? (
          <div className="col-span-full text-gold text-lg">Loading readers...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-gold text-lg">
            {tab === "All"
              ? "No readers found."
              : "No readers are online at the moment."}
          </div>
        ) : (
          filtered.map((reader: any) => (
            <ReaderCard key={reader.id} reader={{ ...reader, online: !!(onlineReaders || []).find((r: any) => r.id === reader.id) }} />
          ))
        )}
      </div>
      <Link
        to="/dashboard"
        className="text-pink underline hover:text-gold transition font-bold"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}