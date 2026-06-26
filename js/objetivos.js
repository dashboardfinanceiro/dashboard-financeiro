// ─── objetivos.js — Widget de Objetivos Financeiros ──────────────────────────
// Importar em app.js: import { initObjetivos, refreshObjetivos } from './objetivos.js';
// Chamar initObjetivos() no window.load
// Chamar refreshObjetivos() dentro de refresh() em app.js

import * as State from './state.js';
import { fmtAbs } from './categorize.js';

// ─── Perfis disponíveis ───────────────────────────────────────────────────────
const PERFIS = {
  equilibrio: {
    nome: '⚖️ Equilíbrio',
    essenciais: 50, lazer: 30, poupanca: 20
  },
  base: {
    nome: '🧱 Base sólida',
    essenciais: 60, lazer: 20, poupanca: 20
  },
  realista: {
    nome: '💪 Realista',
    essenciais: 70, lazer: 20, poupanca: 10
  },
  riqueza: {
    nome: '🚀 Construir riqueza',
    essenciais: 50, lazer: 20, poupanca: 30
  }
};

// Persistir a escolha do perfil em localStorage
let _perfilAtivo = localStorage.getItem('obj_perfil') || null;

// ─── Abrir / Fechar drawer ────────────────────────────────────────────────────
window._toggleObjetivos = function () {
  const drawer  = document.getElementById('objetivosDrawer');
  const overlay = document.getElementById('objetivosOverlay');
  const isOpen  = drawer.classList.contains('open');
  if (isOpen) {
    _closeDrawer(drawer, overlay);
  } else {
    _openDrawer(drawer, overlay);
  }
};

window._closeObjetivos = function () {
  const drawer  = document.getElementById('objetivosDrawer');
  const overlay = document.getElementById('objetivosOverlay');
  _closeDrawer(drawer, overlay);
};

function _openDrawer(drawer, overlay) {
  overlay.classList.remove('hidden');
  // pequeno delay para a transição CSS funcionar
  requestAnimationFrame(() => drawer.classList.add('open'));
  refreshObjetivos();
}

function _closeDrawer(drawer, overlay) {
  drawer.classList.remove('open');
  overlay.classList.add('hidden');
}

// ─── Selecionar perfil ────────────────────────────────────────────────────────
window._selectPerfil = function (perfil) {
  _perfilAtivo = perfil;
  localStorage.setItem('obj_perfil', perfil);
  // Atualizar botões ativos
  document.querySelectorAll('.obj-perfil-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.perfil === perfil);
  });
  _renderDiagnostico();
};

// ─── Calcular totais por pilar com base nos dados atuais ──────────────────────
function _calcularPilares(data) {
  // Usar os PILARES definidos pelo utilizador (State.PILARES)
  // Cada pilar tem p.cats — lista de categorias que lhe pertencem
  const totalRend = data
    .filter(r => r.amount > 0 && r.cat === 'Rendimentos')
    .reduce((s, r) => s + r.amount, 0);

  const gastoLiqCat = (cat) => {
    const saidas   = data.filter(r => r.amount < 0 && r.cat === cat).reduce((s, r) => s + Math.abs(r.amount), 0);
    const entradas = data.filter(r => r.amount > 0 && r.cat === cat && r.cat !== 'Rendimentos').reduce((s, r) => s + r.amount, 0);
    return Math.max(0, saidas - entradas);
  };

  const resultado = {};
  State.PILARES.forEach(p => {
    resultado[p.id] = p.cats.reduce((s, cat) => s + gastoLiqCat(cat), 0);
  });

  return { totalRend, porPilar: resultado };
}

// ─── Mapear pilares do utilizador para os 3 slots do perfil ──────────────────
// Os PILARES do utilizador têm ids: 'essenciais', 'lazer', 'poupanca'
// Estes coincidem exatamente com as chaves dos PERFIS
function _pctAtual(porPilar, totalRend, slot) {
  const val = porPilar[slot] || 0;
  if (totalRend <= 0) return 0;
  return (val / totalRend) * 100;
}

// ─── Gerar conselhos com base no desvio ──────────────────────────────────────
function _gerarConselhos(perfil, pcts) {
  const conselhos = [];
  const p = PERFIS[perfil];

  const desvioEss  = pcts.essenciais - p.essenciais;
  const desvioLaz  = pcts.lazer      - p.lazer;
  const desvioPoup = pcts.poupanca   - p.poupanca;

  // Essenciais
  if (desvioEss > 10) {
    conselhos.push('🏠 Essenciais muito acima do objetivo. Revê Habitação, Telecomunicações ou Seguros — são as categorias com mais margem para reduzir.');
  } else if (desvioEss > 5) {
    conselhos.push('🏠 Essenciais ligeiramente acima. Verifica se há subscrições ou contratos que possas renegociar.');
  } else if (desvioEss < -10) {
    conselhos.push('🏠 Essenciais muito abaixo do objetivo — podes estar a subnotificar despesas fixas ou o mês foi atípico.');
  }

  // Lazer
  if (desvioLaz > 10) {
    conselhos.push('🎉 Lazer acima do objetivo. Restauração e subscrições são as categorias mais fáceis de cortar temporariamente.');
  } else if (desvioPoup < -5 && desvioLaz > 0) {
    conselhos.push('🎉 Reduzir um pouco o lazer libertaria margem para aumentar a poupança.');
  }

  // Poupança
  if (desvioPoup < -10) {
    conselhos.push('💰 Poupança muito abaixo do objetivo. Considera a estratégia "paga-te primeiro": transfere a poupança logo no início do mês antes de gastar.');
  } else if (desvioPoup < -5) {
    conselhos.push('💰 Poupança abaixo do objetivo. Tenta aumentar gradualmente — mesmo +2% por mês faz diferença a longo prazo.');
  } else if (desvioPoup >= 0) {
    conselhos.push('💰 Boa poupança! Tens o pilar mais importante dentro ou acima do objetivo.');
  }

  // Fluxo geral
  const totalGasto = pcts.essenciais + pcts.lazer + pcts.poupanca;
  if (totalGasto > 100) {
    conselhos.push('⚠️ Estás a gastar mais do que ganhas neste período. Prioridade: reduzir despesas antes de pensar em poupança.');
  }

  // Se tudo bem
  if (conselhos.length === 0) {
    conselhos.push('✅ Estás dentro dos objetivos em todos os pilares. Mantém o ritmo!');
  }

  return conselhos;
}

// ─── Render diagnóstico ───────────────────────────────────────────────────────
function _renderDiagnostico() {
  const diagEl      = document.getElementById('objDiagnostico');
  const emptyEl     = document.getElementById('objEmpty');
  const rowsEl      = document.getElementById('objDiagRows');
  const conselhosEl = document.getElementById('objConselhos');
  const mesLabelEl  = document.getElementById('objMesLabel');

  if (!_perfilAtivo || !State.allData.length) {
    diagEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  // Dados filtrados pelo mês ativo (igual ao resto do dashboard)
  const data = State.activeTableMonth === 'all'
    ? State.allData
    : State.allData.filter(r => r.date.slice(0, 7) === State.activeTableMonth);

  if (!data.length) {
    diagEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  // Verificar se o utilizador tem pilares configurados
  const temPilares = State.PILARES.some(p => p.cats.length > 0);
  if (!temPilares) {
    diagEl.classList.add('hidden');
    emptyEl.innerHTML = '<p>Configura os <strong>Pilares financeiros</strong> para veres o diagnóstico.</p>';
    emptyEl.classList.remove('hidden');
    return;
  }

  diagEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  // Mês label
  const nomeMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (State.activeTableMonth === 'all') {
    mesLabelEl.textContent = 'Todos os meses carregados';
  } else {
    const [y, m] = State.activeTableMonth.split('-');
    mesLabelEl.textContent = nomeMes[parseInt(m) - 1] + ' ' + y;
  }

  const { totalRend, porPilar } = _calcularPilares(data);
  const perfil = PERFIS[_perfilAtivo];

  // Calcular % atuais
  const pcts = {
    essenciais: _pctAtual(porPilar, totalRend, 'essenciais'),
    lazer:      _pctAtual(porPilar, totalRend, 'lazer'),
    poupanca:   _pctAtual(porPilar, totalRend, 'poupanca')
  };

  // Definição dos 3 slots a mostrar
  const slots = [
    { id: 'essenciais', label: '🏠 Essenciais', alvo: perfil.essenciais, cor: '#185FA5' },
    { id: 'lazer',      label: '🎉 Lazer',      alvo: perfil.lazer,      cor: '#D85A30' },
    { id: 'poupanca',   label: '💰 Poupança',   alvo: perfil.poupanca,   cor: '#1D9E75' }
  ];

  rowsEl.innerHTML = slots.map(slot => {
    const atual   = pcts[slot.id];
    const delta   = atual - slot.alvo;
    const ok      = Math.abs(delta) <= 3; // tolerância de 3%
    const acima   = delta > 3;
    const dotCor  = ok ? '#1D9E75' : acima ? '#D85A30' : '#BA7517';
    const deltaTxt = (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
    const deltaCor = ok ? '#1D9E75' : acima ? '#D85A30' : '#BA7517';
    // barra: atual vs alvo
    const barPct    = Math.min(atual, 100);
    const targetPct = Math.min(slot.alvo, 100);

    return `<div class="obj-diag-row">
      <div class="obj-diag-dot" style="background:${dotCor};"></div>
      <div class="obj-diag-info">
        <div class="obj-diag-label">${slot.label}</div>
        <div class="obj-diag-sub">objetivo ${slot.alvo}% · atual ${atual.toFixed(1)}% · ${fmtAbs(porPilar[slot.id] || 0)}</div>
        <div class="obj-diag-bar-wrap">
          <div class="obj-diag-bar-atual" style="width:${barPct}%;background:${dotCor};"></div>
          <div class="obj-diag-bar-target" style="left:${targetPct}%;"></div>
        </div>
      </div>
      <div class="obj-diag-delta" style="color:${deltaCor};">${deltaTxt}</div>
    </div>`;
  }).join('');

  // Conselhos
  const conselhos = _gerarConselhos(_perfilAtivo, pcts);
  conselhosEl.innerHTML = `
    <div class="obj-conselhos-box">
      <div class="obj-conselhos-title">💡 Conselhos</div>
      ${conselhos.map(c => `<div class="obj-conselho-item">${c}</div>`).join('')}
    </div>`;
}

// ─── Mostrar botão quando há dados ───────────────────────────────────────────
function _updateBotaoVisivel() {
  const btn = document.getElementById('objetivosBtn');
  if (!btn) return;
  btn.style.display = State.allData.length > 0 ? 'flex' : 'none';
}

// ─── API pública ──────────────────────────────────────────────────────────────
export function initObjetivos() {
  // Restaurar perfil guardado
  if (_perfilAtivo) {
    const btn = document.querySelector(`.obj-perfil-btn[data-perfil="${_perfilAtivo}"]`);
    if (btn) btn.classList.add('active');
  }
}

export function refreshObjetivos() {
  _updateBotaoVisivel();
  // Só re-render o diagnóstico se o drawer estiver aberto
  const drawer = document.getElementById('objetivosDrawer');
  if (drawer && drawer.classList.contains('open')) {
    _renderDiagnostico();
  }
}
