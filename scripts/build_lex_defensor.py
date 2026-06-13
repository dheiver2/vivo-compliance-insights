"""
Lex Defensor -- Apresentacao de Vendas
Empresa: Rueda & Rueda Advocacia
Identidade visual extraida de ruedaerueda.com.br
  Navy  #1B355E  (27, 53, 94)
  Orange #E94E2C  (233, 78, 44)
  Teal  #40C8C8  (64, 200, 200)
  Amber #FFBC7D  (255, 188, 125)
  Dark  #0A0A0A  (10, 10, 10)
  Light #F4F4F4  (244, 244, 244)
Precos de mercado 2025 (ABES / Gartner Peer Insights)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT   = "/Users/dheiver/Documents/vivo-compliance-insights-1/LexDefensor-Apresentacao-Vendas.pdf"
LOGO  = "/tmp/rueda-logo-branco.png"   # navy + orange on transparent (para fundo claro)
W, H  = 1920, 1080

# ── Paleta oficial Rueda & Rueda ─────────────────────────────────────────
C = {
    "navy":    (27,  53,  94),    # #1B355E primaria
    "navy_d":  (15,  30,  58),    # variante mais escura
    "navy_l":  (55,  90, 145),    # variante clara
    "orange":  (233, 78,  44),    # #E94E2C acento
    "orange_d":(185, 55,  28),    # variante escura
    "teal":    (64,  200, 200),   # #40C8C8 secundaria
    "amber":   (255, 188, 125),   # #FFBC7D calor/destaque suave
    "dark":    (10,  10,  10),    # #0A0A0A texto escuro
    "gray":    (166, 166, 166),   # #A6A6A6 cinza medio
    "light":   (244, 244, 244),   # #F4F4F4 fundo claro
    "lighter": (247, 251, 255),   # #F7FBFF quase branco
    "white":   (255, 255, 255),
    "border":  (210, 210, 218),
    "muted":   (110, 115, 132),
    "pgray":   (160, 162, 175),
    # fases juridicas
    "prep":    (55,  90, 145),    # azul-marinho claro
    "analises":(215, 130,  25),   # ambar
    "defesas": (64,  155, 210),   # azul-medio
    "merito":  (38,  155,  80),   # verde
    "green":   (22,  163,  74),
    "card_d":  (22,  40,  78),    # card escuro (sobre navy_d)
}

HN = "/System/Library/Fonts/HelveticaNeue.ttc"

# ── Primitivas ────────────────────────────────────────────────────────────
def fnt(size, bold=False):
    try:
        return ImageFont.truetype(HN, size, index=1 if bold else 0)
    except:
        return ImageFont.load_default()

def new_slide(bg=None):
    img = Image.new("RGB", (W, H), bg or C["navy_d"])
    return img, ImageDraw.Draw(img)

def rect(d, x, y, w, h, color, radius=0, outline=None, outline_w=2):
    if radius:
        kw = {"outline": outline, "width": outline_w} if outline else {}
        d.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=color, **kw)
    else:
        d.rectangle([x, y, x+w, y+h], fill=color)

def circle(d, cx, cy, r, color):
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

def txt(d, x, y, text, size=28, color=None, bold=False, anchor="la"):
    color = color or C["white"]
    f = fnt(size, bold)
    d.text((x, y), str(text), font=f, fill=color, anchor=anchor)

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

def glow(img, cx, cy, rw, rh, color, alpha=18):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([cx-rw, cy-rh, cx+rw, cy+rh], fill=(*color, alpha))
    return Image.alpha_composite(img.convert("RGBA"),
           layer.filter(ImageFilter.GaussianBlur(radius=90))).convert("RGB")

def load_logo(white=False, target_w=220):
    """
    Carrega o logo Rueda & Rueda.
    white=True  -> converte pixels navy para branco (versao para fundo escuro)
    white=False -> logo original (navy+laranja, para fundo claro)
    """
    if not os.path.exists(LOGO):
        return None
    logo = Image.open(LOGO).convert("RGBA")
    if white:
        data = logo.getdata()
        new_data = []
        for r, g, b, a in data:
            if a < 30:
                new_data.append((0, 0, 0, 0))
            elif r < 80 and g < 100 and b > 60:   # pixels navy -> branco
                new_data.append((255, 255, 255, a))
            else:
                new_data.append((r, g, b, a))
        logo.putdata(new_data)
    scale = target_w / logo.width
    new_h = int(logo.height * scale)
    return logo.resize((target_w, new_h), Image.LANCZOS)

def paste_logo(img, white=False, x=56, y=18, target_w=220):
    logo = load_logo(white=white, target_w=target_w)
    if logo is None:
        return img
    base = img.convert("RGBA")
    base.paste(logo, (x, y), logo)
    return base.convert("RGB")

def orange_tag(d, x, y, label):
    f = fnt(19, bold=True)
    tw = int(d.textlength(label, font=f))
    rect(d, x, y, tw + 22, 32, C["orange"], radius=5)
    txt(d, x + 11, y + 16, label, size=19, color=C["white"], bold=True, anchor="lm")

def dark_header(img, d, tag, subtitle, logo_white=True):
    rect(d, 0, 0, W, 118, C["navy_d"])
    rect(d, 0, 0, 8, 118, C["orange"])
    orange_tag(d, 34, 30, tag)
    txt(d, 34, 74, subtitle, size=36, color=C["white"], bold=True)
    img = paste_logo(img, white=logo_white, x=W - 280, y=20, target_w=240)
    return img, ImageDraw.Draw(img)

def light_header(img, d, tag, subtitle):
    rect(d, 0, 0, W, 118, C["lighter"])
    rect(d, 0, 0, W, 118, C["lighter"])
    rect(d, 0, 0, 8, 118, C["orange"])
    orange_tag(d, 34, 30, tag)
    txt(d, 34, 74, subtitle, size=36, color=C["navy"], bold=True)
    img = paste_logo(img, white=False, x=W - 280, y=20, target_w=240)
    return img, ImageDraw.Draw(img)

def footer_bar(d, dark=True):
    bg = C["navy_d"] if dark else C["lighter"]
    fc = C["pgray"] if dark else C["muted"]
    rect(d, 0, H - 46, W, 46, bg)
    txt(d, 56, H - 23, "Lex Defensor  |  Rueda & Rueda Advocacia  |  ruedaerueda.com.br  |  Powered by Claude AI",
        size=18, color=fc, anchor="lm")
    txt(d, W - 56, H - 23, "Confidencial", size=18, color=fc, anchor="rm")

slides = []

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 1 -- CAPA
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["navy_d"])
img = glow(img, 1560, 260, 620, 560, C["orange"], 20)
img = glow(img, 240,  860, 500, 420, C["teal"],   12)
d = ImageDraw.Draw(img)

# faixas
rect(d, 0, 0, 10, H, C["orange"])
rect(d, 0, 0, W, 8,  C["orange"])
rect(d, 0, H - 8, W, 8, C["orange"])

# logo branco grande à direita
img = paste_logo(img, white=True, x=W - 620, y=H//2 - 120, target_w=540)
d = ImageDraw.Draw(img)

# badge powered
rect(d, 56, 48, 340, 40, C["orange_d"], radius=20)
txt(d, 226, 68, "Powered by Claude AI", size=20, color=C["white"], bold=True, anchor="mm")

# titulo
txt(d, 56, 160, "Lex Defensor", size=110, color=C["white"], bold=True)
rect(d, 56, 284, 520, 7, C["orange"])

txt(d, 56, 308, "Engenharia juridica deterministica", size=46, color=C["amber"])
txt(d, 56, 368, "para defesa civel", size=46, color=C["amber"])

txt(d, 56, 452, "Contestacao por algoritmo auditavel, sem alucinacao.", size=30, color=C["pgray"])
txt(d, 56, 500, "A peca sempre sai.", size=30, color=C["pgray"])

# empresa
rect(d, 56, 576, 560, 76, C["card_d"], radius=10)
rect(d, 56, 576, 7, 76, C["orange"])
txt(d, 82, 600, "Rueda & Rueda Advocacia", size=30, color=C["white"], bold=True)
txt(d, 82, 640, "ruedaerueda.com.br  |  2025", size=22, color=C["pgray"])

# tags
for i, (tag, col) in enumerate([
    ("Defesa Civel",  C["navy_l"]),
    ("4 Fases",       C["teal"]),
    ("Claude AI",     C["orange"]),
    ("Supabase",      C["navy_l"]),
]):
    tx = 56 + i * 195
    rect(d, tx, 686, 180, 34, col, radius=17)
    txt(d, tx + 90, 703, tag, size=18, color=C["white"], bold=True, anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 2 -- O PROBLEMA
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["navy_d"])
img = glow(img, 1700, 100, 400, 400, C["orange"], 14)
img, d = dark_header(img, d, "O PROBLEMA", "Dores que o mercado juridico enfrenta hoje")
rect(d, 0, 0, 8, H, C["orange"])

problems = [
    ("Contestacoes demoram dias",
     "Advogados gastam horas em tarefas repetitivas: extrair pedidos, mapear teses, formatar a peca."),
    ("Teses juridicas esquecidas",
     "Sem sistematica, itens criticos -- prescricao, ilegitimidade, inepcia -- passam em branco."),
    ("Inconsistencia entre pares",
     "Cada advogado aplica criterios diferentes. Qualidade da defesa varia por profissional."),
    ("Risco de prazos perdidos",
     "Calculos de prescricao feitos manualmente falham. Uma data errada pode custar o caso."),
    ("Raciocinio inauditavel",
     "Sem trilha de decisao, o cliente nao entende a defesa e a revisao vira retrabalho."),
]

cw = 330
for i, (title, desc) in enumerate(problems):
    cx = 56 + i * (cw + 22)
    rect(d, cx, 148, cw, 876, C["card_d"], radius=12)
    rect(d, cx, 148, cw, 7, C["orange"])
    circle(d, cx + cw//2, 236, 46, C["orange"])
    txt(d, cx + cw//2, 236, str(i+1), size=42, color=C["white"], bold=True, anchor="mm")
    txt_wrapped(d, cx + 24, 304, title, cw - 48, size=26, color=C["white"], bold=True)
    txt_wrapped(d, cx + 24, 410, desc, cw - 48, size=21, color=C["pgray"])

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 3 -- A SOLUCAO
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["navy_d"])
img = glow(img, 1600, 700, 500, 400, C["teal"], 14)
img, d = dark_header(img, d, "A SOLUCAO", "Lex Defensor: contestacao por algoritmo auditavel, sem alucinacao")
rect(d, 0, 0, 8, H, C["orange"])

# bloco esquerdo
rect(d, 56, 148, 660, 880, C["card_d"], radius=14)
rect(d, 56, 148, 8, 880, C["orange"])
txt(d, 90, 178, "Lex Defensor", size=48, color=C["white"], bold=True)
rect(d, 90, 240, 340, 5, C["orange"])
txt_wrapped(d, 90, 266,
    "Mapeia os fatos do processo as teses cabiveis, "
    "cruza a narrativa autoral com os subsidios do cliente "
    "e monta a contestacao por algoritmo auditavel. "
    "A peca sempre sai.",
    580, size=27, color=C["pgray"], line_gap=42)

fases4 = [("Preparatoria",C["prep"]),("Analises",C["analises"]),
          ("Defesas",C["defesas"]),("Merito",C["merito"])]
for i, (name, col) in enumerate(fases4):
    fy = 580 + i * 86
    rect(d, 90, fy, 560, 66, C["navy_d"], radius=8)
    rect(d, 90, fy, 7, 66, col)
    txt(d, 116, fy + 33, f"Fase {i+1}: {name}", size=26, color=C["white"], bold=True, anchor="lm")

# bullets direita
bullets = [
    ("01", "Extrai pedidos, partes, causa de pedir e datas da inicial (PDF ou texto) em segundos."),
    ("02", "Cruza a narrativa autoral com os subsidios do cliente para apontar contradicoes e lacunas."),
    ("03", "Sugere preliminares (Art. 337 CPC), prejudiciais e teses de merito com base de conhecimento."),
    ("04", "Calcula prescricao, verifica ordem de datas e detecta conflitos entre teses aceitas."),
    ("05", "Gera a peca final estruturada com cada argumento rastreavel a tese e ao subsidio de origem."),
]
for i, (num, desc) in enumerate(bullets):
    bx, by, bw, bh = 760, 152 + i * 174, 1108, 154
    rect(d, bx, by, bw, bh, C["card_d"], radius=12)
    circle(d, bx + 52, by + bh//2, 38, C["orange"])
    txt(d, bx + 52, by + bh//2, num, size=22, color=C["white"], bold=True, anchor="mm")
    txt_wrapped(d, bx + 112, by + 24, desc, bw - 136, size=26, color=C["pgray"])

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDES 4-9: TELAS (mock screens)
# ══════════════════════════════════════════════════════════════════════════

def screen_frame(img, d):
    """Desenha o frame do browser e retorna as coordenadas da area util."""
    sx, sy, sw, sh = 188, 128, 1544, 896
    # sombra
    shadow = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([sx-8, sy-8, sx+sw+8, sy+sh+8], radius=16, fill=(0,0,0,55))
    merged = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")
    d2 = ImageDraw.Draw(merged)
    # card
    rect(d2, sx, sy, sw, sh, C["lighter"], radius=14)
    # chrome
    rect(d2, sx, sy, sw, 38, C["navy_d"])
    rect(d2, sx, sy + 26, sw, 12, C["navy_d"])
    for ci, col in enumerate([(205,50,40),(220,180,40),(40,180,80)]):
        circle(d2, sx + 20 + ci * 22, sy + 19, 7, col)
    rect(d2, sx + 82, sy + 7, sw - 164, 24, C["card_d"], radius=4)
    txt(d2, sx + 82 + (sw-164)//2, sy + 19, "app.lexdefensor.com.br",
        size=14, color=C["pgray"], anchor="mm")
    return merged, d2, sx, sy + 38, sw, sh - 38

# ── TELA 1: Landing Page ─────────────────────────────────────────────────
img, d = new_slide(C["navy_d"])
img = glow(img, 960, 580, 700, 600, C["teal"], 10)
img, d = dark_header(img, d, "TELA 01 / 06", "Landing Page -- hero e fases do raciocinio juridico")
rect(d, 0, 0, 8, H, C["orange"])

img, d, sx, sy, sw, sh = screen_frame(img, d)

# nav
rect(d, sx, sy, sw, 54, C["lighter"])
txt(d, sx+28, sy+27, "Lex Defensor", size=23, color=C["navy"], bold=True, anchor="lm")
for i, (nav, highlight) in enumerate([("Ver fluxograma",False),("Comecar um caso",True)]):
    nx = sx + sw - 380 + i*196
    nw = 180
    rect(d, nx, sy+11, nw, 32, C["navy"] if highlight else C["light"], radius=6)
    txt(d, nx+nw//2, sy+27, nav, size=15, color=C["white"] if highlight else C["navy"], anchor="mm")

# hero bg gradient
hy = sy + 54
for yi in range(340):
    t = yi / 340
    r2 = int(C["lighter"][0]*(1-t*0.07))
    g2 = int(C["lighter"][1]*(1-t*0.06))
    b2 = int(C["lighter"][2]*(1-t*0.05))
    d.line([(sx, hy+yi),(sx+sw, hy+yi)], fill=(r2,g2,b2))

# badge
rect(d, sx+32, hy+22, 410, 26, C["light"], radius=13)
txt(d, sx+32+205, hy+35, "Excelencia juridica  |  Solucoes inovadoras", size=14, color=C["muted"], anchor="mm")

txt(d, sx+32, hy+64,  "Da inicial aos pedidos finais,", size=42, color=C["navy"], bold=True)
txt(d, sx+32, hy+118, "em fases visuais com", size=42, color=C["orange"], bold=True)
txt(d, sx+32, hy+172, "engenharia juridica deterministica.", size=42, color=C["orange"], bold=True)

rect(d, sx+32, hy+256, 212, 44, C["navy"], radius=7)
txt(d, sx+32+106, hy+278, "Comecar um caso", size=17, color=C["white"], bold=True, anchor="mm")
rect(d, sx+258, hy+256, 190, 44, C["light"], radius=7)
txt(d, sx+258+95, hy+278, "Ver fluxograma", size=17, color=C["navy"], anchor="mm")

# 4 phase cards
pcw2 = (sw - 72) // 4 - 10
pcy2 = hy + 332
phase_info = [("Preparatoria",C["prep"],"Extracao de pedidos e partes"),
              ("Analises",C["analises"],"Cruzamento com subsidios"),
              ("Defesas",C["defesas"],"Preliminares e prejudiciais"),
              ("Merito",C["merito"],"Refutacoes ponto a ponto")]
for i,(pn,pc,pd) in enumerate(phase_info):
    pcx2 = sx+32+i*(pcw2+14)
    rect(d, pcx2, pcy2, pcw2, 196, C["white"], radius=8)
    rect(d, pcx2, pcy2, pcw2, 7, pc)
    circle(d, pcx2+28, pcy2+44, 18, pc)
    txt(d, pcx2+16, pcy2+72, pn, size=19, color=C["navy"], bold=True)
    txt_wrapped(d, pcx2+12, pcy2+100, pd, pcw2-24, size=15, color=C["muted"])

# caption
rect(d, sx, sy+sh, sw, 44, C["card_d"], radius=0)
txt(d, sx+sw//2, sy+sh+22,
    "Landing page com hero serif, fases coloridas e acesso direto ao workspace",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ── TELA 2: Autenticacao ─────────────────────────────────────────────────
img, d = new_slide(C["navy_d"])
img, d = dark_header(img, d, "TELA 02 / 06", "Tela de autenticacao -- acesso seguro por e-mail / Google")
rect(d, 0, 0, 8, H, C["orange"])
img, d, sx, sy, sw, sh = screen_frame(img, d)

# bg
for yi in range(sh):
    t = yi/sh
    r2=int(C["lighter"][0]*(1-t*0.05)); g2=int(C["lighter"][1]*(1-t*0.05)); b2=int(C["lighter"][2]*(1-t*0.05))
    d.line([(sx,sy+yi),(sx+sw,sy+yi)],fill=(r2,g2,b2))

cw2=520; cx2=sx+(sw-cw2)//2; cy2=sy+80; ch2=640
rect(d, cx2, cy2, cw2, ch2, C["white"], radius=14)
layer2=Image.new("RGBA",(W,H),(0,0,0,0)); ld2=ImageDraw.Draw(layer2)
ld2.rounded_rectangle([cx2,cy2,cx2+cw2,cy2+ch2],radius=14,fill=(0,0,0,0),outline=(*C["border"],180),width=1)
img=Image.alpha_composite(img.convert("RGBA"),layer2).convert("RGB"); d=ImageDraw.Draw(img)

# logo no card
img = paste_logo(img, white=False, x=cx2+(cw2-200)//2, y=cy2+28, target_w=200)
d = ImageDraw.Draw(img)
txt(d, cx2+cw2//2, cy2+148, "Faca login para continuar", size=18, color=C["muted"], anchor="mm")

for i,(lbl,ph) in enumerate([("E-mail","seu@ruedaadvocacia.com.br"),("Senha","*****************")]):
    fy2=cy2+188+i*112
    txt(d, cx2+40, fy2, lbl, size=18, color=C["navy"], bold=True)
    rect(d, cx2+40, fy2+26, cw2-80, 48, C["light"], radius=6)
    rect(d, cx2+40, fy2+26, cw2-80, 48, C["light"], radius=6, outline=C["border"], outline_w=1)
    txt(d, cx2+56, fy2+50, ph, size=17, color=C["muted"], anchor="lm")

rect(d, cx2+40, cy2+450, cw2-80, 52, C["navy"], radius=8)
txt(d, cx2+cw2//2, cy2+476, "Entrar", size=22, color=C["white"], bold=True, anchor="mm")
rect(d, cx2+40, cy2+516, cw2-80, 1, C["border"])
txt(d, cx2+cw2//2, cy2+535, "ou continue com", size=15, color=C["muted"], anchor="mm")
rect(d, cx2+40, cy2+552, cw2-80, 44, C["light"], radius=8)
txt(d, cx2+cw2//2, cy2+574, "Continuar com Google", size=17, color=C["navy"], anchor="mm")

rect(d, sx, sy+sh, sw, 44, C["card_d"])
txt(d, sx+sw//2, sy+sh+22, "Autenticacao gerenciada pelo Supabase Auth -- zero segredos no navegador",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ── TELA 3: Lista de Casos ───────────────────────────────────────────────
img, d = new_slide(C["navy_d"])
img, d = dark_header(img, d, "TELA 03 / 06", "Dashboard de casos -- visao geral da banca")
rect(d, 0, 0, 8, H, C["orange"])
img, d, sx, sy, sw, sh = screen_frame(img, d)

rect(d, sx, sy, sw, sh, C["light"])
rect(d, sx, sy, sw, 64, C["white"])
txt(d, sx+32, sy+32, "Meus casos", size=28, color=C["navy"], bold=True, anchor="lm")
rect(d, sx+sw-344, sy+14, 148, 36, C["navy"], radius=6)
txt(d, sx+sw-270, sy+32, "+ Novo caso", size=17, color=C["white"], bold=True, anchor="mm")
rect(d, sx+sw-182, sy+14, 148, 36, C["light"], radius=6)
txt(d, sx+sw-108, sy+32, "Caso demonstrativo", size=15, color=C["navy"], anchor="mm")
txt(d, sx+32, sy+78, "Cada caso percorre as fases Preparatoria > Analises > Defesas > Merito.",
    size=17, color=C["muted"])

casos_data = [
    ("Banco do Brasil v. Ferreira", 3, "ha 2 dias"),
    ("CEF v. Rodrigues",            2, "ha 5 dias"),
    ("Bradesco v. Lima",            4, "ha 1 hora"),
    ("Itau v. Santos",              1, "ha 3 horas"),
    ("Santander v. Costa",          2, "ha 1 semana"),
    ("Tribunal TJ-SP v. Pereira",   3, "ha 12 horas"),
]
ccw=(sw-80-32)//3
for idx,(ct,cf,cti) in enumerate(casos_data):
    col_i=idx%3; row_i=idx//3
    ccx=sx+32+col_i*(ccw+16); ccy=sy+112+row_i*(240+14)
    rect(d, ccx, ccy, ccw, 234, C["white"], radius=9)
    fcol=[C["prep"],C["analises"],C["defesas"],C["merito"]][cf-1]
    rect(d, ccx+14, ccy+16, 96, 24, fcol, radius=12)
    txt(d, ccx+62, ccy+28, f"Fase {cf}/4", size=14, color=C["white"], bold=True, anchor="mm")
    txt(d, ccx+ccw-14, ccy+22, cti, size=13, color=C["muted"], anchor="rm")
    txt_wrapped(d, ccx+18, ccy+56, ct, ccw-36, size=22, color=C["navy"], bold=True)
    prog=int((ccw-48)*cf/4)
    rect(d, ccx+18, ccy+196, ccw-36, 8, C["light"], radius=4)
    rect(d, ccx+18, ccy+196, prog, 8, fcol, radius=4)
    txt(d, ccx+18, ccy+214, f"{cf*25}% completo", size=13, color=C["muted"])

rect(d, sx, sy+sh, sw, 44, C["card_d"])
txt(d, sx+sw//2, sy+sh+22, "Grid responsivo de casos com barra de progresso por fase e acoes rapidas",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ── TELA 4: Workspace Fase 1 Preparatoria ───────────────────────────────
img, d = new_slide(C["navy_d"])
img, d = dark_header(img, d, "TELA 04 / 06", "Workspace -- Fase 1: Preparatoria (extracao automatica da inicial)")
rect(d, 0, 0, 8, H, C["orange"])
img, d, sx, sy, sw, sh = screen_frame(img, d)

rect(d, sx, sy, sw, sh, C["light"])
rect(d, sx, sy, sw, 52, C["white"])
txt(d, sx+28, sy+26, "Banco do Brasil v. Ferreira", size=22, color=C["navy"], bold=True, anchor="lm")
txt(d, sx+sw-28, sy+26, "Fase 1 de 4", size=17, color=C["muted"], anchor="rm")

step_w=sw//4
for i,(pn,pl,pc,ac) in enumerate([("1","Preparatoria",C["prep"],True),
                                   ("2","Analises",C["analises"],False),
                                   ("3","Defesas",C["defesas"],False),
                                   ("4","Merito",C["merito"],False)]):
    px2=sx+i*step_w; bg2=pc if ac else C["light"]
    rect(d, px2, sy+52, step_w, 48, bg2)
    rect(d, px2, sy+52, step_w, 4, pc)
    fc2=C["white"] if ac else C["muted"]
    txt(d, px2+step_w//2, sy+76, f"{pn}. {pl}", size=19, color=fc2, bold=ac, anchor="mm")

panel_y=sy+108; lw=700; rw=sw-lw-12
rect(d, sx, panel_y, lw, sh-108, C["white"])
txt(d, sx+18, panel_y+16, "Texto da inicial (petição inicial do autor)", size=17, color=C["navy"], bold=True)
rect(d, sx+18, panel_y+46, lw-36, 420, C["light"], radius=6)
for li,line in enumerate(["EXMO. SR. DR. JUIZ DE DIREITO DA VARA CIVEL",
    "","JOAO CARLOS FERREIRA, brasileiro, casado, CPF..., vem,",
    "por meio de seu advogado, propor ACAO DE INDENIZACAO",
    "POR DANOS MORAIS E MATERIAIS em face do BANCO DO BRASIL","",
    "I. DOS FATOS","O autor mantem conta corrente junto a re ha mais de 10 anos.",
    "Em 15/03/2024, foram realizadas cobranças indevidas no valor",
    "de R$ 2.500,00 sem autorizacao do autor..."]):
    txt(d, sx+32, panel_y+56+li*36, line, size=15,
        color=C["navy"] if li in (0,6) else C["muted"])
rect(d, sx+18, panel_y+484, lw-36, 48, C["navy"], radius=6)
txt(d, sx+18+(lw-36)//2, panel_y+508, "Analisar com IA  (Fase 1)",
    size=17, color=C["white"], bold=True, anchor="mm")

rect(d, sx+lw+12, panel_y, rw, sh-108, C["white"])
txt(d, sx+lw+28, panel_y+16, "Dados extraidos pela IA", size=17, color=C["navy"], bold=True)
for i,(lbl,val) in enumerate([("Autor","Joao Carlos Ferreira"),("Reu","Banco do Brasil S/A"),
    ("Causa","Cobranças indevidas -- dano moral e material"),("Valor","R$ 12.500,00"),
    ("Data fato","15/03/2024"),("Ajuizamento","10/06/2024  (85 dias -- ok)"),
    ("Pedidos","Devolucao + danos morais")]):
    ey=panel_y+50+i*94
    rect(d, sx+lw+28, ey, rw-44, 74, C["light"], radius=6)
    rect(d, sx+lw+28, ey, 4, 74, C["prep"])
    txt(d, sx+lw+44, ey+14, lbl, size=14, color=C["muted"], bold=True)
    txt_wrapped(d, sx+lw+44, ey+38, val, rw-68, size=17, color=C["navy"])

rect(d, sx, sy+sh, sw, 44, C["card_d"])
txt(d, sx+sw//2, sy+sh+22,
    "Extracao automatica de partes, pedidos, causa de pedir, datas e valor da causa via Claude AI",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ── TELA 5: Workspace Fase 3 Defesas ────────────────────────────────────
img, d = new_slide(C["navy_d"])
img, d = dark_header(img, d, "TELA 05 / 06", "Workspace -- Fase 3: Defesas (teses sugeridas, aceitas e rejeitadas)")
rect(d, 0, 0, 8, H, C["orange"])
img, d, sx, sy, sw, sh = screen_frame(img, d)

rect(d, sx, sy, sw, sh, C["light"])
rect(d, sx, sy, sw, 52, C["white"])
txt(d, sx+28, sy+26, "Banco do Brasil v. Ferreira", size=22, color=C["navy"], bold=True, anchor="lm")
txt(d, sx+sw-28, sy+26, "Fase 3 de 4", size=17, color=C["muted"], anchor="rm")

for i,(pn,pl,pc,ac) in enumerate([("1","Preparatoria",C["prep"],False),
                                   ("2","Analises",C["analises"],False),
                                   ("3","Defesas",C["defesas"],True),
                                   ("4","Merito",C["merito"],False)]):
    px2=sx+i*(sw//4); bg2=pc if ac else C["light"]
    rect(d, px2, sy+52, sw//4, 48, bg2)
    rect(d, px2, sy+52, sw//4, 4, pc)
    txt(d, px2+sw//8, sy+76, f"{pn}. {pl}", size=19,
        color=C["white"] if ac else C["muted"], bold=ac, anchor="mm")

hdr_y=sy+108
rect(d, sx, hdr_y, sw, 50, C["white"])
txt(d, sx+28, hdr_y+25, "Teses sugeridas (6) -- aceite ou rejeite antes de gerar a peca",
    size=17, color=C["navy"], bold=True, anchor="lm")
rect(d, sx+sw-220, hdr_y+10, 192, 30, C["navy"], radius=6)
txt(d, sx+sw-124, hdr_y+25, "Aceitar todas", size=15, color=C["white"], bold=True, anchor="mm")

cat_colors2={"preliminar":C["defesas"],"prejudicial":C["analises"],"merito":C["merito"]}
teses_list=[
    ("preliminar","Ilegitimidade passiva","Contrato cedido. Reu correto seria o cessionario.",True),
    ("preliminar","Inepcia da inicial","Causa de pedir nao descreve nexo causal.",False),
    ("prejudicial","Prescricao trienal","Data fato: 15/03/2024. Ajuizamento: 10/06/2024. Ok.",True),
    ("prejudicial","Coisa julgada","Nao ha evidencia de processo anterior identico.",False),
    ("merito","Culpa exclusiva do autor","Movimentacoes autorizadas via token digital.",True),
    ("merito","Ausencia de dano moral","Dissabor nao configura lesao a dignidade.",False),
]
tcw2=(sw-72-16)//2
for idx,(cat,title,desc,aceita) in enumerate(teses_list):
    ci=idx%2; ri=idx//2
    tcx=sx+32+ci*(tcw2+16); tcy=hdr_y+68+ri*230
    tcol=cat_colors2[cat]
    rect(d, tcx, tcy, tcw2, 210, C["white"], radius=8)
    rect(d, tcx, tcy, tcw2, 5, tcol)
    rect(d, tcx+14, tcy+16, 120, 22, tcol, radius=11)
    txt(d, tcx+74, tcy+27, cat.upper(), size=12, color=C["white"], bold=True, anchor="mm")
    txt(d, tcx+148, tcy+22, title, size=19, color=C["navy"], bold=True)
    txt_wrapped(d, tcx+14, tcy+52, desc, tcw2-28, size=16, color=C["muted"])
    btn_col=C["merito"] if aceita else C["muted"]
    btn_txt="Aceita" if aceita else "Rejeitada"
    rect(d, tcx+tcw2-142, tcy+164, 128, 32, btn_col, radius=16)
    txt(d, tcx+tcw2-78, tcy+180, btn_txt, size=15, color=C["white"], bold=True, anchor="mm")
    if not aceita:
        rect(d, tcx+14, tcy+164, 106, 32, C["light"], radius=16)
        txt(d, tcx+67, tcy+180, "Aceitar", size=15, color=C["navy"], anchor="mm")

rect(d, sx, sy+sh, sw, 44, C["card_d"])
txt(d, sx+sw//2, sy+sh+22,
    "Teses codificadas em base de conhecimento juridico -- conflitos detectados automaticamente",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ── TELA 6: Fluxograma ───────────────────────────────────────────────────
img, d = new_slide(C["navy_d"])
img, d = dark_header(img, d, "TELA 06 / 06", "Fluxograma -- mapa visual de teses defensivas (base de conhecimento)")
rect(d, 0, 0, 8, H, C["orange"])
img, d, sx, sy, sw, sh = screen_frame(img, d)

rect(d, sx, sy, sw, sh, C["lighter"])
rect(d, sx, sy, sw, 50, C["white"])
txt(d, sx+28, sy+25, "Fluxograma de teses defensivas", size=22, color=C["navy"], bold=True, anchor="lm")
txt(d, sx+sw-28, sy+25, "Lex Defensor -- base de conhecimento", size=15, color=C["muted"], anchor="rm")

# root node
rx=sx+sw//2-100; ry=sy+70; rw2=200; rh2=44
rect(d, rx, ry, rw2, rh2, C["navy"], radius=8)
txt(d, rx+rw2//2, ry+22, "Defesa Civel", size=19, color=C["white"], bold=True, anchor="mm")

cats_flow=[("Preliminares",C["defesas"],sx+100),
           ("Prejudiciais",C["analises"],sx+sw//2-105),
           ("Merito",C["merito"],sx+sw-310)]
cat_w2=200; cat_y=sy+190

for cname,ccol,cx6 in cats_flow:
    d.line([(rx+rw2//2,ry+rh2),(cx6+cat_w2//2,cat_y)],fill=ccol,width=2)
    rect(d, cx6, cat_y, cat_w2, 42, ccol, radius=8)
    txt(d, cx6+cat_w2//2, cat_y+21, cname, size=17, color=C["white"], bold=True, anchor="mm")

leaf_teses2=[
    [("Ilegitimidade passiva",C["defesas"]),("Inepcia da inicial",C["defesas"]),("Incompetencia",C["defesas"])],
    [("Prescricao trienal",C["analises"]),("Coisa julgada",C["analises"]),("Litispendencia",C["analises"])],
    [("Culpa do autor",C["merito"]),("Ausencia de dano",C["merito"]),("Fortuito externo",C["merito"])],
]
lw2=196; lh2=40
cat_xs=[sx+100, sx+sw//2-105, sx+sw-310]
for ci,(leafs,(_,ccol2,cx6)) in enumerate(zip(leaf_teses2,cats_flow)):
    for li,(lname2,lc2) in enumerate(leafs):
        lx6=cx6-lw2+li*(lw2+10)+(cat_w2-lw2)//2-10
        ly6=sy+326
        d.line([(cx6+cat_w2//2,cat_y+42),(lx6+lw2//2,ly6)],fill=lc2,width=1)
        rect(d, lx6, ly6, lw2, lh2, C["white"], radius=6)
        rect(d, lx6, ly6, lw2, 4, lc2)
        txt(d, lx6+lw2//2, ly6+22, lname2, size=13, color=C["navy"], anchor="mm")

# info bar
rect(d, sx+80, sy+440, sw-160, 58, C["white"], radius=8)
rect(d, sx+80, sy+440, sw-160, 5, C["navy"])
txt(d, sx+sw//2, sy+470,
    "Base: 18 argumentos  |  Conflito automatico  |  Calculo de prescricao  |  Sugestao por IA",
    size=18, color=C["muted"], anchor="mm")

# legend
legend_y=sy+534
for i2,(ln2,lc2) in enumerate([("Preliminar",C["defesas"]),("Prejudicial",C["analises"]),
                                ("Merito",C["merito"]),("Aceita",C["green"]),("Rejeitada",C["muted"])]):
    lx2=sx+60+i2*270
    circle(d, lx2, legend_y+14, 10, lc2)
    txt(d, lx2+18, legend_y, ln2, size=16, color=C["navy"])

rect(d, sx, sy+sh, sw, 44, C["card_d"])
txt(d, sx+sw//2, sy+sh+22,
    "Visualizacao interativa com React Flow -- nos coloridos por categoria juridica",
    size=19, color=C["pgray"], anchor="mm")

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 10 -- BENEFICIOS
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["lighter"])
img, d = light_header(img, d, "BENEFICIOS", "Impacto mensuravel para a banca")
rect(d, 0, 0, 8, H, C["orange"])

benefits = [
    ("80%",    "menos tempo",    "Contestacoes de rotina que levavam 3 dias ficam prontas em 4-6 horas com revisao final do advogado.",    C["orange"]),
    ("100%",   "teses cobertas", "Nenhuma preliminar, prejudicial ou tese de merito esquecida -- base validada a cada novo caso.",           C["prep"]),
    ("4x",     "mais rastreavel","Cada argumento na peca final aponta a tese e ao subsidio de origem. Auditoria e revisao sao triviais.",    C["analises"]),
    ("Zero",   "alucinacoes",    "Algoritmo determinisitco: a IA sugere, o advogado decide. Nenhuma jurisprudencia inventada.",              C["defesas"]),
    ("Escala", "sem limite",     "De 1 advogado a 100: mesma base de conhecimento, mesma qualidade de defesa garantida para todos.",         C["merito"]),
]
cw3=(W-112-64)//5
for i,(metric,sub,desc,col) in enumerate(benefits):
    cx3=56+i*(cw3+16); cy3=148
    rect(d, cx3, cy3, cw3, 876, C["white"], radius=12)
    rect(d, cx3, cy3, cw3, 7, col)
    txt(d, cx3+cw3//2, cy3+96,  metric, size=78, color=col, bold=True, anchor="mm")
    txt(d, cx3+cw3//2, cy3+152, sub,    size=24, color=C["muted"], anchor="mm")
    rect(d, cx3+30, cy3+184, cw3-60, 2, C["light"])
    txt_wrapped(d, cx3+24, cy3+204, desc, cw3-48, size=21, color=C["navy"])

footer_bar(d, dark=False)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 11 -- TECNOLOGIA
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["navy_d"])
img = glow(img, 1700, 200, 400, 400, C["teal"], 14)
img, d = dark_header(img, d, "TECNOLOGIA", "Stack proprietario e componentes de IA do Lex Defensor")
rect(d, 0, 0, 8, H, C["orange"])

tech=[
    ("Claude AI","Anthropic",
     "LLM de ultima geracao para extracao de dados juridicos, sugestao de teses e geracao da peca final. Prompts estruturados garantem saida deterministica.",
     C["orange"]),
    ("TanStack Start","React SSR Full-Stack",
     "Framework full-stack com SSR. Carregamento de dados no servidor -- nenhum dado sensivel exposto ao navegador do cliente.",
     C["prep"]),
    ("Supabase","PostgreSQL + Auth",
     "Banco relacional gerenciado com Row Level Security. Cada caso isolado por usuario -- zero vazamento entre clientes.",
     C["analises"]),
    ("React Flow","Visualizacao de grafos",
     "Renderizacao interativa do fluxograma de teses com nos coloridos por categoria: preliminar, prejudicial, merito.",
     C["defesas"]),
    ("Algoritmo Deterministico","Engenharia juridica",
     "Logica de conflito entre teses, calculo de prescricao, avaliacao de qualidade da peca e progresso por fase -- 100% auditavel.",
     C["merito"]),
]
cw4=(W-112-64)//5
for i,(name5,sub5,desc5,col5) in enumerate(tech):
    cx4=56+i*(cw4+16)
    rect(d, cx4, 148, cw4, 876, C["card_d"], radius=12)
    rect(d, cx4, 148, cw4, 7, col5)
    circle(d, cx4+cw4//2, 240, 52, col5)
    txt(d, cx4+cw4//2, 240, str(i+1), size=46, color=C["white"], bold=True, anchor="mm")
    txt(d, cx4+cw4//2, 318, name5, size=24, color=C["white"], bold=True, anchor="mm")
    txt(d, cx4+cw4//2, 354, sub5,  size=17, color=col5, anchor="mm")
    rect(d, cx4+30, 382, cw4-60, 2, C["navy_l"])
    txt_wrapped(d, cx4+24, 400, desc5, cw4-48, size=19, color=C["pgray"])

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 12 -- PROXIMOS PASSOS / CTA
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["navy_d"])
img = glow(img, 1500, 540, 700, 700, C["orange"], 26)
img = glow(img, 300,  200, 400, 400, C["teal"],   14)
d = ImageDraw.Draw(img)

rect(d, 0, 0, 10, H, C["orange"])
rect(d, 0, 0, W, 8, C["orange"])
orange_tag(d, 56, 42, "PROXIMOS PASSOS")
txt(d, 56, 96, "Como comecar com o Lex Defensor", size=48, color=C["white"], bold=True)
img = paste_logo(img, white=True, x=W-300, y=22, target_w=240)
d = ImageDraw.Draw(img)

steps3=[
    ("01","Workshop de alinhamento (1 dia)",
     "Reuniao com a banca para mapear os tipos de caso mais frequentes, definir criterios de qualidade e configurar a base de teses para o perfil da advocacia."),
    ("02","POC com casos reais (30 dias)",
     "Ativacao da plataforma com ate 20 casos acompanhados por analista Avantti. Medicao de reducao de tempo e avaliacao de qualidade das pecas geradas."),
    ("03","Licenca mensal a partir de R$ 1.900",
     "Ao final do POC, assinatura do plano adequado. Suporte dedicado, atualizacoes mensais da base de teses e treinamento da equipe inclusos."),
]
for i,(num,title,desc) in enumerate(steps3):
    bx=56+i*604; bw=572; bh=670
    rect(d, bx, 200, bw, bh, C["card_d"], radius=14)
    rect(d, bx, 200, bw, 7, C["orange"])
    circle(d, bx+bw//2, 296, 56, C["orange"])
    txt(d, bx+bw//2, 296, num, size=38, color=C["white"], bold=True, anchor="mm")
    txt_wrapped(d, bx+32, 372, title, bw-64, size=30, color=C["white"], bold=True)
    txt_wrapped(d, bx+32, 464, desc, bw-64, size=23, color=C["pgray"])

rect(d, 56, 918, W-112, 96, C["orange_d"], radius=12)
rect(d, 56, 918, 8, 96, C["amber"])
txt(d, 86, 944, "contato@ruedaadvocacia.com.br  |  (11) 9 9999-0000  |  ruedaerueda.com.br",
    size=26, color=C["white"], bold=True)
txt(d, 86, 984, "Agende uma demonstracao gratuita com um caso real da sua banca", size=21, color=C["amber"])

footer_bar(d, dark=True)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 13 -- POC
# Referencia ABES 2024: POC AI enterprise juridico = R$ 12.000 a R$ 30.000
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["lighter"])
img, d = light_header(img, d, "PASSO 1 -- POC", "Prova de Conceito -- valor unico, sem recorrencia")
rect(d, 0, 0, 8, H, C["orange"])

# POC card
rect(d, 56, 148, 640, 818, C["navy_d"], radius=14)
rect(d, 56, 148, 8, 818, C["orange"])
txt(d, 376, 228, "POC", size=50, color=C["pgray"], bold=True, anchor="mm")
txt(d, 376, 306, "R$ 12.000", size=88, color=C["orange"], bold=True, anchor="mm")
txt(d, 376, 364, "pagamento unico · sem recorrencia", size=22, color=C["pgray"], anchor="mm")
rect(d, 96, 384, 536, 2, C["navy_l"])
txt(d, 376, 414, "REF ABES 2024: R$ 12k - R$ 30k  (piso competitivo)", size=18, color=C["pgray"], bold=True, anchor="mm")

poc_buls=["Ate 20 casos reais auditados com Claude AI",
          "30 dias corridos apos kick-off",
          "Workshop de alinhamento juridico (1 dia)",
          "1 especialista dedicado ao projeto",
          "Base de teses configurada para o perfil da banca",
          "Relatorio final: ROI medido + recomendacao de plano"]
for i,b in enumerate(poc_buls):
    by2=446+i*74
    circle(d, 96, by2+18, 12, C["orange"])
    txt(d, 118, by2, b, size=23, color=C["pgray"])

phases_poc=[("Semana 1","Workshop de alinhamento e configuracao da base de teses"),
            ("Semanas 2-4","Auditoria de 20 casos reais com analista Avantti dedicado"),
            ("Semana 5","Relatorio de ROI, qualidade das pecas e recomendacao de plano")]
for i,(week,desc) in enumerate(phases_poc):
    py3=166+i*182; pw3=1124; ph3=154
    rect(d, 740, py3, pw3, ph3, C["white"], radius=10)
    rect(d, 740, py3, 8, ph3, C["orange"])
    circle(d, 800, py3+ph3//2, 38, C["navy_d"])
    txt(d, 800, py3+ph3//2, str(i+1), size=28, color=C["orange"], bold=True, anchor="mm")
    txt(d, 858, py3+28, week.upper(), size=22, color=C["navy"], bold=True)
    txt_wrapped(d, 858, py3+66, desc, pw3-130, size=26, color=C["muted"])

rect(d, 740, 722, 1124, 116, C["navy_d"], radius=12)
rect(d, 740, 722, 8, 116, C["orange"])
txt(d, 766, 748, "Apos o POC --> Licenca Mensal a partir de", size=26, color=C["pgray"], bold=True)
txt(d, 766, 796, "R$ 1.900/mes  (Plano Starter -- sem custo adicional de setup)", size=30, color=C["orange"], bold=True)

rect(d, 56, 884, 640, 100, C["light"], radius=10)
rect(d, 56, 884, 8, 100, C["gray"])
txt(d, 80, 906, "Referencia de mercado (ABES 2024):", size=21, color=C["navy"], bold=True)
txt(d, 80, 940, "POC AI enterprise juridico: R$ 12.000 a R$ 30.000 / 30-60 dias", size=20, color=C["muted"])

footer_bar(d, dark=False)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 14 -- PLATAFORMA POS-POC
# Referencia ABES 2024: software juridico AI B2B = R$ 1.500 a R$ 8.000/mes
# Gartner Peer Insights 2024: legal AI platforms = USD 500 a USD 3.000/mes
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["lighter"])
img, d = light_header(img, d, "PASSO 2 -- PLATAFORMA POS-POC",
                       "Licenca Mensal · Atualizacoes Inclusas · Suporte Dedicado")
rect(d, 0, 0, 8, H, C["orange"])

rect(d, 56, 134, W-112, 62, C["navy_d"], radius=10)
rect(d, 56, 134, 6, 62, C["orange"])
txt(d, 80, 152, "LICENCA MENSAL POR BANCA  (nao por advogado -- sem fidelidade anual)", size=24, color=C["orange"], bold=True)
txt(d, 80, 186, "Setup cobrado uma unica vez na ativacao  |  Harvey AI custa R$ 6.000/advogado/mes  --  Lex Defensor: ate 18x mais acessivel",
    size=20, color=C["pgray"])

tiers2=[
    {"name":"Starter",  "sub":"Ate 3 advogados · 50 casos/mes",
     "lic":"R$ 1.900",  "yr":"R$ 22.800/ano",
     "setup":"Setup unico: R$ 7.500",
     "cmp":"Harvey eq.: R$ 18.000/mes",
     "saving":"9x mais barato",
     "pop":False,
     "items":["Ate 3 usuarios ativos","Base de teses padrao (18 arg.)","Relatorios mensais","Suporte ticket (SLA 48h)"]},
    {"name":"Business", "sub":"Ate 15 advogados · 200 casos/mes",
     "lic":"R$ 4.900",  "yr":"R$ 58.800/ano",
     "setup":"Setup unico: R$ 15.000",
     "cmp":"Harvey eq.: R$ 90.000/mes",
     "saving":"18x mais barato",
     "pop":True,
     "items":["Ate 15 usuarios ativos","Base de teses customizada","API REST + integracoes","Suporte 8x5 (SLA 8h)"]},
    {"name":"Enterprise","sub":"Ate 50 advogados · ilimitado",
     "lic":"R$ 9.900",  "yr":"R$ 118.800/ano",
     "setup":"Setup: R$ 28.000",
     "cmp":"Harvey eq.: R$ 300.000/mes",
     "saving":"30x mais barato",
     "pop":False,
     "items":["Ate 50 usuarios + SLA 99,9%","Base customizada + treinamento","Suporte 24x7 (SLA 2h)","Gestor de conta dedicado"]},
]

card_w2=(W-112-48)//3; cy5=230; ch5=790
for i,t2 in enumerate(tiers2):
    cx5=56+i*(card_w2+24); hl2=t2["pop"]
    bg5=C["navy_d"] if hl2 else C["white"]

    if hl2:
        layer5=Image.new("RGBA",(W,H),(0,0,0,0)); ld5=ImageDraw.Draw(layer5)
        ld5.rounded_rectangle([cx5-3,cy5-3,cx5+card_w2+3,cy5+ch5+3],
                               radius=15,fill=(0,0,0,0),outline=(*C["orange"],210),width=3)
        img=Image.alpha_composite(img.convert("RGBA"),layer5).convert("RGB")
        d=ImageDraw.Draw(img)

    rect(d, cx5, cy5, card_w2, ch5, bg5, radius=14)
    rect(d, cx5, cy5, card_w2, 7, C["orange"])

    fc5=C["white"] if hl2 else C["navy"]
    fc5m=C["pgray"] if hl2 else C["muted"]

    txt(d, cx5+card_w2//2, cy5+52, t2["name"], size=38, color=fc5, bold=True, anchor="mm")
    txt(d, cx5+card_w2//2, cy5+88, t2["sub"],  size=22, color=fc5m, anchor="mm")

    # licenca box
    lb_top=cy5+108; lb_h=148
    lb_bg=C["dark"] if hl2 else C["light"]
    rect(d, cx5+24, lb_top, card_w2-48, lb_h, lb_bg, radius=10)
    rect(d, cx5+24, lb_top, card_w2-48, 5, C["orange"])
    txt(d, cx5+card_w2//2, lb_top+28, "LICENCA MENSAL / BANCA", size=17, color=C["orange"], bold=True, anchor="mm")
    txt(d, cx5+card_w2//2, lb_top+86, t2["lic"], size=54,
        color=C["orange"] if hl2 else C["navy"], bold=True, anchor="mm")
    txt(d, cx5+card_w2//2, lb_top+128, "("+t2["yr"]+")", size=19, color=fc5m, anchor="mm")

    # setup box
    sb_top=lb_top+lb_h+10
    sb_bg=C["card_d"] if hl2 else C["light"]
    rect(d, cx5+24, sb_top, card_w2-48, 58, sb_bg, radius=8)
    txt(d, cx5+card_w2//2, sb_top+20, t2["setup"],                   size=20, color=fc5m, anchor="mm")
    txt(d, cx5+card_w2//2, sb_top+44, "pagamento unico na ativacao", size=17, color=fc5m, anchor="mm")

    # comparativo Harvey box
    cmp_top=sb_top+58+8
    cmp_bg=(32,18,12) if hl2 else (255,245,240)
    rect(d, cx5+24, cmp_top, card_w2-48, 56, cmp_bg, radius=8)
    rect(d, cx5+24, cmp_top, card_w2-48, 4, C["orange_d"])
    txt(d, cx5+card_w2//2, cmp_top+16, t2["cmp"], size=16, color=C["pgray"], anchor="mm")
    # saving badge
    sw_w=int(ImageDraw.Draw(Image.new("RGB",(1,1))).textlength(t2["saving"], font=fnt(16,True)))+20
    rect(d, cx5+card_w2//2-sw_w//2, cmp_top+30, sw_w, 22, C["green"], radius=11)
    txt(d, cx5+card_w2//2, cmp_top+41, t2["saving"], size=14, color=C["white"], bold=True, anchor="mm")

    # features
    ft_top=cmp_top+56+12
    rect(d, cx5+40, ft_top, card_w2-80, 2, C["orange"] if hl2 else C["border"])
    for j2,item2 in enumerate(t2["items"]):
        iy2=ft_top+14+j2*84
        circle(d, cx5+58, iy2+16, 13, C["orange"])
        txt(d, cx5+58, iy2+16, "V", size=12, color=C["white"], bold=True, anchor="mm")
        txt(d, cx5+84, iy2, item2, size=22, color=fc5)

    if hl2:
        mid5=cx5+card_w2//2
        rect(d, mid5-100, cy5-40, 200, 34, C["green"], radius=17)
        txt(d, mid5, cy5-23, "MAIS POPULAR", size=18, color=C["white"], bold=True, anchor="mm")

rect(d, 0, H-46, W, 46, C["lighter"])
txt(d, 56, H-23,
    "Ref: ABES 2024 R$ 1.500-8.000/mes  |  Gartner 2024 USD 500-3.000/mes  |  Harvey AI USD 1.200/adv/mes  |  CoCounsel USD 220-500/mes",
    size=16, color=C["muted"], anchor="lm")
txt(d, W-56, H-23, "ruedaerueda.com.br", size=16, color=C["muted"], anchor="rm")
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SLIDE 15 -- MANUTENCAO
# Referencia: manutencao anual SaaS enterprise Brasil = 15% a 25% (ABES 2024)
# ══════════════════════════════════════════════════════════════════════════
img, d = new_slide(C["lighter"])
img, d = light_header(img, d, "POS-VENDA", "Manutencao & Suporte -- Preco de Mercado")
rect(d, 0, 0, 8, H, C["orange"])

maint2=[
    {"tier":"Basico","pct":"15%","base":"ao ano sobre licenca","pop":False,
     "items":["Correcoes criticas (bug fix)","Atualizacoes de seguranca",
              "Suporte via ticket (SLA 48h)","1 revisao de teses/ano"]},
    {"tier":"Standard","pct":"20%","base":"ao ano sobre licenca","pop":True,
     "items":["Tudo do Basico","Atualizacoes de features",
              "Suporte 8x5 (SLA 8h)","2 revisoes de teses/ano",
              "Treinamento anual da equipe"]},
    {"tier":"Premium","pct":"25%","base":"ao ano sobre licenca","pop":False,
     "items":["Tudo do Standard","Suporte 24x7 (SLA 2h)",
              "Gestor de sucesso dedicado","Revisoes trimestrais de teses",
              "Evolucoes customizadas Claude AI"]},
]
cw6=(W-112-48)//3; ch6=700
for i,m2 in enumerate(maint2):
    cx6=56+i*(cw6+24); cy6=148; hl3=m2["pop"]
    bg6=C["navy_d"] if hl3 else C["white"]
    rect(d, cx6, cy6, cw6, ch6, bg6, radius=12)
    rect(d, cx6, cy6, cw6, 7, C["orange"])
    fc6=C["white"] if hl3 else C["navy"]
    fc6m=C["pgray"] if hl3 else C["muted"]
    txt(d, cx6+cw6//2, cy6+56,  m2["tier"], size=34, color=fc6, bold=True, anchor="mm")
    txt(d, cx6+cw6//2, cy6+172, m2["pct"],  size=92,
        color=C["orange"] if hl3 else C["navy_l"], bold=True, anchor="mm")
    txt(d, cx6+cw6//2, cy6+228, m2["base"], size=22, color=fc6m, anchor="mm")
    rect(d, cx6+40, cy6+262, cw6-80, 2, C["orange"] if hl3 else C["border"])
    for j3,item3 in enumerate(m2["items"]):
        iy3=cy6+282+j3*80
        circle(d, cx6+44, iy3+18, 13, C["orange"])
        txt(d, cx6+44, iy3+18, "V", size=12, color=C["white"], bold=True, anchor="mm")
        txt(d, cx6+68, iy3, item3, size=22, color=fc6)
    if hl3:
        mid6=cx6+cw6//2
        rect(d, mid6-100, cy6-40, 200, 32, C["green"], radius=16)
        txt(d, mid6, cy6-24, "RECOMENDADO", size=17, color=C["white"], bold=True, anchor="mm")

rect(d, 56, 892, W-112, 96, C["light"], radius=10)
rect(d, 56, 892, 8, 96, C["gray"])
txt(d, 80, 914, "Referencia de mercado SaaS enterprise Brasil (Gartner / ABES 2024):", size=24, color=C["navy"], bold=True)
txt(d, 80, 950, "Manutencao anual: 15% a 25% da licenca -- inclui SLA, suporte e atualizacoes da base de conhecimento juridico",
    size=21, color=C["muted"])

footer_bar(d, dark=False)
slides.append(img)

# ══════════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════════
print(f"Salvando {len(slides)} slides...")
slides[0].save(OUT, save_all=True, append_images=slides[1:], resolution=150)
print(f"OK  {OUT}  ({len(slides)} paginas)")
