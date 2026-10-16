// Lumora Saúde — portal do prestador FICTÍCIO, só para demonstração. Estado no localStorage.
// Erro de script aparece na tela (quem opera a demo por automação só vê o que está na página).
function mostraErro(m) { const e = document.getElementById('erro'); if (e) e.textContent = 'Erro na página: ' + m; }
window.addEventListener('error', ev => mostraErro(ev.message));
window.addEventListener('unhandledrejection', ev => mostraErro((ev.reason && ev.reason.message) || String(ev.reason)));
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

// SHA-256 em JS puro: o Web Crypto só existe em contexto seguro, e nem todo navegador automatizado tem.
function sha256Puro(t) {
  const K = [], H = [];
  const frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
  for (let n = 2, c = 0; c < 64; n++) {
    let primo = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { primo = false; break; }
    if (!primo) continue;
    if (c < 8) H[c] = frac(Math.sqrt(n));
    K[c++] = frac(Math.cbrt(n));
  }
  const b = [...new TextEncoder().encode(t)], bits = b.length * 8;
  b.push(0x80); while (b.length % 64 !== 56) b.push(0);
  for (let i = 7; i >= 0; i--) b.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
  const r = (x, n) => (x >>> n) | (x << (32 - n)), W = new Array(64);
  for (let o = 0; o < b.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    [a, bb, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

async function sha256(t) {
  if (!(window.crypto && crypto.subtle)) return sha256Puro(t);
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
