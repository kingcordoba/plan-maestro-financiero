import React, { useState, useEffect } from 'react';
import initialData from './data.json';

function App() {
  const [gameState, setGameState] = useState(() => {
    const savedData = localStorage.getItem('bbva_transition_data');
    return savedData ? JSON.parse(savedData) : initialData;
  });

  const [isEditingSaldo, setIsEditingSaldo] = useState(false);
  const [nuevoSaldoInput, setNuevoSaldoInput] = useState('');
  
  const [valorAbono, setValorAbono] = useState('');
  const [interesesAbono, setInteresesAbono] = useState('');
  const [cuotaManejoAbono, setCuotaManejoAbono] = useState('');

  const [isAddingFuga, setIsAddingFuga] = useState(false);
  const [newFuga, setNewFuga] = useState({ establecimiento: '', valor: '', cuotas: '', interes: '' });

  const { resumen_global, fugas_de_capital, checklist_bbva, proyeccion_pagos } = gameState;

  useEffect(() => {
    localStorage.setItem('bbva_transition_data', JSON.stringify(gameState));
  }, [gameState]);

  const formatCOP = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(valor);
  };

  const reiniciarTablero = () => {
    const seguro = window.confirm("⚠️ ALERTA: ¿Estás totalmente seguro de reiniciar el tablero? Perderás todos los pagos y ajustes que hayas registrado. Esta acción no se puede deshacer.");
    if (seguro) {
      setGameState(initialData);
    }
  };

  const handleChecklistChange = (id) => {
    setGameState((prevState) => ({
      ...prevState,
      checklist_bbva: prevState.checklist_bbva.map((item) =>
        item.id === id ? { ...item, hecho: !item.hecho } : item
      ),
    }));
  };

  const guardarNuevoSaldo = () => {
    if (nuevoSaldoInput !== '') {
      setGameState((prevState) => ({
        ...prevState,
        resumen_global: {
          ...prevState.resumen_global,
          saldo_actual: Number(nuevoSaldoInput),
        },
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
      setGameState((prevState) => ({
        ...prevState,
        resumen_global: {
          ...prevState.resumen_global,
          saldo_actual: prevState.resumen_global.saldo_actual - abonoCapital,
        },
      }));
      setValorAbono('');
      setInteresesAbono('');
      setCuotaManejoAbono('');
    } else {
      alert("Error matemático: El pago total debe ser mayor o igual a la suma de los intereses y la cuota de manejo.");
    }
  };

  // CORRECCIÓN: Pagar cuota ya NO resta del saldo global, solo actualiza el tracker interno
  const pagarCuotaFuga = (id, valorCuota) => {
    setGameState((prevState) => {
      const nuevasFugas = prevState.fugas_de_capital.map((fuga) => {
        if (fuga.id === id && fuga.cuotas_pagadas < fuga.cuotas_totales) {
          return {
            ...fuga,
            cuotas_pagadas: fuga.cuotas_pagadas + 1,
            saldo_pendiente: fuga.saldo_pendiente - valorCuota,
          };
        }
        return fuga;
      });

      return {
        ...prevState,
        fugas_de_capital: nuevasFugas,
      };
    });
  };

  // CORRECCIÓN: Reversar cuota ya NO suma al saldo global, solo retrocede el tracker interno
  const reversarCuotaFuga = (id, valorCuota) => {
    setGameState((prevState) => {
      const nuevasFugas = prevState.fugas_de_capital.map((fuga) => {
        if (fuga.id === id && fuga.cuotas_pagadas > 0) {
          return {
            ...fuga,
            cuotas_pagadas: fuga.cuotas_pagadas - 1,
            saldo_pendiente: fuga.saldo_pendiente + valorCuota,
          };
        }
        return fuga;
      });

      return {
        ...prevState,
        fugas_de_capital: nuevasFugas,
      };
    });
  };

  // Nota: Agregar una fuga nueva SÍ debe sumar al saldo global, porque significa que usaste la tarjeta de nuevo
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

      setGameState((prevState) => ({
        ...prevState,
        resumen_global: {
          ...prevState.resumen_global,
          saldo_actual: prevState.resumen_global.saldo_actual + saldo,
        },
        fugas_de_capital: [...prevState.fugas_de_capital, nuevaFugaObj]
      }));

      setIsAddingFuga(false);
      setNewFuga({ establecimiento: '', valor: '', cuotas: '', interes: '' });
    }
  };

  const generarProyeccionDinamica = () => {
    let saldoSimulado = resumen_global.saldo_actual;
    
    return proyeccion_pagos.map((mes) => {
      if (mes.estado === 'Pagado') return mes;
      
      let nuevoSaldo = saldoSimulado - mes.pago;
      if (nuevoSaldo < 0) nuevoSaldo = 0;
      saldoSimulado = nuevoSaldo;
      
      let estadoVisual = mes.estado;
      if (nuevoSaldo === 0) estadoVisual = 'Meta Cumplida 🏆';

      return { ...mes, saldo_restante: nuevoSaldo, estado: estadoVisual };
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 font-sans relative">
      
      <button 
        onClick={reiniciarTablero}
        className="absolute top-4 right-4 md:top-8 md:right-12 bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-800 px-4 py-2 rounded-lg text-sm font-bold transition-all"
      >
        ⚠️ Reiniciar Tablero
      </button>

      <div className="max-w-4xl mx-auto space-y-8 mt-10 md:mt-0">
        
        <header className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          <h1 className="text-2xl font-bold text-gray-400 mb-6">Plan Maestro: Transición Financiera</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <p className="text-sm text-gray-400 uppercase tracking-wider">Deuda Actual Bancolombia</p>
                <button 
                  onClick={() => setIsEditingSaldo(!isEditingSaldo)}
                  className="text-gray-500 hover:text-emerald-400 transition-colors"
                >
                  ✏️
                </button>
              </div>

              {isEditingSaldo ? (
                <div className="flex items-center space-x-2 mt-2">
                  <input 
                    type="number" 
                    placeholder="Ej: 2207329"
                    value={nuevoSaldoInput}
                    onChange={(e) => setNuevoSaldoInput(e.target.value)}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white w-full max-w-[200px] focus:outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={guardarNuevoSaldo}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <h2 className="text-5xl font-black text-emerald-400 tracking-tight transition-all duration-300">
                  {formatCOP(resumen_global.saldo_actual)}
                </h2>
              )}
            </div>

            <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
              <p className="text-sm font-bold text-gray-300 mb-3">Registrar Pago a la Tarjeta</p>
              <form onSubmit={registrarAbonoGlobal} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Total Pagado</label>
                    <input 
                      type="number" 
                      placeholder="Ej: 750000"
                      value={valorAbono}
                      onChange={(e) => setValorAbono(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white w-full focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Intereses</label>
                    <input 
                      type="number" 
                      placeholder="Ej: 45000"
                      value={interesesAbono}
                      onChange={(e) => setInteresesAbono(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white w-full focus:outline-none focus:border-red-500 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">C. Manejo</label>
                    <input 
                      type="number" 
                      placeholder="Ej: 24900"
                      value={cuotaManejoAbono}
                      onChange={(e) => setCuotaManejoAbono(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white w-full focus:outline-none focus:border-orange-500 text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Registrar Abono a Capital
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <section className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <span className="bg-red-500 w-3 h-3 rounded-full mr-3 animate-pulse"></span>
                Compras Diferidas
              </h3>
              <button 
                onClick={() => setIsAddingFuga(!isAddingFuga)}
                className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md transition-colors"
              >
                {isAddingFuga ? 'Cancelar' : '+ Nueva Compra'}
              </button>
            </div>

            {isAddingFuga && (
              <form onSubmit={agregarNuevaFuga} className="mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-600 space-y-3">
                <input 
                  type="text" placeholder="¿Qué compraste?" required
                  value={newFuga.establecimiento} onChange={(e) => setNewFuga({...newFuga, establecimiento: e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded p-2 w-full text-sm focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <input 
                    type="number" placeholder="Valor Total" required
                    value={newFuga.valor} onChange={(e) => setNewFuga({...newFuga, valor: e.target.value})}
                    className="bg-gray-800 border border-gray-700 rounded p-2 w-full text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <input 
                    type="number" placeholder="Cuotas" required
                    value={newFuga.cuotas} onChange={(e) => setNewFuga({...newFuga, cuotas: e.target.value})}
                    className="bg-gray-800 border border-gray-700 rounded p-2 w-24 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number" placeholder="% Interés (Opcional)" step="0.01"
                    value={newFuga.interes} onChange={(e) => setNewFuga({...newFuga, interes: e.target.value})}
                    className="bg-gray-800 border border-gray-700 rounded p-2 w-full text-sm focus:border-red-500 focus:outline-none"
                  />
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-sm w-full">
                    Guardar Fuga
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {fugas_de_capital.map((fuga) => {
                const isPaid = fuga.cuotas_pagadas >= fuga.cuotas_totales;
                const canUndo = fuga.cuotas_pagadas > 0;
                
                return (
                  <div 
                    key={fuga.id} 
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      isPaid 
                        ? 'bg-gray-800/40 border-gray-700 opacity-60' 
                        : fuga.alerta_roja 
                          ? 'bg-red-900/20 border-red-500/30' 
                          : 'bg-gray-700/30 border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-bold text-lg ${isPaid ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                        {fuga.establecimiento}
                      </h4>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${isPaid ? 'bg-gray-700 text-gray-400' : fuga.alerta_roja ? 'bg-red-500 text-white' : 'bg-emerald-500 text-gray-900'}`}>
                        {isPaid ? 'Saldado' : `${fuga.tasa_interes}% Interés`}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-sm text-gray-400">Saldo Pendiente</p>
                        <p className="text-2xl font-bold text-gray-300">{formatCOP(fuga.saldo_pendiente)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Cuotas</p>
                        <p className="text-lg font-bold text-white">{fuga.cuotas_pagadas} / {fuga.cuotas_totales}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => reversarCuotaFuga(fuga.id, fuga.valor_por_cuota)}
                        disabled={!canUndo}
                        title="Deshacer pago"
                        className={`px-3 py-2 rounded-lg font-bold transition-colors ${
                          !canUndo ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-red-400 border border-gray-600'
                        }`}
                      >
                        ↩️
                      </button>
                      <button
                        onClick={() => pagarCuotaFuga(fuga.id, fuga.valor_por_cuota)}
                        disabled={isPaid}
                        className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors flex justify-between items-center ${
                          isPaid ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-500 text-white border border-gray-500'
                        }`}
                      >
                        <span>{isPaid ? 'Marcar Progreso' : 'Abonar Cuota'}</span>
                        {!isPaid && <span>{formatCOP(fuga.valor_por_cuota)}</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Auditoría de Documentos</h3>
            <div className="space-y-3">
              {checklist_bbva.map((item) => (
                <label 
                  key={item.id} 
                  className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                    item.hecho ? 'bg-blue-950/20 border-blue-500/40 opacity-60' : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={item.hecho}
                    onChange={() => handleChecklistChange(item.id)}
                    className="mt-1 w-5 h-5 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                  />
                  <div className="ml-3 flex-1">
                    <p className={`font-medium ${item.hecho ? 'line-through text-gray-400' : 'text-gray-200'}`}>
                      {item.tarea}
                    </p>
                    <p className="text-sm text-gray-400">Límite: {item.limite}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 mt-8">
          <h3 className="text-xl font-bold mb-6 text-purple-400 flex items-center">
            📍 Mapa de Ruta hacia Saldo $0
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {generarProyeccionDinamica().map((mes, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-xl border transition-all ${
                  mes.estado === 'Pagado' ? 'bg-emerald-900/20 border-emerald-500/30' : mes.estado.includes('Meta') ? 'bg-purple-900/20 border-purple-500/30' : 'bg-gray-700/30 border-gray-600'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-lg text-gray-200">{mes.mes}</h4>
                  <span className={`text-xs font-bold px-2 py-1 rounded inline-block whitespace-nowrap ${
                    mes.estado === 'Pagado' ? 'bg-emerald-500 text-gray-900' : mes.estado.includes('Meta') ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {mes.estado}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Abono Proyectado</p>
                    <p className="text-lg font-bold text-white">{formatCOP(mes.pago)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Saldo Restante</p>
                    <p className={`text-lg font-bold transition-all ${mes.saldo_restante === 0 ? 'text-purple-400 text-2xl' : 'text-gray-300'}`}>
                      {formatCOP(mes.saldo_restante)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default App;