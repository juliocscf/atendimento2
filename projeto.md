**Plano de desenvolvimento — Sistema de atendimento para assistência técnica**

Versão 1.3 · 28/09/2026 · Status: etapa 1 iniciada com protótipo navegável; projeto Supabase definido e MCP validado em consulta somente de leitura.

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
