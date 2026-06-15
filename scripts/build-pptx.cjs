const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "VoiceAudit - Apresentação de Vendas";
pres.author = "Avantti Consultoria";

// Colors
const VIVO_PURPLE = "660099";
const VIVO_PURPLE_DARK = "4A006E";
const WHITE = "FFFFFF";
const LIGHT_BG = "F8F5FF";
const ACCENT = "9B30C8";
const TEXT_DARK = "1A0028";
const TEXT_MID = "4B2070";
const GRAY = "64748B";
const GREEN = "16A34A";

// ────────────────────────────────────────────
// SLIDE 1 — CAPA
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: VIVO_PURPLE_DARK };

  // Decorative circles
  s.addShape(pres.shapes.OVAL, {
    x: -1.2,
    y: -1.0,
    w: 4,
    h: 4,
    fill: { color: ACCENT, transparency: 75 },
    line: { color: ACCENT, transparency: 75 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.8,
    y: 2.8,
    w: 3.5,
    h: 3.5,
    fill: { color: VIVO_PURPLE, transparency: 60 },
    line: { color: VIVO_PURPLE, transparency: 60 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 8.5,
    y: -0.5,
    w: 2,
    h: 2,
    fill: { color: WHITE, transparency: 90 },
    line: { color: WHITE, transparency: 90 },
  });

  // Tag line top
  s.addText("VIVO × AVANTTI CONSULTORIA", {
    x: 0.7,
    y: 0.55,
    w: 8.6,
    h: 0.35,
    fontSize: 10,
    fontFace: "Calibri",
    bold: true,
    color: "CC99EE",
    charSpacing: 4,
    align: "left",
    margin: 0,
  });

  // Main title
  s.addText("VoiceAudit", {
    x: 0.7,
    y: 1.1,
    w: 8.6,
    h: 1.5,
    fontSize: 72,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "left",
    margin: 0,
  });

  // Subtitle
  s.addText("Auditoria Inteligente de Ligações com IA", {
    x: 0.7,
    y: 2.7,
    w: 8.6,
    h: 0.7,
    fontSize: 22,
    fontFace: "Calibri",
    color: "DDB8F5",
    align: "left",
    margin: 0,
  });

  // Horizontal separator
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7,
    y: 3.55,
    w: 3.2,
    h: 0.05,
    fill: { color: "CC99EE" },
    line: { color: "CC99EE" },
  });

  // Description
  s.addText(
    "Audite 100% das chamadas em tempo real.\nCompliance garantido, coaching automatizado.",
    {
      x: 0.7,
      y: 3.75,
      w: 7.5,
      h: 0.8,
      fontSize: 14,
      fontFace: "Calibri",
      color: "DDB8F5",
      align: "left",
      margin: 0,
    },
  );

  // Bottom year tag
  s.addText("2026", {
    x: 0.7,
    y: 5.1,
    w: 2,
    h: 0.35,
    fontSize: 11,
    fontFace: "Calibri",
    color: "AA66CC",
    align: "left",
    margin: 0,
  });
}

// ────────────────────────────────────────────
// SLIDE 2 — O PROBLEMA
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  // Left purple bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 0.22,
    h: 5.625,
    fill: { color: VIVO_PURPLE },
    line: { color: VIVO_PURPLE },
  });

  // Title
  s.addText("O desafio de compliance\nnos call centers", {
    x: 0.5,
    y: 0.35,
    w: 8.8,
    h: 1.1,
    fontSize: 30,
    fontFace: "Calibri",
    bold: true,
    color: TEXT_DARK,
    align: "left",
    margin: 0,
  });

  // Problems grid
  const problems = [
    {
      icon: "⚠",
      title: "Cobertura mínima",
      desc: "Somente ~5% das ligações são auditadas manualmente",
    },
    {
      icon: "$",
      title: "Alto custo operacional",
      desc: "Equipes inteiras dedicadas à monitoria humana",
    },
    {
      icon: "~",
      title: "Inconsistência",
      desc: "Avaliações subjetivas entre auditores diferentes",
    },
    { icon: "!", title: "Risco regulatório", desc: "Multas por não conformidade (ANATEL / LGPD)" },
    { icon: "⏱", title: "Feedback tardio", desc: "Retorno ao agente chega dias ou semanas depois" },
  ];

  const cols = [0.5, 5.2];
  problems.forEach((p, i) => {
    const col = cols[i % 2 === 0 ? 0 : 1];
    const row = Math.floor(i / 2);
    const y = 1.6 + row * 1.15;

    s.addShape(pres.shapes.RECTANGLE, {
      x: col,
      y,
      w: 4.4,
      h: 0.95,
      fill: { color: LIGHT_BG },
      line: { color: "E5D6F5" },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: col,
      y,
      w: 0.08,
      h: 0.95,
      fill: { color: VIVO_PURPLE },
      line: { color: VIVO_PURPLE },
    });
    s.addText(p.title, {
      x: col + 0.18,
      y: y + 0.07,
      w: 4.1,
      h: 0.3,
      fontSize: 12,
      fontFace: "Calibri",
      bold: true,
      color: VIVO_PURPLE,
      align: "left",
      margin: 0,
    });
    s.addText(p.desc, {
      x: col + 0.18,
      y: y + 0.37,
      w: 4.1,
      h: 0.45,
      fontSize: 11,
      fontFace: "Calibri",
      color: TEXT_MID,
      align: "left",
      margin: 0,
    });
  });

  // If odd, last card spans half row (already handled by modulo)
  if (problems.length % 2 !== 0) {
    // last card is already at correct position
  }
}

// ────────────────────────────────────────────
// SLIDE 3 — A SOLUÇÃO
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: VIVO_PURPLE_DARK };

  s.addShape(pres.shapes.OVAL, {
    x: 7.5,
    y: 3.5,
    w: 3.5,
    h: 3.5,
    fill: { color: ACCENT, transparency: 80 },
    line: { color: ACCENT, transparency: 80 },
  });

  s.addText("VoiceAudit", {
    x: 0.6,
    y: 0.3,
    w: 8.5,
    h: 0.5,
    fontSize: 13,
    fontFace: "Calibri",
    bold: true,
    color: "CC99EE",
    charSpacing: 3,
    align: "left",
    margin: 0,
  });
  s.addText("100% das chamadas auditadas por IA", {
    x: 0.6,
    y: 0.85,
    w: 8.5,
    h: 0.8,
    fontSize: 32,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "left",
    margin: 0,
  });

  const solutions = [
    "Transcrição automática de todas as ligações",
    "Agentes de IA avaliam critérios de compliance em tempo real",
    "Scorecards automáticos e objetivos por agente",
    "Coaching personalizado baseado em padrões detectados",
    "Dashboard de gestão com KPIs consolidados",
  ];

  solutions.forEach((text, i) => {
    const y = 1.9 + i * 0.65;
    s.addShape(pres.shapes.OVAL, {
      x: 0.6,
      y: y + 0.08,
      w: 0.28,
      h: 0.28,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    s.addText(String(i + 1), {
      x: 0.6,
      y: y + 0.08,
      w: 0.28,
      h: 0.28,
      fontSize: 10,
      fontFace: "Calibri",
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    s.addText(text, {
      x: 1.05,
      y,
      w: 8.3,
      h: 0.5,
      fontSize: 14,
      fontFace: "Calibri",
      color: "DDB8F5",
      align: "left",
      valign: "middle",
      margin: 0,
    });
  });
}

// ────────────────────────────────────────────
// Helper: screen slide
// ────────────────────────────────────────────
function addScreenSlide(title, desc, imagePath) {
  const s = pres.addSlide();
  s.background = { color: "0F0018" };

  // Top bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.72,
    fill: { color: VIVO_PURPLE_DARK },
    line: { color: VIVO_PURPLE_DARK },
  });
  s.addText(title, {
    x: 0.4,
    y: 0.12,
    w: 7,
    h: 0.48,
    fontSize: 18,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "left",
    margin: 0,
  });
  s.addText("VoiceAudit", {
    x: 7.6,
    y: 0.12,
    w: 2,
    h: 0.48,
    fontSize: 12,
    fontFace: "Calibri",
    color: "CC99EE",
    align: "right",
    margin: 0,
  });

  // Screenshot
  s.addImage({
    path: imagePath,
    x: 0.35,
    y: 0.82,
    w: 9.3,
    h: 4.15,
    sizing: { type: "contain", w: 9.3, h: 4.15 },
  });

  // Bottom caption
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 5.12,
    w: 10,
    h: 0.5,
    fill: { color: VIVO_PURPLE_DARK },
    line: { color: VIVO_PURPLE_DARK },
  });
  s.addText(desc, {
    x: 0.4,
    y: 5.16,
    w: 9.2,
    h: 0.38,
    fontSize: 11,
    fontFace: "Calibri",
    color: "CC99EE",
    align: "left",
    margin: 0,
  });
}

// ────────────────────────────────────────────
// SLIDES 4–9 — TELAS
// ────────────────────────────────────────────
const BASE = "/Users/dheiver/Documents/vivo-compliance-insights-1/screenshots";

addScreenSlide(
  "Dashboard de Operações",
  "Visão consolidada de KPIs — total de ligações auditadas, compliance médio, cobertura da IA e componentes ativos",
  `${BASE}/03-dashboard.png`,
);
addScreenSlide(
  "Análise Detalhada de Ligações",
  "Lista completa de chamadas com score de compliance, transcrição, agente responsável e resultado da auditoria de IA",
  `${BASE}/05-ligacoes.png`,
);
addScreenSlide(
  "Scorecards Automáticos por Agente",
  "Pontuação individualizada por critério, evolução histórica e identificação de gaps de qualidade",
  `${BASE}/08-scorecards.png`,
);
addScreenSlide(
  "Coaching Personalizado com IA",
  "Recomendações automáticas de melhoria por agente baseadas nos padrões detectados pela IA",
  `${BASE}/07-coaching.png`,
);
addScreenSlide(
  "Relatórios Gerenciais",
  "Exportação de relatórios de compliance, produtividade e qualidade para gestores e auditores",
  `${BASE}/09-relatorios.png`,
);
addScreenSlide(
  "Gestão de Equipes",
  "Visão por supervisor e agente, ranking de performance e alertas de compliance",
  `${BASE}/06-equipe.png`,
);

// ────────────────────────────────────────────
// SLIDE 10 — BENEFÍCIOS
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 0.22,
    h: 5.625,
    fill: { color: VIVO_PURPLE },
    line: { color: VIVO_PURPLE },
  });

  s.addText("Resultados que a Vivo já vê", {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.7,
    fontSize: 30,
    fontFace: "Calibri",
    bold: true,
    color: TEXT_DARK,
    align: "left",
    margin: 0,
  });

  const benefits = [
    { label: "100%", sub: "das ligações auditadas", note: "vs. ~5% com monitoria manual" },
    { label: "–70%", sub: "no tempo de auditoria", note: "de dias para minutos" },
    { label: "<24h", sub: "feedback ao agente", note: "ciclo de melhoria contínua" },
    { label: "100%", sub: "rastreabilidade", note: "ANATEL · LGPD · conformidade" },
    { label: "3 meses", sub: "para ROI positivo", note: "retorno mensurável e rápido" },
  ];

  const xs = [0.4, 2.45, 4.5, 6.55, 8.6];
  const cardW = 1.75,
    cardH = 3.3;

  benefits.forEach((b, i) => {
    const x = xs[i];
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.2,
      w: cardW,
      h: cardH,
      fill: { color: LIGHT_BG },
      line: { color: "E0CCEE" },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.2,
      w: cardW,
      h: 0.08,
      fill: { color: VIVO_PURPLE },
      line: { color: VIVO_PURPLE },
    });
    // Big stat
    s.addText(b.label, {
      x: x + 0.05,
      y: 1.35,
      w: cardW - 0.1,
      h: 0.9,
      fontSize: 32,
      fontFace: "Calibri",
      bold: true,
      color: VIVO_PURPLE,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    s.addText(b.sub, {
      x: x + 0.05,
      y: 2.35,
      w: cardW - 0.1,
      h: 0.5,
      fontSize: 12,
      fontFace: "Calibri",
      bold: true,
      color: TEXT_DARK,
      align: "center",
      margin: 0,
    });
    s.addText(b.note, {
      x: x + 0.05,
      y: 2.9,
      w: cardW - 0.1,
      h: 0.45,
      fontSize: 10,
      fontFace: "Calibri",
      color: GRAY,
      align: "center",
      margin: 0,
    });
  });
}

// ────────────────────────────────────────────
// SLIDE 11 — TECNOLOGIA
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: VIVO_PURPLE_DARK };

  s.addShape(pres.shapes.OVAL, {
    x: -1,
    y: 3,
    w: 4,
    h: 4,
    fill: { color: ACCENT, transparency: 82 },
    line: { color: ACCENT, transparency: 82 },
  });

  s.addText("TECNOLOGIA", {
    x: 0.6,
    y: 0.3,
    w: 8.5,
    h: 0.4,
    fontSize: 11,
    fontFace: "Calibri",
    bold: true,
    color: "CC99EE",
    charSpacing: 4,
    align: "left",
    margin: 0,
  });
  s.addText("Arquitetura de IA de Ponta", {
    x: 0.6,
    y: 0.75,
    w: 8.5,
    h: 0.75,
    fontSize: 32,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "left",
    margin: 0,
  });

  const techs = [
    {
      title: "LLMs de última geração",
      desc: "Claude (Anthropic) e GPT-4 para análise semântica profunda",
    },
    {
      title: "Transcrição com Whisper",
      desc: "Pipeline automático de conversão áudio → texto de alta precisão",
    },
    {
      title: "Agentes especializados",
      desc: "Cada critério de compliance avaliado por um agente dedicado",
    },
    {
      title: "API REST aberta",
      desc: "Integração nativa com sistemas legados e ERPs corporativos",
    },
    {
      title: "Dados no Brasil (LGPD)",
      desc: "Infraestrutura 100% hospedada em território nacional",
    },
  ];

  techs.forEach((t, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const x = col === 0 ? 0.6 : 5.4;
    const y = 1.75 + row * 1.1;
    const w = 4.4;

    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w,
      h: 0.9,
      fill: { color: "ffffff", transparency: 90 },
      line: { color: "ffffff", transparency: 80 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: 0.07,
      h: 0.9,
      fill: { color: "CC99EE" },
      line: { color: "CC99EE" },
    });
    s.addText(t.title, {
      x: x + 0.18,
      y: y + 0.07,
      w: w - 0.22,
      h: 0.3,
      fontSize: 12,
      fontFace: "Calibri",
      bold: true,
      color: "EED5FF",
      align: "left",
      margin: 0,
    });
    s.addText(t.desc, {
      x: x + 0.18,
      y: y + 0.38,
      w: w - 0.22,
      h: 0.4,
      fontSize: 10.5,
      fontFace: "Calibri",
      color: "CC99EE",
      align: "left",
      margin: 0,
    });
  });
}

// ────────────────────────────────────────────
// SLIDE 12 — CTA
// ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: VIVO_PURPLE_DARK };

  s.addShape(pres.shapes.OVAL, {
    x: 6.5,
    y: -0.5,
    w: 4.5,
    h: 4.5,
    fill: { color: ACCENT, transparency: 75 },
    line: { color: ACCENT, transparency: 75 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: -1.5,
    y: 3.5,
    w: 3.5,
    h: 3.5,
    fill: { color: VIVO_PURPLE, transparency: 60 },
    line: { color: VIVO_PURPLE, transparency: 60 },
  });

  s.addText("PRÓXIMOS PASSOS", {
    x: 0.7,
    y: 0.4,
    w: 8.5,
    h: 0.4,
    fontSize: 11,
    fontFace: "Calibri",
    bold: true,
    color: "CC99EE",
    charSpacing: 4,
    align: "left",
    margin: 0,
  });

  s.addText("Vamos escalar juntos?", {
    x: 0.7,
    y: 0.9,
    w: 8.5,
    h: 0.85,
    fontSize: 38,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "left",
    margin: 0,
  });
  s.addText("Agende uma demonstração ao vivo", {
    x: 0.7,
    y: 1.8,
    w: 8.5,
    h: 0.5,
    fontSize: 18,
    fontFace: "Calibri",
    color: "DDB8F5",
    align: "left",
    margin: 0,
  });

  const steps = [
    { num: "01", text: "Piloto em 30 dias com sua base real de ligações" },
    { num: "02", text: "Onboarding guiado pela equipe Avantti" },
    { num: "03", text: "SLA de suporte dedicado e relatórios semanais" },
  ];

  steps.forEach((st, i) => {
    const y = 2.55 + i * 0.72;
    s.addShape(pres.shapes.OVAL, {
      x: 0.7,
      y,
      w: 0.42,
      h: 0.42,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    s.addText(st.num, {
      x: 0.7,
      y,
      w: 0.42,
      h: 0.42,
      fontSize: 11,
      fontFace: "Calibri",
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    s.addText(st.text, {
      x: 1.25,
      y: y + 0.03,
      w: 8,
      h: 0.4,
      fontSize: 14,
      fontFace: "Calibri",
      color: "DDB8F5",
      align: "left",
      margin: 0,
    });
  });

  // Contact
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7,
    y: 4.75,
    w: 4.5,
    h: 0.52,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
  s.addText("contato@avantti.com.br", {
    x: 0.7,
    y: 4.75,
    w: 4.5,
    h: 0.52,
    fontSize: 14,
    fontFace: "Calibri",
    bold: true,
    color: WHITE,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  s.addText("Avantti Consultoria × Vivo · 2026", {
    x: 0.7,
    y: 5.22,
    w: 8.5,
    h: 0.3,
    fontSize: 10,
    fontFace: "Calibri",
    color: "AA66CC",
    align: "left",
    margin: 0,
  });
}

// ────────────────────────────────────────────
// WRITE
// ────────────────────────────────────────────
pres
  .writeFile({
    fileName:
      "/Users/dheiver/Documents/vivo-compliance-insights-1/VoiceAudit-Apresentacao-Vendas.pptx",
  })
  .then(() => console.log("✅ Apresentação gerada com sucesso!"))
  .catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
