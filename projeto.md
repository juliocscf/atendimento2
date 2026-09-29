**Plano de desenvolvimento — Sistema de atendimento para assistência técnica**

Versão 2.0 · 29/09/2026 · Status: etapa 6 iniciada com agenda persistente, conflitos e modalidades remota/domiciliar.

**1. Objetivo e decisões de produto**

Criar um sistema web moderno, profissional e responsivo para assistência técnica de computadores e notebooks. Unificar atendimento no balcão, remoto e em domicílio, mantendo o histórico do cliente, do equipamento e de cada ordem de serviço (OS).

Requisitos confirmados: uso na própria assistência com possibilidade de filiais; três modalidades de atendimento; identificação curta dos equipamentos; clientes, OS, orçamento, agenda, financeiro básico e histórico; uso em computador, tablet e celular; design moderno e profissional. Desenvolver e validar todo o escopo operacional primeiro; integrar o WhatsApp automático pela API oficial somente na etapa final, com o sistema já funcional.

Decisões confirmadas e propostas técnicas:

| Decisão | Proposta inicial | Situação |
| --- | --- | --- |
| Público | Própria assistência, com estrutura para matriz e filiais | Confirmado pelo usuário |
| WhatsApp | Envio automático pela API oficial na última etapa, após o sistema funcional e validado | Ordem revisada pelo usuário |
| Identidade visual | Tema claro, azul como cor principal, tons neutros e identidade consistente | Direção proposta; nome, logotipo e cores finais a definir |
| Plataforma | Aplicação web responsiva, dependente de conexão na primeira versão | Proposta |
| Tecnologia | Next.js, TypeScript, Tailwind CSS e Supabase | Proposta técnica |
| Banco de dados | Supabase: projeto `epkgzpiczfrhpickxhxk` | Definido pelo usuário; MCP cadastrado e autenticado |

Começar com uma unidade ativa. Preparar cadastro de unidades, permissões e filtros para ativar filiais sem reconstruir os módulos. Clientes e equipamentos pertencem à assistência; OS, agendas e recebimentos identificam a unidade responsável. Usuários terão acesso às unidades autorizadas, e o gestor poderá consultar a visão consolidada. Comercialização como SaaS, assinaturas e administração de lojas independentes ficam fora do escopo atual.

**2. Experiência visual e responsividade**

O design faz parte da primeira entrega e será mantido em todos os módulos.

- Identidade: fundo neutro, superfícies claras, tipografia legível, espaços consistentes, bordas discretas e ícones acompanhados de textos quando necessário.
- Hierarquia: uma ação principal por contexto, títulos claros, códigos de equipamento destacados e indicadores com significado operacional.
- Desktop: menu lateral, busca global, listas com filtros e detalhes da OS bem organizados.
- Tablet: menu recolhível e formulários reorganizados conforme o espaço disponível.
- Celular: navegação compacta, listas em cartões, formulário em uma coluna e acesso fácil a fotos, agenda, telefone e ações da OS.
- Quadro de OS: oferecer lista por status no celular e mudança de etapa por botão, além de qualquer interação de arrastar.
- Formulários: campos obrigatórios mínimos, erros junto ao campo, preservação do preenchimento em falhas e confirmação após gravação real.
- Estados de interface: carregamento, vazio, erro, sucesso, acesso negado e conexão indisponível.
- Acessibilidade: navegação por teclado, foco visível, rótulos, contraste e status compreensíveis sem depender apenas de cor. Meta de projeto: WCAG 2.2 AA, sujeita a verificação.
- Área de toque: buscar pelo menos 44 × 44 px para ações principais no celular, como escolha de usabilidade do produto.
- Impressão: layouts próprios para etiqueta, recebimento, orçamento e entrega, sem menus da aplicação.

Validação visual: testar larguras de 360, 390, 768, 1024 e 1440 px; verificar também reflow a 320 CSS px e ampliação. Formulários e páginas não podem exigir rolagem horizontal. Tabelas realmente extensas podem ter uma região própria de rolagem, com alternativa legível para tarefas essenciais no celular. Referência: [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Primeiro protótipo: painel, lista de OS, abertura de atendimento, detalhes do equipamento e agenda. Usar exemplos realistas, incluindo nomes longos e atendimentos atrasados. Tema escuro fica para uma evolução, após consolidar o tema principal.

**3. Escopo da primeira versão operacional**

| Módulo | Entrega |
| --- | --- |
| Acesso e equipe | Login, recuperação de acesso, usuários convidados e permissões por função |
| Matriz e filiais | Unidade responsável, acesso por unidade e visão consolidada do gestor; uma unidade ativa inicialmente |
| Clientes | Nome, telefone, contatos e endereços; documento fiscal quando necessário; pesquisa e alerta de possível duplicidade |
| Equipamentos | Código permanente, marca, modelo, série opcional, configuração, fotos e histórico |
| Entrada no balcão | Defeito relatado, acessórios, estado físico, checklist, responsável e comprovante |
| Ordens de serviço | Modalidade, prioridade, técnico, prazo, diagnóstico, atividades, status e histórico de alterações |
| Orçamentos | Peças, mão de obra, desconto, validade, versões e registro de aprovação ou recusa |
| Agenda | Visitas e sessões remotas por técnico, duração prevista, reagendamento e alerta de conflito |
| Atendimento remoto | Autorização registrada, ferramenta externa utilizada, duração e resumo técnico |
| Atendimento domiciliar | Endereço, referência, acesso ao mapa, taxa combinada, chegada, saída e conclusão pelo celular |
| Execução e entrega | Checklist de testes, peças aplicadas, relatório, retirada ou conclusão e vínculo de retorno em garantia |
| Financeiro básico | Entrada, saldo, recebimentos parciais, formas de pagamento, custos e estornos auditados |
| Comunicação | Registro manual de contatos e orientações, documentos para impressão e cópia de link seguro do portal |
| Portal do cliente | Consulta da OS e aprovação da versão vigente do orçamento por acesso seguro e limitado |
| Painel | Pendências, atrasos, orçamentos sem resposta, agenda do dia, equipamentos prontos e valores a receber |

O controle financeiro inicial registra recebimentos. Integração bancária, conciliação automática e emissão fiscal são evoluções separadas. O suporte remoto utiliza uma ferramenta existente; não inclui desenvolver um programa próprio de acesso remoto.

**3.1. Funcionamento antes da integração com WhatsApp**

- Todos os módulos operacionais, incluindo portal, orçamento, agenda e financeiro, devem funcionar sem conta, número, credenciais ou API do WhatsApp.
- A equipe poderá imprimir documentos, copiar links seguros e registrar contatos realizados por seus canais habituais.
- O cliente poderá aprovar pelo portal. Para aceite obtido presencialmente ou por outro canal, a equipe registrará a versão do orçamento, o responsável pelo registro, a data, o canal e a evidência, distinguindo esse registro da aprovação direta do cliente no portal.
- Acesso e recuperação de conta do portal usarão mecanismo independente do WhatsApp.
- Pendências de aprovação, agendamento e retirada ficam visíveis no painel; o acompanhamento inicial é feito pela equipe.
- Não implementar nesta fase fila de mensagens, caixa de entrada do WhatsApp, callbacks, modelos da Meta ou telas de conexão. A etapa final adicionará esses recursos aos módulos já validados.

**3.2. Especificação reservada para a etapa final de WhatsApp**

Esta especificação será executada somente após a conclusão das etapas 1 a 7. Não é requisito para o primeiro piloto ou lançamento operacional.

Proposta de integração: WhatsApp Business Platform via Cloud API da Meta. Validar conta empresarial, número e condições de ativação ao iniciar a etapa final. Começar com um número central da assistência e associar mensagens à OS e à unidade; avaliar números por filial quando necessário.

Eventos iniciais: confirmação de recebimento do equipamento, orçamento disponível com link seguro, confirmação/lembrete de agendamento, equipamento pronto e conclusão do atendimento. O gestor poderá habilitar eventos e definir horários e frequência de lembretes.

- Registrar a preferência e autorização de contato do cliente; respeitar descadastro, evitando novos envios automáticos a quem os recusou.
- Usar modelos aprovados quando exigidos. A política vigente prevê mensagens livres dentro da janela de atendimento de 24 horas após mensagem do cliente e modelos aprovados fora dela. Conferir novamente as regras antes da ativação. Fonte: [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy).
- Criar uma fila persistente na mesma transação do evento de negócio para não perder notificações após salvar a OS.
- Deduplicar eventos e controlar tentativas. Em falhas transitórias, tentar novamente com intervalo crescente e limite; falhas permanentes geram pendência para a equipe. Resultado incerto após timeout exige reconciliação, evitando reenvio cego.
- Registrar estados como em fila, aceito pela API, enviado, entregue, lido quando informado e falhou. Aceite da requisição não significa entrega ao cliente.
- Receber callbacks da plataforma, validar assinatura e deduplicar notificações. Eventos repetidos ou fora de ordem não podem regredir o estado da mensagem.
- Exibir respostas recebidas em uma caixa de entrada simples e permitir atendimento humano conforme a janela e os modelos aplicáveis. Quando houver várias OS para o mesmo telefone, solicitar associação pela equipe em vez de adivinhar.
- Não enviar notas internas, senhas ou custos de peças. Links compartilhados devem expirar e ter acesso limitado ao cliente.
- Se a integração estiver indisponível, preservar o atendimento e apresentar a falha com ação de recuperação. A OS não depende do sucesso do WhatsApp para ser salva.

Dependências externas exclusivas do piloto da integração: configuração da conta e do número, credenciais guardadas no servidor, endpoint HTTPS, modelos aprovados e orçamento de uso conforme preços vigentes. Validar a situação do número já utilizado pela loja antes de qualquer migração. Desenvolver com número/ambiente de teste; a conclusão da integração requer teste real controlado com um destinatário autorizado. Essas dependências não bloqueiam a entrega do sistema operacional.

Referência técnica disponível: [exemplos oficiais da Meta para Cloud API e validação de webhooks](https://github.com/fbsamples/whatsapp-api-examples). O acesso a partes da documentação de desenvolvedores pode exigir login.

**4. Identificação dos equipamentos**

- Código visível de quatro caracteres, por exemplo `A7K9`, gerado automaticamente e permanente durante a vida do cadastro.
- Alfabeto: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, com 32 símbolos; capacidade teórica de 32⁴ = 1.048.576 códigos por empresa.
- Não exigir necessariamente uma letra e um número em cada código; essa restrição reduziria a capacidade indicada.
- Unicidade garantida pelo banco por empresa, compartilhada entre suas filiais. Geração com nova tentativa limitada quando ocorrer colisão, inclusive em cadastros simultâneos.
- Usar um identificador interno independente do código curto; não reutilizar códigos de cadastros arquivados.
- Etiqueta com código, QR Code e identificação da loja. A dimensão final será definida conforme a impressora disponível.
- O QR Code da etiqueta abre a ficha para a equipe autenticada. Não contém dados pessoais, senhas ou autorização pública permanente.
- Busca pelo código funciona com letras minúsculas ou maiúsculas. Número de série do fabricante continua como campo separado.
- Cada OS possui número próprio, como `OS-2026-00123`. Retorno do mesmo equipamento gera outra OS vinculada ao histórico.

**5. Fluxos e regras de negócio**

Fluxo principal: abertura → diagnóstico → aguardando aprovação → execução → testes → pronto para entrega → entregue/concluído.

Os fluxos remoto e domiciliar podem terminar em concluído após os testes, sem exigir retirada física. A OS registra as modalidades utilizadas ao longo do atendimento; mudar de remoto para balcão preserva as informações anteriores.

- Pausas: guardar motivo e data, como aguardando peça ou resposta do cliente. Exibir o tempo parado.
- Cancelamento e recusa: registrar motivo e possíveis valores previamente combinados, sem apagar o histórico.
- Diagnóstico e autorização: registrar o escopo autorizado na entrada e eventual taxa de diagnóstico. Reparos e despesas adicionais dependem do aceite correspondente.
- Orçamento: aprovação vincula cliente, versão, itens, valor e momento do aceite. Alteração comercial relevante cria nova versão e solicita novo aceite.
- Entrada com vários equipamentos: criar uma OS por equipamento, permitindo vínculo ao mesmo recebimento. Serviços de rede ou suporte geral podem ter OS sem equipamento.
- Agenda: alertar sobre sobreposição de horários e considerar duração e deslocamento informados. Impedir que dois agendamentos conflitantes sejam confirmados simultaneamente sem tratamento explícito.
- Cobrança: usar valores monetários exatos; calcular totais no servidor; impedir repetição de recebimentos causada por duplo clique ou reenvio.
- Separar situação financeira de situação técnica. A política de entrega com saldo pendente será configurável para o gestor, com justificativa registrada.
- Garantia: registrar condições aplicáveis ao serviço e relacionar o retorno à OS original; não transformar todo retorno automaticamente em serviço gratuito.
- Estoque: inicialmente registrar peças e seus custos na OS. Reserva, baixa de estoque e compras entram na etapa de evolução.
- Histórico: arquivar cadastros referenciados em vez de removê-los de forma a quebrar OS anteriores.

**6. Perfis e proteção de dados**

| Perfil | Acesso proposto |
| --- | --- |
| Gestor | Configurações, equipe, preços, operação, financeiro e relatórios |
| Atendimento | Clientes, equipamentos, abertura, agenda, orçamento e entrega; recebimentos somente se autorizado |
| Técnico | OS e agenda autorizadas, diagnóstico, atividades, fotos e testes; sem acesso geral ao financeiro |
| Financeiro | Recebimentos, estornos e relatórios necessários, sem acesso a credenciais técnicas |
| Cliente | Apenas informações e ações explicitamente compartilhadas com ele |

Permissões serão verificadas no servidor e no banco, além da interface, incluindo o escopo de unidades. Uma pessoa pode acumular funções. O cadastro compartilhado de clientes/equipamentos e o acesso às OS de outras unidades terão permissões explícitas. Notas internas, custos e dados de outros clientes não aparecem no portal.

Arquivos ficam privados, com validação de tipo/tamanho e acesso temporário autorizado. Links de portal serão revogáveis e expiráveis, com identificadores imprevisíveis e verificação adicional para ações sensíveis. O código de quatro caracteres nunca será senha ou autorização.

Priorizar credenciais temporárias fornecidas para o atendimento. Se for indispensável armazená-las, entregar antes um mecanismo específico com criptografia, acesso restrito, auditoria e descarte ao término; não gravar senhas em observações, mensagens ou registros de erro.

Registrar alterações de status, preço, responsável, aprovação, pagamento e permissões. Planejar retenção, exportação e exclusão controlada dos dados. Essas definições serão detalhadas conforme a operação e as obrigações aplicáveis, sem presumir conformidade jurídica apenas pela implementação.

**7. Arquitetura proposta**

Uma aplicação organizada em módulos, com regras de negócio centralizadas e um banco relacional. Essa estrutura permite entregar e manter a primeira versão com pouca complexidade operacional.

| Camada | Proposta e finalidade |
| --- | --- |
| Interface e servidor web | Next.js com TypeScript; páginas, navegação e operações de negócio |
| Estilo | Tailwind CSS e componentes reutilizáveis com padrões de acessibilidade |
| Dados | PostgreSQL no Supabase, com migrações versionadas |
| Identidade e arquivos | Supabase Auth e Storage privado |
| Autorização | Verificação no servidor e políticas de acesso por linha no banco |
| Integrações | Módulo de WhatsApp separado, acrescentado na etapa final; operação principal independente de mensagens externas |
| Qualidade | Verificação de tipos, lint, testes de regras críticas e testes dos fluxos no navegador |
| Operação | Ambientes separados, registros de erro sem segredos, monitoramento e restauração testada |

Next.js documenta suporte a TypeScript, App Router e integração com Tailwind em seu [guia de instalação](https://nextjs.org/docs/app/getting-started/installation). Supabase fornece PostgreSQL integrado a Auth e Storage, conforme sua [documentação de banco](https://supabase.com/docs/guides/database/overview).

Entidades da primeira versão operacional: empresa, unidade, usuário e vínculos de função/unidade, cliente, contato, endereço, equipamento, OS, evento de modalidade/status, checklist, anexo, versão e item de orçamento, aceite, agendamento, sessão remota, atividade, recebimento, estorno, registro de contato e registro de auditoria.

Entidades adicionadas apenas na etapa final de WhatsApp: preferência de envio automático, modelo de mensagem, conversa, mensagem, evento de entrega e fila de envio. A integração utilizará os registros do sistema existente por meio de migrações incrementais, preservando os dados operacionais.

Integridade: cliente, equipamento, OS e anexos vinculados devem pertencer à mesma empresa. A unidade responsável precisa pertencer à assistência e estar no escopo autorizado do usuário. Tratar concorrência em alterações de orçamento, status, código e agenda. Datas de eventos serão armazenadas com referência temporal consistente e apresentadas no fuso da loja; moeda inicial BRL e interface pt-BR.

Aplicar RLS e permissões de operação nas tabelas expostas e validar acessos permitidos e negados, conforme a [documentação de segurança do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). Chaves privilegiadas permanecem apenas no servidor. Revisar documentação e versões antes de implementar; não fixar versões neste plano.

Definir hospedagem, região, domínio, e-mail transacional, capacidade e custos antes da publicação. Backup deverá cobrir banco e arquivos separadamente: a [documentação do Supabase](https://supabase.com/docs/guides/database/overview) distingue o backup do banco dos objetos do Storage.

**7.1. Projeto Supabase deste sistema**

- URL da API: `https://epkgzpiczfrhpickxhxk.supabase.co`.
- Identificador do projeto: `epkgzpiczfrhpickxhxk`.
- Nome do MCP no Codex: `supabase-atendimento-2`.
- Endpoint MCP: `https://mcp.supabase.com/mcp?project_ref=epkgzpiczfrhpickxhxk`.
- Autenticação: OAuth do Supabase concluído; nenhuma senha ou chave foi adicionada a este documento.
- Registro separado na configuração do Codex, preservando o servidor existente `supabase-outsourcing` e seu vínculo com outro projeto.
- Usar este MCP nas operações de banco deste sistema. Se uma ferramenta exigir `project_id`, informar explicitamente `epkgzpiczfrhpickxhxk`.
- Verificação realizada: o Codex reconhece o novo servidor como ativo com OAuth e o endpoint correto. A consulta autenticada ao banco deverá ser verificada quando as ferramentas desse novo MCP forem disponibilizadas na conversa.

A URL da API Supabase e a URL do servidor MCP têm finalidades diferentes. O vínculo acima configura o acesso de desenvolvimento pelo MCP; a conexão da aplicação será configurada na etapa de fundação com a chave publicável apropriada.

**8. Etapas e critérios de conclusão**

| Etapa | Entregas | Critério para concluir |
| --- | --- | --- |
| 1 — Produto e protótipo | Jornada dos três atendimentos, telas principais, identidade e matriz de permissões | Fluxos demonstráveis em desktop e celular; decisões de operação registradas |
| 2 — Fundação | Projeto, ambientes, autenticação, unidades, permissões, banco, arquivos privados e estrutura visual | Login e restrições funcionando; testes de acesso indevido aprovados |
| 3 — Clientes e equipamentos | Cadastros, busca, código permanente, fotos e etiqueta | Cadastrar e reencontrar equipamento; imprimir etiqueta; não duplicar código sob concorrência |
| 4 — OS e execução | Abertura, checklists, diagnóstico, quadro/lista, atividades e histórico | Completar um atendimento de bancada até a entrega, com rastreabilidade |
| 5 — Orçamento, portal e financeiro | Versões, aprovação segura, documentos, links do portal, registro de contatos, recebimentos e saldo | Cliente aprova a versão válida; aceites manuais identificados; valores corretos e recebimentos sem duplicidade |
| 6 — Remoto e domicílio | Agenda, conflitos, sessões, visitas e execução pelo celular | Completar as duas modalidades e migrar de remoto para balcão sem perder histórico |
| 7 — Sistema funcional, piloto e lançamento | Painel final, revisão de uso, proteção de dados, recuperação e publicação | Todos os módulos operacionais concluídos; cenários críticos aprovados; restauração demonstrada; uso piloto validado sem WhatsApp |
| 8 — Integração final com WhatsApp | Conta/API, modelos aprovados, fila, mensagens automáticas, caixa de entrada e acompanhamento de entrega | Sistema das etapas 1 a 7 já funcional; envio/recebimento reais comprovados; falhas e duplicidades tratadas sem regressões na operação |

Cada etapa entrega uma parte demonstrável e inclui sua própria verificação. A etapa 7 consolida a validação integrada. A primeira versão operacional completa corresponde às etapas 1 a 7 e pode entrar em uso sem WhatsApp. A etapa 8 é a última etapa desta entrega e só começa após esse marco; nenhuma configuração da Meta faz parte dos critérios das etapas anteriores. As evoluções opcionais da seção 10 são um backlog separado do escopo operacional já definido.

Não há prazo fechado nesta versão: tamanho da equipe, integrações contratadas e disponibilidade para validar o piloto ainda não foram definidos. Estimar o calendário após decompor a etapa 1 e medir a primeira entrega funcional.

**9. Cenários obrigatórios antes do uso real**

1. Cliente novo deixa notebook e carregador; equipe registra fotos, emite etiqueta e abre OS.
2. Cliente retorna com o mesmo equipamento; sistema recupera histórico e abre nova OS sem duplicar cadastro.
3. Dois cadastros simultâneos disputam um código; o sistema preserva unicidade e informa falhas de forma recuperável.
4. Cliente aprova um orçamento; uma alteração posterior não reutiliza indevidamente o aceite anterior.
5. Um usuário tenta acessar cliente, OS ou arquivo fora de seu escopo; todos os caminhos relevantes negam acesso.
6. Atendimento remoto vira atendimento na bancada, preservando autorizações e atividades.
7. Técnico agenda e conclui visita no celular; sobreposição de agenda é tratada.
8. Recebimento parcial e saldo final são registrados; repetir a solicitação não duplica cobrança/recebimento.
9. Equipamento retorna para avaliação de garantia com vínculo à OS original.
10. Rede falha ao salvar ou enviar foto; interface não mostra sucesso falso e permite recuperação.
11. Telas críticas funcionam nas larguras definidas, por teclado e com estados de erro e vazio.
12. Banco e arquivos de teste são restaurados em ambiente separado e permanecem vinculados corretamente.
13. Usuário restrito a uma unidade não acessa OS e recebimentos de outra; gestor autorizado consulta ambas. O mesmo equipamento mantém o código ao passar por uma filial.
14. Abertura, orçamento, aprovação no portal ou registro de aceite manual, execução, pagamento e entrega funcionam de ponta a ponta sem configuração do WhatsApp.

Cenários exclusivos da etapa 8, após o sistema funcional:

1. Eventos de WhatsApp duplicados, falhas transitórias e callbacks fora de ordem não causam reenvios indevidos ou estado incorreto.
2. Um cliente que recusou notificações não recebe novos envios automáticos; modelos e janela de atendimento são respeitados.
3. Uma indisponibilidade da integração não impede salvar OS, aprovar orçamento, agendar, receber pagamento ou concluir atendimento.
4. Ativar a integração não dispara mensagens retroativas de atendimentos antigos; o marco de ativação e os eventos elegíveis são explícitos.

Executar testes automatizados nas regras com risco de perda de dados, acesso indevido e erro financeiro; usar revisão visual e testes de uso para comportamento responsivo e impressão. Avaliar busca com massa de dados representativa da loja e registrar a meta de desempenho antes do piloto.

**10. Evoluções priorizadas**

| Prioridade | Evolução | Dependência |
| --- | --- | --- |
| P1 | Estoque, reserva de peças, fornecedores e compras | Cadastro de produtos e definição dos movimentos |
| P1 | Localização física em prateleira/bancada | Etiquetas e processo interno de movimentação |
| P2 | Pagamentos integrados e conciliação | Provedor escolhido e tratamento de notificações duplicadas |
| P2 | Contratos empresariais e horas contratadas | Modelo comercial, vigência e regras de consumo |
| P2 | Leitura de etiqueta/modelo pela câmera | Revisão humana dos dados extraídos |
| P2 | IA para organizar anotações e sugerir resumos | Controle dos dados enviados, avaliação de qualidade e revisão antes de compartilhar |
| P3 | Emissão fiscal | Provedor e requisitos da operação definidos |
| P3 | Aplicação instalável e recursos offline | Necessidade validada e estratégia de sincronização e conflitos |

Diagnósticos, preços e mensagens gerados por IA permanecerão sujeitos à revisão da equipe. A operação principal não dependerá de IA.

**11. Próxima entrega prevista**

Detalhar a etapa 1 e preparar um protótipo navegável do painel, cadastro de equipamento, abertura de OS e agenda, em desktop e celular, incluindo a indicação de unidade, pendências e registros de contato. Nome da assistência e logotipo poderão ser definidos durante essa etapa. A configuração do WhatsApp será tratada somente após o sistema funcional, na etapa 8.

Este arquivo será atualizado conforme decisões e entregas. Apenas este plano foi criado nesta etapa; nenhum serviço externo foi contratado ou publicado.

**11.1. Registro de início da etapa 1**

Foi criado o protótipo navegável local em `D:\PROJETOS\Atendimento-2`, com Next.js, TypeScript, Tailwind CSS e componentes reutilizáveis. A entrega demonstra o painel, ordens de serviço em lista e quadro, detalhes e avanço de status, clientes, equipamentos com código de quatro caracteres, agenda, orçamentos, financeiro e configurações.

O protótipo usa dados ilustrativos e permite criar OS, clientes e equipamentos, persistindo essas simulações somente no navegador. A interface foi preparada para desktop e celular, com estados de vazio, busca, pendências, feedback de gravação e fluxo de três modalidades: balcão, remoto e domicílio. Nenhuma configuração ou chamada do WhatsApp faz parte desta etapa; a integração permanece reservada para a etapa 8, depois que as etapas 1 a 7 estiverem funcionais.

**11.2. Início da etapa 2 — Fundação**

A etapa 1 foi encerrada com o protótipo navegável revisado, tipografia legível, validação de build e publicação sincronizada no repositório. A etapa 2 foi iniciada no projeto Supabase `epkgzpiczfrhpickxhxk`.

Foi aplicada e versionada a fundação inicial do banco, com `organizations`, `units`, `profiles`, `unit_memberships` e `audit_log`, chaves estrangeiras, índices, gatilhos de atualização e RLS. O acesso por unidade e função usa políticas separadas para gestor, atendimento, técnico e financeiro; a integração com WhatsApp continua fora desta etapa.

O projeto recebeu os clientes SSR e de navegador do Supabase, um `proxy.ts` compatível com o Next.js 16 para renovação de sessão e uma rota de diagnóstico somente de leitura em `/api/health/supabase`. As chaves ficam fora do repositório; `.env.example` registra apenas os nomes das variáveis públicas necessárias.

As auditorias de segurança do Supabase estão limpas após o hardening. O advisor de performance apresenta somente índices ainda sem uso, esperado enquanto as tabelas estão vazias; isso será reavaliado após os primeiros módulos operacionais.

**11.3. Autenticação inicial da etapa 2**

Foi adicionada a tela de login com entrada por e-mail e senha, criação de acesso, recuperação de senha e atualização de senha. O callback de confirmação troca o código por sessão, e o encerramento de sessão usa um handler no servidor.

O `proxy.ts` do Next.js 16 renova a sessão com `getClaims()` e redireciona usuários não autenticados para `/login`, preservando a rota de destino. A rota de saúde do Supabase permanece pública e somente de leitura. O perfil é criado automaticamente no cadastro por trigger no `auth.users`.

Validação realizada: build e typecheck passaram; `/login` e `/api/health/supabase` respondem publicamente, enquanto `/` redireciona para o login quando não há sessão. O advisor de segurança do Supabase continua sem alertas.

**11.4. Início da etapa 3 — Clientes e equipamentos**

Foram criadas as entidades reais `clients`, `client_contacts`, `client_addresses`, `devices` e `device_photos`, todas com vínculo à organização, chaves compostas para evitar cruzamento entre unidades, índices de busca e RLS por função.

O código visível do equipamento é gerado exclusivamente no banco com quatro caracteres do alfabeto seguro `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. Ele possui unicidade por organização, não pode ser alterado depois da criação e continua reservado quando o equipamento é arquivado.

Foram adicionados os endpoints autenticados `GET/POST /api/clients`, `GET/POST /api/devices` e `POST /api/onboarding`. A primeira configuração cria a assistência, a unidade Matriz e o vínculo do primeiro usuário como gestor. APIs sem sessão retornam `401` em JSON; a rota de saúde permanece somente de leitura.

As migrações `clients_devices_0004`, `clients_devices_0005_hardening`, `onboarding_0006` e `onboarding_0007_hardening` estão aplicadas no Supabase. A auditoria de segurança permanece sem alertas; os avisos de performance são apenas índices ainda sem uso enquanto as tabelas estão vazias.

**11.5. Integração operacional da etapa 3**

As telas de clientes e equipamentos agora consultam os endpoints reais quando existe uma sessão autenticada e mantêm o protótipo demonstrável como fallback quando a aplicação ainda não está configurada ou o usuário não concluiu o onboarding. Os formulários de cadastro enviam clientes e equipamentos ao Supabase, exibem o código gerado pelo banco e atualizam as listas após a gravação.

Foi criado o bucket privado `device-photos`, com limite de 10 MB, tipos de imagem restritos e políticas de Storage que exigem membro ativo da organização e vínculo do caminho ao equipamento correto. A rota `GET/POST /api/devices/[deviceId]/photos` valida sessão, equipamento, tipo e tamanho, grava o arquivo privado e registra o metadado em `device_photos`; as leituras retornam URLs assinadas temporárias.

A migração `device_photos_storage_0008` está aplicada no projeto `epkgzpiczfrhpickxhxk`. Typecheck e build passaram; o lint permanece sem erros, com apenas avisos de imagens não otimizadas e imports preexistentes não utilizados. A interface de captura/listagem de fotos está disponível no fluxo autenticado da etiqueta. WhatsApp continua reservado para a etapa 8.

**11.7. Correção do onboarding**

O onboarding publicado retornava erro de RLS ao criar a primeira unidade. A migração `onboarding_0009_creator_rpc` corrigiu a transação de criação da organização, unidade, vínculo do gestor e auditoria usando uma função protegida, com validação explícita de sessão, slug e ausência de vínculo organizacional anterior; a execução permanece restrita ao papel `authenticated`.

**11.8. Início da etapa 4 — Ordens de serviço e execução**

Foi criada a fundação real de OS no Supabase com `service_orders`, `service_order_events` e `service_order_tasks`, RLS por organização e função, vínculos compostos com cliente, equipamento e unidade, numeração concorrente no formato `OS-AAAA-00001` e evento automático de abertura. A função `advance_service_order` valida as transições do fluxo antes de registrar o histórico.

Foram adicionados `GET/POST /api/orders` e `GET/PATCH /api/orders/[orderId]`. A interface agora consulta as OS reais quando o usuário está autenticado, abre novas OS pelo formulário existente e atualiza o status pelo drawer; o modo demonstração continua disponível sem sessão ou configuração.

Typecheck, lint e build passaram. O drawer autenticado já busca o histórico de eventos real após abrir uma OS. Checklist, atividades, anexos e comprovante são detalhados na entrega seguinte.

**11.9. Execução da OS e comprovante**

Foi adicionada a migração `service_order_attachments_0011`, com bucket privado de 20 MB e políticas vinculadas à OS. As rotas autenticadas permitem criar e concluir tarefas, anexar arquivos e listar anexos com URLs temporárias.

O drawer da OS agora apresenta atividades, checklist, upload de anexos e links protegidos para os arquivos quando a sessão está conectada ao Supabase. A rota `/ordens/[orderId]/comprovante` gera um comprovante responsivo e imprimível com cliente, equipamento, solicitação, modalidade, status e prazo.

**11.10. Início da etapa 5 — Orçamentos e financeiro**

Foi criada a fundação de `quotes`, `quote_items`, `quote_portal_links` e `service_order_payments`, com versões de orçamento, itens calculados no servidor, aprovação manual/portal, validade, RLS e chave de idempotência para recebimentos. Um gatilho recalcula o total pago da OS após cada recebimento.

Foram adicionados `GET/POST /api/quotes`, `GET/PATCH /api/quotes/[quoteId]` e `GET/POST /api/payments`. A tela de Orçamentos consulta propostas reais quando há sessão autenticada e permite criar uma nova versão com itens, desconto, validade e observações. A tela Financeiro usa os saldos reais retornados pelas OS e permite registrar recebimentos com método, observação e chave de idempotência.

**11.11. Portal seguro de aprovação**

Foi adicionada a emissão autenticada de links temporários para cada versão de orçamento em `POST /api/quotes/[quoteId]/portal-link`. O link usa token aleatório, persiste somente o hash SHA-256 no banco e tem validade configurável entre 1 e 30 dias.

A página pública `/portal/orcamento/[token]` consulta apenas a proposta vigente por uma função SQL com escopo limitado, exibindo cliente, equipamento, solicitação, itens, total e validade. A aprovação é registrada em `POST /api/portal/quotes/[token]/approve`, com bloqueio transacional, verificação de expiração/revogação e canal `portal`; nenhum dado operacional adicional fica exposto ao portador do link.

O build inclui as novas rotas e a migração `quote_portal_0013`. A integração com WhatsApp permanece reservada à etapa 8, depois da validação funcional das etapas anteriores.

**11.12. Início da etapa 6 — Agenda, remoto e domicílio**

Foram criadas as migrações `schedule_remote_home_0015` e `move_extensions_0016`, com `appointments` e `remote_sessions`, RLS por organização, modalidade, técnico responsável, janela de início/fim, endereço, ferramenta externa, taxa de deslocamento, check-in/check-out e restrição de exclusão para impedir sobreposição confirmada do mesmo técnico. A extensão de suporte à restrição foi movida para o schema dedicado `extensions`.

As rotas `GET/POST /api/appointments` e `PATCH /api/appointments/[appointmentId]` validam a OS vinculada, calculam o fim pela duração, retornam conflito como `409` e permitem confirmar, concluir, cancelar ou registrar chegada/saída. A rota `/api/appointments/[appointmentId]/remote-session` registra autorização, ferramenta, início, encerramento e resumo técnico; iniciar a sessão confirma o compromisso e encerrá-la o conclui automaticamente. A rota `/api/appointments/[appointmentId]/events` expõe o histórico protegido de criação, mudanças de status, chegada e saída. A agenda passa a carregar compromissos reais; o formulário de novo compromisso cobre sessões remotas, visitas domiciliares e atendimentos no balcão, e o painel de execução permite concluir a sessão ou a visita sem depender de WhatsApp.
O painel principal também utiliza os compromissos reais do dia quando há sessão autenticada, mantendo pendências e agenda na mesma visão operacional.

**11.6. Etiqueta de equipamento**

Foi adicionada a rota autenticada `/equipamentos/[deviceId]/etiqueta`, com identificação da assistência, código permanente, dados essenciais, QR Code para a ficha protegida e impressão em formato compacto. A ação aparece nos cards de equipamentos carregados do Supabase; o protótipo continua sem simular etiqueta para registros locais de demonstração.

O QR Code não contém dados pessoais nem autorização permanente: aponta para a ficha autenticada do equipamento. A dependência `qrcode` foi adicionada ao projeto. Typecheck, lint e build foram executados após a entrega.
