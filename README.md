# Arco Solar 🌞

Índice UV em tempo real, rotina de bronzeamento guiada, histórico de exposição
solar e estimativa de vitamina D. PWA instalável, funciona offline (com
estimativa), em PT/EN/ES.

## Estrutura do projeto

```
arco-solar/
├── index.html          # shell da app
├── manifest.json        # PWA — permite "Adicionar ao ecrã principal"
├── sw.js                 # service worker — cache offline + notificações locais
├── css/style.css         # tema escuro + claro automático, acessibilidade
├── js/
│   ├── i18n.js           # traduções PT/EN/ES
│   ├── storage.js        # localStorage seguro (nunca rebenta) + histórico
│   ├── solar-api.js       # Open-Meteo (dados reais) + fallback offline (posição solar)
│   ├── skin.js            # tipos de pele, FPS, cálculo de queimadura e vitamina D
│   ├── timer.js            # lógica do timer da rotina (vibração + som)
│   ├── ui.js               # tudo o que desenha o ecrã e liga os módulos
│   └── app.js               # arranque
├── icons/                # ícones da PWA (gerados)
├── legal/privacy.html      # política de privacidade
├── legal/terms.html         # termos + aviso médico reforçado
├── tests/smoke.test.js       # testes automatizados (Node + jsdom)
└── .github/workflows/test.yml # corre os testes em cada push (CI)
```

## Como publicar a partir do telemóvel (sem PC)

1. No GitHub (app ou github.com no Safari/Chrome), cria um repositório novo, público.
2. Usa **Add file → Upload files** e envia *todos* os ficheiros e pastas desta
   pasta, mantendo a mesma estrutura (o GitHub mobile permite arrastar/escolher
   vários ficheiros de uma vez a partir dos teus Ficheiros).
3. **Settings → Pages** → Branch `main` / `root` → Save.
4. Espera ~1 minuto. Fica disponível em `https://<teu-user>.github.io/<repo>/`.
5. Abre o link no Safari → ícone de partilha → **Adicionar ao Ecrã Principal**
   para instalar como app.

Como o `index.html` está na raiz e todos os caminhos são relativos, funciona
tal e qual sem configuração adicional.

## Correr os testes localmente

```
npm install
npm test
```

Isto corre `tests/smoke.test.js`, que simula: carregamento inicial, mudança de
tipo de pele e FPS, fluxo completo do timer (começar/pausar/retomar/repor),
troca de idioma, pesquisa de cidade, e fallback automático para o modo offline
quando o `fetch` falha. Também corre automaticamente em cada `git push` via
GitHub Actions (`.github/workflows/test.yml`).

## O que está implementado (funcional, testado)

- Dados reais de UV (Open-Meteo) com **fallback automático offline** para uma
  estimativa baseada na posição solar real — a app nunca fica presa num ecrã
  de erro, e o modo estimativa é sempre identificado no ecrã.
- Tipo de pele (Fitzpatrick I–VI) + seletor de FPS real (0/15/30/50) a ajustar
  o tempo estimado até risco de queimadura.
- Estimativa de vitamina D (educativa).
- Rotina de bronzeamento com timer, vibração e som nas transições de fase.
- Histórico de sessões (guardado no dispositivo) com gráfico de barras dos
  últimos 14 dias.
- Partilha de progresso (Web Share API, com fallback para copiar texto).
- PWA instalável, com ícone próprio, funciona offline.
- 3 idiomas (PT/EN/ES), com deteção automática do idioma do dispositivo.
- Onboarding de 3 ecrãs na primeira utilização.
- Tema claro/escuro automático (`prefers-color-scheme`).
- Acessibilidade: alvos de toque ≥44px, contraste corrigido, foco visível,
  `prefers-reduced-motion` respeitado.
- Notificações locais (pede permissão ao clicar no sino) para quando a rotina
  termina — **isto não é push do servidor**, só funciona com a app aberta/em
  segundo plano recente no mesmo dispositivo.
- Páginas de privacidade e termos, com aviso médico reforçado.

## O que fica por fazer — precisa das TUAS contas/credenciais

Não implementei estas por precisarem de contas, chaves ou infraestrutura que
só tu podes criar (não posso inventar credenciais a funcionar a sério):

- **Login e sincronização entre dispositivos** — precisa de um projeto
  Firebase teu (Auth + Firestore). A estrutura do código já separa os dados
  (`storage.js`) de forma a ser simples trocar localStorage por Firestore
  mais tarde.
- **Notificações push reais (servidor a enviar mesmo com a app fechada)** —
  precisa de um backend com chaves VAPID ou de um serviço como OneSignal.
- **Pagamentos/subscrição (Stripe)** — precisa da tua conta Stripe e só faz
  sentido depois de teres utilizadores da beta a validar o produto.
- **App Store / Play Store** — uma PWA não entra nas lojas sem um wrapper
  nativo (ex: Capacitor). É um passo adicional separado deste projeto.
- **Analytics** — não liguei nenhum serviço de terceiros por defeito (evita
  recolher dados sem consentimento). Se quiseres, o sítio mais simples de
  adicionar é um `<script>` do Plausible ou Simple Analytics no `index.html`.

## Aviso

Os cálculos de tempo até queimadura e vitamina D são estimativas educativas,
não substituem aconselhamento dermatológico — ver `legal/terms.html`.
