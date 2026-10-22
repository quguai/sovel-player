import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogQuery } from "../core/catalog";
import type { Track } from "../core/types";
import { useMusic } from "./store";
export function useCatalogPage(query: CatalogQuery) {
  const { catalogPage, catalogRevision } = useMusic();
  const key = JSON.stringify(query);
  const generation = useRef(0);
  const busy = useRef(false);
  const [state, setState] = useState<{
    items: Track[];
    total: number;
    loading: boolean;
    error: string;
  }>({ items: [], total: 0, loading: true, error: "" });
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const version = ++generation.current;
    busy.current = true;
    setState({ items: [], total: 0, loading: true, error: "" });
    void catalogPage(JSON.parse(key))
      .then((page) => {
        if (generation.current === version)
          setState({ ...page, loading: false, error: "" });
      })
      .catch((e) => {
        if (generation.current === version)
          setState({ items: [], total: 0, loading: false, error: String(e) });
      })
      .finally(() => {
        if (generation.current === version) busy.current = false;
      });
    return () => {
      generation.current = version + 1;
    };
  }, [key, catalogRevision, catalogPage]);
  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (busy.current || current.items.length >= current.total) return;
    busy.current = true;
    const version = generation.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const page = await catalogPage({
        ...JSON.parse(key),
        offset: current.items.length,
      });
      if (version === generation.current)
        setState({
          items: [...current.items, ...page.items],
          total: page.total,
          loading: false,
          error: "",
        });
    } catch (error) {
      if (version === generation.current)
        setState((s) => ({ ...s, loading: false, error: String(error) }));
    } finally {
      if (version === generation.current) busy.current = false;
    }
  }, [catalogPage, key]);
  return { ...state, loadMore };
}
