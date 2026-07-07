import { supabase } from './lib/supabaseClient';
import React, { useState, useEffect } from 'react';
import initialData from './data.json';
import { AuthGuard } from './components/AuthGuard';

function App() {
  // 1. Estado principal (los datos que se guardan en Supabase)
  const [gameState, setGameState] = useState(initialData);
  const [loadingDB, setLoadingDB] = useState(true);

  // 2. Estados de la interfaz (para que los inputs funcionen correctamente)
  const [isEditingSaldo, setIsEditingSaldo] = useState(false);
  const [nuevoSaldoInput, setNuevoSaldoInput] = useState('');
  const [isAddingFuga, setIsAddingFuga] = useState(false);
  const [newFuga, setNewFuga] = useState({ establecimiento: '', valor: '', cuotas: '', interes: '' });
  const [valorAbono, setValorAbono] = useState('');
  const [interesesAbono, setInteresesAbono] = useState('');
  const [cuotaManejoAbono, setCuotaManejoAbono] = useState('');

  // 3. Efecto para cargar datos al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('dashboard_data')
        .select('game_state')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setGameState(data.game_state);
      } else {
        await supabase.from('dashboard_data').insert([{ user_id: user.id, game_state: initialData }]);
      }
      setLoadingDB(false);
    };
    cargarDatos();
  }, []);

  // 4. Efecto para guardar automáticamente cada vez que cambie gameState
  useEffect(() => {
    if (loadingDB) return; 

    const guardarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('dashboard_data')
        .update({ game_state: gameState, updated_at: new Date() })
        .eq('user_id', user.id);
    };
    guardarDatos();
  }, [gameState, loadingDB]);

  // Funciones auxiliares
  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const formatCOP = (valor) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);

  const reiniciarTablero = () => {
    const seguro = window.confirm("⚠️ ALERTA: ¿Estás totalmente seguro?");
    if (seguro) setGameState(initialData);
  };

  const handleChecklistChange = (id) => {
    setGameState((prev) => ({
      ...prev,
      checklist_bbva: prev.checklist_bbva.map((item) => item.id === id ? { ...item, hecho: !item.hecho } : item),
    }));
  };

  const guardarNuevoSaldo = () => {
    if (nuevoSaldoInput !== '') {
      setGameState((prev) => ({
        ...prev,
        resumen_global: { ...prev.resumen_global, saldo_actual: Number(nuevoSaldoInput) },
      }));
    }
    setIsEditingSaldo(false);
    setNuevoSaldoInput('');
  };

  const registrarAbonoGlobal = (e) => {
    e.preventDefault();
    const montoTotal = Number(valorAbono);
    const cobroIntereses = Number(interesesAbono) || 0; 
    const cobroManejo = Number(cuotaManejoAbono) || 0;
    const abonoCapital = montoTotal - cobroIntereses - cobroManejo;

    if (montoTotal > 0 && abonoCapital >= 0) {
      setGameState((prev) => ({
        ...prev,
        resumen_global: { ...prev.resumen_global, saldo_actual: prev.resumen_global.saldo_actual - abonoCapital },
      }));
      setValorAbono(''); setInteresesAbono(''); setCuotaManejoAbono('');
    } else {
      alert("Error matemático: Verifica los valores.");
    }
  };

  const pagarCuotaFuga = (id, valorCuota) => {
    setGameState((prev) => ({
      ...prev,
      fugas_de_capital: prev.fugas_de_capital.map((f) => 
        f.id === id && f.cuotas_pagadas < f.cuotas_totales ? { ...f, cuotas_pagadas: f.cuotas_pagadas + 1, saldo_pendiente: f.saldo_pendiente - valorCuota } : f
      )
    }));
  };

  const reversarCuotaFuga = (id, valorCuota) => {
    setGameState((prev) => ({
      ...prev,
      fugas_de_capital: prev.fugas_de_capital.map((f) => 
        f.id === id && f.cuotas_pagadas > 0 ? { ...f, cuotas_pagadas: f.cuotas_pagadas - 1, saldo_pendiente: f.saldo_pendiente + valorCuota } : f
      )
    }));
  };

  const agregarNuevaFuga = (e) => {
    e.preventDefault();
    const saldo = Number(newFuga.valor);
    const cuotas = Number(newFuga.cuotas);
    const interes = Number(newFuga.interes) || 0;

    if (saldo > 0 && cuotas > 0 && newFuga.establecimiento !== '') {
      const nuevaFugaObj = {
        id: `compra-${Date.now()}`,
        establecimiento: newFuga.establecimiento,
        saldo_pendiente: saldo,
        cuotas_totales: cuotas,
        cuotas_pagadas: 0,
        valor_por_cuota: Math.round(saldo / cuotas),
        tasa_interes: interes,
        alerta_roja: interes > 0,
      };
      setGameState((prev) => ({
        ...prev,
        resumen_global: { ...prev.resumen_global, saldo_actual: prev.resumen_global.saldo_actual + saldo },
        fugas_de_capital: [...prev.fugas_de_capital, nuevaFugaObj]
      }));
      setIsAddingFuga(false);
      setNewFuga({ establecimiento: '', valor: '', cuotas: '', interes: '' });
    }
  };

  const generarProyeccionDinamica = () => {
    let saldoSimulado = gameState.resumen_global.saldo_actual;
    return gameState.proyeccion_pagos.map((mes) => {
      if (mes.estado === 'Pagado') return mes;
      let nuevoSaldo = Math.max(0, saldoSimulado - mes.pago);
      saldoSimulado = nuevoSaldo;
      return { ...mes, saldo_restante: nuevoSaldo, estado: nuevoSaldo === 0 ? 'Meta Cumplida 🏆' : mes.estado };
    });
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 font-sans relative">
        <button onClick={cerrarSesion} className="absolute top-4 left-4 bg-gray-800 border border-gray-600 px-4 py-2 rounded-lg text-sm font-bold">🚪 Cerrar Sesión</button>
        <button onClick={reiniciarTablero} className="absolute top-4 right-4 bg-red-900/30 border border-red-800 px-4 py-2 rounded-lg text-sm font-bold">⚠️ Reiniciar</button>

        <div className="max-w-4xl mx-auto space-y-8 mt-14">
          <header className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
            <h1 className="text-2xl font-bold text-gray-400 mb-6">Plan Maestro</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <p className="text-sm text-gray-400">Deuda Actual</p>
                  <button onClick={() => setIsEditingSaldo(!isEditingSaldo)}>✏️</button>
                </div>
                {isEditingSaldo ? (
                  <div className="flex items-center space-x-2">
                    <input type="number" value={nuevoSaldoInput} onChange={(e) => setNuevoSaldoInput(e.target.value)} className="bg-gray-900 p-2 rounded" />
                    <button onClick={guardarNuevoSaldo} className="bg-emerald-600 p-2 rounded">Guardar</button>
                  </div>
                ) : (
                  <h2 className="text-5xl font-black text-emerald-400">{formatCOP(gameState.resumen_global.saldo_actual)}</h2>
                )}
              </div>
              <div className="bg-gray-900/50 p-5 rounded-xl">
                <p className="text-sm font-bold mb-3">Registrar Pago</p>
                <form onSubmit={registrarAbonoGlobal} className="space-y-2">
                  <input type="number" placeholder="Total" value={valorAbono} onChange={(e) => setValorAbono(e.target.value)} className="bg-gray-800 p-2 w-full rounded" />
                  <input type="number" placeholder="Int." value={interesesAbono} onChange={(e) => setInteresesAbono(e.target.value)} className="bg-gray-800 p-2 w-full rounded" />
                  <input type="number" placeholder="Manejo" value={cuotaManejoAbono} onChange={(e) => setCuotaManejoAbono(e.target.value)} className="bg-gray-800 p-2 w-full rounded" />
                  <button type="submit" className="w-full bg-blue-600 p-2 rounded font-bold">Abonar</button>
                </form>
              </div>
            </div>
          </header>

          <section className="bg-gray-800 rounded-2xl p-6">
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-bold">Compras Diferidas</h3>
              <button onClick={() => setIsAddingFuga(!isAddingFuga)} className="bg-gray-700 px-3 py-1 rounded">{isAddingFuga ? 'Cancelar' : '+ Nueva'}</button>
            </div>
            {isAddingFuga && (
              <form onSubmit={agregarNuevaFuga} className="mb-4 bg-gray-900 p-4 rounded-xl space-y-2">
                <input type="text" placeholder="Establecimiento" value={newFuga.establecimiento} onChange={(e) => setNewFuga({...newFuga, establecimiento: e.target.value})} className="bg-gray-800 w-full p-2 rounded" />
                <input type="number" placeholder="Valor" value={newFuga.valor} onChange={(e) => setNewFuga({...newFuga, valor: e.target.value})} className="bg-gray-800 w-full p-2 rounded" />
                <input type="number" placeholder="Cuotas" value={newFuga.cuotas} onChange={(e) => setNewFuga({...newFuga, cuotas: e.target.value})} className="bg-gray-800 w-full p-2 rounded" />
                <button type="submit" className="bg-emerald-600 w-full p-2 rounded font-bold">Guardar</button>
              </form>
            )}
            <div className="space-y-4">
              {gameState.fugas_de_capital.map((fuga) => (
                <div key={fuga.id} className="p-4 bg-gray-700/30 rounded-xl">
                   <div className="flex justify-between">
                     <p className="font-bold">{fuga.establecimiento}</p>
                     <p>{formatCOP(fuga.saldo_pendiente)}</p>
                   </div>
                   <div className="flex gap-2 mt-2">
                     <button onClick={() => reversarCuotaFuga(fuga.id, fuga.valor_por_cuota)} className="bg-gray-600 px-3 rounded">↩️</button>
                     <button onClick={() => pagarCuotaFuga(fuga.id, fuga.valor_por_cuota)} className="flex-1 bg-gray-600 rounded">Abonar {formatCOP(fuga.valor_por_cuota)}</button>
                   </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AuthGuard>
  );
}

export default App;