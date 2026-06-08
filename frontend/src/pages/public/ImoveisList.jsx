import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PropertyCard from "../../components/PropertyCard";
import { formatMoney, TYPE_LABELS, PURPOSE_LABELS } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { Search, X, Map as MapIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const oliveIcon = L.divIcon({
  className: "lm-marker",
  html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:#071d34;border:3px solid #c9a66b;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center"><div style="color:#c9a66b;transform:rotate(45deg);font-family:serif;font-weight:700;font-size:14px">LM</div></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

const initial = {
  codigo: "", nome_condominio: "",
  cidade: "", bairro: "", tipo: "", finalidade: "",
  quartos_min: "", vagas_min: "", valor_min: "", valor_max: "",
  aceita_financiamento: false, aceita_consorcio: false, aceita_permuta: false,
  piscina: false, edicula: false, elevador: false, varanda: false, quintal: false,
  terreo: false, sobrado: false, quitado: false, churrasqueira: false, climatizado: false, planejados: false, sol_manha: false,
};

const PAGE_SIZE = 9;

export default function ImoveisList() {
  const location = useLocation();
  const [filters, setFilters] = useState(() => {
    const p = new URLSearchParams(location.search);
    return {
      ...initial,
      tipo: p.get("tipo") || "",
      finalidade: p.get("finalidade") || "",
      valor_max: p.get("valor_max") || "",
      codigo: p.get("codigo") || "",
      nome_condominio: p.get("nome_condominio") || "",
    };
  });
  const [props, setProps] = useState([]);
  const [coordsMap, setCoordsMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lm_geocache") || "{}"); } catch { return {}; }
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // City → neighborhoods map from Supabase
  const [citiesMap, setCitiesMap] = useState({});
  const [totalCount, setTotalCount] = useState(null);
  const [condominios, setCondominios] = useState([]);
  const [showCondSug, setShowCondSug] = useState(false);
  const [allBairros, setAllBairros] = useState([]);
  const [showBairroSug, setShowBairroSug] = useState(false);
  const [allCodigos, setAllCodigos] = useState([]);
  const [showCodigoSug, setShowCodigoSug] = useState(false);

  useEffect(() => {
    supabase.from("properties").select("codigo, cidade, bairro, nome_condominio").in("status", ["disponivel", "reservado"]).then(({ data }) => {
      setTotalCount(data ? data.length : 0);
      if (!data) return;
      const unique = [...new Set(data.map(p => p.nome_condominio).filter(Boolean))].sort();
      setCondominios(unique);
      const uniqueBairros = [...new Set(data.map(p => p.bairro).filter(Boolean))].sort();
      setAllBairros(uniqueBairros);
      const uniqueCodigos = [...new Set(data.map(p => p.codigo).filter(Boolean))].sort();
      setAllCodigos(uniqueCodigos);
      const map = {};
      data.forEach(({ cidade, bairro }) => {
        if (!cidade) return;
        if (!map[cidade]) map[cidade] = new Set();
        if (bairro) map[cidade].add(bairro);
      });
      const result = {};
      Object.entries(map).forEach(([c, s]) => { result[c] = [...s].sort(); });
      setCitiesMap(result);
    });
  }, []);

  const cities = Object.keys(citiesMap).sort();
  const neighborhoods = filters.cidade ? (citiesMap[filters.cidade] || []) : [];

  const load = async (f) => {
    setLoading(true);
    setPage(1);
    try {
      let q = supabase.from("properties").select("*").in("status", ["disponivel", "reservado"]);
      if (f.tipo) q = q.eq("tipo", f.tipo);
      if (f.finalidade) q = q.eq("finalidade", f.finalidade);
      if (f.cidade) q = q.ilike("cidade", `%${f.cidade}%`);
      if (f.bairro) q = q.ilike("bairro", `%${f.bairro}%`);
      if (f.codigo) q = q.eq("codigo", f.codigo);
      if (f.nome_condominio) q = q.ilike("nome_condominio", `%${f.nome_condominio}%`);
      if (f.valor_min) q = q.gte("valor", Number(f.valor_min));
      if (f.valor_max) q = q.lte("valor", Number(f.valor_max));
      if (f.quartos_min) q = q.gte("quartos", Number(f.quartos_min));
      if (f.vagas_min) q = q.gte("vagas", Number(f.vagas_min));
      if (f.aceita_financiamento) q = q.eq("aceita_financiamento", true);
      if (f.aceita_consorcio) q = q.eq("aceita_consorcio", true);
      if (f.aceita_permuta) q = q.eq("aceita_permuta", true);
      if (f.piscina) q = q.eq("piscina", true);
      if (f.edicula) q = q.eq("edicula", true);
      if (f.elevador) q = q.eq("elevador", true);
      if (f.varanda) q = q.eq("varanda", true);
      if (f.quintal) q = q.eq("quintal", true);
      if (f.terreo) q = q.eq("terreo", true);
      if (f.sobrado) q = q.eq("sobrado", true);
      if (f.quitado) q = q.eq("quitado", true);
      if (f.churrasqueira) q = q.eq("churrasqueira", true);
      if (f.climatizado) q = q.eq("climatizado", true);
      if (f.planejados) q = q.eq("planejados", true);
      if (f.sol_manha) q = q.eq("sol_manha", true);
      const { data } = await q.order("created_at", { ascending: false });
      setProps(data || []);
      // Geocode addresses for map pins (sequential with rate limit, cache in localStorage)
      (async () => {
        const cache = { ...coordsMap };
        let changed = false;
        for (const p of (data || [])) {
          const key = `${p.bairro || ""}|${p.cidade || ""}`.toLowerCase();
          if (key === "|" || cache[key]) continue;
          const tries = [
            `${p.bairro || ""}, ${p.cidade || ""}, SP, Brasil`,
            `${p.cidade || ""}, SP, Brasil`,
          ].filter(s => s.replace(/[\s,]/g, "").length > 5);
          for (const query of tries) {
            try {
              const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
              const j = await r.json();
              if (j[0]) {
                cache[key] = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
                changed = true;
                setCoordsMap({ ...cache });
                break;
              }
            } catch {}
            await new Promise(res => setTimeout(res, 1100));
          }
        }
        if (changed) { try { localStorage.setItem("lm_geocache", JSON.stringify(cache)); } catch {} }
      })();
    } finally { setLoading(false); }
  };

  useEffect(() => { load(filters); /* eslint-disable-next-line */ }, []);

  const reset = () => { setFilters(initial); load(initial); };
  const set = (k, v) => {
    const next = { ...filters, [k]: v };
    // Clear neighborhood when city changes
    if (k === "cidade") next.bairro = "";
    setFilters(next);
  };

  // Pagination
  const totalPages = Math.ceil(props.length / PAGE_SIZE);
  const paginated = props.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const center = useMemo(() => {
    const withCoords = props.filter((p) => p.lat && p.lng);
    if (!withCoords.length) return [-22.3148, -49.0620];
    const lat = withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length;
    const lng = withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length;
    return [lat, lng];
  }, [props]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
      <div className="mb-8">
        <div className="lm-overline mb-3">Buscar imóveis</div>
        <h1 className="font-serif text-4xl md:text-5xl text-[#071d34] leading-tight">Todos os imóveis disponíveis</h1>
        <p className="text-[#5C5C5C] mt-2">Use os filtros para refinar e visualize no mapa ao lado.</p>
      </div>

      {/* Filtros + Mapa */}
      <div className="grid lg:grid-cols-5 gap-5 mb-10">
        <div className="lg:col-span-2 bg-white border border-[#d1dde8] rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-[#071d34]" />
            <span className="font-serif text-lg text-[#071d34]">Filtros</span>
          </div>
          {/* Busca rápida por código ou condomínio */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#d1dde8]">
            <div className="relative">
              <label className="lm-label">Cód. do imóvel</label>
              <input
                className="lm-input"
                placeholder="Ex: 00001"
                value={filters.codigo}
                onChange={(e) => { set("codigo", e.target.value); setShowCodigoSug(true); }}
                onFocus={() => setShowCodigoSug(true)}
                onBlur={() => setTimeout(() => setShowCodigoSug(false), 200)}
                data-testid="filter-codigo"
              />
              {showCodigoSug && filters.codigo && allCodigos.filter(c => c.toLowerCase().includes(filters.codigo.toLowerCase())).length > 0 && (
                <ul className="absolute z-10 left-0 right-0 bg-white border border-[#d1dde8] rounded-sm max-h-48 overflow-y-auto mt-1 shadow">
                  {allCodigos.filter(c => c.toLowerCase().includes(filters.codigo.toLowerCase())).slice(0, 8).map(c => (
                    <li
                      key={c}
                      className="px-3 py-2 hover:bg-[#f8fafc] cursor-pointer text-sm"
                      onMouseDown={() => { set("codigo", c); setShowCodigoSug(false); }}
                    >{c}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="relative">
              <label className="lm-label">Nome do condomínio</label>
              <input
                className="lm-input"
                placeholder="Ex: Villaggio"
                value={filters.nome_condominio}
                onChange={(e) => { set("nome_condominio", e.target.value); setShowCondSug(true); }}
                onFocus={() => setShowCondSug(true)}
                onBlur={() => setTimeout(() => setShowCondSug(false), 150)}
                autoComplete="off"
                data-testid="filter-condominio"
              />
              {showCondSug && condominios.filter(n => n.toLowerCase().includes((filters.nome_condominio || "").toLowerCase())).length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-[#d1dde8] rounded-sm shadow-lg max-h-48 overflow-y-auto">
                  {condominios.filter(n => n.toLowerCase().includes((filters.nome_condominio || "").toLowerCase())).map(name => (
                    <button key={name} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8fafc] text-[#071d34]"
                      onMouseDown={() => { const next = { ...filters, nome_condominio: name }; setFilters(next); load(next); setShowCondSug(false); }}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Cidade — dropdown */}
            <div>
              <label className="lm-label">Cidade</label>
              <select data-testid="filter-cidade" className="lm-input" value={filters.cidade} onChange={(e) => set("cidade", e.target.value)}>
                <option value="">Todas</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Bairro — autocomplete */}
            <div className="relative">
              <label className="lm-label">Bairro</label>
              <input
                data-testid="filter-bairro"
                className="lm-input"
                value={filters.bairro}
                onChange={(e) => { set("bairro", e.target.value); setShowBairroSug(true); }}
                onFocus={() => setShowBairroSug(true)}
                onBlur={() => setTimeout(() => setShowBairroSug(false), 150)}
                placeholder="Bairro"
                autoComplete="off"
              />
              {showBairroSug && filters.bairro && allBairros.filter(b => b.toLowerCase().includes(filters.bairro.toLowerCase())).length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-[#d1dde8] rounded-sm shadow-lg max-h-48 overflow-y-auto">
                  {allBairros.filter(b => b.toLowerCase().includes(filters.bairro.toLowerCase())).map(name => (
                    <button key={name} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8fafc] text-[#071d34]"
                      onMouseDown={() => { const next = { ...filters, bairro: name }; setFilters(next); load(next); setShowBairroSug(false); }}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div><label className="lm-label">Tipo</label>
              <select data-testid="filter-tipo" className="lm-input" value={filters.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="lm-label">Finalidade</label>
              <select data-testid="filter-finalidade" className="lm-input" value={filters.finalidade} onChange={(e) => set("finalidade", e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="lm-label">Valor mín. (R$)</label><input type="number" data-testid="filter-valor-min" className="lm-input" value={filters.valor_min} onChange={(e) => set("valor_min", e.target.value)} /></div>
            <div><label className="lm-label">Valor máx. (R$)</label><input type="number" data-testid="filter-valor-max" className="lm-input" value={filters.valor_max} onChange={(e) => set("valor_max", e.target.value)} /></div>
            <div><label className="lm-label">Quartos mín.</label><input type="number" data-testid="filter-quartos" className="lm-input" value={filters.quartos_min} onChange={(e) => set("quartos_min", e.target.value)} /></div>
            <div><label className="lm-label">Vagas mín.</label><input type="number" data-testid="filter-vagas" className="lm-input" value={filters.vagas_min} onChange={(e) => set("vagas_min", e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 border-t border-[#d1dde8]">
            {[
              ["aceita_financiamento", "Financia"],
              ["aceita_consorcio", "Consórcio"],
              ["aceita_permuta", "Permuta"],
              ["piscina", "Piscina"],
              ["edicula", "Edícula"],
              ["elevador", "Elevador"],
              ["varanda", "Varanda"],
              ["quintal", "Quintal"],
              ["terreo", "Térreo"],
              ["sobrado", "Sobrado"],
              ["quitado", "Quitado"],
              ["churrasqueira", "Churrasqueira/Gourmet"],
              ["climatizado", "Climatizado"],
              ["planejados", "Planejados"],
              ["sol_manha", "Sol da manhã"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 text-xs text-[#2C2C2C] cursor-pointer">
                <input type="checkbox" data-testid={`filter-${k}`} checked={filters[k]} onChange={(e) => set(k, e.target.checked)} className="accent-[#071d34]" /> {l}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={reset} data-testid="filter-reset" className="text-sm px-4 py-2 border border-[#d1dde8] rounded-full text-[#5C5C5C] hover:bg-[#f8fafc] flex items-center gap-1 flex-1 justify-center"><X className="w-3.5 h-3.5" /> Limpar</button>
            <button onClick={() => load(filters)} data-testid="filter-search" className="lm-btn-primary flex-1 justify-center"><Search className="w-4 h-4" /> Buscar</button>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-sm overflow-hidden border border-[#d1dde8] bg-white" style={{ minHeight: 500 }}>
          <div className="px-5 py-3 border-b border-[#d1dde8] bg-white flex items-center gap-2">
            <MapIcon className="w-4 h-4 text-[#071d34]" />
            <span className="font-serif text-lg text-[#071d34]">Mapa de imóveis</span>
            <span className="text-xs text-[#5C5C5C] ml-auto">Localizações aproximadas — preserva a privacidade do imóvel</span>
          </div>
          <div style={{ height: 500 }} data-testid="properties-map">
            <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup
                chunkedLoading
                showCoverageOnHover={false}
                spiderfyOnMaxZoom
                maxClusterRadius={50}
                iconCreateFunction={(cluster) => {
                  const count = cluster.getChildCount();
                  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
                  return L.divIcon({
                    html: `<div style="width:${size}px;height:${size}px;background:#c9a66b;color:#fff;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${count < 100 ? 14 : 13}px;box-shadow:0 4px 10px rgba(0,0,0,.3);font-family:Outfit,sans-serif;">${count}</div>`,
                    className: "lm-cluster",
                    iconSize: [size, size],
                  });
                }}
              >
              {props.map((p) => {
                const key = `${p.bairro || ""}|${p.cidade || ""}`.toLowerCase();
                const c = (p.lat && p.lng) ? { lat: p.lat, lng: p.lng } : coordsMap[key];
                if (!c) return null;
                return (
                  <Marker key={p.id} position={[c.lat, c.lng]} icon={oliveIcon}>
                    <Popup>
                      <div style={{ minWidth: 200 }}>
                        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 18, color: "#071d34", lineHeight: 1.1 }}>{p.titulo}</div>
                        <div style={{ fontSize: 12, color: "#5C5C5C", marginTop: 4 }}>{p.bairro}, {p.cidade}</div>
                        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 20, color: "#071d34", marginTop: 6 }}>
                          {formatMoney(p.valor, p.finalidade)}
                        </div>
                        <a href={`/imoveis/${p.codigo}`} style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", background: "#071d34", color: "#f8fafc", borderRadius: 999, fontSize: 12, textDecoration: "none" }}>Ver imóvel</a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#5C5C5C] py-24">Carregando imóveis…</div>
      ) : props.length === 0 ? (
        <div className="text-center text-[#5C5C5C] py-24 font-serif text-2xl">
          {totalCount === 0 ? "Nenhum imóvel cadastrado ainda." : "Nenhum imóvel encontrado com esses filtros."}
        </div>
      ) : (
        <>
          <div className="text-sm text-[#5C5C5C] mb-5">{props.length} imóvel{props.length > 1 ? "is" : ""} encontrado{props.length > 1 ? "s" : ""}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((p) => <PropertyCard key={p.id} prop={p} />)}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-full border border-[#d1dde8] flex items-center justify-center text-[#071d34] hover:bg-[#f8fafc] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                    n === page
                      ? "bg-[#071d34] text-[#f8fafc] border-[#071d34]"
                      : "border-[#d1dde8] text-[#071d34] hover:bg-[#f8fafc]"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-full border border-[#d1dde8] flex items-center justify-center text-[#071d34] hover:bg-[#f8fafc] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
