import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { formatMoney, waLink, addWatermark, TYPE_LABELS, PURPOSE_LABELS } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { Bed, Bath, Car, Ruler, MapPin, MessageCircle, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import PropertyCard from "../../components/PropertyCard";

const oliveIcon = L.divIcon({
  className: "lm-marker",
  html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#071d34;border:3px solid #c9a66b;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.25)"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function ImovelDetail({ settings = {} }) {
  const { id } = useParams();
  const [prop, setProp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(0);
  const [similar, setSimilar] = useState([]);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from("properties").select("*").eq("codigo", id).in("status", ["disponivel", "reservado"]).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setProp(data || null);
      setLoading(false);
      if (!data) return;
      const featured = data.featured_photo || 0;
      setPhoto(Math.min(featured, (data.fotos || []).length - 1));
      // Geocode address via Nominatim (with fallback chain)
      if (data.bairro || data.cidade) {
        (async () => {
          const tries = [
            `${data.bairro || ""}, ${data.cidade || ""}, SP, Brasil`,
            `${data.cidade || ""}, SP, Brasil`,
          ].filter(s => s.replace(/[\s,]/g, "").length > 5);
          for (const query of tries) {
            try {
              const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
              const j = await r.json();
              if (!cancelled && j[0]) {
                setCoords({ lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) });
                return;
              }
            } catch {}
            await new Promise(res => setTimeout(res, 1100));
          }
        })();
      }
      // Load similar
      supabase.from("properties").select("*")
        .eq("tipo", data.tipo).eq("finalidade", data.finalidade)
        .neq("id", data.id).in("status", ["disponivel", "reservado"])
        .limit(4).then(({ data: sim }) => !cancelled && setSimilar(sim || []));
    }).catch(() => { if (!cancelled) { setProp(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-24 text-center text-[#5C5C5C]">Carregando imóvel…</div>;
  if (!prop) return <div className="max-w-7xl mx-auto px-6 py-24 text-center text-[#5C5C5C] font-serif text-2xl">Imóvel não encontrado.</div>;

  const fotos = prop.fotos || [];
  const prev = () => setPhoto((photo - 1 + fotos.length) % fotos.length);
  const next = () => setPhoto((photo + 1) % fotos.length);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
      <Link to="/imoveis" className="inline-flex items-center gap-1 text-sm text-[#071d34] mb-6 hover:text-[#c9a66b]" data-testid="back-to-list">
        <ArrowLeft className="w-4 h-4" /> Voltar aos imóveis
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Carousel + details */}
        <div className="md:col-span-2 min-w-0">
          <div className="relative bg-white border border-[#d1dde8] overflow-hidden" data-testid="detail-carousel">
            <img src={addWatermark(fotos[photo])} alt={prop.titulo} className="w-full h-[480px] object-contain max-w-full" />
            {fotos.length > 1 && (
              <>
                <button onClick={prev} data-testid="carousel-prev" aria-label="Anterior" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#071d34] flex items-center justify-center shadow"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={next} data-testid="carousel-next" aria-label="Próximo" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#071d34] flex items-center justify-center shadow"><ChevronRight className="w-5 h-5" /></button>
                <div className="absolute bottom-3 right-3 bg-[#071d34]/80 text-[#f8fafc] text-xs px-3 py-1 rounded-full">{photo + 1} / {fotos.length}</div>
              </>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="overflow-x-auto w-full mt-3" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex gap-2 w-max">
                {fotos.map((f, i) => (
                  <button key={i} onClick={() => setPhoto(i)} className={`flex-shrink-0 w-24 h-20 rounded-sm overflow-hidden border-2 transition-all ${photo === i ? "border-[#c9a66b]" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <img src={addWatermark(f)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center gap-2 text-xs text-[#5C5C5C]"><MapPin className="w-3 h-3" /> {prop.bairro}, {prop.cidade}</div>
            <h1 className="font-serif text-4xl text-[#071d34] mt-2 leading-tight">{prop.titulo}</h1>
            <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
              <span className="lm-pill-filled lm-pill" style={{ borderColor: "#071d34" }}>{PURPOSE_LABELS[prop.finalidade]}</span>
              {prop.exclusivo && <span className="px-2 py-0.5 rounded-sm text-xs font-semibold bg-[#c9a66b] text-white tracking-wide">Exclusivo</span>}
              <span className="text-[#5C5C5C]">Cód. {prop.codigo}</span>
              <span className="text-[#5C5C5C]">{TYPE_LABELS[prop.tipo]}</span>
            </div>

            <div className="mt-6 text-3xl font-serif text-[#071d34]">{formatMoney(prop.valor, prop.finalidade)}</div>
            {prop.condominio > 0 && <div className="text-sm text-[#5C5C5C]">Condomínio: {formatMoney(prop.condominio)}/mês</div>}
            {prop.iptu > 0 && <div className="text-sm text-[#5C5C5C]">IPTU: {formatMoney(prop.iptu)}/ano</div>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-lg">
              {prop.terreno_m2 > 0 && <Spec icon={Ruler} label={`${prop.terreno_m2}m² terreno`} />}
              {prop.metragem > 0 && <Spec icon={Ruler} label={`${prop.metragem}m² construído`} />}
              {prop.quartos > 0 && <Spec icon={Bed} label={`${prop.quartos} quartos`} />}
              {prop.banheiros > 0 && <Spec icon={Bath} label={`${prop.banheiros} banh.`} />}
              {prop.vagas > 0 && <Spec icon={Car} label={`${prop.vagas} vagas`} />}
            </div>

            <div className="mt-8">
              <div className="lm-overline mb-2">Descrição</div>
              <p className="text-[#5C5C5C] leading-relaxed whitespace-pre-line">{prop.descricao}</p>
            </div>

            {getYoutubeId(prop.youtube_url) && (
              <div className="mt-8">
                <div className="lm-overline mb-3">Vídeo do imóvel</div>
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(prop.youtube_url)}`}
                    title="Vídeo do imóvel"
                    className="absolute inset-0 w-full h-full rounded-sm border border-[#d1dde8]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {prop.aceita_financiamento && <span className="lm-pill">Aceita financiamento</span>}
              {prop.aceita_consorcio && <span className="lm-pill">Aceita consórcio</span>}
              {prop.aceita_permuta && <span className="lm-pill">Aceita permuta</span>}
            </div>

            {/* Mapa */}
            {coords && (
              <div className="mt-10">
                <div className="lm-overline mb-3">Localização aproximada</div>
                <p className="text-xs text-[#5C5C5C] mb-3">Por privacidade do imóvel, exibimos apenas a região. O endereço completo é compartilhado após o primeiro contato.</p>
                <div className="rounded-sm overflow-hidden border border-[#d1dde8]" style={{ height: 320 }}>
                  <MapContainer center={[coords.lat, coords.lng]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <Marker position={[coords.lat, coords.lng]} icon={oliveIcon}>
                      <Popup>{prop.bairro}, {prop.cidade}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="md:col-span-1">
          <div className="sticky top-28 space-y-4">
            <div className="bg-white border border-[#d1dde8] p-6 rounded-sm">
              <div className="lm-overline mb-2">Quer visitar ou tirar dúvidas?</div>
              <div className="font-serif text-xl text-[#071d34] leading-tight mb-4">Chame Larissa no WhatsApp</div>
              <a href={waLink(settings.whatsapp, `Olá Larissa! Tenho interesse no imóvel ${prop.codigo} — ${prop.titulo}. https://larissamagesi.com.br/imoveis/${prop.codigo}`)}
                target="_blank" rel="noreferrer" data-testid="detail-wa-btn"
                className="lm-btn-primary w-full justify-center">
                <MessageCircle className="w-4 h-4" /> Falar agora
              </a>
              <div className="mt-4 pt-4 border-t border-[#d1dde8] text-sm text-[#5C5C5C]">
                <div>Ou ligue para:</div>
                <a href={`tel:${(settings.telefone || "").replace(/\D/g, "")}`} className="font-medium text-[#071d34] text-lg hover:text-[#c9a66b]">{settings.telefone}</a>
              </div>
              <div className="mt-4 pt-4 border-t border-[#d1dde8] text-xs text-[#5C5C5C]">
                <div>Larissa Magesi · {settings.creci}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* SIMILARES */}
      {similar.length > 0 && (
        <section className="mt-20 border-t border-[#d1dde8] pt-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="lm-overline mb-2">Você também pode gostar</div>
              <h2 className="font-serif text-3xl text-[#071d34]">Imóveis semelhantes</h2>
            </div>
            <Link to="/imoveis" className="text-sm text-[#071d34] hover:text-[#c9a66b]">Ver todos</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="similar-properties">
            {similar.map((p) => <PropertyCard key={p.id} prop={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function Spec({ icon: Icon, label }) {
  return (
    <div className="text-center bg-white border border-[#d1dde8] p-4 rounded-sm">
      <Icon className="w-5 h-5 mx-auto text-[#071d34]" />
      <div className="text-sm mt-1 font-medium">{label}</div>
    </div>
  );
}
