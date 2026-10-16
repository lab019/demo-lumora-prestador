// Lumora Saúde — portal do prestador FICTÍCIO, só para demonstração. Estado no localStorage.
const CHAVE = 'lumora.v1';
const USUARIO = 'clinica.equilibrio';
const SENHA_SHA256 = 'f2c5fe6e1e765480e090a4aee8df24e8f20634f016389cff3a1b36a2bd460048';
const LIMITE_SEM_LAUDO = 10;

const BENEFICIARIOS = {
  '00421187330501': { nome: 'Mariana Alves Duarte', plano: 'Lumora Essencial' },
  '00425520941802': { nome: 'João Pedro Ramos', plano: 'Lumora Mais' },
  '00423076661201': { nome: 'Helena Costa Prado', plano: 'Lumora Essencial' },
  '00427741208803': { nome: 'Beatriz Nogueira', plano: 'Lumora Mais' },
};

function estado() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || { sessao: null, pedidos: [] }; }
  catch (e) { return { sessao: null, pedidos: [] }; }
}
function grava(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} }

if (new URLSearchParams(location.search).has('reset')) {
  try { localStorage.removeItem(CHAVE); } catch (e) {}
  history.replaceState(null, '', location.pathname);
}

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// número estável para a mesma solicitação (o ensaio e a gravação mostram o mesmo)
function numero(base) {
  let h = 2166136261;
  for (const c of base) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return String(h % 1000000).padStart(6, '0');
}
const digitos = t => (t || '').replace(/\D/g, '');
const fmtCart = d => d.replace(/^(\d{4})(\d{4})(\d{4})(\d{2})$/, '$1 $2 $3 $4');
function fmtData(dt) { return dt.toLocaleDateString('pt-BR'); }
function emDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

function reiniciar() {
  try { localStorage.removeItem(CHAVE); } catch (e) {}
  location.href = 'index.html';
}

function sair() {
  const s = estado(); s.sessao = null; grava(s); location.href = 'index.html';
}

function solicitar(cart, procedimento, sessoes) {
  const d = digitos(cart);
  const b = BENEFICIARIOS[d];
  if (!b) return { tipo: 'falha', motivo: 'Carteirinha não encontrada. Confira o número e tente de novo.' };
  const n = parseInt(sessoes, 10);
  if (!n || n < 1 || n > 40) return { tipo: 'falha', motivo: 'Informe a quantidade de sessões (de 1 a 40).' };
  const base = `${d}|${procedimento}|${n}`;
  const p = {
    carteirinha: fmtCart(d), beneficiario: b.nome, plano: b.plano, procedimento, sessoes: n,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
  if (n > LIMITE_SEM_LAUDO) {
    Object.assign(p, { tipo: 'pendente', situacao: 'Pendente — laudo médico obrigatório', protocolo: 'P-' + numero(base) });
  } else {
    Object.assign(p, { tipo: 'ok', situacao: 'Autorizada', autorizacao: '2026-' + numero(base), validade: fmtData(emDias(30)) });
  }
  const s = estado(); s.pedidos.push(p); grava(s);
  return p;
}
