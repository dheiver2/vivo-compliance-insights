"""
VoiceAudit — Apresentação de Vendas
Identidade visual: Avantti Consultoria × Vivo
Cores: #4C5A61 (slate), #FFE450 (amarelo), #660099 (Vivo purple)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import io, os

OUT  = "/Users/dheiver/Documents/vivo-compliance-insights-1/VoiceAudit-Apresentacao-Vendas.pdf"
SS   = "/Users/dheiver/Documents/vivo-compliance-insights-1/screenshots"
LOGO      = "/tmp/avantti-logo.png"
LOGO_W    = "/tmp/avantti-logo-branco.png"
W, H = 1920, 1080

# ── Palette ──────────────────────────────────────────────────────────────
C = {
    "slate":   (76,  90,  97),    # #4C5A61  Avantti primary
    "slate_d": (48,  58,  63),    # #30393F  dark slate
    "slate_l": (108, 124, 132),   # #6C7C84  light slate
    "yellow":  (255, 228, 80),    # #FFE450  Avantti accent
    "yellow_d":(220, 190, 40),    # #DCBE28  darker yellow
    "vivo":    (102, 0,   153),   # #660099  Vivo purple
    "vivo_d":  (74,  0,   110),   # #4A006E  dark purple
    "white":   (255, 255, 255),
    "off_w":   (248, 248, 246),   # warm white bg
    "light_bg":(242, 244, 245),   # light card bg
    "dark_bg": (28,  36,  40),    # very dark slate
    "mid":     (95,  110, 118),   # mid gray
    "pgray":   (130, 145, 152),
    "green":   (22,  163, 74),
    "red":     (220, 38,  38),
}

HN = "/System/Library/Fonts/HelveticaNeue.ttc"

def fnt(size, bold=False):
    try:
        return ImageFont.truetype(HN, size, index=1 if bold else 0)
    except:
        return ImageFont.load_default()

def new_slide(bg=None):
    img = Image.new("RGB", (W, H), bg or C["slate_d"])
    return img, ImageDraw.Draw(img)

def rect(d, x, y, w, h, color, radius=0):
    if radius:
        d.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=color)
    else:
        d.rectangle([x, y, x+w, y+h], fill=color)

def circle(d, cx, cy, r, color):
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

def txt(d, x, y, text, size=28, color=None, bold=False, anchor="la"):
    color = color or C["white"]
    f = fnt(size, bold)
    d.text((x, y), text, font=f, fill=color, anchor=anchor)

def txt_wrapped(d, x, y, text, max_w, size=26, color=None, bold=False, line_gap=None):
    color = color or C["white"]
    f = fnt(size, bold)
    lg = line_gap or int(size * 1.45)
    words = text.split()
    lines, cur = [], ""
    for w2 in words:
        test = (cur + " " + w2).strip()
        if d.textlength(test, font=f) <= max_w:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w2
    if cur: lines.append(cur)
    cy = y
    for line in lines:
        d.text((x, cy), line, font=f, fill=color, anchor="la")
        cy += lg
    return cy

def paste_image(img, path, x, y, w, h):
    try:
        src = Image.open(path).convert("RGB")
        sw, sh = src.size
        if sh > sw * 1.2:
            crop_h = int(sw * (h / w))
            src = src.crop((0, 0, sw, min(crop_h, sh)))
            sw, sh = src.size
        scale = min(w / sw, h / sh)
        nw, nh = int(sw * scale), int(sh * scale)
        src = src.resize((nw, nh), Image.LANCZOS)
        ox = x + (w - nw) // 2
        oy = y + (h - nh) // 2
        img.paste(src, (ox, oy))
    except Exception as e:
        print(f"  [warn] {path}: {e}")

def add_glow(img, cx, cy, rx, ry, color, alpha=35):
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(*color, alpha))
    blurred = layer.filter(ImageFilter.GaussianBlur(radius=80))
    base = img.convert("RGBA")
    return Image.alpha_composite(base, blurred).convert("RGB")

def add_logo(img, white=True, x=None, y=None, target_w=200):
    """Paste Avantti logo onto slide at a fixed target width."""
    path = LOGO_W if white else LOGO
    try:
        logo = Image.open(path).convert("RGBA")
        ratio = logo.height / logo.width
        lw = target_w
        lh = int(lw * ratio)
        logo = logo.resize((lw, lh), Image.LANCZOS)
        px = x if x is not None else W - lw - 40
        py = y if y is not None else H - lh - 20
        base = img.convert("RGBA")
        base.paste(logo, (px, py), logo)
        return base.convert("RGB")
    except Exception as e:
        print(f"  [logo warn] {e}")
        return img

def mangaba_badge(d, x, y):
    """Small 'Powered by Mangaba AI' badge."""
    rect(d, x, y, 290, 38, C["slate"], radius=6)
    rect(d, x, y, 4, 38, C["yellow"])
    txt(d, x+14, y+19, "Powered by Mangaba AI", size=18, color=C["white"], anchor="lm")

def yellow_tag(d, x, y, text, size=20):
    f = fnt(size, True)
    tw = d.textlength(text, font=f)
    rect(d, x, y, int(tw)+24, size+16, C["yellow"], radius=4)
    txt(d, x+12, y+8, text, size=size, color=C["slate_d"], bold=True)

# ══════════════════════════════════════════════════════════════════════
slides = []

# ─── SLIDE 1: CAPA ────────────────────────────────────────────────────
img, d = new_slide(C["dark_bg"])
img = add_glow(img,  300,  500, 400, 400, C["slate"],  40)
img = add_glow(img, 1700,  200, 380, 380, C["vivo"],   35)
img = add_glow(img, 1800,  900, 300, 300, C["yellow"], 30)
d = ImageDraw.Draw(img)

# Yellow accent bar left
rect(d, 0, 0, 8, H, C["yellow"])

# Logo Avantti (white) — bottom right of capa
img = add_logo(img, white=True, x=W-300, y=H-130, target_w=260)
d = ImageDraw.Draw(img)

# Vivo partner tag
yellow_tag(d, 56, 140, "Parceiro Nacional VIVO EMPRESAS")

# Main title
txt(d, 56, 225, "VoiceAudit", size=120, color=C["white"], bold=True)

# Yellow underline accent
rect(d, 56, 368, 680, 7, C["yellow"])

txt(d, 56, 390, "Auditoria Inteligente de Ligacoes com IA", size=42, color=C["pgray"])
txt(d, 56, 448, "Compliance garantido. Coaching automatizado. 100% das chamadas.", size=30, color=C["slate_l"])

# Bottom strip
rect(d, 0, H-68, W, 68, C["slate"])
rect(d, 0, H-68, W, 4, C["yellow"])
mangaba_badge(d, 56, H-53)
txt(d, W-56, H-34, "2026  ·  Confidencial", size=22, color=C["slate_l"], anchor="rm")
slides.append(img)

# ─── SLIDE 2: O PROBLEMA ─────────────────────────────────────────────
img, d = new_slide(C["off_w"])
rect(d, 0, 0, 8, H, C["yellow"])

# Header
rect(d, 0, 0, W, 130, C["slate_d"])
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
txt(d, 56, 38, "O DESAFIO", size=22, color=C["yellow"], bold=True)
txt(d, 56, 72, "Compliance nos call centers: por que o modelo atual falha", size=34, color=C["white"], bold=True)

problems = [
    ("~5%",   "de cobertura",     "Somente ~5% das ligacoes sao auditadas manualmente"),
    ("R$$$",  "custo alto",       "Equipes inteiras dedicadas a monitoria humana"),
    ("!=",     "inconsistencia",   "Avaliacoes subjetivas variam entre auditores"),
    ("!",     "risco legal",      "Multas por nao conformidade ANATEL e LGPD"),
    ("30d+",  "feedback tardio",  "Retorno ao agente chega dias ou semanas depois"),
]
for i, (stat, label, desc) in enumerate(problems):
    col = i % 2
    row = i // 2
    cx = 56 + col * 950
    cy = 175 + row * 235
    cw, ch = 860, 200

    # card
    rect(d, cx, cy, cw, ch, C["light_bg"], radius=10)
    rect(d, cx, cy, 8, ch, C["yellow"])
    # stat bubble
    rect(d, cx+24, cy+20, 110, 60, C["slate_d"], radius=8)
    txt(d, cx+79, cy+50, stat, size=26, color=C["yellow"], bold=True, anchor="mm")
    txt(d, cx+150, cy+22, label.upper(), size=20, color=C["slate"], bold=True)
    txt_wrapped(d, cx+150, cy+58, desc, cw-170, size=26, color=C["mid"])

# footer
rect(d, 0, H-50, W, 50, C["slate_d"])
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDE 3: A SOLUÇÃO ──────────────────────────────────────────────
img, d = new_slide(C["slate_d"])
img = add_glow(img, 1750, 540, 450, 450, C["vivo"], 30)
rect(d, 0, 0, 8, H, C["yellow"])

rect(d, 0, 0, W, 130, (20, 28, 32))
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "A SOLUÇÃO")
txt(d, 56, 84, "VoiceAudit — 100% das chamadas auditadas por IA", size=36, color=C["white"], bold=True)

solutions = [
    ("01", "Transcricao automatica", "Todas as ligacoes convertidas em texto com Mangaba Voz"),
    ("02", "Analise de compliance",  "Mangaba Compliance IA avalia cada criterio em tempo real"),
    ("03", "Scorecards automaticos", "Pontuacao objetiva por agente, sem subjetividade"),
    ("04", "Coaching com IA",        "Recomendacoes personalizadas baseadas nos padroes detectados"),
    ("05", "Dashboard & Relatorios", "KPIs consolidados, exportacao e rastreabilidade total"),
]
for i, (num, title, desc) in enumerate(solutions):
    col = 0 if i < 3 else 1
    row = i % 3
    cx = 56 + col * 940
    cy = 175 + row * 265

    rect(d, cx, cy, 880, 228, (38, 50, 57), radius=12)
    rect(d, cx, cy, 6, 228, C["yellow"])
    # number
    rect(d, cx+20, cy+20, 64, 64, C["yellow"], radius=8)
    txt(d, cx+52, cy+52, num, size=28, color=C["slate_d"], bold=True, anchor="mm")
    txt(d, cx+100, cy+28, title, size=30, color=C["white"], bold=True)
    txt_wrapped(d, cx+100, cy+78, desc, 760, size=26, color=C["slate_l"])

rect(d, 0, H-50, W, 50, (20, 28, 32))
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDES 4-9: TELAS ───────────────────────────────────────────────
screens = [
    ("Dashboard de Operacoes",
     "KPIs consolidados: ligacoes auditadas · compliance medio · cobertura IA · componentes ativos",
     f"{SS}/03-dashboard.png"),
    ("Analise Detalhada de Ligacoes",
     "Score por chamada · transcricao · agente responsavel · resultado da auditoria Mangaba AI",
     f"{SS}/05-ligacoes.png"),
    ("Scorecards por Agente",
     "Pontuacao por criterio · evolucao historica · identificacao de gaps de qualidade",
     f"{SS}/08-scorecards.png"),
    ("Coaching Personalizado com IA",
     "Recomendacoes automaticas por agente baseadas nos padroes detectados pelo Mangaba AI",
     f"{SS}/07-coaching.png"),
    ("Relatorios Gerenciais",
     "Exportacao de relatorios de compliance · produtividade · qualidade para gestores e auditores",
     f"{SS}/09-relatorios.png"),
    ("Gestao de Equipes",
     "Visao por supervisor e agente · ranking de performance · alertas de compliance",
     f"{SS}/06-equipe.png"),
]
for title, caption, img_path in screens:
    img, d = new_slide(C["dark_bg"])
    # top bar
    rect(d, 0, 0, W, 90, C["slate_d"])
    rect(d, 0, 0, W, 5, C["yellow"])
    txt(d, 40, 45, title, size=36, color=C["white"], bold=True, anchor="lm")
    img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
    d = ImageDraw.Draw(img)
    # screenshot
    paste_image(img, img_path, 16, 96, W-32, H-166)
    d = ImageDraw.Draw(img)
    # bottom
    rect(d, 0, H-68, W, 68, C["slate_d"])
    rect(d, 0, H-68, W, 3, C["yellow"])
    txt_wrapped(d, 40, H-52, caption, W-650, size=24, color=C["slate_l"])
    mangaba_badge(d, W-310, H-53)
    slides.append(img)

# ─── SLIDE 10: BENEFICIOS ────────────────────────────────────────────
img, d = new_slide(C["off_w"])
rect(d, 0, 0, 8, H, C["yellow"])
rect(d, 0, 0, W, 130, C["slate_d"])
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "RESULTADOS")
txt(d, 56, 84, "Impacto real e mensuravel desde o primeiro mes", size=34, color=C["white"], bold=True)

benefits = [
    ("100%",    "das ligacoes\nauditadas",    "vs. ~5% manual"),
    ("-70%",    "no tempo de\nauditoria",     "de dias p/ minutos"),
    ("<24h",    "feedback\nao agente",        "ciclo continuo"),
    ("100%",    "rastreabilidade\nANATEL",    "LGPD compliant"),
    ("3 meses", "para ROI\npositivo",         "retorno garantido"),
]
cw, ch = 330, 720
gap = 20
for i, (stat, sub, note) in enumerate(benefits):
    cx = 52 + i * (cw + gap)
    cy = 168
    rect(d, cx, cy, cw, ch, C["light_bg"], radius=12)
    rect(d, cx, cy, cw, 6, C["yellow"])
    # big stat
    txt(d, cx+cw//2, cy+105, stat, size=72, color=C["slate_d"], bold=True, anchor="mm")
    rect(d, cx+40, cy+145, cw-80, 2, C["yellow"])
    for j, line in enumerate(sub.split("\n")):
        txt(d, cx+cw//2, cy+178+j*46, line, size=28, color=C["slate"], bold=True, anchor="mm")
    txt(d, cx+cw//2, cy+ch-44, note, size=24, color=C["pgray"], anchor="mm")

rect(d, 0, H-50, W, 50, C["slate_d"])
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDE 11: TECNOLOGIA ────────────────────────────────────────────
img, d = new_slide(C["slate_d"])
img = add_glow(img, -80, 900, 400, 400, C["yellow"], 22)
img = add_glow(img, 1800, 200, 380, 380, C["vivo"],  25)
rect(d, 0, 0, 8, H, C["yellow"])

rect(d, 0, 0, W, 130, (20, 28, 32))
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "TECNOLOGIA")
txt(d, 56, 84, "Arquitetura Mangaba AI — modelos proprietarios", size=36, color=C["white"], bold=True)

techs = [
    ("Mangaba Compliance IA",
     "Modelo proprietario para analise semantica de conformidade em chamadas de voz"),
    ("Mangaba Voz",
     "Pipeline de transcricao audio >> texto otimizado para portugues brasileiro"),
    ("Agentes Mangaba Basico",
     "Cada criterio de compliance avaliado por um agente de IA dedicado"),
    ("API REST aberta",
     "Integracao nativa com sistemas legados, CRMs e ERPs corporativos"),
    ("Dados no Brasil — LGPD",
     "Infraestrutura 100% hospedada em territorio nacional, sem envio externo"),
]
for i, (title, desc) in enumerate(techs):
    col = 0 if i < 3 else 1
    row = i % 3
    cx = 56 + col * 940
    cy = 175 + row * 250
    cw2 = 880

    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([cx, cy, cx+cw2, cy+210], radius=10,
                          fill=(255,255,255,14), outline=(*C["slate_l"], 60), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)
    rect(d, cx, cy, 6, 210, C["yellow"])
    txt(d, cx+24, cy+24, title, size=30, color=C["yellow"], bold=True)
    txt_wrapped(d, cx+24, cy+76, desc, cw2-40, size=26, color=C["slate_l"])

rect(d, 0, H-50, W, 50, (20, 28, 32))
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDE 12: CTA ───────────────────────────────────────────────────
img, d = new_slide(C["dark_bg"])
img = add_glow(img, 1700, 300, 500, 500, C["yellow"], 20)
img = add_glow(img, 200,  900, 400, 400, C["vivo"],   25)
rect(d, 0, 0, 8, H, C["yellow"])

rect(d, 0, 0, W, 130, (20, 28, 32))
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "PRÓXIMOS PASSOS")
txt(d, 56, 84, "Vamos escalar juntos?", size=36, color=C["white"], bold=True)

txt(d, 56, 175, "Agende uma demonstracao ao vivo com a equipe Avantti", size=36, color=C["slate_l"])
rect(d, 56, 228, 560, 5, C["yellow"])

steps = [
    ("01", "Piloto em 30 dias com sua base real de ligacoes"),
    ("02", "Onboarding guiado e treinamento da equipe Avantti"),
    ("03", "SLA dedicado e relatorios semanais de progresso"),
]
for i, (num, step) in enumerate(steps):
    sy = 272 + i * 130
    rect(d, 56, sy, 72, 72, C["yellow"], radius=8)
    txt(d, 92, sy+36, num, size=30, color=C["slate_d"], bold=True, anchor="mm")
    txt(d, 150, sy+14, step, size=34, color=C["white"])

# CTA box
rect(d, 56, 680, 680, 80, C["slate"], radius=12)
rect(d, 56, 680, 6, 80, C["yellow"])
txt(d, 400, 720, "contato@avantticonsultoria.com.br", size=32, color=C["yellow"], bold=True, anchor="mm")

rect(d, 0, H-68, W, 68, C["slate_d"])
rect(d, 0, H-68, W, 4, C["yellow"])
mangaba_badge(d, 56, H-53)
txt(d, W-56, H-34, "Avantti Consultoria × Vivo · 2026", size=22, color=C["slate_l"], anchor="rm")
slides.append(img)

# ─── SLIDE 13: POC ───────────────────────────────────────────────────
img, d = new_slide(C["off_w"])
rect(d, 0, 0, 8, H, C["yellow"])
rect(d, 0, 0, W, 130, C["slate_d"])
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "PASSO 1 — POC")
txt(d, 56, 84, "Prova de Conceito — entrada sem risco, resultado em 30 dias", size=34, color=C["white"], bold=True)

# ── Left: price highlight ──────────────────────────────────────────
rect(d, 56, 160, 640, 560, C["slate_d"], radius=14)
rect(d, 56, 160, 640, 8, C["yellow"])
txt(d, 376, 240, "R$ 18.000", size=78, color=C["yellow"], bold=True, anchor="mm")
txt(d, 376, 292, "pagamento unico · sem recorrencia", size=25, color=C["slate_l"], anchor="mm")
rect(d, 100, 316, 548, 2, C["slate"])
txt(d, 376, 344, "PRECO DE POC  (valor de mercado)", size=21, color=C["pgray"], bold=True, anchor="mm")

# poc scope bullets inside card
poc_bullets = [
    "Ate 500 ligacoes auditadas com Mangaba AI",
    "30 dias corridos apos kick-off",
    "Workshop presencial de alinhamento",
    "1 analista Avantti dedicado",
    "Relatorio final + dashboard ativo",
    "ROI calculado e plano de expansao",
]
for i, b in enumerate(poc_bullets):
    by = 388 + i * 52
    circle(d, 96, by+14, 10, C["yellow"])
    txt(d, 116, by, b, size=23, color=C["slate_l"])

# ── Right: 3 phases timeline ──────────────────────────────────────
phases = [
    ("Semana 1",   "Kick-off + alinhamento de criterios de compliance"),
    ("Semanas 2-4","Auditoria de 500 ligacoes com Mangaba AI"),
    ("Semana 5",   "Relatorio, ROI e recomendacao de escala"),
]
for i, (week, desc) in enumerate(phases):
    px = 740
    py = 175 + i * 165
    pw, ph = 1120, 140
    rect(d, px, py, pw, ph, C["light_bg"], radius=10)
    rect(d, px, py, 8, ph, C["yellow"])
    # number circle
    circle(d, px+55, py+ph//2, 36, C["slate_d"])
    txt(d, px+55, py+ph//2, str(i+1), size=30, color=C["yellow"], bold=True, anchor="mm")
    txt(d, px+108, py+24, week.upper(), size=22, color=C["slate"], bold=True)
    txt_wrapped(d, px+108, py+58, desc, pw-130, size=26, color=C["mid"])

# ── Transition arrow to platform ──────────────────────────────────
rect(d, 740, 700, 1120, 110, C["slate_d"], radius=12)
rect(d, 740, 700, 8, 110, C["yellow"])
txt(d, 760, 722, "Apos o POC >> Licenca Mensal a partir de", size=26, color=C["pgray"], bold=True)
txt(d, 760, 768, "R$ 3.500/mes  (plano Starter, sem custo de setup adicional)", size=30, color=C["yellow"], bold=True)

# ref box
rect(d, 56, 760, 640, 120, (230, 232, 230), radius=10)
rect(d, 56, 760, 8, 120, C["slate_l"])
txt(d, 80, 782, "Referencia de mercado (ABES 2024):", size=22, color=C["slate"], bold=True)
txt(d, 80, 816, "POC de plataforma AI enterprise:", size=21, color=C["mid"])
txt(d, 80, 848, "R$ 15.000 a R$ 30.000 (30 a 60 dias)", size=21, color=C["mid"])

rect(d, 0, H-50, W, 50, C["slate_d"])
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDE 14: PLATAFORMA COMPLETA ───────────────────────────────────
img, d = new_slide(C["slate_d"])
img = add_glow(img, 1800, 300, 500, 500, C["yellow"], 18)
img = add_glow(img, 100,  900, 350, 350, C["vivo"],   20)
rect(d, 0, 0, 8, H, C["yellow"])
rect(d, 0, 0, W, 130, (20, 28, 32))
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "PASSO 2 — PLATAFORMA POS-POC")
txt(d, 56, 84, "Licenca Mensal · Atualizacoes Inclusas · Suporte Dedicado", size=34, color=C["white"], bold=True)

# ── Key callout bar ──────────────────────────────────────────────────
rect(d, 56, 148, W-112, 72, (40, 52, 58), radius=10)
rect(d, 56, 148, 6, 72, C["yellow"])
txt(d, 80, 162, "LICENCA MENSAL  (sem fidelidade anual obrigatoria)", size=24, color=C["yellow"], bold=True)
txt(d, 80, 200, "Setup cobrado uma unica vez na ativacao · Referencia de mercado: ABES / Gartner 2024", size=22, color=C["slate_l"])

tiers = [
    {"name":"Starter",    "sub":"Ate 2.000 lig./mes",
     "license":"R$ 3.500",  "license_yr":"R$ 42.000/ano",
     "setup":"Setup unico: R$ 18.000",
     "highlight":False,
     "items":["5 agentes monitorados","Dashboard + Scorecards","Relatorios mensais","Suporte via ticket"]},
    {"name":"Business",   "sub":"Ate 10.000 lig./mes",
     "license":"R$ 9.800",  "license_yr":"R$ 117.600/ano",
     "setup":"Setup unico: R$ 35.000",
     "highlight":True,
     "items":["30 agentes monitorados","Coaching automatizado","API REST + integracoes","Suporte prioritario 8x5"]},
    {"name":"Enterprise", "sub":"Volume ilimitado",
     "license":"Sob consulta", "license_yr":"",
     "setup":"Setup: a definir",
     "highlight":False,
     "items":["Agentes ilimitados","SLA 99.9% + suporte 24x7","Customizacao Mangaba AI","Gestor de conta dedicado"]},
]
card_w = 555
cy = 270      # start cards lower so POPULAR badge fits above without overlap
ch4 = 760     # taller cards

for i, t in enumerate(tiers):
    cx = 56 + i * (card_w + 30)
    hl = t.get("highlight", False)
    bg_alpha = 35 if hl else 18
    border_col = (*C["yellow"], 220) if hl else (*C["slate_l"], 60)

    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([cx, cy, cx+card_w, cy+ch4], radius=14,
                          fill=(255,255,255,bg_alpha), outline=border_col, width=3 if hl else 1)
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)

    # top accent bar
    rect(d, cx, cy, card_w, 7, C["yellow"])

    # Plan name + volume
    txt(d, cx+card_w//2, cy+50,  t["name"], size=36, color=C["white"], bold=True, anchor="mm")
    txt(d, cx+card_w//2, cy+84,  t["sub"],  size=24, color=C["slate_l"], anchor="mm")

    # ── LICENCA MENSAL box (height=140 so annual fits inside) ──────
    lbox_top = cy+104
    lbox_h   = 140
    rect(d, cx+24, lbox_top, card_w-48, lbox_h, (20, 28, 32), radius=10)
    rect(d, cx+24, lbox_top, card_w-48, 5, C["yellow"])
    txt(d, cx+card_w//2, lbox_top+26, "LICENCA MENSAL", size=19, color=C["yellow"], bold=True, anchor="mm")
    txt(d, cx+card_w//2, lbox_top+82, t["license"], size=52, color=C["yellow"] if hl else C["white"], bold=True, anchor="mm")
    if t["license_yr"]:
        txt(d, cx+card_w//2, lbox_top+122, "("+t["license_yr"]+")", size=21, color=C["pgray"], anchor="mm")

    # ── Setup fee box (below license box, clear gap) ───────────────
    sbox_top = lbox_top + lbox_h + 14          # 14px gap
    rect(d, cx+24, sbox_top, card_w-48, 64, (30, 40, 46), radius=8)
    txt(d, cx+card_w//2, sbox_top+22, t["setup"],                   size=22, color=C["slate_l"], anchor="mm")
    txt(d, cx+card_w//2, sbox_top+46, "pagamento unico na ativacao", size=19, color=C["pgray"],  anchor="mm")

    # ── Feature list ───────────────────────────────────────────────
    feat_top = sbox_top + 64 + 16
    rect(d, cx+40, feat_top, card_w-80, 2, (*C["slate_l"], 60))
    for j, item in enumerate(t["items"]):
        iy = feat_top + 18 + j * 88
        circle(d, cx+58, iy+16, 13, C["yellow"])
        txt(d, cx+58, iy+16, "V", size=14, color=C["slate_d"], bold=True, anchor="mm")
        txt(d, cx+84, iy, item, size=26, color=C["slate_l"])

# POPULAR badge on Business card — positioned safely above card top
mid_cx = 56 + (card_w+30) + card_w//2
badge_y = cy - 42   # badge bottom = cy-42+34 = cy-8 — 8px clear above card
rect(d, mid_cx-95, badge_y, 190, 34, C["green"], radius=17)
txt(d, mid_cx, badge_y+17, "MAIS POPULAR", size=18, color=C["white"], bold=True, anchor="mm")

# Market ref footer
rect(d, 0, H-50, W, 50, (20, 28, 32))
txt(d, 56, H-30, "Referencia de mercado: plataformas AI compliance B2B = R$ 3.000 a R$ 15.000/mes (ABES 2024 / Gartner Peer Insights)", size=20, color=C["pgray"])
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ─── SLIDE 15: MANUTENCAO ────────────────────────────────────────────
img, d = new_slide(C["off_w"])
rect(d, 0, 0, 8, H, C["yellow"])
rect(d, 0, 0, W, 130, C["slate_d"])
img = add_logo(img, white=True, x=W-220, y=18, target_w=180)
d = ImageDraw.Draw(img)
yellow_tag(d, 56, 38, "POS-VENDA")
txt(d, 56, 84, "Manutencao & Suporte — Preco de Mercado", size=36, color=C["white"], bold=True)

maint = [
    {"tier":"Basico",   "pct":"15%", "base":"ao ano sobre licenca",
     "items":["Correcoes criticas (bug fix)","Atualizacoes de seguranca","Suporte ticket (SLA 48h)","1 revisao de criterios/ano"]},
    {"tier":"Standard", "pct":"20%", "base":"ao ano sobre licenca", "highlight":True,
     "items":["Tudo do Basico","Atualizacoes de features","Suporte 8x5 (SLA 8h)","2 revisoes de criterios/ano","Treinamento anual da equipe"]},
    {"tier":"Premium",  "pct":"25%", "base":"ao ano sobre licenca",
     "items":["Tudo do Standard","Suporte 24x7 (SLA 2h)","Gestor de sucesso dedicado","Revisoes trimestrais","Evolucoes customizadas"]},
]
cw5, ch5 = 560, 660
for i, m in enumerate(maint):
    cx = 56 + i * (cw5 + 42)
    cy = 165
    hl = m.get("highlight", False)
    bg = C["light_bg"]
    rect(d, cx, cy, cw5, ch5, bg, radius=12)
    rect(d, cx, cy, cw5, 7, C["yellow"])
    txt(d, cx+cw5//2, cy+52,  m["tier"],  size=34, color=C["slate_d"], bold=True, anchor="mm")
    txt(d, cx+cw5//2, cy+155, m["pct"],   size=82, color=C["slate_d"] if not hl else C["vivo"], bold=True, anchor="mm")
    txt(d, cx+cw5//2, cy+210, m["base"],  size=22, color=C["pgray"], anchor="mm")
    rect(d, cx+40, cy+244, cw5-80, 2, C["yellow"])
    for j, item in enumerate(m["items"]):
        iy = cy + 264 + j * 74
        circle(d, cx+40, iy+18, 12, C["yellow"])
        txt(d, cx+40, iy+18, "✓", size=16, color=C["slate_d"], bold=True, anchor="mm")
        txt(d, cx+64, iy, item, size=24, color=C["mid"])

# Market ref box
rect(d, 56, 870, W-112, 100, C["light_bg"], radius=10)
rect(d, 56, 870, 8, 100, C["yellow"])
txt(d, 86, 892, "Referencia de mercado SaaS enterprise Brasil (Gartner / ABES 2024):", size=24, color=C["slate"], bold=True)
txt(d, 86, 928, "Manutencao anual entre 15% e 25% do valor da licenca · Inclui SLA, suporte e atualizacoes", size=23, color=C["mid"])

rect(d, 0, H-50, W, 50, C["slate_d"])
mangaba_badge(d, W-310, H-44)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════
print(f"Salvando {len(slides)} slides…")
slides[0].save(OUT, save_all=True, append_images=slides[1:], resolution=150)
print(f"✅  {OUT}  ({len(slides)} paginas)")
