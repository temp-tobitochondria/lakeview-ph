// src/components/SearchBar.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { FiMenu, FiSearch, FiFilter } from "react-icons/fi";
import { MdLightbulbOutline } from "react-icons/md";
import api from "../lib/api";

function SearchBar({ onMenuClick, onFilterClick, onSearch, onClear, onTyping, mode = 'suggest' }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const [anchor, setAnchor] = useState({ left: 56, top: 56, width: 420 });
  const [suggestions, setSuggestions] = useState([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const abortRef = useRef(null);
  const suggCacheRef = useRef(new Map()); // key: q, value: { ts, rows }
  const defaultTopics = [
    { label: 'Lake names', subtitle: 'e.g., Taal Lake, Laguna de Bay' },
    { label: 'Analytical queries', subtitle: 'e.g., largest lake, deepest lake' },
    { label: 'Regions or provinces', subtitle: 'e.g., lakes in Laguna' },
    { label: 'Parameters', subtitle: 'e.g., high pH lakes, low DO lakes' },
    { label: 'Watersheds', subtitle: 'e.g., Angat watershed' },
    { label: 'Layers/categories', subtitle: 'e.g., protected areas, fish sanctuaries' }
  ];

  const triggerSearch = useCallback(() => {
    const q = (text || "").trim();
    if (!q) return;
    if (typeof onSearch === "function") onSearch(q);
  }, [text, onSearch]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min((suggestions?.length ?? 0) - 1, i + 1));
      setOpenSuggest(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(-1, i - 1));
      setOpenSuggest(true);
    } else if (e.key === "Escape") {
      setOpenSuggest(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (openSuggest && activeIndex >= 0 && activeIndex < (suggestions?.length ?? 0)) {
        const s = suggestions[activeIndex];
        if (s?.label) {
          // Fill input with suggestion label
          setText(s.label);
          setOpenSuggest(false);
          setActiveIndex(-1);
          if (typeof onSearch === "function") onSearch(s.label);
          return;
        }
      }
      triggerSearch();
    }
  };

  const clearText = () => {
    setText("");
    try { inputRef.current?.focus(); } catch (_) {}
    if (typeof onClear === "function") onClear();
    setSuggestions([]);
    setOpenSuggest(false);
    setActiveIndex(-1);
  };

  // Debounced suggest fetch & default topics
  useEffect(() => {
    const q = (text || "").trim();
  // Only drive suggestions when mode allows and panel is explicitly open
  if (mode !== 'suggest' || !openSuggest) { setSuggestions([]); setSuggestionsLoading(false); return; }
    // If no or short query, show default topics immediately
    if (q.length < 2) {
      setSuggestions(defaultTopics);
      setSuggestionsLoading(false);
      return;
    }
    // Panel is already open due to user interaction
    setSuggestionsLoading(true);
    // Cache check (short TTL)
    const cache = suggCacheRef.current;
    const cached = cache.get(q);
    const now = Date.now();
    if (cached && (now - cached.ts) < 20000) {
      setSuggestions(cached.rows || []);
      setSuggestionsLoading(false);
      setActiveIndex(-1);
      return;
    }
      const handle = setTimeout(async () => {
      try {
        if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
        const controller = new AbortController();
        abortRef.current = controller;
        const res = await api.get(`/search/suggest?q=${encodeURIComponent(q)}&limit=6`, { signal: controller.signal });
        const rows = res?.data ?? [];
        setSuggestions(Array.isArray(rows) ? rows : []);
        setActiveIndex(-1);
        setSuggestionsLoading(false);
        cache.set(q, { ts: Date.now(), rows: Array.isArray(rows) ? rows : [] });
      } catch (e) {
        // Don't close on aborts triggered by rapid typing
        if (e?.cause?.name === 'AbortError') {
          // keep panel open and keep loading state; the next request will settle it
          return;
        }
        // For real errors, stop loading and keep the panel open with no suggestions
        setSuggestions([]);
        setSuggestionsLoading(false);
            // keep panel state as-is
      }
    }, 100);
    return () => clearTimeout(handle);
  }, [text, mode, openSuggest]);

  // Open suggestions only when the user interacts (focus/click) with the input
  const handleFocus = () => {
    if (mode !== 'suggest') return;
    const q = (text || '').trim();
    setIsFocused(true);
    if (q.length < 2) {
      setSuggestions(defaultTopics);
      setSuggestionsLoading(false);
    }
    setOpenSuggest(true);
  };

  // Track and update popover anchor to align with the search bar
  useEffect(() => {
    const update = () => {
      try {
        const el = containerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1024;
        const maxWidth = Math.max(240, Math.min(r.width, vw - r.left - 12));
        setAnchor({ left: Math.round(r.left), top: Math.round(r.bottom), width: Math.round(maxWidth) });
      } catch {}
    };
    update();
    let ro;
    try {
      if (window.ResizeObserver) {
        ro = new ResizeObserver(() => update());
        if (containerRef.current) ro.observe(containerRef.current);
      }
    } catch {}
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      try { ro && ro.disconnect && ro.disconnect(); } catch {}
    };
  }, []);

  const handleClickSuggestion = (s) => {
    if (!s) return;
    const label = s.label || '';
    if (!label) return;
    setText(label);
    setOpenSuggest(false);
    setActiveIndex(-1);
    if (typeof onSearch === "function") onSearch(label);
  };

  return (
    <div className="search-bar" ref={containerRef}>
      {/* ✅ Hamburger opens sidebar */}
      <button className="btn-floating" onClick={onMenuClick}>
        <FiMenu size={18} />
      </button>

      <div className="search-input-wrap">
        <input
          type="text"
          placeholder="Search LakeView"
          value={text}
          onChange={(e) => { const v = e.target.value; setText(v); if (typeof onTyping === 'function') onTyping(v); }}
          onKeyDown={onKeyDown}
          ref={inputRef}
          onBlur={(e) => {
            // Delay to allow click selection in dropdown to register
            setTimeout(() => { setOpenSuggest(false); setActiveIndex(-1); setIsFocused(false); }, 120);
          }}
          onFocus={handleFocus}
              onClick={handleFocus}
        />
        {text?.length > 0 && (
          <button className="btn-clear" onClick={clearText} aria-label="Clear search" title="Clear">×</button>
        )}
      </div>

      <button className="btn-floating" onClick={triggerSearch}>
        <FiSearch size={18} />
      </button>

      <button className="btn-floating" onClick={onFilterClick} title="Filter lakes">
        <FiFilter size={18} />
      </button>

      {mode === 'suggest' && openSuggest && (
        <div
          className="modern-scrollbar"
          style={{
            position: 'fixed', top: (anchor?.top ?? 56) + 8, left: anchor?.left ?? 56, zIndex: 1300,
            background: '#fff', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', borderRadius: 10,
            width: anchor?.width ?? 420,
            maxHeight: Math.min(420, (typeof window !== 'undefined' ? (window.innerHeight - ((anchor?.top ?? 56) + 8) - 24) : 420)),
            overflowY: 'auto', color: '#111',
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdLightbulbOutline size={16} style={{ color: '#f59e0b' }} />
            <strong>Search Tips</strong>
          </div>
          {suggestionsLoading && (
            <div style={{ padding: 12, fontSize: 13 }}>Looking up…</div>
          )}
          {!suggestionsLoading && suggestions?.length === 0 && (
            <div style={{ padding: 12, fontSize: 13 }}>No suggestions.</div>
          )}
          {!suggestionsLoading && suggestions.map((s, idx) => {
            const isTopic = !s.entity; // default guidance rows
            const clickable = !isTopic;
            return (
              <div
                key={`${s.entity ?? 'topic'}-${s.id ?? idx}`}
                onMouseDown={(e) => clickable ? e.preventDefault() : null}
                onClick={() => clickable && handleClickSuggestion(s)}
                style={{
                  padding: '8px 10px',
                  cursor: clickable ? 'pointer' : 'default',
                  background: idx === activeIndex && clickable ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                </div>
                {s.subtitle && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{s.subtitle}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchBar;