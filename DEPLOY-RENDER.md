# Guia: Conectar o Backend ao Render (passo a passo)

## Pré-requisitos

- Conta no [Render](https://render.com) (grátis)
- Conta no [GitHub](https://github.com)
- Código do backend na pasta `backend/`

---

## Passo 1: Colocar o backend no GitHub

### 1.1 Criar repositório

1. Acesse [github.com/new](https://github.com/new)
2. Nome sugerido: `voicemod-backend`
3. Marque **Public**
4. Clique em **Create repository** (não precisa adicionar README)

### 1.2 Subir o código

No terminal (na pasta do projeto):

```bash
cd "c:\Users\kauav\OneDrive\Área de Trabalho\Mods\voicemod"
```

**Se ainda não tiver Git inicializado:**

```bash
git init
git add backend/
git add .
git commit -m "Backend VoiceMod para Render"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/voicemod-backend.git
git push -u origin main
```

**Se o repositório for só o backend**, crie uma pasta temporária e copie só o `backend`:

```bash
mkdir voicemod-backend-temp
copy backend\* voicemod-backend-temp\
cd voicemod-backend-temp
git init
git add .
git commit -m "Backend VoiceMod"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/voicemod-backend.git
git push -u origin main
cd ..
```

> Substitua `SEU-USUARIO` pelo seu usuário do GitHub.

---

## Passo 2: Criar conta no Render

1. Acesse [render.com](https://render.com)
2. Clique em **Get Started**
3. Escolha **Sign up with GitHub**
4. Autorize o Render a acessar seu GitHub

---

## Passo 3: Deploy do Web Service

1. No [Dashboard do Render](https://dashboard.render.com), clique em **New +** → **Web Service**
2. Conecte o repositório:
   - Se aparecer a lista de repos, escolha `voicemod-backend`
   - Se não, clique em **Connect account** e autorize o acesso
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `voicemod-backend` (ou outro nome) |
| **Region** | Oregon (US West) ou o mais próximo de você |
| **Root Directory** | `backend` *(se o backend estiver dentro de backend/)* ou deixe em branco |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

4. Em **Instance Type**, escolha **Free** (para começar)
5. Clique em **Create Web Service**

---

## Passo 4: Aguardar o deploy

1. O Render vai clonar o repo, rodar `npm install` e `node server.js`
2. Quando o status ficar **Live** (verde), o serviço está no ar
3. A URL será algo como: `https://voicemod-backend-xxxx.onrender.com`

---

## Passo 5: Conferir a URL do backend

1. No serviço, clique em **Open** ou copie a URL (ex: `https://voicemod-backend-xxxx.onrender.com`)
2. Teste no navegador: `https://sua-url.onrender.com/positions`  
   - Deve retornar 404 (é esperado, pois POST é o método certo)
3. O backend aceita:
   - **POST** `https://sua-url.onrender.com/positions` – plugin envia posições
   - **WebSocket** `wss://sua-url.onrender.com` – clientes de voz

---

## Passo 6: Configurar o plugin para usar o Render

1. Abra `voicemod.properties` (na pasta do plugin no servidor)
2. Configure:

```properties
backend.url=https://voicemod-backend-xxxx.onrender.com
```

3. Salve e use `/voicemod reload` no servidor (ou reinicie)

---

## Passo 7: Conectar clientes de voz

- WebSocket: `wss://voicemod-backend-xxxx.onrender.com`
- Use **wss** (não ws) e **https** (não http) em produção

---

## Importante: plano Free do Render

| Aspecto | Comportamento |
|---------|---------------|
| **Sleep** | O serviço entra em modo de espera após ~15 min sem tráfego |
| **Wake** | A primeira requisição pode demorar ~30–60 s para “acordar” |
| **Cold start** | Se o plugin enviar POST a cada 100ms, o serviço tende a ficar acordado |

Se o servidor Hytale ficar ligado o tempo todo enviando posições, o backend normalmente não dorme. Se o servidor for desligado por um tempo, a próxima conexão pode ter um pequeno atraso no primeiro request.

---

## Resumo rápido

1. Suba o `backend/` no GitHub  
2. Crie Web Service no Render vinculado ao repo  
3. Build: `npm install` | Start: `node server.js`  
4. Copie a URL `https://...onrender.com`  
5. Configure `backend.url` no plugin  
6. Clientes usam `wss://...onrender.com` para WebSocket  
