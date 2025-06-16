import { useMemo, useState, useCallback } from "react";
import { Livestream } from "@shared/schema";

export interface LivestreamFilters {
  searchTerm: string;
  selectedCategory: string;
}

export function useLivestreamFilters(livestreams?: Livestream[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredLivestreams = useMemo(() => {
    if (!livestreams) return [];

    return livestreams.filter(stream => {
      const matchesSearch = 
        searchTerm === "" || 
        stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stream.description.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesCategory = 
        selectedCategory === "all" || 
        stream.category === selectedCategory;
        
      return matchesSearch && matchesCategory;
    });
  }, [livestreams, searchTerm, selectedCategory]);

  const categorizedStreams = useMemo(() => {
    const active = filteredLivestreams.filter((stream: Livestream) => stream.status === "live");
    const upcoming = filteredLivestreams.filter((stream: Livestream) => stream.status === "scheduled");
    const completed = filteredLivestreams.filter((stream: Livestream) => stream.status === "ended");

    return { active, upcoming, completed };
  }, [filteredLivestreams]);

  const updateSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const updateCategory = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  return {
    searchTerm,
    selectedCategory,
    updateSearchTerm,
    updateCategory,
    categorizedStreams,
    totalFiltered: filteredLivestreams.length
  };
}