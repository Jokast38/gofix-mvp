import { useQuery } from "@tanstack/react-query";
import { publicService } from "@/services/publicService";

const EMPTY = { flags: {}, settings: {} };

export function useConfig() {
  const { data } = useQuery({ queryKey: ["config"], queryFn: publicService.config, staleTime: 5 * 60_000 });
  const cfg = data || EMPTY;
  return { ...cfg, flag: (k) => Boolean(cfg.flags[k]) };
}

export function useWilayas() {
  return useQuery({ queryKey: ["wilayas"], queryFn: publicService.wilayas, staleTime: Infinity });
}

export function useFaq(lang) {
  return useQuery({ queryKey: ["faq", lang], queryFn: () => publicService.faq(lang) });
}
