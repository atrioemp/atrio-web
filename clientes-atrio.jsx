import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Phone, Mail, Search, X, Store, Download, Calendar, ArrowUpDown, Sparkles, AlertCircle, Inbox, ExternalLink, ArrowRight, Menu, Check, Clock } from 'lucide-react';

const ESTADOS = [
  { key: 'por_contactar', label: 'Por contactar', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 border-slate-300' },
  { key: 'contactado', label: 'Contactado', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-300' },
  { key: 'interesado', label: 'Interesado', dot: 'bg-sky-400', pill: 'bg-sky-50 text-sky-700 border-sky-300' },
  { key: 'cerrado', label: 'Cerrado', dot: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { key: 'no_interesado', label: 'No interesado', dot: 'bg-rose-300', pill: 'bg-rose-50 text-rose-500 border-rose-200' },
];

const STORAGE_KEY = 'atrio:clientes';
const AGREGADOS_KEY = 'atrio:solicitudes-agregadas';
const ESTADO_SOLICITUDES_KEY = 'atrio:estado-solicitudes';

// Última vez que se trajeron las solicitudes desde Airtable (base "CLIENTES ATRIO", tabla SOLICITUDES).
// El artifact no puede llamar directamente a la API de Airtable (el sandbox bloquea peticiones
// a dominios externos), así que estos datos son una foto fija. Para traer solicitudes nuevas,
// pídele a Claude en el chat: "sincroniza las solicitudes" y te genero una versión actualizada.
const SOLICITUDES_SINCRONIZADAS = '10 ago 2026, 11:25';
const SOLICITUDES_INICIALES = [];

const SUGERENCIAS_INICIALES = [
  { id: 'sug-1', negocio: 'Electricistas 24 horas Madrid', tipo: 'Electricista', contacto: '+34 666 56 42 06', notas: 'Solo 3 reseñas en Google — negocio muy nuevo, buen candidato.' },
  { id: 'sug-2', negocio: 'Fontanero Centro Madrid', tipo: 'Fontanero', contacto: '+34 673 40 72 09', notas: '49 reseñas, buena valoración (4.8).' },
  { id: 'sug-3', negocio: 'ElectricistaMD en Madrid', tipo: 'Electricista', contacto: '+34 640 61 65 00', notas: '54 reseñas, algunas quejas de comunicación — podrías destacar profesionalidad.' },
  { id: 'sug-4', negocio: 'Dale Café', tipo: 'Cafetería', contacto: '', notas: 'Sin teléfono público en su ficha de Google — presencia online floja.' },
  { id: 'sug-5', negocio: 'Slow Café', tipo: 'Cafetería', contacto: '', notas: 'Sin teléfono público en su ficha de Google — presencia online floja.' },
];

function estadoInfo(key) {
  return ESTADOS.find((e) => e.key === key) || ESTADOS[0];
}

function esVencido(fechaProximoContacto) {
  if (!fechaProximoContacto) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(fechaProximoContacto) < hoy;
}

function formatearFecha(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

const MENU_OPCIONES = [
  { key: 'lista', label: 'Mi lista', icon: Store },
  { key: 'sugerencias', label: 'Sugerencias', icon: Sparkles },
  { key: 'solicitudes', label: 'Solicitudes', icon: Inbox },
];

export default function RastreadorClientes() {
  const [clientes, setClientes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [vista, setVista] = useState('lista');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sugerenciasUsadas, setSugerenciasUsadas] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [nuevo, setNuevo] = useState({ negocio: '', tipo: '', contacto: '', notas: '' });
  const menuRef = useRef(null);

  // Solicitudes recibidas por el formulario web (foto fija sincronizada desde Airtable)
  const [solicitudes] = useState(SOLICITUDES_INICIALES);
  const [estadoSolicitudes, setEstadoSolicitudes] = useState({});
  const [solicitudesAgregadas, setSolicitudesAgregadas] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setClientes(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res2 = await window.storage.get(AGREGADOS_KEY, false);
        if (res2 && res2.value) setSolicitudesAgregadas(JSON.parse(res2.value));
      } catch (e) {}
      try {
        const res3 = await window.storage.get(ESTADO_SOLICITUDES_KEY, false);
        if (res3 && res3.value) setEstadoSolicitudes(JSON.parse(res3.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    function fuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, []);

  async function guardar(lista) {
    setClientes(lista);
    setSaving(true);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(lista), false);
    } catch (e) {
      console.error('Error guardando', e);
    }
    setSaving(false);
  }

  async function guardarAgregadas(lista) {
    setSolicitudesAgregadas(lista);
    try {
      await window.storage.set(AGREGADOS_KEY, JSON.stringify(lista), false);
    } catch (e) {}
  }

  async function marcarEstadoSolicitud(id, estado) {
    const actualizado = { ...estadoSolicitudes, [id]: estado };
    setEstadoSolicitudes(actualizado);
    try {
      await window.storage.set(ESTADO_SOLICITUDES_KEY, JSON.stringify(actualizado), false);
    } catch (e) {}
  }

  function irA(vistaDestino) {
    setVista(vistaDestino);
    setMenuAbierto(false);
  }

  function agregarCliente() {
    if (!nuevo.negocio.trim()) return;
    const entrada = {
      id: Date.now().toString(),
      negocio: nuevo.negocio.trim(),
      tipo: nuevo.tipo.trim(),
      contacto: nuevo.contacto.trim(),
      notas: nuevo.notas.trim(),
      estado: 'por_contactar',
      fecha: new Date().toLocaleDateString('es-ES'),
      fechaOrden: Date.now(),
      proximoContacto: '',
    };
    guardar([entrada, ...clientes]);
    setNuevo({ negocio: '', tipo: '', contacto: '', notas: '' });
    setShowForm(false);
  }

  function agregarSugerencia(sug) {
    const entrada = {
      id: Date.now().toString(),
      negocio: sug.negocio,
      tipo: sug.tipo,
      contacto: sug.contacto,
      notas: sug.notas,
      estado: 'por_contactar',
      fecha: new Date().toLocaleDateString('es-ES'),
      fechaOrden: Date.now(),
      proximoContacto: '',
    };
    guardar([entrada, ...clientes]);
    setSugerenciasUsadas((prev) => [...prev, sug.id]);
  }

  function pasarSolicitudALista(registro) {
    const f = registro.fields || {};
    const nombre = f['Nombre'] || f['Name'] || '';
    const negocio = f['Negocio'] || nombre || 'Solicitud sin nombre';
    const contacto = f['Email'] || f['Telefono'] || '';
    const partesNotas = [];
    if (nombre && f['Negocio']) partesNotas.push(`Contacto: ${nombre}`);
    if (f['Plan']) partesNotas.push(`Plan: ${f['Plan']}`);
    if (f['Estilo']) partesNotas.push(`Estilo: ${f['Estilo']}`);
    if (f['Web de referencia']) partesNotas.push(`Referencia: ${f['Web de referencia']}`);
    if (f['Mensaje']) partesNotas.push(f['Mensaje']);
    const entrada = {
      id: Date.now().toString(),
      negocio,
      tipo: f['Tipo de negocio'] || '',
      contacto,
      notas: partesNotas.join(' · '),
      estado: 'por_contactar',
      fecha: new Date().toLocaleDateString('es-ES'),
      fechaOrden: Date.now(),
      proximoContacto: '',
    };
    guardar([entrada, ...clientes]);
    guardarAgregadas([...solicitudesAgregadas, registro.id]);
  }

  function cambiarEstado(id, estado) {
    guardar(clientes.map((c) => (c.id === id ? { ...c, estado } : c)));
  }

  function eliminar(id) {
    guardar(clientes.filter((c) => c.id !== id));
  }

  function actualizarCampo(id, campo, valor) {
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  }

  function guardarCampo(id, campo, valor) {
    guardar(clientes.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  }

  function exportarCSV() {
    const filas = [['Negocio', 'Tipo', 'Contacto', 'Estado', 'Próximo contacto', 'Notas', 'Añadido']];
    clientes.forEach((c) => {
      filas.push([c.negocio, c.tipo, c.contacto, estadoInfo(c.estado).label, c.proximoContacto || '', c.notas, c.fecha]);
    });
    const csv = filas.map((f) => f.map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes-atrio.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibles = useMemo(() => {
    let lista = clientes.filter((c) => {
      const pasaFiltro = filtro === 'todos' || c.estado === filtro;
      const pasaBusqueda = c.negocio.toLowerCase().includes(busqueda.toLowerCase());
      return pasaFiltro && pasaBusqueda;
    });
    if (orden === 'recientes') lista = [...lista].sort((a, b) => (b.fechaOrden || 0) - (a.fechaOrden || 0));
    if (orden === 'antiguos') lista = [...lista].sort((a, b) => (a.fechaOrden || 0) - (b.fechaOrden || 0));
    if (orden === 'proximo') lista = [...lista].sort((a, b) => {
      if (!a.proximoContacto) return 1;
      if (!b.proximoContacto) return -1;
      return new Date(a.proximoContacto) - new Date(b.proximoContacto);
    });
    return lista;
  }, [clientes, filtro, busqueda, orden]);

  const conteos = ESTADOS.reduce((acc, e) => {
    acc[e.key] = clientes.filter((c) => c.estado === e.key).length;
    return acc;
  }, {});

  const vencidos = clientes.filter((c) => esVencido(c.proximoContacto)).length;

  const totalSolicitudes = solicitudes.length;
  const pendientesSolicitudes = solicitudes.filter((r) => (estadoSolicitudes[r.id] || 'pendiente') === 'pendiente').length;
  const hechasSolicitudes = totalSolicitudes - pendientesSolicitudes;

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <p className="text-slate-400 text-sm">Cargando tus clientes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white font-sans">
      {/* CABECERA */}
      <header className="bg-white/80 backdrop-blur border-b border-sky-100 px-6 py-5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">A</div>
          <div>
            <div className="font-bold text-slate-800 leading-none">CLIENTES ATRIO</div>
            <div className="text-slate-400 text-xs">Seguimiento y solicitudes</div>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 transition"
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>

          {menuAbierto && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-30">
              {MENU_OPCIONES.map((op) => {
                const Icono = op.icon;
                const activo = vista === op.key;
                let badge = null;
                if (op.key === 'sugerencias') {
                  const n = SUGERENCIAS_INICIALES.length - sugerenciasUsadas.length;
                  if (n > 0) badge = n;
                } else if (op.key === 'solicitudes' && pendientesSolicitudes > 0) {
                  badge = pendientesSolicitudes;
                }
                return (
                  <button
                    key={op.key}
                    onClick={() => irA(op.key)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition ${activo ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icono size={16} /> {op.label}
                    </span>
                    {badge != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activo ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {vista === 'solicitudes' ? (
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h1 className="font-bold text-lg text-slate-800">Solicitudes</h1>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Respuestas del formulario "Solicita tu web" · sincronizado {SOLICITUDES_SINCRONIZADAS}
            </p>

            {/* RESUMEN */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-2xl font-bold text-slate-800">{totalSolicitudes}</div>
                <div className="text-xs text-slate-500">Recibidas</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-2xl font-bold text-amber-700">{pendientesSolicitudes}</div>
                <div className="text-xs text-amber-600">Pendientes</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-2xl font-bold text-emerald-700">{hechasSolicitudes}</div>
                <div className="text-xs text-emerald-600">Hechas</div>
              </div>
            </div>

            {totalSolicitudes === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Inbox className="mx-auto mb-3 opacity-40" size={40} />
                <p className="text-sm">Todavía no ha llegado ninguna solicitud desde la web.</p>
                <p className="text-xs mt-1">Cuando lleguen nuevas, pídele a Claude que sincronice esta pestaña.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Negocio</th>
                      <th className="px-4 py-3 font-medium">Contacto</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Estilo</th>
                      <th className="px-4 py-3 font-medium">Mensaje</th>
                      <th className="px-4 py-3 font-medium">Referencia</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.map((r) => {
                      const f = r.fields || {};
                      const yaAgregada = solicitudesAgregadas.includes(r.id);
                      const estado = estadoSolicitudes[r.id] || 'pendiente';
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 align-top">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => marcarEstadoSolicitud(r.id, estado === 'pendiente' ? 'hecho' : 'pendiente')}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border whitespace-nowrap transition ${
                                estado === 'hecho'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              {estado === 'hecho' ? <Check size={12} /> : <Clock size={12} />}
                              {estado === 'hecho' ? 'Hecho' : 'Pendiente'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatearFecha(r.createdTime)}</td>
                          <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{f['Nombre'] || f['Name'] || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{f['Negocio'] || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {f['Email'] && (
                                <a href={`mailto:${f['Email']}`} className="flex items-center gap-1 text-blue-500 hover:text-blue-700 whitespace-nowrap">
                                  <Mail size={12} /> {f['Email']}
                                </a>
                              )}
                              {f['Telefono'] && (
                                <a href={`tel:${f['Telefono'].replace(/\s/g, '')}`} className="flex items-center gap-1 text-blue-500 hover:text-blue-700 whitespace-nowrap">
                                  <Phone size={12} /> {f['Telefono']}
                                </a>
                              )}
                              {!f['Email'] && !f['Telefono'] && '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{f['Tipo de negocio'] || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{f['Plan'] || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{f['Estilo'] || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-[220px]">
                            <p className="line-clamp-3">{f['Mensaje'] || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {f['Web de referencia'] ? (
                              <a
                                href={f['Web de referencia'].startsWith('http') ? f['Web de referencia'] : `https://${f['Web de referencia']}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-500 hover:text-blue-700 whitespace-nowrap"
                              >
                                <ExternalLink size={12} /> Ver
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => pasarSolicitudALista(r)}
                              disabled={yaAgregada}
                              className={`flex items-center gap-1 font-semibold px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${
                                yaAgregada
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {yaAgregada ? 'Añadida' : <>Pasar a lista <ArrowRight size={12} /></>}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : vista === 'sugerencias' ? (
          <div>
            <h1 className="font-bold text-lg text-slate-800 mb-1">Sugerencias</h1>
            <p className="text-sm text-slate-500 mb-4">
              Negocios encontrados que podrían no tener web propia. Pulsa "Añadir" para pasarlos a tu lista.
            </p>
            <div className="space-y-3">
              {SUGERENCIAS_INICIALES.filter((s) => !sugerenciasUsadas.includes(s.id)).length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-sm">Ya añadiste todas las sugerencias. ¡Pídeme más cuando quieras!</p>
                </div>
              ) : (
                SUGERENCIAS_INICIALES.filter((s) => !sugerenciasUsadas.includes(s.id)).map((s) => (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap hover:border-sky-200 transition">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800">{s.negocio}</h3>
                        <span className="text-xs text-slate-400">· {s.tipo}</span>
                      </div>
                      {s.contacto && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                          <Phone size={13} /> {s.contacto}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{s.notas}</p>
                    </div>
                    <button
                      onClick={() => agregarSugerencia(s)}
                      className="flex items-center gap-1.5 bg-blue-500 text-white font-semibold px-3 py-2 rounded-full text-xs hover:bg-blue-600 transition"
                    >
                      <Plus size={14} /> Añadir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
        <>
        {/* CABECERA DE LA LISTA */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <h1 className="font-bold text-lg text-slate-800">Mi lista</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 font-medium px-3 py-2 rounded-full text-sm hover:border-sky-300 hover:text-sky-600 transition"
            >
              <Download size={15} /> Exportar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-500 text-white font-semibold px-4 py-2 rounded-full text-sm hover:bg-blue-600 transition shadow-sm shadow-blue-200"
            >
              <Plus size={16} /> Nuevo negocio
            </button>
          </div>
        </div>

        {/* AVISO DE SEGUIMIENTOS VENCIDOS */}
        {vencidos > 0 && (
          <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={16} />
            Tienes <strong className="mx-1">{vencidos}</strong> {vencidos === 1 ? 'seguimiento pendiente' : 'seguimientos pendientes'} de contactar.
          </div>
        )}

        {/* RESUMEN */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-8">
          <button
            onClick={() => setFiltro('todos')}
            className={`rounded-2xl border p-3 text-left transition ${filtro === 'todos' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-2xl font-bold text-slate-800">{clientes.length}</div>
            <div className="text-xs text-slate-500">Todos</div>
          </button>
          {ESTADOS.map((e) => (
            <button
              key={e.key}
              onClick={() => setFiltro(e.key)}
              className={`rounded-2xl border p-3 text-left transition ${filtro === e.key ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${e.dot}`} />
                <div className="text-2xl font-bold text-slate-800">{conteos[e.key] || 0}</div>
              </div>
              <div className="text-xs text-slate-500">{e.label}</div>
            </button>
          ))}
        </div>

        {/* BUSCADOR Y ORDEN */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar negocio..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-full border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:border-blue-400 appearance-none cursor-pointer"
            >
              <option value="recientes">Más recientes</option>
              <option value="antiguos">Más antiguos</option>
              <option value="proximo">Próximo contacto</option>
            </select>
          </div>
        </div>

        {/* LISTA */}
        {visibles.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Store className="mx-auto mb-3 opacity-40" size={40} />
            <p className="text-sm">
              {clientes.length === 0
                ? 'Aún no has apuntado ningún negocio. Dale a "Nuevo negocio" para empezar.'
                : 'No hay negocios que coincidan con este filtro.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibles.map((c) => {
              const info = estadoInfo(c.estado);
              const vencido = esVencido(c.proximoContacto);
              const esEmail = c.contacto && c.contacto.includes('@');
              return (
                <div key={c.id} className={`bg-white border rounded-2xl p-4 hover:shadow-md transition ${vencido ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                        <h3 className="font-semibold text-slate-800">{c.negocio}</h3>
                        {c.tipo && <span className="text-xs text-slate-400">· {c.tipo}</span>}
                      </div>

                      {c.contacto && (
                        <a
                          href={esEmail ? `mailto:${c.contacto}` : `tel:${c.contacto.replace(/\s/g, '')}`}
                          className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 mt-1 w-fit"
                        >
                          {esEmail ? <Mail size={13} /> : <Phone size={13} />}
                          {c.contacto}
                        </a>
                      )}

                      <div className="text-xs text-slate-400 mt-1">Añadido: {c.fecha}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={c.estado}
                        onChange={(e) => cambiarEstado(c.id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-full border cursor-pointer ${info.pill}`}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.key} value={e.key}>{e.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => eliminar(c.id)}
                        className="text-slate-300 hover:text-rose-500 transition p-1.5"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Calendar size={14} className={vencido ? 'text-amber-500' : 'text-slate-400'} />
                    <label className="text-xs text-slate-500">Próximo contacto:</label>
                    <input
                      type="date"
                      value={c.proximoContacto || ''}
                      onChange={(e) => guardarCampo(c.id, 'proximoContacto', e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 ${vencido ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-slate-200 text-slate-600'}`}
                    />
                    {vencido && <span className="text-xs text-amber-600 font-medium">Se pasó la fecha</span>}
                  </div>

                  <textarea
                    value={c.notas}
                    onChange={(e) => actualizarCampo(c.id, 'notas', e.target.value)}
                    onBlur={(e) => guardarCampo(c.id, 'notas', e.target.value)}
                    placeholder="Notas (qué le dijiste, cuándo volver a escribir...)"
                    rows={1}
                    className="w-full mt-3 text-sm text-slate-600 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-slate-50 resize-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        {saving && <p className="text-xs text-slate-300 text-center mt-6">Guardando...</p>}
        </>
        )}
      </div>

      {/* MODAL: NUEVO NEGOCIO */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">Nuevo negocio</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Nombre del negocio</label>
                <input
                  autoFocus
                  value={nuevo.negocio}
                  onChange={(e) => setNuevo({ ...nuevo, negocio: e.target.value })}
                  placeholder="Ej: Panadería San Miguel"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Tipo de negocio</label>
                <input
                  value={nuevo.tipo}
                  onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}
                  placeholder="Ej: Panadería, Fontanero, Peluquería..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Teléfono o email</label>
                <input
                  value={nuevo.contacto}
                  onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })}
                  placeholder="Ej: 612 345 678"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Notas (opcional)</label>
                <textarea
                  value={nuevo.notas}
                  onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })}
                  rows={2}
                  placeholder="Ej: Vi que no tiene web, tiene buenas reseñas..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>

            <button
              onClick={agregarCliente}
              disabled={!nuevo.negocio.trim()}
              className="w-full mt-5 bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Añadir a la lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
