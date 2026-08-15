from pathlib import Path
from shutil import copyfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "manual-trazabilidad.pdf"
PUBLIC = ROOT / "public" / "manual" / "manual-trazabilidad.pdf"
LOGO = ROOT / "public" / "brand" / "finning-cat-logo.png"
SCREENS = ROOT / "docs" / "manual" / "screenshots"

YELLOW = colors.HexColor("#FFCD00")
YELLOW_DARK = colors.HexColor("#9A7A00")
BLACK = colors.HexColor("#080B0D")
INK = colors.HexColor("#14181A")
MUTED = colors.HexColor("#687178")
LINE = colors.HexColor("#D9DDDF")
SOFT = colors.HexColor("#F3F5F5")
WHITE = colors.white
GREEN = colors.HexColor("#17864B")
RED = colors.HexColor("#C8423A")


def header_footer(canvas, doc):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(BLACK)
    canvas.rect(0, height - 20 * mm, width, 20 * mm, stroke=0, fill=1)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, height - 21.2 * mm, width, 1.2 * mm, stroke=0, fill=1)
    if LOGO.exists():
        canvas.drawImage(
            str(LOGO),
            18 * mm,
            height - 16.2 * mm,
            width=38 * mm,
            height=10 * mm,
            preserveAspectRatio=True,
            mask="auto",
        )
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(width - 18 * mm, height - 12 * mm, "MANUAL VISUAL DEL SISTEMA")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 9 * mm, "Finning CAT / Bodega Neuquen")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "ManualTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=27,
    leading=30,
    textColor=INK,
    spaceAfter=7,
)
SUBTITLE = ParagraphStyle(
    "ManualSubtitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=15,
    textColor=MUTED,
    spaceAfter=13,
)
H1 = ParagraphStyle(
    "ManualH1",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=19,
    leading=22,
    textColor=INK,
    spaceAfter=8,
)
H2 = ParagraphStyle(
    "ManualH2",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=11.5,
    leading=14,
    textColor=INK,
    spaceBefore=8,
    spaceAfter=5,
)
BODY = ParagraphStyle(
    "ManualBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9,
    leading=13,
    textColor=INK,
    spaceAfter=6,
)
SMALL = ParagraphStyle(
    "ManualSmall",
    parent=BODY,
    fontSize=7.8,
    leading=10.5,
    textColor=MUTED,
)
KICKER = ParagraphStyle(
    "ManualKicker",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=7.5,
    leading=9,
    textColor=YELLOW_DARK,
    spaceAfter=4,
)
STEP = ParagraphStyle(
    "ManualStep",
    parent=BODY,
    leftIndent=7 * mm,
    firstLineIndent=-7 * mm,
    bulletIndent=0,
    spaceAfter=6,
)
LEGEND = ParagraphStyle(
    "ManualLegend",
    parent=SMALL,
    fontSize=7.6,
    leading=10,
    textColor=INK,
)
PHONE_CAPTION = ParagraphStyle(
    "PhoneCaption",
    parent=SMALL,
    alignment=TA_CENTER,
    fontName="Helvetica-Bold",
    textColor=INK,
)


class ScreenshotFigure(Flowable):
    """Draw a screenshot with numbered markers without modifying the bitmap."""

    def __init__(self, path, width, height, markers=None):
        super().__init__()
        self.path = str(path)
        self.width = width
        self.height = height
        self.markers = markers or []

    def draw(self):
        reader = ImageReader(self.path)
        source_w, source_h = reader.getSize()
        scale = min(self.width / source_w, self.height / source_h)
        draw_w = source_w * scale
        draw_h = source_h * scale
        x = (self.width - draw_w) / 2
        y = (self.height - draw_h) / 2

        self.canv.setFillColor(BLACK)
        self.canv.roundRect(0, 0, self.width, self.height, 2 * mm, stroke=0, fill=1)
        self.canv.drawImage(reader, x, y, draw_w, draw_h, preserveAspectRatio=True, mask="auto")
        self.canv.setStrokeColor(colors.HexColor("#31383C"))
        self.canv.setLineWidth(0.7)
        self.canv.roundRect(0, 0, self.width, self.height, 2 * mm, stroke=1, fill=0)

        for number, nx, ny in self.markers:
            cx = x + nx * draw_w
            cy = y + (1 - ny) * draw_h
            radius = 3.8 * mm
            self.canv.setFillColor(YELLOW)
            self.canv.setStrokeColor(BLACK)
            self.canv.setLineWidth(1)
            self.canv.circle(cx, cy, radius, stroke=1, fill=1)
            self.canv.setFillColor(BLACK)
            self.canv.setFont("Helvetica-Bold", 8)
            self.canv.drawCentredString(cx, cy - 2.7, str(number))


def section(kicker, title, intro=None):
    result = [Paragraph(kicker.upper(), KICKER), Paragraph(title, H1)]
    if intro:
        result.append(Paragraph(intro, SUBTITLE))
    return result


def steps(items):
    return [
        Paragraph(f'<font color="#9A7A00"><b>{index}.</b></font> {text}', STEP)
        for index, text in enumerate(items, 1)
    ]


def callout(title, text, color=YELLOW):
    cell = Paragraph(f"<b>{title}</b><br/>{text}", BODY)
    table = Table([[cell]], colWidths=[165 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LINEBEFORE", (0, 0), (0, -1), 4, color),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def screenshot(path_name, height_mm, markers, legends):
    path = SCREENS / path_name
    figure = ScreenshotFigure(path, 165 * mm, height_mm * mm, markers)
    legend_cells = []
    for number, text in legends:
        legend_cells.append(
            Paragraph(
                f'<font color="#9A7A00"><b>{number}</b></font>&nbsp;&nbsp;{text}',
                LEGEND,
            )
        )
    columns = 2 if len(legend_cells) > 1 else 1
    if columns == 2 and len(legend_cells) % 2:
        legend_cells.append(Paragraph("", LEGEND))
    rows = [legend_cells[i : i + columns] for i in range(0, len(legend_cells), columns)]
    widths = [82.5 * mm] * columns
    legend = Table(rows, colWidths=widths)
    legend.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return [figure, Spacer(1, 2.5 * mm), legend]


def role_matrix():
    rows = [
        [Paragraph("ROL", SMALL), Paragraph("ACCESO PRINCIPAL", SMALL), Paragraph("PUEDE HACER", SMALL)],
        [Paragraph("<b>Administracion</b>", BODY), Paragraph("Entregas, Revision, Nueva, Dia, Requisitos y Usuarios", BODY), Paragraph("Crear, editar, asignar, revisar, cerrar y eliminar", BODY)],
        [Paragraph("<b>Picking</b>", BODY), Paragraph("Entregas, Tablero y Ayuda", BODY), Paragraph("Tomar entregas, cargar fotos, observar y marcar lista", BODY)],
        [Paragraph("<b>Supervisor</b>", BODY), Paragraph("Entregas, Revision, Dia, Tablero y Ayuda", BODY), Paragraph("Consultar operacion e informes sin modificar datos", BODY)],
    ]
    table = Table(rows, colWidths=[34 * mm, 69 * mm, 62 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BLACK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SOFT]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def state_flow():
    states = [
        ("BORRADOR", "Admin prepara"),
        ("PUBLICADA", "Picking puede verla"),
        ("EN PICKING", "Carga en curso"),
        ("LISTA", "Admin revisa"),
        ("CERRADA", "Circuito finalizado"),
    ]
    cells = []
    for index, (title, subtitle) in enumerate(states):
        cells.append(Paragraph(f"<b>{title}</b><br/><font size=7 color='#687178'>{subtitle}</font>", PHONE_CAPTION))
        if index < len(states) - 1:
            cells.append(Paragraph("<b>></b>", PHONE_CAPTION))
    widths = []
    for index in range(len(cells)):
        widths.append(29 * mm if index % 2 == 0 else 5 * mm)
    table = Table([cells], colWidths=widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def phone_flow():
    phone_files = [
        ("08-picking-lista-mobile.png", "1. Elegir la entrega"),
        ("09-picking-detalle-mobile.png", "2. Ver que falta"),
        ("10-picking-carga-mobile.png", "3. Sacar o elegir foto"),
    ]
    images = []
    captions = []
    for filename, caption in phone_files:
        img = Image(str(SCREENS / filename), width=49 * mm, height=106 * mm, kind="proportional")
        images.append(img)
        captions.append(Paragraph(caption, PHONE_CAPTION))
    table = Table([images, captions], colWidths=[55 * mm, 55 * mm, 55 * mm])
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), BLACK),
                ("BOX", (0, 0), (-1, 0), 0.6, BLACK),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, 0), 5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                ("TOPPADDING", (0, 1), (-1, 1), 6),
            ]
        )
    )
    return table


def faq_table(items):
    rows = [[Paragraph(f"<b>{question}</b>", BODY), Paragraph(answer, BODY)] for question, answer in items]
    table = Table(rows, colWidths=[55 * mm, 110 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, SOFT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def require_assets():
    required = [
        "01-login.png",
        "02-admin-panel.png",
        "03-admin-nueva.png",
        "05-admin-revision.png",
        "06-supervision-dia.png",
        "07-picking-escritorio.png",
        "08-picking-lista-mobile.png",
        "09-picking-detalle-mobile.png",
        "10-picking-carga-mobile.png",
    ]
    missing = [name for name in required if not (SCREENS / name).exists()]
    if missing:
        raise FileNotFoundError(f"Faltan capturas para el manual: {', '.join(missing)}")


def build_manual():
    require_assets()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=28 * mm,
        bottomMargin=20 * mm,
        title="Manual visual del sistema de trazabilidad",
        author="Finning CAT - Bodega Neuquen",
        subject="Instructivo visual para Administracion, Picking y Supervisor",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="manual")
    doc.addPageTemplates([PageTemplate(id="manual", frames=[frame], onPage=header_footer)])

    story = []
    story += section(
        "Trazabilidad de entregas",
        "Manual visual operativo",
        "Guia practica para Administracion, Picking y Supervisor. Version 2.0 - Agosto 2026.",
    )
    story += screenshot(
        "01-login.png",
        93,
        [(1, 0.78, 0.36), (2, 0.78, 0.67), (3, 0.79, 0.82)],
        [
            (1, "Ingresar con el email y la contraseña asignados."),
            (2, "El rol determina automaticamente las opciones visibles."),
            (3, "En el primer ingreso puede solicitarse una clave nueva."),
        ],
    )
    story += [Spacer(1, 5 * mm), callout("Idea central", "El numero de entrega es la referencia principal. Usalo para buscar, compartir el enlace y pedir ayuda."), PageBreak()]

    story += section("Para todos", "Accesos y circuito de trabajo", "Cada persona ve solamente las herramientas necesarias para su tarea.")
    story += [role_matrix(), Spacer(1, 6 * mm), Paragraph("Estados de una entrega", H2), state_flow(), Spacer(1, 6 * mm)]
    story += steps(
        [
            "Abrir la aplicacion e ingresar con las credenciales asignadas.",
            "Usar Cuenta para cambiar la contraseña y Salir al terminar en un equipo compartido.",
            "Buscar siempre por numero de entrega. El mismo numero aparece en el enlace del navegador.",
            "Consultar Ayuda desde el menu para volver a este instructivo.",
        ]
    )
    story += [callout("Primer ingreso", "Si el sistema solicita cambiar la contraseña, completar ese paso antes de continuar. La clave temporal deja de servir."), PageBreak()]

    story += section("Rol Administracion", "Panel de control", "Esta es la pantalla principal para controlar carga, prioridades y alertas.")
    story += screenshot(
        "02-admin-panel.png",
        98,
        [(1, 0.055, 0.27), (2, 0.45, 0.28), (3, 0.48, 0.52), (4, 0.89, 0.48)],
        [
            (1, "Menu principal: Entregas, Revision, Nueva, Dia y configuracion."),
            (2, "Indicadores para detectar trabajo activo, listas y observaciones."),
            (3, "Buscador y filtros para encontrar una entrega rapidamente."),
            (4, "Atencion ahora destaca urgencias y observaciones abiertas."),
        ],
    )
    story += [Spacer(1, 5 * mm), callout("Rutina recomendada", "Empezar por Atencion ahora, revisar entregas Lista y luego controlar las operaciones En Picking."), PageBreak()]

    story += section("Rol Administracion", "Crear y publicar una entrega", "Nueva concentra los datos operativos y los requisitos que debera documentar Picking.")
    story += screenshot(
        "03-admin-nueva.png",
        100,
        [(1, 0.38, 0.31), (2, 0.57, 0.31), (3, 0.49, 0.52), (4, 0.47, 0.79)],
        [
            (1, "Ingresar el numero de entrega sin espacios."),
            (2, "Elegir modalidad, prioridad, bultos y responsable."),
            (3, "Agregar observaciones solo cuando aporten contexto."),
            (4, "Revisar requisitos y decidir entre borrador o publicada."),
        ],
    )
    story += steps(
        [
            "Guardar como borrador si todavia faltan datos.",
            "Publicar cuando Picking ya pueda comenzar.",
            "Desde el detalle se puede editar, duplicar o reasignar.",
        ]
    )
    story += [PageBreak()]

    story += section("Rol Administracion", "Revisar fotos y cerrar", "La entrega Lista pasa a Revision para aceptar o rechazar cada evidencia.")
    story += screenshot(
        "05-admin-revision.png",
        98,
        [(1, 0.33, 0.28), (2, 0.35, 0.55), (3, 0.21, 0.72), (4, 0.34, 0.87)],
        [
            (1, "Cada tarjeta corresponde a un requisito."),
            (2, "Abrir la foto para comprobar encuadre y legibilidad."),
            (3, "Aceptar una evidencia correcta."),
            (4, "Rechazar indicando un motivo claro para Picking."),
        ],
    )
    story += [Spacer(1, 4 * mm), callout("Cierre", "Cuando todas las evidencias esten correctas, volver al detalle y usar Cerrar. Si hace falta corregir, usar Devolver."), Spacer(1, 3 * mm), callout("Eliminar", "Eliminar entrega esta en el panel Acciones. Hay que escribir el numero para confirmar; fotos e historial quedan conservados."), PageBreak()]

    story += section("Supervisor y Administracion", "Seguimiento y cierre del dia", "Dia resume la operacion historica y permite detectar entregas que siguen abiertas.")
    story += screenshot(
        "06-supervision-dia.png",
        98,
        [(1, 0.52, 0.24), (2, 0.48, 0.42), (3, 0.34, 0.67), (4, 0.90, 0.24)],
        [
            (1, "Elegir fecha con formato DD/MM/AAAA."),
            (2, "Leer volumen, fotos, listas y observaciones."),
            (3, "Identificar operaciones que quedaron abiertas."),
            (4, "Exportar Excel para analisis o archivo."),
        ],
    )
    story += [Spacer(1, 5 * mm), callout("Supervisor", "Es un rol de consulta: puede ver Entregas, Revision, Dia, Tablero e informes, pero no crea, edita, revisa ni elimina datos."), PageBreak()]

    story += section("Rol Picking", "Bandeja de entregas", "Picking trabaja principalmente desde el celular, aunque la misma informacion esta disponible en escritorio.")
    story += screenshot(
        "07-picking-escritorio.png",
        98,
        [(1, 0.42, 0.32), (2, 0.44, 0.43), (3, 0.46, 0.70), (4, 0.55, 0.82)],
        [
            (1, "Buscar por numero o destino."),
            (2, "Alternar entre Todas, Mias y Libres."),
            (3, "Leer prioridad, estado y requisitos pendientes."),
            (4, "Abrir la entrega que se va a preparar."),
        ],
    )
    story += [Spacer(1, 5 * mm), callout("Asignacion", "Si la entrega esta libre, tocar La tomo yo. Si pertenece a otra persona, consultar antes de intervenir."), PageBreak()]

    story += section("Rol Picking", "Carga de fotos desde el celular", "El flujo completo se resuelve en tres pantallas.")
    story += [phone_flow(), Spacer(1, 6 * mm)]
    story += steps(
        [
            "Abrir una entrega y revisar el aviso que indica que requisito falta.",
            "Tocar Subir foto en el requisito correspondiente.",
            "Elegir una imagen o abrir la camara, revisar la vista previa y subir.",
            "Esperar la confirmacion sin cerrar la pantalla.",
            "Repetir hasta completar los obligatorios y tocar Marcar lista.",
        ]
    )
    story += [callout("Foto util", "Mostrar el documento o bulto completo, evitar reflejos y confirmar que el contenido se lea. La aplicacion optimiza la imagen antes de enviarla."), PageBreak()]

    story += section("Ayuda", "Problemas frecuentes y cierre diario")
    story += [
        faq_table(
            [
                ("No aparece una entrega", "Buscar por numero y revisar filtros. Los borradores solo aparecen en Administracion."),
                ("No puedo marcar lista", "Todavia falta al menos una foto obligatoria. El aviso superior indica cual."),
                ("La foto no sube", "Comprobar la conexion, elegirla nuevamente y esperar sin cerrar la pantalla."),
                ("No aparece Eliminar", "Solo se muestra a Administracion dentro del detalle, en Acciones."),
                ("La clave no funciona", "Verificar el email. Administracion puede restablecerla desde Usuarios."),
                ("Hay que corregir una cerrada", "Administracion puede usar Reabrir y dejar el motivo en el historial."),
            ]
        ),
        Spacer(1, 6 * mm),
        Paragraph("Checklist rapido", H2),
    ]
    story += steps(
        [
            "No dejar entregas Lista sin revisar.",
            "Resolver o documentar observaciones abiertas.",
            "Confirmar que cada entrega cerrada tenga las fotos necesarias.",
            "Consultar Dia para identificar operaciones abiertas.",
            "Cerrar sesion en equipos compartidos.",
        ]
    )
    story += [Spacer(1, 5 * mm), callout("Pedir soporte", "Informar numero de entrega, rol del usuario, pantalla donde ocurrio y una captura si fuera posible.", color=GREEN)]

    doc.build(story)
    copyfile(OUTPUT, PUBLIC)
    print(f"Generated {OUTPUT}")
    print(f"Published {PUBLIC}")


if __name__ == "__main__":
    build_manual()
