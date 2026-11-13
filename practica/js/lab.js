import crearElemento from "./dom.js";

const seleccionar = (id) => document.getElementById(id);
const registro = seleccionar("registro");
const resumen = seleccionar("resumenRegistro");
const linea = seleccionar("lineaEstado");
const significado = seleccionar("significado");
const cabeceras = seleccionar("cabeceras");
const cuerpo = seleccionar("cuerpo");
const historial = [];
const filtros = document.querySelectorAll("[data-filtro]");
let filtro = 0;
let generacion = 0;

export function clasificar(estado) {
  const familia = Math.floor(estado / 100);
  if (familia === 2) return { clase: "exito", texto: "2xx · Éxito" };
  if (familia === 3) return { clase: "redireccion", texto: "3xx · Redirección o validación de caché" };
  if (familia === 4) return { clase: "error-cliente", texto: "4xx · Error del cliente" };
  if (familia === 5) return { clase: "error-servidor", texto: "5xx · Error del servidor" };
  return { clase: "sin-respuesta", texto: "Sin respuesta HTTP disponible" };
}

function mostrarRespuesta({ metodo, respuesta, texto, error }) {
  seleccionar("sinRespuesta").hidden = true;
  seleccionar("detalle").hidden = false;
  const estado = respuesta?.status ?? 0;
  const familia = clasificar(estado);
  linea.textContent = respuesta ? `HTTP ${estado} ${respuesta.statusText}`.trim() : "Sin respuesta";
  significado.className = familia.clase;
  significado.textContent = familia.texto;
  cabeceras.replaceChildren();
  if (!respuesta) {
    cuerpo.textContent = `Comprueba Live Server, la red o los permisos CORS. ${error.message}`;
    return;
  }

  for (const [nombre, valor] of respuesta.headers) {
    const elemento = crearElemento("li");
    elemento.append(crearElemento("strong", { texto: `${nombre}: ` }), valor);
    cabeceras.append(elemento);
  }

  cuerpo.textContent = texto.slice(0, 300) || "(respuesta sin cuerpo)";
  if (error) {
    cuerpo.textContent = `No se pudo leer el cuerpo. ${error.message}`;
  } else if (metodo === "HEAD") {
    cuerpo.textContent = "(sin cuerpo: HEAD solo pide las cabeceras)";
  } else if (respuesta.ok && respuesta.headers.get("Content-Type")?.includes("json")) {
    try {
      const datos = JSON.parse(texto);
      if (Array.isArray(datos)) {
        const recurso = new URL(respuesta.url).pathname.endsWith("/data/productos.json") ? "productos" : "elementos";
        cuerpo.textContent = `Se recibieron ${datos.length} ${recurso} en formato JSON.\n\n${texto.slice(0, 300)}`;
      }
    } catch {
      cuerpo.textContent = `El cuerpo no contiene JSON válido.\n\n${texto.slice(0, 300)}`;
    }
  }
}

function actualizarRegistro() {
  let exitos = 0;
  let tiempoTotal = 0;
  for (const { fila, estado, ms } of historial) {
    const familia = Math.floor(estado / 100);
    fila.hidden = filtro !== 0 && filtro !== familia;
    exitos += Number(familia === 2);
    tiempoTotal += ms;
  }
  const total = historial.length;
  resumen.textContent = total
    ? `${total} peticiones · ${exitos} con éxito (2xx) · ${total - exitos} sin éxito · Promedio: ${(tiempoTotal / total).toFixed(1)} ms`
    : "";
}

function registrar({ metodo, url, estado, tipo, bytes, ms }) {
  const fila = crearElemento("tr");
  for (const valor of [historial.length + 1, metodo, url]) {
    fila.append(crearElemento("td", { texto: valor }));
  }
  const celda = crearElemento("td");
  celda.append(crearElemento("span", { clase: `estado ${clasificar(estado).clase}`, texto: estado || "—" }));
  fila.append(celda);
  for (const valor of [tipo, bytes === null ? "—" : `${bytes} B`, `${Math.round(ms)} ms`]) {
    fila.append(crearElemento("td", { texto: valor }));
  }
  historial.push({ fila, estado, ms });
  registro.append(fila);
  actualizarRegistro();
}

async function pedir(metodo, url) {
  const generacionInicial = generacion;
  const inicio = performance.now();
  let respuesta;
  let texto = "";
  let bytes = 0;
  let error;
  try {
    respuesta = await fetch(url, { method: metodo, cache: "no-store" });
    if (metodo !== "HEAD") {
      const contenido = await respuesta.arrayBuffer();
      bytes = contenido.byteLength;
      texto = new TextDecoder().decode(contenido);
    }
  } catch (fallo) {
    error = fallo;
    bytes = null;
  }

  if (generacionInicial !== generacion) return;
  registrar({
    metodo, url, bytes,
    estado: respuesta?.status ?? 0,
    tipo: respuesta?.headers.get("Content-Type") ?? "—",
    ms: performance.now() - inicio,
  });
  mostrarRespuesta({ metodo, respuesta, texto, error });
}

document.querySelector(".rapidos").addEventListener("click", (evento) => {
  const boton = evento.target.closest("[data-metodo]");
  if (boton) pedir(boton.dataset.metodo, boton.dataset.url);
});

seleccionar("formPeticion").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const url = seleccionar("url").value.trim();
  if (url) pedir(seleccionar("metodo").value, url);
});

for (const boton of filtros) {
  boton.addEventListener("click", () => {
    filtro = Number(boton.dataset.filtro);
    for (const opcion of filtros) opcion.setAttribute("aria-pressed", String(opcion === boton));
    actualizarRegistro();
  });
}

seleccionar("btnLimpiar").addEventListener("click", () => {
  generacion++;
  historial.length = 0;
  registro.replaceChildren();
  actualizarRegistro();
});
