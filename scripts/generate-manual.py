from pathlib import Path
from shutil import copyfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
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

YELLOW = colors.HexColor("#FFCD00")
BLACK = colors.HexColor("#080B0D")
INK = colors.HexColor("#14181A")
MUTED = colors.HexColor("#687178")
LINE = colors.HexColor("#D9DDDF")
SOFT = colors.HexColor("#F3F5F5")
WHITE = colors.white


def header_footer(canvas, doc):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(BLACK)
    canvas.rect(0, height - 20 * mm, width, 20 * mm, stroke=0, fill=1)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, height - 21.2 * mm, width, 1.2 * mm, stroke=0, fill=1)
    if LOGO.exists():
        canvas.drawImage(str(LOGO), 18 * mm, height - 16.2 * mm, width=38 * mm, height=10 * mm, preserveAspectRatio=True, mask="auto")
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(width - 18 * mm, height - 12 * mm, "MANUAL DEL SISTEMA")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 9 * mm, "Finning CAT / Bodega Neuquen")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
TITLE = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=26, leading=29, textColor=INK, spaceAfter=8)
SUBTITLE = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=16, textColor=MUTED, spaceAfter=18)
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=23, textColor=INK, spaceBefore=4, spaceAfter=12)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=INK, spaceBefore=12, spaceAfter=6)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=7)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=8, leading=11, textColor=MUTED)
KICKER = ParagraphStyle("Kicker", parent=BODY, fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=colors.HexColor("#9A7A00"), spaceAfter=5)
STEP = ParagraphStyle("Step", parent=BODY, leftIndent=7 * mm, firstLineIndent=-7 * mm, bulletIndent=0, spaceAfter=8)
CALLOUT = ParagraphStyle("Callout", parent=BODY, leftIndent=4 * mm, rightIndent=4 * mm, textColor=INK)


def section(kicker, title, intro=None):
    result = [Paragraph(kicker.upper(), KICKER), Paragraph(title, H1)]
    if intro:
        result.append(Paragraph(intro, SUBTITLE))
    return result


def steps(items):
    return [Paragraph(f'<font color="#9A7A00"><b>{index}.</b></font> {text}', STEP) for index, text in enumerate(items, 1)]


def callout(title, text):
    table = Table([[Paragraph(f"<b>{title}</b><br/>{text}", CALLOUT)]], colWidths=[165 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 4, YELLOW),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([table, Spacer(1, 5 * mm)])


def status_table():
    rows = [[Paragraph("ESTADO", SMALL), Paragraph("QUE SIGNIFICA", SMALL)]]
    data = [
        ("Borrador", "Administracion todavia esta preparando la entrega."),
        ("Publicada", "Ya puede ser tomada por Picking."),
        ("En Picking", "La preparacion y la carga de fotos estan en curso."),
        ("Lista", "Picking termino y Administracion debe revisar."),
        ("Cerrada", "El circuito finalizo y ya no admite nuevas fotos."),
    ]
    rows.extend([[Paragraph(f"<b>{name}</b>", BODY), Paragraph(description, BODY)] for name, description in data])
    table = Table(rows, colWidths=[40 * mm, 125 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SOFT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def faq_table(items):
    rows = []
    for question, answer in items:
        rows.append([Paragraph(f"<b>{question}</b>", BODY), Paragraph(answer, BODY)])
    table = Table(rows, colWidths=[58 * mm, 107 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, SOFT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def build_manual():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=29 * mm,
        bottomMargin=20 * mm,
        title="Manual del sistema de trazabilidad",
        author="Finning CAT - Bodega Neuquen",
        subject="Instructivo para Administracion, Picking y Supervisor",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="manual", frames=[frame], onPage=header_footer)])

    story = []
    story += section("Trazabilidad de entregas", "Manual operativo", "Instructivo para Administracion, Picking y Supervisor. Version 1.0 - Agosto 2026.")
    if LOGO.exists():
        logo = Image(str(LOGO), width=84 * mm, height=22 * mm, kind="proportional")
        logo.hAlign = "LEFT"
        story += [Spacer(1, 8 * mm), logo, Spacer(1, 12 * mm)]
    story += [
        callout("Objetivo", "Registrar cada entrega desde su alta hasta el cierre, con responsables, checklist, fotos e historial en un unico lugar."),
        Paragraph("Este manual explica que hace cada rol, el orden recomendado de trabajo y como resolver las situaciones mas frecuentes.", BODY),
        Spacer(1, 6 * mm),
        Paragraph("CONTENIDO", KICKER),
        Paragraph("1. Ingreso y conceptos basicos<br/>2. Administracion<br/>3. Picking<br/>4. Supervisor<br/>5. Problemas frecuentes y buenas practicas", BODY),
        PageBreak(),
    ]

    story += section("Para todos", "1. Ingreso y conceptos basicos", "La operacion es diaria y el numero de entrega es la referencia principal del sistema.")
    story += steps([
        "Abrir la aplicacion e ingresar con el email y la contraseña asignados.",
        "En el primer ingreso, crear una contraseña propia cuando el sistema lo solicite.",
        "Usar Cuenta para cambiar la clave y Salir al terminar en un equipo compartido.",
        "Identificar siempre la entrega por su numero. Ese numero tambien aparece en el enlace del navegador.",
    ])
    story += [Paragraph("Estados de una entrega", H2), status_table(), Spacer(1, 5 * mm)]
    story += [callout("Regla general", "No hace falta cargar dia ni hora de entrega. El tablero refleja el trabajo del dia y el historial conserva cuando ocurrio cada accion."), PageBreak()]

    story += section("Rol Administracion", "2. Crear y publicar una entrega", "Administracion controla los datos maestros, asigna responsables, revisa evidencias y cierra la operacion.")
    story += steps([
        "Entrar en Nueva.",
        "Completar numero, modalidad, destino o cliente, cantidad de bultos y prioridad.",
        "Revisar los requisitos propuestos. Marcar cuales aplican y cuales son obligatorios.",
        "Guardar como borrador si falta informacion o Publicar para enviarla a Picking.",
        "Desde el detalle, asignar un responsable cuando sea necesario.",
    ])
    story += [callout("Borrador o publicada", "El borrador solo se ve en Administracion. Una entrega publicada aparece en la bandeja de Picking."), PageBreak()]

    story += section("Rol Administracion", "3. Revisar, cerrar y eliminar", "El detalle de la entrega concentra todas las acciones disponibles.")
    story += steps([
        "Cuando la entrega figure Lista, abrir Revisar fotos.",
        "Aceptar cada imagen correcta. Si una foto no sirve, rechazarla e indicar el motivo.",
        "Usar Devolver cuando Picking tenga que corregir algo. El motivo queda visible y auditado.",
        "Cerrar cuando el checklist y las evidencias esten correctos.",
        "Usar Reabrir si una entrega cerrada necesita una correccion posterior.",
        "Usar Informe para descargar el PDF con datos, checklist, evidencias e historial.",
    ])
    story += [callout("Eliminar entrega", "Dentro del panel Acciones, tocar Eliminar entrega y escribir el numero para confirmar. Se quita de la operacion, pero conserva fotos e historial para una eventual recuperacion."),
              Paragraph("Otras herramientas", H2),
              Paragraph("Requisitos administra catalogos y plantillas. Usuarios crea cuentas, cambia roles, restablece claves y desactiva accesos. Dia muestra metricas historicas y exporta Excel. Duplicar crea un borrador nuevo a partir de una entrega existente.", BODY),
              PageBreak()]

    story += section("Rol Picking", "4. Preparar y cargar evidencias", "La interfaz de Picking esta pensada para trabajar desde el celular.")
    story += steps([
        "Abrir Entregas y elegir el numero que se va a preparar.",
        "Si no tiene responsable, tocar La tomo yo.",
        "Abrir el requisito pendiente y tocar Elegir o sacar foto.",
        "Revisar la vista previa, agregar un comentario si aporta contexto y tocar Subir foto.",
        "Esperar la confirmacion sin cerrar la pantalla y repetir hasta completar los obligatorios.",
        "Agregar una observacion si se detecta un problema.",
        "Cuando no queden requisitos obligatorios pendientes, tocar Marcar lista.",
    ])
    story += [callout("Fotos claras", "Encuadrar todo el documento o bulto, evitar reflejos y comprobar que el texto sea legible. La aplicacion optimiza la imagen antes de subirla."),
              callout("Correcciones", "Si Administracion devuelve la entrega, leer el motivo, reemplazar o completar las fotos y volver a marcarla como lista."),
              PageBreak()]

    story += section("Rol Supervisor", "5. Seguimiento operativo", "Supervisor consulta la operacion y descarga informes, sin modificar datos.")
    story += steps([
        "Entregas muestra estado, prioridad, responsable y avance.",
        "Revisar el detalle para consultar checklist, observaciones, fotos e historial.",
        "Revisión permite consultar las evidencias y su resultado.",
        "Dia presenta metricas historicas y las entregas que continuan abiertas.",
        "Tablero ofrece una vista resumida para seguimiento operativo.",
        "Informe descarga el PDF completo de una entrega.",
    ])
    story += [callout("Modo lectura", "Supervisor no crea, edita, asigna, revisa, cierra ni elimina entregas. Si hace falta una correccion debe solicitarla a Administracion."), PageBreak()]

    story += section("Ayuda", "6. Problemas frecuentes")
    story += [faq_table([
        ("No aparece una entrega", "Buscar por numero y revisar filtros. Los borradores solo son visibles para Administracion y las eliminadas no aparecen en la operacion."),
        ("No aparece Eliminar entrega", "Solo se muestra a Administracion y esta dentro del detalle, en el panel Acciones."),
        ("No puedo marcar como lista", "Falta al menos una foto obligatoria. El aviso superior indica cual."),
        ("La foto no sube", "Revisar la conexion, elegir nuevamente la imagen y esperar sin cerrar la pantalla."),
        ("La contraseña no funciona", "Verificar el email. Administracion puede restablecer la clave desde Usuarios."),
        ("Hay que corregir una cerrada", "Administracion puede usar Reabrir y dejar el motivo registrado."),
    ]), Spacer(1, 7 * mm), Paragraph("Checklist de cierre diario", H2)]
    story += steps([
        "No dejar entregas Lista sin revisar.",
        "Resolver o documentar observaciones abiertas.",
        "Confirmar que cada entrega cerrada tenga sus fotos necesarias.",
        "Consultar Dia para identificar operaciones que siguen abiertas.",
        "Cerrar sesion en equipos compartidos.",
    ])
    story += [Spacer(1, 8 * mm), callout("Soporte", "Al informar un problema, incluir el numero de entrega, el rol del usuario, la pantalla donde ocurrio y una captura si fuera posible.")]

    doc.build(story)
    copyfile(OUTPUT, PUBLIC)
    print(f"Generated {OUTPUT}")
    print(f"Published {PUBLIC}")


if __name__ == "__main__":
    build_manual()
