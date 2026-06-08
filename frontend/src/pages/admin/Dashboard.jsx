import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { formatMoney, STAGE_LABELS, ORIGIN_LABELS } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import {
  Users, TrendingUp, KeyRound, CheckCircle2, X, Home, Calendar, Activity, Thermometer, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#071d34", "#c9a66b", "#7A9477", "#8B6D3F", "#4A5D4E", "#A88656", "#5C6E55", "#dbbf8a", "#0d2d4c"];

function Kpi({ icon: Icon, label, value, hint, testid, tone = "default" }) {
  const tones = {
    default: "bg-white",
    olive: "bg-[#071d34] text-[#f8fafc] border-[#071d34]",
    gold: "bg-[#c9a66b]/10 border-[#c9a66b]/40",
  };
  return (
    <div data-testid={testid} className={`border border-[#d1dde8] rounded-sm p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="lm-overline" style={tone === "olive" ? { color: "#c9a66b" } : {}}>{label}</div>
        <Icon className="w-4 h-4 opacity-70" strokeWidth={1.5} />
      </div>
      <div className={`font-serif text-3xl mt-2 ${tone === "olive" ? "text-[#f8fafc]" : "text-[#071d34]"}`}>{value}</div>
      {hint && <div className={`text-xs mt-1 ${tone === "olive" ? "text-[#a8b8cc]" : "text-[#5C5C5C]"}`}>{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("properties").select("status"),
    ]).then(([{ data: leads }, { data: propsList }]) => {
      const props = propsList || [];
      const total_imoveis = props.length;
      const imoveis_disponiveis = props.filter(p => p.status === "disponivel" || p.status === "reservado").length;
      const imoveis_vendidos = props.filter(p => p.status === "vendido").length;
      if (!leads) return;
      const count = (stage) => leads.filter((l) => l.stage === stage).length;
      const fechados = count("fechado");
      const total = leads.length;
      const now = new Date();
      const evolucao_mensal = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), leads: leads.filter((l) => (l.created_at || "").startsWith(key)).length };
      });
      const por_temperatura = Object.entries(
        leads.reduce((acc, l) => { const t = l.temperatura || "frio"; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
      ).map(([name, value]) => ({ name, value }));
      const por_origem = Object.entries(
        leads.reduce((acc, l) => { acc[l.origem || "outros"] = (acc[l.origem || "outros"] || 0) + 1; return acc; }, {})
      ).map(([name, value]) => ({ name, value }));
      const funil = Object.entries(
        leads.reduce((acc, l) => { acc[l.stage || "novo"] = (acc[l.stage || "novo"] || 0) + 1; return acc; }, {})
      ).map(([stage, total]) => ({ stage, total }));
      setS({
        total_leads: total,
        novos: count("novo"),
        visitas: count("visita_agendada"),
        fechados,
        em_atendimento: count("primeiro_contato") + count("qualificacao") + count("imoveis_enviados"),
        propostas: count("proposta"),
        negociacoes: count("negociacao"),
        conversao: total > 0 ? Math.round((fechados / total) * 100) : 0,
        valor_aberto: leads.filter((l) => !["fechado","perdido"].includes(l.stage)).reduce((a, l) => a + (l.orcamento || 0), 0),
        valor_fechado: leads.filter((l) => l.stage === "fechado").reduce((a, l) => a + (l.orcamento || 0), 0),
        perdidos: count("perdido"),
        total_imoveis: total_imoveis || 0,
        imoveis_disponiveis,
        imoveis_vendidos,
        por_origem, funil, evolucao_mensal, por_temperatura,
      });
    });
  }, []);

  if (!s) return <AdminLayout title="Dashboard"><div className="py-24 text-center text-[#5C5C5C]">Carregando…</div></AdminLayout>;

  const origemData = s.por_origem.map((x) => ({ ...x, name: ORIGIN_LABELS[x.name] || x.name }));
  const funilData = s.funil.map((x) => ({ ...x, name: STAGE_LABELS[x.stage] || x.stage }));

  return (
    <AdminLayout title="Dashboard" subtitle="Visão geral do seu negócio imobiliário">
      {/* KPIs primeira linha */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi testid="kpi-total" icon={Users} label="Total de leads" value={s.total_leads} tone="olive" />
        <Kpi testid="kpi-novos" icon={TrendingUp} label="Novos" value={s.novos} />
        <Kpi testid="kpi-visitas" icon={Calendar} label="Visitas agendadas" value={s.visitas} />
        <Kpi testid="kpi-fechados" icon={CheckCircle2} label="Negócios fechados" value={s.fechados} tone="gold" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <Kpi testid="kpi-atend" icon={Activity} label="Em atendimento" value={s.em_atendimento} />
        <Kpi testid="kpi-propostas" icon={KeyRound} label="Propostas" value={s.propostas} />
        <Kpi testid="kpi-negociacoes" icon={Home} label="Negociações" value={s.negociacoes} />
        <Kpi testid="kpi-conv" icon={TrendingUp} label="Taxa de conversão" value={`${s.conversao}%`} hint={`${s.fechados} de ${s.total_leads}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <Kpi testid="kpi-aberto" icon={DollarSign} label="Em oportunidades abertas" value={formatMoney(s.valor_aberto)} />
        <Kpi testid="kpi-fechado" icon={DollarSign} label="Em negócios fechados" value={formatMoney(s.valor_fechado)} tone="gold" />
        <Kpi testid="kpi-imoveis" icon={Home} label="Imóveis cadastrados" value={s.total_imoveis} />
        <Kpi testid="kpi-imoveis-disponiveis" icon={Home} label="Disponíveis no site" value={s.imoveis_disponiveis} />
        <Kpi testid="kpi-imoveis-vendidos" icon={Home} label="Vendidos" value={s.imoveis_vendidos} tone="gold" />
        <Kpi testid="kpi-perdidos" icon={X} label="Leads perdidos" value={s.perdidos} />
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-3 gap-5 mt-8">
        <div className="bg-white border border-[#d1dde8] rounded-sm p-5 lg:col-span-2">
          <div className="lm-overline mb-1">Evolução de leads</div>
          <div className="font-serif text-2xl text-[#071d34] mb-4">Últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={s.evolucao_mensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1dde8" />
              <XAxis dataKey="mes" stroke="#5C5C5C" fontSize={12} />
              <YAxis stroke="#5C5C5C" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="#071d34" strokeWidth={2.5} dot={{ fill: "#c9a66b", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#d1dde8] rounded-sm p-5">
          <div className="lm-overline mb-1">Temperatura dos leads</div>
          <div className="font-serif text-2xl text-[#071d34] mb-4 flex items-center gap-2"><Thermometer className="w-5 h-5" /> Quente · Morno · Frio</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={s.por_temperatura} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {s.por_temperatura.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#d1dde8] rounded-sm p-5 lg:col-span-2">
          <div className="lm-overline mb-1">Funil comercial</div>
          <div className="font-serif text-2xl text-[#071d34] mb-4">Leads por etapa</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funilData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1dde8" />
              <XAxis type="number" stroke="#5C5C5C" fontSize={12} />
              <YAxis dataKey="name" type="category" width={130} stroke="#5C5C5C" fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" fill="#071d34" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#d1dde8] rounded-sm p-5">
          <div className="lm-overline mb-1">Leads por origem</div>
          <div className="font-serif text-2xl text-[#071d34] mb-4">Canais que trazem resultado</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={origemData} dataKey="value" nameKey="name" outerRadius={95}>
                {origemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 text-xs mt-3">
            {origemData.map((o, i) => (
              <span key={i} className="flex items-center gap-1 text-[#5C5C5C]">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {o.name} · {o.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-8 bg-[#071d34] text-[#f8fafc] rounded-sm p-8">
        <div className="text-xs tracking-[0.25em] uppercase text-[#c9a66b] mb-3">Insights automáticos</div>
        <div className="font-serif text-3xl mb-5">Inteligência comercial</div>
        <ul className="grid md:grid-cols-2 gap-3">
          {insights.map((t, i) => (
            <li key={i} data-testid={`insight-${i}`} className="bg-[#0d2d4c]/60 border border-[#0d2d4c] rounded-sm px-5 py-4 text-sm leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
