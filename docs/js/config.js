// Configuração dos serviços do Google (passo a passo no README).
// Vazio = o recurso fica desativado; o resto do app funciona normalmente.

// Backup no Google Drive: "ID do cliente" OAuth (termina em .apps.googleusercontent.com).
export const GOOGLE_CLIENT_ID = '740657322302-9bp0rppniio68dkuaqnbv4ahpij4ae8m.apps.googleusercontent.com';

// Busca no Google Books: "chave de API" (começa com AIza). Sem ela, o Google Books
// usa uma cota gratuita compartilhada por todo mundo, que costuma acabar todo dia.
export const GOOGLE_BOOKS_API_KEY = 'AIzaSyDZ19RdcdFQD8H5c-o773gSKj2GjujCWoA';

// Leitura de posts do Substack: o Substack bloqueia leitura direta pelo navegador.
// Cole aqui o endereço do seu intermediário gratuito na Cloudflare (README, "Intermediário do Substack"),
// ex.: 'https://leituras-proxy.seu-usuario.workers.dev'. Vazio = usa intermediários públicos (menos estáveis).
export const LINK_PROXY_URL = 'https://leituras-proxy.richardvassoler01.workers.dev/';
