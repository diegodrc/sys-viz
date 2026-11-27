# sys-viz

Visualizador de arquiteturas de sistemas descritas em JSON. Mostra componentes aninhados que
expandem do macro ao micro, conexões, fluxos passo a passo e a lógica de negócio de cada
requisição (validações, buscas, regras e processos disparados). Funciona 100% no navegador: sem
backend, sem conta, sem enviar dados para lugar nenhum.

## Usar

- **No navegador:** <https://diegodrc.github.io/sys-viz/> — pode ser instalado como app (PWA) e
  continua funcionando offline.
- **Arquivo offline:** baixe
  [`sys-viz.html`](https://github.com/diegodrc/sys-viz/releases/latest/download/sys-viz.html) e
  abra com duplo clique. É um único HTML com tudo embutido; não precisa de internet nem do
  GitHub. Versões anteriores ficam em [Releases](https://github.com/diegodrc/sys-viz/releases).

Os dados ficam no armazenamento local do navegador, separados por endereço: o que está salvo no
site não aparece no arquivo offline, e vice-versa. Para levar seus sistemas de um para o outro,
use **Exportar** (JSON do sistema ou backup completo) e depois **Importar**.

## Gerar um sistema com IA

Em **Gerar com IA**, copie um dos prompts e cole num agente de IA (de preferência um com acesso
aos repositórios do sistema). O agente devolve um JSON que você importa em **Importar**:

| Aba                             | Para quê                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Criar novo sistema              | Descrever o sistema numa conversa.                          |
| Mapear a partir de repositórios | O agente lê deployments, configs, filas e bancos dos repos. |
| Evoluir sistema atual           | Ajustar o sistema aberto.                                   |
| Mapear lógica                   | Mapear as regras de negócio de cada requisição do sistema.  |

## Desenvolvimento

Requer Node 20.19+.

```sh
npm install
npm run dev          # servidor local
npm test             # testes
npm run build        # dist/ (PWA)
npm run build:single # dist-single/sys-viz.html (arquivo offline)
```

A especificação completa está em [SPEC.md](SPEC.md); decisões fora dela, em
[DECISIONS.md](DECISIONS.md).

**Publicação:** todo push em `main` publica o site no GitHub Pages. Para gerar uma release com o
arquivo offline, atualize a versão e envie a tag:

```sh
npm version 1.1.0 -m "chore: release %s"
git push --follow-tags
```
