"""
Gera VoiceAudit-Apresentacao-Vendas.pdf direto via ReportLab.
Cada slide = 1280x720 pt (16:9). Cores fiéis ao PPTX original.
"""
from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor, white, black
from PIL import Image
import io, math, os

OUT  = "/Users/dheiver/Documents/vivo-compliance-insights-1/VoiceAudit-Apresentacao-Vendas.pdf"
SS   = "/Users/dheiver/Documents/vivo-compliance-insights-1/screenshots"
W, H = 960, 540   # slide size in points

# ── Palette ──────────────────────────────────────────────────────────────
P      = HexColor("#660099")   # Vivo purple
PD     = HexColor("#4A006E")   # dark purple
PA     = HexColor("#9B30C8")   # accent
PL     = HexColor("#F8F5FF")   # light bg
PMID   = HexColor("#4B2070")
PGRAY  = HexColor("#64748B")
PCAP   = HexColor("#CC99EE")
PSUB   = HexColor("#DDB8F5")
PWHITE = white
PDARK  = HexColor("#1A0028")
PGREEN = HexColor("#16A34A")
PCARD  = HexColor("#E0CCEE")

# ── Font helpers ─────────────────────────────────────────────────────────
def font(c, name="Helvetica", size=14):
    c.setFont(name, size)

def bold(c, size=14):
    c.setFont("Helvetica-Bold", size)

# ── Drawing primitives ───────────────────────────────────────────────────
def rect(c, x, y, w, h, fill, stroke=None, sw=0):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(sw)
    else:
        c.setStrokeColor(fill)
        c.setLineWidth(0)
    c.rect(x, y, w, h, fill=1, stroke=1 if stroke else 0)

def oval(c, x, y, w, h, fill, alpha=1.0):
    c.saveState()
    c.setFillAlpha(alpha)
    c.setFillColor(fill)
    c.setStrokeColor(fill)
    c.setLineWidth(0)
    c.ellipse(x, y, x+w, y+h, fill=1, stroke=0)
    c.restoreState()

def text(c, x, y, txt, size=13, color=white, align="left", bold_f=False):
    c.setFillColor(color)
    fname = "Helvetica-Bold" if bold_f else "Helvetica"
    c.setFont(fname, size)
    if align == "center":
        c.drawCentredString(x, y, txt)
    elif align == "right":
        c.drawRightString(x, y, txt)
    else:
        c.drawString(x, y, txt)

def wrapped_text(c, x, y, txt, w, size=13, color=white, bold_f=False, line_h=None):
    """Draw text wrapped to width w. Returns final y (bottom)."""
    if line_h is None:
        line_h = size * 1.35
    fname = "Helvetica-Bold" if bold_f else "Helvetica"
    c.setFont(fname, size)
    c.setFillColor(color)
    words = txt.split()
    line, cur_y = "", y
    for word in words:
        test = (line + " " + word).strip()
        if c.stringWidth(test, fname, size) <= w:
            line = test
        else:
            if line:
                c.drawString(x, cur_y, line)
                cur_y -= line_h
            line = word
    if line:
        c.drawString(x, cur_y, line)
        cur_y -= line_h
    return cur_y

def image(c, path, x, y, w, h):
    try:
        img = Image.open(path).convert("RGB")
        ir  = ImageReader(img)
        c.drawImage(ir, x, y, w, h, preserveAspectRatio=True, anchor="nw")
    except Exception as e:
        print(f"  [warn] imagem {path}: {e}")

def pill(c, x, y, w, h, fill, label, lsize=11, lcolor=white):
    """Rounded button / badge."""
    r = h / 2
    c.setFillColor(fill)
    c.setStrokeColor(fill)
    c.roundRect(x, y, w, h, r, fill=1, stroke=0)
    c.setFillColor(lcolor)
    c.setFont("Helvetica-Bold", lsize)
    c.drawCentredString(x + w/2, y + h/2 - lsize/2.5, label)

def circle_num(c, cx, cy, r, fill, num, fsize=11):
    c.setFillColor(fill)
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", fsize)
    c.drawCentredString(cx, cy - fsize/3, str(num))

# ── Canvas helper ────────────────────────────────────────────────────────
def new_slide(pdf):
    if hasattr(pdf, '_pagesize'):
        pdf.showPage()
    pdf.setPageSize((W, H))

# ════════════════════════════════════════════════════════════════════════
# BUILD PDF
# ════════════════════════════════════════════════════════════════════════
pdf = canvas.Canvas(OUT, pagesize=(W, H))

# ── SLIDE 1: CAPA ────────────────────────────────────────────────────────
pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, PD)
oval(pdf, -80, H-180, 300, 300, PA, 0.22)
oval(pdf, W-200, -80, 280, 280, P, 0.35)
oval(pdf, W-120, H-120, 150, 150, white, 0.08)

text(pdf, 52, H-48, "VIVO  ×  AVANTTI CONSULTORIA", size=10, color=PCAP, bold_f=True)
text(pdf, 52, H-110, "VoiceAudit", size=64, color=white, bold_f=True)
text(pdf, 52, H-155, "Auditoria Inteligente de Ligações com IA", size=20, color=PSUB)

rect(pdf, 52, H-172, 240, 3, PCAP)

text(pdf, 52, H-193, "Audite 100% das chamadas em tempo real.", size=13, color=PSUB)
text(pdf, 52, H-211, "Compliance garantido, coaching automatizado.", size=13, color=PSUB)

text(pdf, 52, 22, "2026", size=10, color=HexColor("#AA66CC"))

# ── SLIDE 2: O PROBLEMA ──────────────────────────────────────────────────
pdf.showPage(); pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, white)
rect(pdf, 0, 0, 16, H, P)

text(pdf, 36, H-42, "O desafio de compliance nos call centers", size=26, color=PDARK, bold_f=True)

problems = [
    ("Cobertura mínima",       "Somente ~5% das ligações são auditadas manualmente"),
    ("Alto custo operacional",  "Equipes inteiras dedicadas à monitoria humana"),
    ("Inconsistência",          "Avaliações subjetivas entre auditores diferentes"),
    ("Risco regulatório",       "Multas por não conformidade (ANATEL / LGPD)"),
    ("Feedback tardio",         "Retorno ao agente chega dias ou semanas depois"),
]
cols = [32, 502]
for i, (title, desc) in enumerate(problems):
    col = cols[i % 2]
    row = i // 2
    cy  = H - 130 - row * 115
    rect(pdf, col, cy-70, 430, 88, PL)
    rect(pdf, col, cy-70, 7, 88, P)
    text(pdf, col+16, cy, title, size=12, color=P, bold_f=True)
    wrapped_text(pdf, col+16, cy-20, desc, 400, size=11, color=PMID)

# ── SLIDE 3: A SOLUÇÃO ───────────────────────────────────────────────────
pdf.showPage(); pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, PD)
oval(pdf, W-200, -60, 320, 320, PA, 0.2)

text(pdf, 48, H-36, "VoiceAudit", size=11, color=PCAP, bold_f=True)
text(pdf, 48, H-72, "100% das chamadas auditadas por IA", size=28, color=white, bold_f=True)

solutions = [
    "Transcrição automática de todas as ligações",
    "Agentes de IA avaliam critérios de compliance em tempo real",
    "Scorecards automáticos e objetivos por agente",
    "Coaching personalizado baseado em padrões detectados",
    "Dashboard de gestão com KPIs consolidados",
]
for i, sol in enumerate(solutions):
    cy = H - 130 - i * 62
    circle_num(pdf, 68, cy+8, 14, PA, i+1, fsize=10)
    text(pdf, 92, cy, sol, size=14, color=PSUB)

# ── SLIDES 4-9: TELAS ────────────────────────────────────────────────────
screens = [
    ("Dashboard de Operações",
     "Visão consolidada de KPIs — ligações auditadas, compliance médio, cobertura IA e componentes ativos",
     f"{SS}/03-dashboard.png"),
    ("Análise Detalhada de Ligações",
     "Lista de chamadas com score de compliance, transcrição, agente responsável e resultado da auditoria IA",
     f"{SS}/05-ligacoes.png"),
    ("Scorecards Automáticos por Agente",
     "Pontuação por critério, evolução histórica e identificação de gaps de qualidade",
     f"{SS}/08-scorecards.png"),
    ("Coaching Personalizado com IA",
     "Recomendações automáticas de melhoria por agente baseadas nos padrões detectados",
     f"{SS}/07-coaching.png"),
    ("Relatórios Gerenciais",
     "Exportação de relatórios de compliance, produtividade e qualidade para gestores e auditores",
     f"{SS}/09-relatorios.png"),
    ("Gestão de Equipes",
     "Visão por supervisor e agente, ranking de performance e alertas de compliance",
     f"{SS}/06-equipe.png"),
]
for title, caption, img_path in screens:
    pdf.showPage(); pdf.setPageSize((W, H))
    rect(pdf, 0, 0, W, H, HexColor("#0F0018"))
    # top bar
    rect(pdf, 0, H-52, W, 52, PD)
    text(pdf, 28, H-36, title, size=17, color=white, bold_f=True)
    text(pdf, W-16, H-36, "VoiceAudit", size=11, color=PCAP, align="right")
    # screenshot
    image(pdf, img_path, 20, 44, W-40, H-104)
    # bottom bar
    rect(pdf, 0, 0, W, 42, PD)
    wrapped_text(pdf, 28, 26, caption, W-56, size=10, color=PCAP)

# ── SLIDE 10: BENEFÍCIOS ─────────────────────────────────────────────────
pdf.showPage(); pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, white)
rect(pdf, 0, 0, 16, H, P)

text(pdf, 36, H-42, "Resultados que a Vivo já vê", size=26, color=PDARK, bold_f=True)

benefits = [
    ("100%",    "das ligações\nauditadas",  "vs. ~5% manual"),
    ("–70%",    "no tempo de\nauditoria",   "de dias → minutos"),
    ("<24h",    "feedback\nao agente",      "ciclo contínuo"),
    ("100%",    "rastreabilidade\nregulat.","ANATEL · LGPD"),
    ("3 meses", "para ROI\npositivo",       "retorno rápido"),
]
card_w = 162
for i, (stat, sub, note) in enumerate(benefits):
    cx = 36 + i * (card_w + 14)
    cy = 80
    ch = H - 145
    rect(pdf, cx, cy, card_w, ch, PL)
    rect(pdf, cx, cy+ch-4, card_w, 4, P)
    text(pdf, cx + card_w/2, cy+ch-52, stat, size=34, color=P, bold_f=True, align="center")
    # sub (2 lines)
    for j, line in enumerate(sub.split("\n")):
        text(pdf, cx + card_w/2, cy+ch-82 - j*17, line, size=11, color=PDARK, bold_f=True, align="center")
    text(pdf, cx + card_w/2, cy+22, note, size=10, color=PGRAY, align="center")

# ── SLIDE 11: TECNOLOGIA ─────────────────────────────────────────────────
pdf.showPage(); pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, PD)
oval(pdf, -80, 10, 300, 300, PA, 0.18)

text(pdf, 48, H-34, "TECNOLOGIA", size=10, color=PCAP, bold_f=True)
text(pdf, 48, H-68, "Arquitetura de IA de Ponta", size=28, color=white, bold_f=True)

techs = [
    ("LLMs de última geração",      "Claude (Anthropic) e GPT-4 para análise semântica profunda"),
    ("Transcrição com Whisper",      "Pipeline automático de conversão áudio → texto de alta precisão"),
    ("Agentes especializados",       "Cada critério de compliance avaliado por um agente dedicado"),
    ("API REST aberta",              "Integração nativa com sistemas legados e ERPs corporativos"),
    ("Dados no Brasil (LGPD)",       "Infraestrutura 100% hospedada em território nacional"),
]
cols2 = [48, 508]
for i, (title, desc) in enumerate(techs):
    col = cols2[0] if i < 3 else cols2[1]
    row = i if i < 3 else i - 3
    cy  = H - 130 - row * 108
    rect(pdf, col, cy-60, 420, 82, HexColor("#ffffff"), stroke=HexColor("#ffffff"), sw=0)
    # white semi-transparent via alpha
    pdf.saveState()
    pdf.setFillAlpha(0.1)
    pdf.setFillColor(white)
    pdf.rect(col, cy-60, 420, 82, fill=1, stroke=0)
    pdf.restoreState()
    rect(pdf, col, cy-60, 6, 82, PCAP)
    text(pdf, col+16, cy, title, size=12, color=HexColor("#EED5FF"), bold_f=True)
    wrapped_text(pdf, col+16, cy-22, desc, 390, size=10.5, color=PCAP)

# ── SLIDE 12: CTA ────────────────────────────────────────────────────────
pdf.showPage(); pdf.setPageSize((W, H))
rect(pdf, 0, 0, W, H, PD)
oval(pdf, W-280, H-240, 380, 380, PA, 0.22)
oval(pdf, -120, -80, 280, 280, P, 0.3)

text(pdf, 52, H-38, "PRÓXIMOS PASSOS", size=10, color=PCAP, bold_f=True)
text(pdf, 52, H-84, "Vamos escalar juntos?", size=36, color=white, bold_f=True)
text(pdf, 52, H-118, "Agende uma demonstração ao vivo", size=18, color=PSUB)

steps = [
    ("01", "Piloto em 30 dias com sua base real de ligações"),
    ("02", "Onboarding guiado pela equipe Avantti"),
    ("03", "SLA de suporte dedicado e relatórios semanais"),
]
for i, (num, step_txt) in enumerate(steps):
    sy = H - 168 - i * 64
    circle_num(pdf, 72, sy+8, 16, PA, num, fsize=11)
    text(pdf, 98, sy, step_txt, size=14, color=PSUB)

pill(pdf, 52, 58, 320, 40, PA, "contato@avantti.com.br", lsize=13)
text(pdf, 52, 30, "Avantti Consultoria × Vivo · 2026", size=10, color=HexColor("#AA66CC"))

# ── SAVE ─────────────────────────────────────────────────────────────────
pdf.save()
print(f"✅ PDF gerado: {OUT}")
