# Plano de desenvolvimento — Portal de acompanhamento da OS

## 1. Objetivo

Criar um portal público e seguro para que o cliente acompanhe uma única ordem de serviço por meio de um link rápido ou QR Code, sem precisar criar usuário e senha.

Exemplo de endereço:

```text
https://atendimento2-delta.vercel.app/acompanhar/codigo-seguro
```

O portal deverá apresentar somente informações autorizadas ao cliente. Dados internos da assistência continuarão restritos à equipe.

## Status da implementação — 5 de outubro de 2026

| Fase | Situação | Observação |
| --- | --- | --- |
| 1. Fundação e segurança | Concluída | Migração aplicada, RLS, token em hash, consulta pública controlada, expiração e cancelamento validados. |
| 2. Acompanhamento básico | Concluída com evolução prevista | Página pública, etapas, histórico, equipamento, problema e previsão disponíveis. Endereço, horário e contato aguardam campos próprios da assistência. |
| 3. Administração do link | Concluída | Geração, renovação, cancelamento, cópia, abertura e QR Code disponíveis na OS. |
| 4. Orçamento e financeiro | Concluída | Aprovação, proposta, total recebido e saldo integrados ao acompanhamento. |
| 5. Compartilhamento e comprovante | Concluída | Mensagem pronta, QR Code e impressão do comprovante implementados. |
| 6. Retirada por terceiros | Em desenvolvimento | Configuração geral com chave liga/desliga iniciada; cadastro, confirmação e registro da retirada serão as próximas entregas. |
| 7. Área completa do cliente | Pendente | Evolução posterior com confirmação por telefone ou e-mail. |

## 2. Resultado esperado

Ao final do projeto, a assistência poderá:

- gerar, copiar, cancelar e renovar o link de acompanhamento de uma OS;
- enviar uma mensagem pronta ao cliente pelo canal de sua preferência;
- imprimir o comprovante de entrada com QR Code;
- disponibilizar o andamento da OS em linguagem simples;
- receber a aprovação do orçamento pelo portal;
- apresentar valores pagos e saldo pendente;
- informar quando o equipamento estiver pronto para retirada;
- registrar, em uma fase posterior, a autorização de retirada por terceiros.

## 3. Regras gerais

- O link dará acesso somente a uma OS.
- O endereço usará um código longo, aleatório e impossível de deduzir a partir do número da OS.
- O código original não será armazenado diretamente no banco; será armazenado somente o seu hash.
- Um link cancelado, expirado ou substituído não poderá consultar a OS.
- O link ficará válido enquanto o atendimento estiver aberto e expirará 30 dias após a conclusão.
- A página pública não consultará diretamente as tabelas internas.
- A consulta pública retornará somente campos previamente autorizados.
- O portal deverá funcionar corretamente em celular e computador.
- Páginas administrativas continuarão protegidas por autenticação.

## 4. Fases do desenvolvimento

### Fase 1 — Fundação e segurança

#### Objetivo

Criar a estrutura segura que sustentará o acesso público à ordem de serviço.

#### Desenvolvimento

- Criar uma tabela de links de acompanhamento vinculada à organização e à OS.
- Registrar:
  - organização;
  - ordem de serviço;
  - hash do código de acesso;
  - usuário que gerou o link;
  - data de criação;
  - data do último acesso;
  - data de expiração;
  - data de cancelamento.
- Aplicar RLS e permissões para impedir acesso direto do público à tabela.
- Criar uma função controlada para buscar os dados públicos por meio do hash do código.
- Manter a implementação privilegiada em esquema não exposto e disponibilizar apenas uma função pública de entrada estritamente limitada.
- Liberar no proxy somente a rota exata de acompanhamento.
- Impedir que o portal público receba notas, metadados ou descrições internas dos eventos da OS.
- Criar mecanismo para cancelar links anteriores ao gerar um novo.
- Atualizar a expiração para 30 dias após a conclusão da OS.

#### Critérios de conclusão

- Um código válido retorna somente a OS correspondente.
- Um código inválido, expirado ou cancelado não retorna informações.
- Um link de uma organização não acessa dados de outra.
- O código original não aparece no banco de dados.
- As páginas internas continuam exigindo login.

### Fase 2 — Acompanhamento básico da OS

#### Objetivo

Entregar a primeira versão utilizável do portal para acompanhamento do atendimento.

#### Desenvolvimento

- Criar a rota pública `/acompanhar/[token]`.
- Criar uma página responsiva com a identidade visual do sistema.
- Exibir:
  - número da OS;
  - primeiro nome do cliente;
  - equipamento, marca e modelo;
  - data de entrada;
  - problema informado;
  - prazo estimado;
  - data e hora da última atualização;
  - etapa atual;
  - linha do tempo das etapas;
  - endereço e horário da assistência;
  - botão para entrar em contato.
- Traduzir os status internos para textos próprios para o cliente:

| Status interno | Texto apresentado ao cliente |
| --- | --- |
| Recebido | Equipamento recebido |
| Diagnóstico | Em diagnóstico |
| Aguardando aprovação | Aguardando sua aprovação |
| Em execução | Serviço em andamento |
| Em testes | Em testes finais |
| Pronto para entrega | Pronto para retirada |
| Concluído | Equipamento entregue |

- Montar a linha do tempo somente com mudanças de status.
- Não mostrar observações internas, custos, margens, senhas, responsáveis ou número de série completo.
- Criar telas amigáveis para link inválido, expirado ou cancelado.

#### Critérios de conclusão

- O cliente acompanha a OS sem login.
- A página funciona em celular e computador.
- A atualização de status aparece no portal.
- Nenhuma informação interna é exibida.
- Um link inválido não revela se uma OS existe.

### Fase 3 — Administração do link pela equipe

#### Objetivo

Permitir que a equipe gerencie o acesso do cliente a partir da própria ordem de serviço.

#### Desenvolvimento

- Adicionar a seção **Acompanhamento do cliente** na OS.
- Disponibilizar as ações:
  - gerar link;
  - copiar link;
  - copiar mensagem;
  - exibir QR Code;
  - cancelar acesso;
  - gerar novo link.
- Permitir que gestores e atendentes administrem o link.
- Definir se técnicos poderão apenas visualizar e copiar um link existente.
- Registrar geração, cancelamento e renovação no histórico administrativo.
- Exibir o estado do link: ativo, expirado ou cancelado.

#### Critérios de conclusão

- A equipe consegue gerar e copiar o link sem acessar o banco.
- A renovação cancela o link anterior.
- A interface deixa claro quando o cliente perdeu o acesso.
- As ações respeitam o perfil do usuário.

### Fase 4 — Orçamento e financeiro

#### Objetivo

Concentrar no mesmo portal o acompanhamento, a aprovação do orçamento e o resumo financeiro da OS.

#### Desenvolvimento

- Reaproveitar a estrutura atual do portal de orçamento.
- Quando houver proposta aguardando resposta, exibir:
  - peças e serviços;
  - quantidades;
  - valores unitários;
  - desconto;
  - condições;
  - validade;
  - valor total;
  - botão para aprovação.
- Após a aprovação, mostrar a data e a confirmação da autorização.
- Exibir no resumo financeiro:
  - valor total aprovado;
  - total recebido;
  - saldo pendente.
- Não exibir custo de compra, margem das peças, observações internas do pagamento ou dados contábeis da assistência.
- Manter os pagamentos realizados fora do portal e registrados pela equipe nesta primeira versão.

#### Critérios de conclusão

- O cliente consegue aprovar o orçamento pelo link de acompanhamento.
- A aprovação continua registrada e vinculada à proposta correta.
- O saldo apresentado corresponde aos recebimentos registrados na OS.
- O cliente não consegue alterar valores ou registrar pagamentos manualmente.

### Fase 5 — Compartilhamento e comprovante

#### Objetivo

Facilitar o envio e o uso diário do acompanhamento pela assistência.

#### Desenvolvimento

- Gerar QR Code para o link ativo.
- Adicionar o QR Code ao comprovante de entrada.
- Adicionar uma orientação curta sobre o acompanhamento.
- Criar o botão **Copiar mensagem para o cliente**.
- Usar um texto semelhante a:

> Olá, sua ordem de serviço OS-2026-00002 foi registrada. Acompanhe o atendimento pelo link: [link]. Guarde este endereço, pois ele permite consultar o andamento do seu equipamento.

- Permitir a reimpressão do comprovante com um novo QR Code quando o link for renovado.
- Preparar o fluxo para compartilhamento por WhatsApp, mantendo inicialmente o envio manual.

#### Critérios de conclusão

- O QR Code abre a OS correta.
- A mensagem copiada contém o número da OS e o link ativo.
- O comprovante impresso mantém boa leitura em papel.
- Um QR Code cancelado deixa de funcionar.

### Fase 6 — Autorização de retirada por terceiros

#### Objetivo

Permitir que o cliente autorize outra pessoa a retirar o equipamento com confirmação de identidade e registro da entrega.

#### Desenvolvimento

- Criar em **Configurações → Segurança** a chave **Permitir retirada por terceiros**.
- Manter a chave desativada por padrão para novas assistências.
- Permitir que somente gestores ativem ou desativem o recurso.
- Registrar em auditoria quem alterou a configuração, a data e os valores anterior e novo.
- Ocultar todas as ações de autorização quando o recurso estiver desativado.
- Ao desativar o recurso, impedir novas autorizações e cancelar automaticamente as autorizações pendentes, mantendo o histórico das já utilizadas.
- Permitir que o gestor bloqueie o recurso em uma OS específica, mesmo quando a configuração geral estiver ativa.
- Exibir a ação somente quando a OS estiver em **Pronto para entrega**.
- Solicitar nome e CPF da pessoa autorizada.
- Enviar um código de confirmação ao telefone ou e-mail cadastrado do cliente.
- Registrar:
  - pessoa autorizada;
  - data e hora da autorização;
  - canal utilizado para confirmação;
  - data e hora da retirada;
  - integrante da equipe que entregou o equipamento.
- Permitir que o cliente cancele a autorização antes da entrega.
- Impedir novas alterações depois que a retirada for registrada.

#### Critérios de conclusão

- A funcionalidade permanece indisponível enquanto a chave geral estiver desligada.
- Somente um gestor consegue alterar a chave e a mudança aparece na auditoria.
- Desativar a chave impede novas autorizações sem apagar o histórico existente.
- A autorização não é concluída sem validação do código.
- A equipe consegue conferir a pessoa autorizada no momento da entrega.
- A entrega fica registrada no histórico da OS.
- Uma autorização cancelada não pode ser utilizada.

### Fase 7 — Área completa do cliente

#### Objetivo

Evoluir o link de uma única OS para uma área destinada a clientes recorrentes.

#### Desenvolvimento

- Criar acesso sem senha por telefone ou e-mail.
- Enviar código de seis dígitos para confirmação.
- Manter uma sessão válida por até 30 dias no aparelho do cliente.
- Permitir encerramento de todas as sessões.
- Exibir:
  - todas as ordens do cliente;
  - equipamentos cadastrados;
  - atendimentos em andamento;
  - histórico de serviços;
  - orçamentos;
  - pagamentos e saldos;
  - comprovantes;
  - autorizações de retirada.
- Criar um processo assistido para atualização de telefone ou e-mail.

#### Critérios de conclusão

- A validação identifica corretamente o cliente.
- O cliente acessa somente os próprios dados.
- Alterações de contato não permitem apropriação indevida da conta.
- O link rápido de uma OS continua funcionando independentemente da área completa.

## 5. Primeira entrega recomendada

A primeira publicação deverá reunir as fases 1 a 5:

1. segurança e estrutura do link;
2. página pública de acompanhamento;
3. gerenciamento do link pela equipe;
4. orçamento e resumo financeiro;
5. QR Code, comprovante e mensagem para compartilhamento.

Essa entrega já resolve o acompanhamento diário de uma OS. A autorização por terceiros e a área completa do cliente ficam para uma evolução posterior.

## 6. Plano de testes

Cada fase deverá incluir testes proporcionais ao risco. Antes da publicação da primeira entrega, validar:

- acesso anônimo com link válido;
- bloqueio de link inexistente;
- bloqueio de link expirado;
- bloqueio de link cancelado;
- renovação e cancelamento do link anterior;
- isolamento entre organizações;
- impossibilidade de consultar outra OS;
- proteção das páginas administrativas;
- exibição correta da linha do tempo;
- atualização do status;
- aprovação do orçamento;
- atualização do total pago e saldo;
- ausência de informações internas;
- funcionamento do QR Code;
- impressão do comprovante;
- experiência em celular;
- políticas RLS e permissões das funções;
- análise de segurança do banco antes da publicação.

## 7. Estratégia de publicação

1. Implementar e validar a migração em ambiente de desenvolvimento.
2. Conferir permissões, RLS e funções públicas.
3. Executar testes automatizados e verificações manuais.
4. Publicar a aplicação.
5. Aplicar a migração no Supabase vinculado.
6. Validar um link real em janela anônima.
7. Testar aprovação, atualização de status e cancelamento do link.
8. Acompanhar os primeiros acessos e corrigir eventuais falhas.

## 8. Definição de pronto

Uma fase será considerada concluída quando:

- os critérios de conclusão tiverem sido atendidos;
- os testes correspondentes estiverem aprovados;
- não houver exposição de informações internas;
- a experiência estiver adequada para celular;
- a documentação técnica estiver atualizada;
- as mudanças estiverem versionadas no Git;
- a versão publicada tiver sido validada em ambiente real.
